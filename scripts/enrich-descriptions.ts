/**
 * ENRICH descriptions: เติมคำอธิบายธุรกิจ (ชั้น A) ให้หุ้นทุกตัวที่ยังไม่มี
 *
 * เหตุผล: ซินแสตรวจธาตุไม่ได้ ถ้าไม่รู้ว่าหุ้นประกอบธุรกิจอะไร
 *   — ปัจจุบันหุ้น auto มี business = แค่ชื่อบริษัท, description ว่าง 1,923 ตัว
 *
 * แหล่งข้อมูล: Wikipedia intro (prop=extracts&exintro&explaintext — plain text,
 *   batch 20 หน้า/request ตาม limit ของ extracts module)
 *   → description (2-3 ประโยค ~350 ตัวอักษร) + businessEvidence { source, url }
 *
 * ตัวที่มี description แล้ว (หุ้นมือ 5 ตัว) ข้าม — ไม่ทับของซินแส
 *
 * รัน: npx tsx scripts/enrich-descriptions.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILES = [path.join(ROOT, "data/stocks/thailand.json"), path.join(ROOT, "data/stocks/global.json")];
const CACHE_FILE = path.join(ROOT, "data/stocks/.intro-cache.json");

/** อ่าน cache intro (กัน re-fetch เมื่อรันซ้ำ / โดน kill กลางคัน) — รองรับทั้ง
 *  รูปแบบเก่า (string ล้วน = en) และใหม่ ({ l: ภาษา, i: intro }) */
function loadCache(): Map<string, { intro: string; lang: string }> {
  try {
    const raw = JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, unknown>;
    const out = new Map<string, { intro: string; lang: string }>();
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "string") out.set(k, { intro: v, lang: "en" });
      else if (v && typeof v === "object" && typeof (v as { i?: unknown }).i === "string") {
        out.set(k, { intro: (v as { i: string }).i, lang: String((v as { l?: unknown }).l ?? "en") });
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

/** เก็บ cache ลงไฟล์ (เขียนทับทุกครั้ง — ไฟล์เล็กพอ) */
function saveCache(cache: Map<string, { intro: string; lang: string }>): void {
  const obj: Record<string, { l: string; i: string }> = {};
  for (const [k, v] of cache) obj[k] = { l: v.lang, i: v.intro };
  writeFileSync(CACHE_FILE, JSON.stringify(obj, null, 1) + "\n", "utf8");
}

/** หา Wikipedia title ที่ควรใช้: nameEn > name (ตัด suffix บริษัทที่พบบ่อย) */
function guessTitle(s: Record<string, unknown>): string {
  const raw = String(s.nameEn ?? s.name ?? "").trim();
  return raw
    .replace(/\s+(?:Limited|Ltd|PLC|Corporation|Corp|Incorporated|Inc|Company|Co|Group|Holdings?|Bancorp)[.,]?\s*$/i, "")
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
}

/** fetch แบบมี retry กัน 429 — อ่าน Retry-After header + ถอยหลังแบบยาว (Wikipedia จำกัด IP แบบ rolling) */
async function fetchWithRetry(url: string, attempts = 5): Promise<Response | null> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    let res: Response | null = null;
    try {
      res = await fetch(url, {
        headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
      });
    } catch {
      return null;
    }
    if (res.status !== 429) return res;
    const retryAfter = Number(res.headers.get("retry-after") ?? 0);
    const wait = Math.max(retryAfter || 10, 10) * (attempt + 1);
    console.log(`    ⏳ 429 — รอ ${wait}s (attempt ${attempt + 1}/${attempts})`);
    await new Promise((r) => setTimeout(r, wait * 1000));
  }
  return null;
}

