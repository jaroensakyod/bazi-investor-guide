/**
 * ENRICH หุ้น Hang Seng (HKEX): 85 ตัว — แก้ KNOWN-ISSUES #4
 *
 * ปัญหาเดิม: Wikipedia "Hang Seng Index" Components section ให้แค่ sub-index
 *   (Finance/Utilities/Properties/Commerce & Industry) — Commerce & Industry
 *   เป็นหมวดรวม (Tencent tech → PetroChina energy) map ธาตุเดียวไม่ได้
 *   → pipeline เก่าได้แค่ 4-5 ตัว (เฉพาะ Utilities ที่ map ได้)
 *
 * วิธีใหม่:
 *   1. parse 85 rows จาก wikitext (symbol + ชื่อ + sub-index)
 *   2. sub-index ชัดเจน (Finance/Properties/Utilities = 26 ตัว) → map ตรง
 *   3. Commerce & Industry (59 ตัว) → batch ดึง `industry` จาก Wikipedia
 *      infobox รายบริษัท (50 หน้า/request — ประหยัด rate-limit)
 *   4. map industry text → GICS sector → ธาตุ (keyword rules)
 *   5. merge เข้า global.json: อัปเดตตัวที่มีอยู่ + เพิ่มตัวที่ยังไม่มี
 *
 * รัน: npx tsx scripts/enrich-hk-gics.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

type El = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** sub-index ของ Hang Seng → ธาตุ */
const SUBINDEX_TO_ELEMENT: Record<string, El> = {
  Finance: "น้ำ",
  Properties: "ดิน",
  Utilities: "ไฟ",
};

/** keyword → GICS sector (สำหรับ industry text จาก infobox) */
const INDUSTRY_TO_SECTOR: Array<{ kw: RegExp; sector: string }> = [
  { kw: /bank|financial|finance|insurance|securities|investment|asset/i, sector: "Financials" },
  { kw: /petroleum|oil|gas|energy|coal|petrochemical|fuel/i, sector: "Energy" },
  { kw: /electric|power|utility|water/i, sector: "Utilities" },
  { kw: /real estate|property|reit/i, sector: "Real Estate" },
  { kw: /pharmaceutical|biotech|biologics|drug|medical|health|hospital|medication|medicine|pharma/i, sector: "Health Care" },
  { kw: /semiconductor|chip/i, sector: "Semiconductors" },
  { kw: /technology|software|internet|e-commerce|telecom|communication|video game|online|electronics|computer|hardware|artificial intelligence|photovoltaic|solar/i, sector: "Technology" },
  { kw: /automobile|auto|motor|vehicle|car/i, sector: "Automobiles & Components" },
  { kw: /airline|transport|logistics|shipping|railway|express/i, sector: "Transportation" },
  { kw: /steel|metal|mining|aluminum|aluminium|glass|cement|material|chemical/i, sector: "Materials" },
  { kw: /retail|department store|supermarket|consumer|apparel|footwear|textile|hygiene/i, sector: "Consumer Discretionary" },
  { kw: /food|beverage|beer|brew|dairy|snack/i, sector: "Food & Beverage" },
  { kw: /hotel|casino|gaming|restaurant|leisure|travel|tourism/i, sector: "Hotels, Restaurants & Leisure" },
  { kw: /toy|jewelry|jewellery|personal|household/i, sector: "Consumer Products" },
  { kw: /machinery|industrial|equipment|manufacturing/i, sector: "Industrials" },
  { kw: /conglomerate|holding/i, sector: "Conglomerates" },
];

function industryToSector(industry: string): string | null {
  const text = industry.replace(/\[\[|\]\]|\{\{|\}\}|\|/g, "").toLowerCase();
  for (const { kw, sector } of INDUSTRY_TO_SECTOR) {
    if (kw.test(text)) return sector;
  }
  return null;
}

interface HsiRow {
  symbol: string;
  name: string; // display name (หลัง |) — ใช้เป็นชื่อหุ้น
  page: string; // ชื่อหน้า Wikipedia (ก่อน |) — ใช้ fetch industry แม่นยำ
  subIndex: string;
}

