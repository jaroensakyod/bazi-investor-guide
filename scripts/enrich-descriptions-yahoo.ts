/**
 * ENRICH descriptions ผ่าน Yahoo Finance quoteSummary (assetProfile.longBusinessSummary)
 *
 * ทำไม: Wikipedia action API โดน rate-limit หนัก (429 ต่อเนื่อง) —
 *   Yahoo เป็นคนละ infrastructure ไม่มี limit ร่วม + ได้ sector/industry/website ฟรี
 *
 * ลำดับแหล่งข้อมูลต่อหุ้น (ไม่ทับของเดิม):
 *   1. description มีอยู่แล้ว → ข้าม
 *   2. .intro-cache.json (Wikipedia ที่เก็บไว้จากรอบก่อน) → ใช้ (lang-aware)
 *   3. Yahoo Finance assetProfile → longBusinessSummary (ตัด ~350 ตัวอักษร)
 *
 * รูปแบบ ticker Yahoo ตาม market: SET/mai=.BK, HKEX=.HK, SSE=.SS, SZSE=.SZ,
 *   TSE(ญี่ปุ่น)=.T, KRX=.KS, HOSE=.VN, ASX=.AX, TSX=.TO, NSE=.NS, US=ไม่มี suffix
 *
 * รัน: npx tsx scripts/enrich-descriptions-yahoo.ts
 *   (resumable: cache ทุก ticker ที่ fetch สำเร็จ — รันซ้ำได้ ไม่เสียงาน)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [path.join(ROOT, "data/stocks/thailand.json"), path.join(ROOT, "data/stocks/global.json")];
const WIKI_CACHE_FILE = path.join(ROOT, "data/stocks/.intro-cache.json");
const YAHOO_CACHE_FILE = path.join(ROOT, "data/stocks/.yahoo-cache.json");

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

/** suffix Yahoo ตามตลาด — ถ้า ticker มี suffix อยู่แล้ว (เช่น 0700.HK) ใช้ตามเดิม */
const YAHOO_SUFFIX: Record<string, string> = {
  SET: ".BK",
  mai: ".BK",
  HKEX: ".HK",
  SSE: ".SS",
  SZSE: ".SZ",
  TSE: ".T", // ญี่ปุ่น (Nikkei) — TSX = แคนาดา ด้านล่าง
  KRX: ".KS",
  HOSE: ".VN",
  ASX: ".AX",
  TSX: ".TO",
  NSE: ".NS",
};

function yahooTicker(s: Record<string, unknown>): string | null {
  let raw = String(s.ticker ?? "").trim();
  if (!raw) return null;
  const mkt = String(s.market ?? "");
  // ฮ่องกง: Yahoo ต้อง zero-pad 4 หลัก (2.HK → 0002.HK)
  if (mkt === "HKEX" && /^\d+\.HK$/.test(raw)) {
    const num = raw.split(".")[0];
    raw = num.padStart(4, "0") + ".HK";
  }
  // หุ้น class (BF.B / BRK.B / GIB.A.TO / AP.UN.TO): Yahoo ใช้ขีด (BF-B / GIB-A.TO / AP-UN.TO)
  if (/^\w+\.\w+\.(TO|AX|VN|BK|NS|T|KS|SS|SZ|HK)$/.test(raw)) {
    raw = raw.replace(".", "-");
  } else if ((mkt.includes("NYSE") || mkt.includes("NASDAQ")) && /^\w+\.\w+$/.test(raw)) {
    raw = raw.replace(".", "-");
  }
  if (raw.includes(".")) return raw; // มี suffix อยู่แล้ว
  if (mkt.includes("NYSE") || mkt.includes("NASDAQ") || mkt === "SP500" || mkt === "US") return raw;
  const suffix = YAHOO_SUFFIX[mkt];
  return suffix ? raw + suffix : raw;
}

/** ตัด summary ให้เหลือ ~350 ตัวอักษร ลงท้ายประโยค */
function truncateSummary(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 350) return clean;
  const cut = clean.slice(0, 350);
  const lastDot = cut.lastIndexOf(". ");
  return lastDot > 150 ? cut.slice(0, lastDot + 1) : cut + "…";
}