/** ดึง intro (plain text) ของหลายหน้า — batch 20/request (limit extracts module) */
async function fetchIntros(
  titles: string[],
  cache: Map<string, { intro: string; lang: string }>,
  save: () => void,
): Promise<Map<string, { intro: string; lang: string }>> {
  const out = new Map<string, { intro: string; lang: string }>();
  // ข้าม title ที่มีใน cache แล้ว
  const todo = titles.filter((t) => !cache.has(t));
  for (const [t, v] of cache) out.set(t, v);
  if (todo.length < titles.length) {
    console.log(`  ♻️ ใช้ cache ข้าม ${titles.length - todo.length}/${titles.length} titles`);
  }
  for (let i = 0; i < todo.length; i += 20) {
    const chunk = todo.slice(i, i + 20);
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      chunk.join("|"),
    )}&prop=extracts&exintro&explaintext&redirects=1&format=json&formatversion=2`;
    const res = await fetchWithRetry(url);
    if (!res?.ok) {
      console.log(`  ⚠️ batch ${i / 20 + 1} HTTP ${res?.status ?? "network error"} — ข้าม`);
      continue;
    }
    const json = (await res.json()) as {
      query?: {
        pages?: Array<{ title: string; extract?: string }>;
        redirects?: Array<{ from: string; to: string }>;
        normalized?: Array<{ from: string; to: string }>;
      };
    };
    const pages = json.query?.pages ?? [];
    const byTitle = new Map(pages.map((p) => [p.title, p.extract]));
    // map ชื่อที่ขอ → ชื่อจริงหลัง normalize/redirect (กันพลาด lookup ใต้ชื่อที่ขอ)
    const resolve = (t: string): string => {
      const norm = json.query?.normalized?.find((n) => n.from === t);
      const from = norm?.to ?? t;
      return json.query?.redirects?.find((r) => r.from === from)?.to ?? from;
    };
    for (const t of chunk) {
      const extract = byTitle.get(resolve(t));
      if (extract && !isDisambiguation(extract)) {
        const v = { intro: extract, lang: "en" };
        out.set(t, v);
        cache.set(t, v);
      }
    }
    save(); // checkpoint cache หลังทุก batch — กันงานหายถ้าถูก kill
    await new Promise((r) => setTimeout(r, 1500));
  }
  return out;
}

/** วิกิภาษาท้องถิ่นตามประเทศ (fallback เมื่อ en.wiki ไม่มีหน้า) */
const LANG_BY_COUNTRY: Record<string, string> = {
  TH: "th",
  CN: "zh",
  VN: "vi",
  JP: "ja",
  KR: "ko",
  TW: "zh",
  HK: "zh",
};

/** หา Wikipedia title ด้วย search API (fallback เมื่อเดา title ไม่ตรง) — มี retry กัน 429 */
async function searchTitle(query: string, lang = "en"): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query,
  )}&srlimit=1&format=json&formatversion=2`;
  const res = await fetchWithRetry(url, 3);
  if (!res?.ok) return null;
  const json = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
  return json.query?.search?.[0]?.title ?? null;
}