function parseHangSeng(wikitext: string): HsiRow[] {
  const rows: HsiRow[] = [];
  const lines = wikitext.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const symMatch = lines[i].match(/^\|\s*\{\{[^|}]*\|(\d+)\}\}/);
    if (!symMatch) continue;
    const nameLine = lines[i + 1] ?? "";
    // |[[Page|Display]] หรือ |[[Page]] หรือ |Display เปล่าๆ (ไม่มีลิงก์)
    const linkMatch = nameLine.match(/^\|\s*\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]\s*$/);
    const plainMatch = nameLine.match(/^\|\s*([^|]+?)\s*$/);
    if (!linkMatch && !plainMatch) continue;
    const page = linkMatch ? linkMatch[1].trim() : plainMatch![1].trim();
    const name = linkMatch ? (linkMatch[2] ?? linkMatch[1]).trim() : plainMatch![1].trim();
    const subIndex = (lines[i + 2] ?? "").match(/^\|\s*([^|]+)/)?.slice(1)?.[0]?.trim() ?? "";
    if (name && subIndex) rows.push({ symbol: `${symMatch[1]}.HK`, name, page, subIndex });
  }
  return rows;
}

async function fetchHangSengWikitext(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=parse&page=Hang%20Seng%20Index&format=json&prop=wikitext&redirects=1";
    const res = await fetch(url, {
      headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 10000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } }; error?: { info?: string } };
    if (json.error) throw new Error(json.error.info);
    const text = json.parse?.wikitext?.["*"];
    if (!text) throw new Error("ไม่มี wikitext");
    return text;
  }
  throw new Error("rate-limited เกิน");
}

/** batch ดึง industry จาก Wikipedia infobox — 50 หน้า/request */
async function fetchIndustries(names: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < names.length; i += 50) {
    const chunk = names.slice(i, i + 50);
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      chunk.join("|"),
    )}&prop=revisions&rvprop=content&rvslots=main&format=json&formatversion=2&redirects=1`;
    let res: Response | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      res = await fetch(url, {
        headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 10000 * (attempt + 1)));
        continue;
      }
      break;
    }
    if (!res?.ok) {
      console.log(`  ⚠️ batch ${i / 50 + 1} HTTP ${res?.status} — ข้าม`);
      continue;
    }
    const json = (await res.json()) as {
      query?: {
        pages?: Array<{ title: string; revisions?: Array<{ slots?: { main?: { content?: string } } }> }>;
        normalized?: Array<{ from: string; to: string }>;
        redirects?: Array<{ from: string; to: string }>;
      };
    };
    // map กลับ: ชื่อปลายทาง (redirect) → ชื่อต้นทางที่เราขอ (key ที่ใช้ get ภายหลัง)
    const backMap = new Map<string, string>();
    for (const n of json.query?.normalized ?? []) backMap.set(n.to, n.from);
    for (const r of json.query?.redirects ?? []) backMap.set(r.to, r.from);
    for (const p of json.query?.pages ?? []) {
      const content = p.revisions?.[0]?.slots?.main?.content ?? "";
      // จับค่า industry/sector แบบ single-line ({{Unbulleted list|...}} อยู่ในบรรทัดเดียวเสมอ)
      const m = content.match(/^\|\s*(?:industry|sector)\s*=\s*([^\n]+)$/m);
      if (m) {
        // แยก template list ({{Unbulleted list|A|B|C}} / {{hlist|...}}) → เก็บ A B C
        // แล้ว strip [[...]] เหลือ display name
        const industry = m[1]
          .replace(/\{\{(?:Unbulleted list|hlist|plainlist|ubl|flatlist)\s*\|/gi, "")
          .replace(/\{\{[^{}]*\}\}/g, "")
          .replace(/\}\}/g, " ")
          .replace(/\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g, "$1")
          .replace(/\s*\|\s*/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (industry) out.set(backMap.get(p.title) ?? p.title, industry);
      }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

/** ดึง GICS sector จาก stockanalysis.com — fallback เมื่อ Wikipedia infobox ไม่มี industry
 *  URL: https://stockanalysis.com/quote/hkg/{symbol}/  — sector อยู่ใน HTML ตาม <span>Sector</span> */
async function fetchStockAnalysisSectors(symbols: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const sym of symbols) {
    const num = sym.replace(/\.HK$/, "").padStart(4, "0"); // HK codes มี leading zero (0968)
    try {
      const res = await fetch(`https://stockanalysis.com/quote/hkg/${num}/`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!res.ok) continue;
      const html = await res.text();
      // ดึงจาก href ของ sector link ตรงๆ: <a href="/stocks/sector/technology/">
      // (บางตลาดอย่าง VN ไม่มี Sector box — fallback ไป Industry: /stocks/industry/...)
      const m =
        html.match(/<a href="\/stocks\/sector\/([a-z-]+)\/"/) ??
        html.match(/<a href="\/stocks\/industry\/([a-z-]+)\/"/);
      if (m) {
        const sector = m[1]
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ");
        out.set(sym, sector);
      }
    } catch {
      // ข้าม
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return out;
}