/** หา Wikipedia title ที่ควรใช้ (เหมือน enrich-descriptions.ts — ใช้กับ wiki cache) */
function guessTitle(s: Record<string, unknown>): string {
  const raw = String(s.nameEn ?? s.name ?? "").trim();
  return raw
    .replace(/\s+(?:Limited|Ltd|PLC|Corporation|Corp|Incorporated|Inc|Company|Co|Group|Holdings?|Bancorp)[.,]?\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

interface WikiCache {
  [title: string]: { l?: string; i: string } | string;
}

function loadWikiCache(): Map<string, { l?: string; i: string } | string> {
  try {
    const raw = JSON.parse(readFileSync(WIKI_CACHE_FILE, "utf8")) as WikiCache;
    const out = new Map<string, { l?: string; i: string } | string>();
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") out.set(k, v);
      else if (v && typeof v.i === "string") out.set(k, v);
    }
    return out;
  } catch {
    return new Map();
  }
}

/** ลายเซ็นต์หน้า "ไม่ใช่บริษัท" — บทความเพี้ยน (ลูกบอล/เทศกาล/เมือง/คน/โรค...)
 *  ตรงกับ NON_COMPANY ใน cleanup-wrong-descriptions.py */
const NON_COMPANY_PATTERNS =
  /round object|edible fruit|larval stage|festive season|building material|administrative region|writing system|person or thing|literally means|rice paddy|developmental disorders|coldest temperature|climate change|football club|may refer to|may stand for|most often refers to|as an abbreviation|surname|is a genus|is a species|is a city|is a town|is a village|is a commune|is a district|is a province|animator|is a singer|is a footballer|is a politician|municipality|game list|曖昧さ回避|동음이의어|消歧义|维基百科消歧义/i;

/** เช็คว่า intro เอ่ยถึงชื่อบริษัทจริงไหม — reject หน้าเพี้ยน (ไม่ใช่บริษัท) + ต้องมีชื่อโผล่ */
function mentionsCompany(intro: string, s: Record<string, unknown>): boolean {
  if (NON_COMPANY_PATTERNS.test(intro)) return false;
  const d = intro.toLowerCase();
  const candidates: string[] = [];
  for (const key of ["nameEn", "name"] as const) {
    const raw = String(s[key] ?? "").trim();
    if (!raw) continue;
    candidates.push(raw);
    const stripped = raw
      .replace(/\s+(?:Limited|Ltd|PLC|Corporation|Corp|Incorporated|Inc|Company|Co|Group|Holdings?|Bancorp)[.,]?\s*$/i, "")
      .replace(/\s*\([^)]*\)\s*$/g, "")
      .trim();
    if (stripped.length >= 4) candidates.push(stripped);
  }
  const ticker = String(s.ticker ?? "").trim();
  if (ticker.length >= 4) candidates.push(ticker);
  return candidates.some((c) => c.length >= 4 && d.includes(c.toLowerCase()));
}

interface YahooCacheEntry {
  summary?: string;
  sector?: string;
  industry?: string;
  website?: string;
  url?: string;
  notFound?: boolean;
}

function loadYahooCache(): Map<string, YahooCacheEntry> {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(YAHOO_CACHE_FILE, "utf8")) as Record<string, YahooCacheEntry>));
  } catch {
    return new Map();
  }
}

function saveYahooCache(cache: Map<string, YahooCacheEntry>): void {
  writeFileSync(YAHOO_CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 1) + "\n", "utf8");
}