/** ดึง intro ของ 1 title (ใช้กับ search fallback) — มี retry กัน 429 */
async function fetchIntroOne(title: string, lang = "en"): Promise<string | null> {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    title,
  )}&prop=extracts&exintro&explaintext&redirects=1&format=json&formatversion=2`;
  const res = await fetchWithRetry(url, 3);
  if (!res?.ok) return null;
  const json = (await res.json()) as { query?: { pages?: Array<{ extract?: string }> } };
  const extract = json.query?.pages?.[0]?.extract;
  return extract && !isDisambiguation(extract) ? extract : null;
}

/** ตัด intro ให้เหลือ ~350 ตัวอักษร ลงท้ายประโยค */
function truncateIntro(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 350) return clean;
  const cut = clean.slice(0, 350);
  const lastDot = cut.lastIndexOf(". ");
  return lastDot > 150 ? cut.slice(0, lastDot + 1) : cut + "…";
}

/** ตรวจจับหน้า disambiguation (รายการลิงก์ ไม่ใช่คำอธิบายบริษัท) — กันข้อมูลผิด */
function isDisambiguation(intro: string): boolean {
  return /may refer to:|most often refers to|may stand for|Topics referred to by the same term|Look up .+ in Wiktionary|อาจหมายถึง|Nhiều nghĩa|nhiều ý nghĩa|曖昧さ回避|동음이의어|消歧义|维基百科消歧义/i.test(
    intro,
  );
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

async function main() {
  // รวมหุ้นที่ยังไม่มี description จากทั้ง 2 ไฟล์ (เก็บ db object ไว้เขียนกลับ)
  const dbs: Array<{ file: string; db: { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> } }> = [];
  const pending: Array<{ dbIdx: number; stock: Record<string, unknown> }> = [];
  for (const f of FILES) {
    const db = JSON.parse(readFileSync(f, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
    dbs.push({ file: f, db });
    for (const s of db.stocks) {
      if (!s.description) pending.push({ dbIdx: dbs.length - 1, stock: s });
    }
  }
  console.log(`📋 หุ้นที่ยังไม่มี description: ${pending.length} ตัว`);

  // แบ่ง batch ตาม title ที่เดาได้ (ใช้ 2 variants: ชื่อเต็ม + ชื่อตัด suffix — เพิ่มโอกาสเจอใน batch)
  const titleToStock = new Map<string, typeof pending>();
  for (const p of pending) {
    const raw = String(p.stock.nameEn ?? p.stock.name ?? "").trim();
    const full = raw;
    const trimmed = guessTitle(p.stock);
    for (const t of new Set([full, trimmed].filter(Boolean))) {
      if (!titleToStock.has(t)) titleToStock.set(t, []);
      titleToStock.get(t)!.push(p);
    }
  }
  const titles = [...titleToStock.keys()];
  console.log(`📡 ดึง Wikipedia intro (${titles.length} titles, batch 20)...`);

  const cache = loadCache();
  const save = () => saveCache(cache);
  const intros = await fetchIntros(titles, cache, save);
  console.log(`  ได้ intro ${intros.size}/${titles.length}`);

  // fallback: title ที่ batch เจอไม่หมด → search หาหน้า Wikipedia (ทีละตัว)
  // ใช้ --skip-en-fallback เพื่อข้าม (เช่น รอบที่เพิ่งรัน en fallback ไปแล้ว ได้ผลน้อย)
  const skipEnFallback = process.argv.includes("--skip-en-fallback");
  const missingTitles = titles.filter((t) => !intros.has(t));
  if (!skipEnFallback && missingTitles.length > 0) {
    console.log(`🔍 search fallback สำหรับ ${missingTitles.length} titles...`);
    let found = 0;
    for (const t of missingTitles) {
      const items = titleToStock.get(t)!;
      const st = items[0].stock;
      // ลองหลาย query: nameEn → name → nameEn + " company" (เพิ่มโอกาสเจอ)
      const queries = [
        String(st.nameEn ?? ""),
        String(st.name ?? ""),
        `${String(st.nameEn ?? st.name ?? "")} company`,
      ].filter((q) => q && q !== t);
      let realTitle: string | null = null;
      for (const q of queries) {
        realTitle = await searchTitle(q);
        if (realTitle) break;
      }
      if (realTitle) {
        const intro = await fetchIntroOne(realTitle);
        if (intro) {
          const v = { intro, lang: "en" };
          intros.set(t, v);
          cache.set(t, v);
          save();
          found++;
        }
      }
      await new Promise((r) => setTimeout(r, 1000)); // กัน rate-limit
    }
    console.log(`  search fallback ได้เพิ่ม ${found} ตัว`);
  }

  // fallback 2: วิกิภาษาท้องถิ่น (th/zh/vi/ja/ko) — หุ้นที่ en.wiki ไม่มีหน้า
  // (KNOWN-ISSUES ข้อ 5: หุ้นเล็กจีน/เวียดนาม/ไทยต้องใช้ th/zh/vi.wikipedia)
  const stillMissing = titles.filter((t) => !intros.has(t));
  const byLang = new Map<string, typeof stillMissing>();
  for (const t of stillMissing) {
    const st = titleToStock.get(t)![0].stock;
    const lang = LANG_BY_COUNTRY[String(st.country ?? "")];
    if (!lang) continue;
    if (!byLang.has(lang)) byLang.set(lang, []);
    byLang.get(lang)!.push(t);
  }
  if (byLang.size > 0) {
    console.log(`🌏 fallback วิกิท้องถิ่น: ${[...byLang.entries()].map(([l, v]) => `${l}=${v.length}`).join(", ")}...`);
    let found = 0;
    for (const [lang, lTitles] of byLang) {
      for (const t of lTitles) {
        const st = titleToStock.get(t)![0].stock;
        const queries = [
          String(st.name ?? ""),
          String(st.nameEn ?? ""),
          `${String(st.nameEn ?? "")} ${lang}`,
        ].filter((q) => q && q !== t);
        let realTitle: string | null = null;
        for (const q of queries) {
          realTitle = await searchTitle(q, lang);
          if (realTitle) break;
        }
        if (realTitle) {
          const intro = await fetchIntroOne(realTitle, lang);
          if (intro) {
            const v = { intro, lang };
            intros.set(t, v);
            cache.set(t, v);
            save();
            found++;
          }
        }
        await new Promise((r) => setTimeout(r, 1500)); // กัน rate-limit
      }
    }
    console.log(`  วิกิท้องถิ่นได้เพิ่ม ${found} ตัว`);
  }

  // เติม description + businessEvidence
  let filled = 0;
  let notFound = 0;
  for (const [title, items] of titleToStock) {
    const hit = intros.get(title);
    if (!hit) {
      notFound++;
      continue;
    }
    // กันหน้าเพี้ยน: intro ต้องเอ่ยชื่อบริษัทจริง (เช่น "Ping An" → กล้วยไม้ = ไม่รับ)
    if (!mentionsCompany(hit.intro, items[0].stock)) {
      notFound++;
      continue;
    }
    const desc = truncateIntro(hit.intro);
    const lang = hit.lang;
    const host = lang === "en" ? "en.wikipedia.org" : `${lang}.wikipedia.org`;
    for (const { stock } of items) {
      stock.description = desc;
      stock.businessEvidence = {
        source: lang === "en" ? "Wikipedia intro (auto) — draft รอตรวจ" : `Wikipedia ${lang} intro (auto) — draft รอตรวจ`,
        url: `https://${host}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`,
        quote: desc.slice(0, 200),
      };
      filled++;
    }
  }

  // เขียนกลับ (ใช้ db object เดิม — อย่า re-read ไม่งั้น reference ที่แก้หาย)
  for (const { file, db } of dbs) {
    db.meta.updatedAt = new Date().toISOString().slice(0, 10);
    writeFileSync(file, JSON.stringify(db, null, 2) + "\n", "utf8");
  }

  console.log(`\n✅ เติม description ${filled} ตัว (หา intro ไม่เจอ ${notFound})`);
  console.log("   ตัวอย่าง:");
  const shown = new Set<string>();
  for (const [title, items] of titleToStock) {
    const hit = intros.get(title);
    if (hit && shown.size < 3) {
      console.log(`   • ${items[0].stock.ticker} (${title}): ${truncateIntro(hit.intro).slice(0, 100)}...`);
      shown.add(title);
    }
  }
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