async function main() {
  console.log("📡 ดึง wikitext Hang Seng Index...");
  const wikitext = await fetchHangSengWikitext();
  const rows = parseHangSeng(wikitext);
  console.log(`  parse ได้ ${rows.length} rows`);

  // แยก: sub-index ชัดเจน vs Commerce & Industry
  const clear = rows.filter((r) => SUBINDEX_TO_ELEMENT[r.subIndex]);
  const commerce = rows.filter((r) => !SUBINDEX_TO_ELEMENT[r.subIndex]);
  console.log(`  sub-index ชัดเจน ${clear.length} (Finance/Properties/Utilities), Commerce & Industry ${commerce.length}`);

  // batch ดึง industry สำหรับ Commerce & Industry
  console.log("📡 ดึง industry จาก Wikipedia infobox (batch)...");
  const industries = await fetchIndustries(commerce.map((r) => r.page));
  console.log(`  ได้ industry ${industries.size}/${commerce.length} บริษัท`);

  // ตัวที่ยัง map sector ไม่ได้ (ไม่มี industry หรือ industry ไม่ match keyword)
  // → fallback stockanalysis.com (GICS sector จริง)
  const stillMissing = commerce.filter((r) => {
    const industry = industries.get(r.page);
    return !industry || !industryToSector(industry);
  });
  const saSectors = await fetchStockAnalysisSectors(stillMissing.map((r) => r.symbol));
  if (saSectors.size > 0) console.log(`  stockanalysis fallback ได้ ${saSectors.size} ตัว`);

  // คำนวณ sector/ธาตุต่อ row
  const rowSector = new Map<string, string>();
  for (const r of clear) rowSector.set(r.symbol, r.subIndex); // เก็บ sub-index ไว้กันก่อน
  let mapped = 0;
  for (const r of commerce) {
    // ลำดับ: Wikipedia infobox → stockanalysis GICS → ข้าม
    let sector: string | null = null;
    const industry = industries.get(r.page);
    if (industry) sector = industryToSector(industry);
    if (!sector) sector = saSectors.get(r.symbol) ?? null;
    if (sector) {
      rowSector.set(r.symbol, sector);
      mapped++;
    }
  }
  console.log(`  Commerce & Industry map ธาตุได้ ${mapped}/${commerce.length}`);

  // merge เข้า global.json
  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };
  const byTicker = new Map(db.stocks.map((s) => [s.ticker as string, s]));

  let added = 0;
  let updated = 0;
  const unmapped: string[] = [];

  for (const r of rows) {
    const sector = rowSector.get(r.symbol);
    if (!sector) {
      unmapped.push(r.symbol);
      continue;
    }
    // sub-index เก็บเป็น sector ชั่วคราว → map ธาตุ
    const element: El | undefined = SUBINDEX_TO_ELEMENT[sector] ?? undefined;
    const elementFromSector = (sec: string): El | null => {
      const known: Record<string, El> = {
        Financials: "น้ำ", "Financial Services": "น้ำ", "Consumer Defensive": "น้ำ",
        "Consumer Staples": "น้ำ", "Consumer Cyclical": "น้ำ",
        Energy: "ไฟ", Utilities: "ไฟ", "Real Estate": "ดิน",
        "Health Care": "ไฟ", Healthcare: "ไฟ", Semiconductors: "ทอง",
        Technology: "ทอง", "Information Technology": "ทอง",
        "Automobiles & Components": "ทอง", Transportation: "น้ำ", Materials: "ทอง",
        "Basic Materials": "ทอง", "Consumer Discretionary": "น้ำ",
        "Food & Beverage": "น้ำ", "Hotels, Restaurants & Leisure": "น้ำ",
        "Consumer Products": "น้ำ", Industrials: "ทอง", Conglomerates: "น้ำ",
        "Communication Services": "ไม้", "Telecommunication Services": "ไม้",
      };
      return known[sec] ?? null;
    };
    const el = element ?? elementFromSector(sector);
    if (!el) {
      unmapped.push(r.symbol);
      continue;
    }

    const isSubIndex = Boolean(SUBINDEX_TO_ELEMENT[sector]);
    const existing = byTicker.get(r.symbol);
    if (existing) {
      existing.sector = isSubIndex ? `${r.subIndex} (Hang Seng sub-index)` : sector;
      existing.elements = [el];
      existing.primaryElement = el;
      existing.elementReason = isSubIndex
        ? `Hang Seng sub-index: ${r.subIndex} → ธาตุ ${el} (auto — รอซินแสตรวจ)`
        : `GICS sector (จาก industry infobox): ${sector} → ธาตุ ${el} (auto — รอซินแสตรวจ)`;
      existing.elementSource = isSubIndex
        ? "Hang Seng sub-index (auto) — draft รอตรวจ"
        : "Wikipedia industry infobox (auto) — draft รอตรวจ";
      // business ว่าง (ตัวที่เพิ่มรอบแรกยังไม่ได้ตั้ง) → ใช้ชื่อบริษัท (pattern auto)
      if (!existing.business || String(existing.business).length <= 3) {
        existing.business = r.name.replace(/\[\[|\]\]/g, "").replace(/\|.*/, "").trim();
      }
      updated++;
    } else {
      const meta = { country: "ฮ่องกง/จีน", direction: "เหนือ", marketElement: "น้ำ" as El };
      const stockName = r.name.replace(/\[\[|\]\]/g, "").replace(/\|.*/, "").trim();
      db.stocks.push({
        type: "stock",
        ticker: r.symbol,
        name: stockName,
        nameEn: stockName,
        country: "HK",
        market: "HKEX",
        currency: "HKD",
        sector: isSubIndex ? `${r.subIndex} (Hang Seng sub-index)` : sector,
        business: stockName,
        businessKeywords: [],
        growthStage: "large",
        theme: [],
        risingStar: false,
        listedDate: null,
        elements: [el],
        primaryElement: el,
        elementReason: isSubIndex
          ? `Hang Seng sub-index: ${r.subIndex} → ธาตุ ${el} (auto — รอซินแสตรวจ)`
          : `GICS sector (จาก industry infobox): ${sector} → ธาตุ ${el} (auto — รอซินแสตรวจ)`,
        elementSource: isSubIndex
          ? "Hang Seng sub-index (auto) — draft รอตรวจ"
          : "Wikipedia industry infobox (auto) — draft รอตรวจ",
        tier: "large",
        isHighLiquidity: true,
        status: "draft",
        reviewedBy: null,
        reviewedAt: null,
        notes: `ธาตุตลาด ${meta.country} = ${meta.marketElement} (ทิศ${meta.direction}) — ใช้บท 8; verdict หุ้นใช้ธาตุธุรกิจนี้`,
      });
      byTicker.set(r.symbol, db.stocks[db.stocks.length - 1]);
      added++;
    }
  }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  console.log(`\n✅ HKEX: เพิ่ม ${added} ตัว, อัปเดต ${updated} ตัว`);
  if (unmapped.length) console.log(`  ⚠️ map ไม่ได้ ${unmapped.length} ตัว: ${unmapped.join(", ")}`);
  console.log(`→ ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