/** fetch quoteSummary ของ ticker — คืน assetProfile หรือ null */
async function fetchAssetProfile(ticker: string, cookie: string, crumb: string): Promise<Record<string, unknown> | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    ticker,
  )}?modules=assetProfile&crumb=${encodeURIComponent(crumb)}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, { headers: { "User-Agent": UA, Cookie: cookie } });
    } catch {
      return null;
    }
    if (res.status === 429 || res.status === 999) {
      const wait = 5000 * (attempt + 1);
      console.log(`    ⏳ Yahoo 429/999 — รอ ${wait / 1000}s (attempt ${attempt + 1}/4)`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) return null;
    try {
      const json = (await res.json()) as { quoteSummary?: { result?: Array<{ assetProfile?: Record<string, unknown> }> } };
      return json.quoteSummary?.result?.[0]?.assetProfile ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

async function main() {
  const wikiCache = loadWikiCache();
  const yahooCache = loadYahooCache();

  // เปิด session + crumb
  let cookie = "";
  let crumb = "";
  try {
    const cj = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "manual" });
    const setCookies = cj.headers.getSetCookie?.() ?? [];
    cookie = setCookies.map((c) => c.split(";")[0]).join("; ");
  } catch {
    /* ignore */
  }
  const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": UA, Cookie: cookie },
  });
  crumb = (await crumbRes.text()).trim();
  if (!crumb || crumbRes.status !== 200) {
    console.log("❌ Yahoo crumb ไม่สำเร็จ — ลองใหม่ทีหลัง");
    process.exit(1);
  }
  console.log(`🔑 Yahoo session OK (crumb=${crumb.slice(0, 8)}…)`);

  // รวมหุ้นที่ยังไม่มี description
  const dbs: Array<{ file: string; db: { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> } }> = [];
  const pending: Array<{ dbIdx: number; stock: Record<string, unknown>; yTicker: string | null }> = [];
  for (const f of FILES) {
    const db = JSON.parse(readFileSync(f, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
    dbs.push({ file: f, db });
    for (const s of db.stocks) {
      if (s.description) continue;
      const yt = yahooTicker(s);
      if (!yt) continue;
      // เช็ค wiki cache ก่อน (lang-aware) — แต่ต้องผ่านตรวจชื่อบริษัท กันหน้าเพี้ยน
      const title = guessTitle(s);
      const hit = wikiCache.get(title) ?? wikiCache.get(String(s.nameEn ?? s.name ?? "").trim());
      if (hit) {
        const lang = typeof hit === "string" ? "en" : (hit.l ?? "en");
        const intro = typeof hit === "string" ? hit : hit.i;
        if (mentionsCompany(intro, s)) {
          s.description = truncateSummary(intro);
          s.businessEvidence = {
            source: lang === "en" ? "Wikipedia intro (auto) — draft รอตรวจ" : `Wikipedia ${lang} intro (auto) — draft รอตรวจ`,
            url: `https://${lang === "en" ? "en" : lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
            quote: String(s.description ?? "").slice(0, 200),
          };
          continue;
        }
        // intro จาก cache ผิด → ปล่อยให้ลอง Yahoo ต่อ
      }
      const cached = yahooCache.get(yt);
      if (cached?.summary) {
        applyYahoo(s, cached);
        continue;
      }
      pending.push({ dbIdx: dbs.length - 1, stock: s, yTicker: yt });
    }
  }
  console.log(`📋 รอ fetch จาก Yahoo: ${pending.length} ตัว`);

  // fetch ทีละตัว (1s ระหว่าง — Yahoo ทนได้ดีกว่า Wikipedia มาก)
  let filled = 0;
  let notFound = 0;
  let i = 0;
  for (const p of pending) {
    i++;
    const profile = await fetchAssetProfile(p.yTicker!, cookie, crumb);
    if (profile) {
      const summary = String(profile.longBusinessSummary ?? "").trim();
      const entry: YahooCacheEntry = {
        summary: summary || undefined,
        sector: String(profile.sector ?? "").trim() || undefined,
        industry: String(profile.industry ?? "").trim() || undefined,
        website: String(profile.website ?? "").trim() || undefined,
        url: `https://finance.yahoo.com/quote/${p.yTicker}`,
      };
      yahooCache.set(p.yTicker!, entry);
      if (summary) {
        applyYahoo(p.stock, entry);
        filled++;
      } else {
        notFound++;
      }
      saveYahooCache(yahooCache);
    } else {
      // ไม่มี profile — ไม่ cache notFound (กัน ticker ที่พลาดชั่วคราวติดถาวร — รอบหน้าลองใหม่)
      notFound++;
    }
    if (i % 25 === 0 || i === pending.length) {
      console.log(`  progress ${i}/${pending.length} (ได้ ${filled}, ไม่พบ ${notFound})`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  // เขียนกลับ
  for (const { file, db } of dbs) {
    db.meta.updatedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(file, JSON.stringify(db, null, 2) + "\n", "utf8");
  }
  console.log(`\n✅ เติม description จาก Yahoo ${filled} ตัว (ไม่พบ ${notFound})`);
  console.log("   ตัวอย่าง:");
  const shown = new Set<string>();
  for (const { db } of dbs) {
    for (const s of db.stocks) {
      const ev = s.businessEvidence as Record<string, unknown> | undefined;
      if (s.description && ev && String(ev.source ?? "").includes("Yahoo") && shown.size < 3) {
        console.log(`   • ${s.ticker} (${s.nameEn ?? s.name}): ${String(s.description).slice(0, 100)}...`);
        shown.add(String(s.ticker));
      }
    }
  }
}

/** เติม description + ข้อมูลฟรี (sector/industry/website เฉพาะช่องว่าง — ไม่ทับซินแส) */
function applyYahoo(s: Record<string, unknown>, entry: YahooCacheEntry): void {
  if (entry.summary) {
    s.description = truncateSummary(entry.summary);
    s.businessEvidence = {
      source: "Yahoo Finance assetProfile (auto) — draft รอตรวจ",
      url: entry.url ?? `https://finance.yahoo.com/quote/${s.ticker}`,
      quote: String(s.description).slice(0, 200),
    };
  }
  if (!s.website && entry.website) s.website = entry.website;
  if (!s.sector && entry.sector) s.sector = entry.sector;
  if (!s.industry && entry.industry) s.industry = entry.industry;
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
