/**
 * ดึงรายชื่อหุ้นจริงจาก Wikipedia (symbol + GICS sector) → map sector→ธาตุไทย
 * → สร้าง data/stocks/global.json (draft) ให้ครบ 100+ ตัว/ตลาด
 *
 * แหล่งข้อมูล (ข้อมูลจริง — ไม่เดา):
 *   US: List of S&P 500 companies · JP: List of NIKKEI 225 companies
 *   IN: NIFTY 50 · HK/CN: Hang Seng Index · AU: S&P/ASX 200
 *   CA: S&P/TSX 60 · KR: KOSPI 200 · VN: VN30 Index
 *
 * รัน: npx tsx scripts/fetch-wikipedia-stocks.ts
 *   - ดึงแต่ละหน้าแค่ครั้งเดียว → cache ไว้ data/cache/wikipedia/ (รันซ้ำ = 0 request)
 *   - อยากดึงจาก Wikipedia ใหม่ (อัปเดตชื่อ/สมาชิกดัชนี): เพิ่ม --refresh
 *   - ใช้ maxlag=5 + ฟัง Retry-After → ไม่โดน rate-limit 429 ค้าง
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");
const CACHE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/cache/wikipedia");
const REFRESH = process.argv.includes("--refresh");
let usedNetwork = false; // ใช้ใน main: ข้าม delay ระหว่างแหล่งเมื่อรันจาก cache ล้วน

type El = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** GICS Sector (อังกฤษ) → ธาตุไทย — map จาก career-business.txt + decision-log */
const SECTOR_TO_ELEMENT: Record<string, El> = {
  "Technology": "ทอง",
  "Information Technology": "ทอง",
  "Semiconductors": "ทอง",
  "Communication Services": "ไม้",
  "Telecommunication Services": "ไม้",
  "Financials": "น้ำ",
  "Banks": "น้ำ",
  "Insurance": "น้ำ",
  "Financial Services": "น้ำ",
  "Capital Markets": "น้ำ",
  "Energy": "ไฟ",
  "Utilities": "ไฟ",
  "Electric Utilities": "ไฟ",
  "Health Care": "ไฟ",
  "Pharmaceuticals": "ไฟ",
  "Biotechnology": "ไฟ",
  "Health Care Equipment & Services": "ไฟ",
  "Consumer Discretionary": "น้ำ",
  "Consumer Staples": "น้ำ",
  "Food & Beverage": "น้ำ",
  "Food and Beverage": "น้ำ",
  "Retailing": "น้ำ",
  "Consumer Products": "น้ำ",
  "Household & Personal Products": "น้ำ",
  "Materials": "ทอง",
  "Metals & Mining": "ทอง",
  "Chemicals": "ทอง",
  "Paper & Forest Products": "ไม้",
  "Industrials": "ทอง",
  "Capital Goods": "ทอง",
  "Machinery": "ทอง",
  "Automobiles & Components": "ทอง",
  "Auto & Truck Manufacturers": "ทอง",
  "Transportation": "น้ำ",
  "Airlines": "น้ำ",
  "Railroads": "น้ำ",
  "Real Estate": "ดิน",
  "Real Estate Investment Trusts": "ดิน",
  "Construction": "ดิน",
  "Engineering & Construction": "ดิน",
  "Basic Materials": "ทอง",
  "Conglomerates": "น้ำ",
  "Diversified Financials": "น้ำ",
  "Software": "ทอง",
  "Hardware": "ทอง",
  "Media & Entertainment": "น้ำ",
  "Media": "ไม้",
  "Hotels, Restaurants & Leisure": "น้ำ",
  "Aerospace & Defense": "ทอง",
  "Food & Staples Retailing": "น้ำ",
  "GIC Sector": "น้ำ", // fallback header
};

const MARKET_META: Record<string, { country: string; direction: string; marketElement: El; note: string }> = {
  US: { country: "สหรัฐฯ", direction: "ตะวันออก (ข้ามมหาสมุทร)", marketElement: "ไม้", note: "เทค(ทอง)/การเงิน(น้ำ)/พลังงาน(ไฟ)" },
  JP: { country: "ญี่ปุ่น", direction: "ตะวันออกเฉียงเหนือ", marketElement: "ดิน", note: "เทค/ยานยนต์(ทอง)/การเงิน(น้ำ)" },
  IN: { country: "อินเดีย", direction: "ตะวันตก", marketElement: "ทอง", note: "เทค/บริการ(ทอง)/การเงิน(น้ำ)" },
  HK: { country: "ฮ่องกง/จีน", direction: "เหนือ", marketElement: "น้ำ", note: "เทค(ทอง)/การเงิน(น้ำ)/อสังหา(ดิน)" },  AU: { country: "ออสเตรเลีย", direction: "ใต้", marketElement: "ไฟ", note: "เหมือง(ทอง)/พลังงาน(ไฟ)/ธนาคาร(น้ำ)" },
  CA: { country: "แคนาดา", direction: "ตะวันออกเฉียงเหนือ", marketElement: "ดิน", note: "พลังงาน(ไฟ)/เหมือง(ทอง)/ธนาคาร(น้ำ)" },
  KR: { country: "เกาหลีใต้", direction: "ตะวันออกเฉียงเหนือ", marketElement: "ดิน", note: "เทค/ชิป(ทอง)/ยานยนต์(ทอง)" },
  VN: { country: "เวียดนาม", direction: "ตะวันออกเฉียงใต้", marketElement: "ไม้", note: "ผลิต/อสังหา(ดิน)/ธนาคาร(น้ำ)" },
};

/** map: ชื่อตลาด (Wikipedia page — ใช้ raw title, ไม่ pre-encode) → ข้อมูล */
const SOURCES: Array<{ page: string; market: string; country: string; cur: string; exchange: string; section?: number; nikkeiSections?: boolean }> = [
  { page: "List of S&P 500 companies", market: "US", country: "US", cur: "USD", exchange: "NYSE/NASDAQ", section: 1 },
  { page: "NIFTY 50", market: "IN", country: "IN", cur: "INR", exchange: "NSE", section: 2 },
  { page: "Hang Seng Index", market: "HK", country: "HK", cur: "HKD", exchange: "HKEX", section: 7 },
  { page: "S&P/ASX 200", market: "AU", country: "AU", cur: "AUD", exchange: "ASX", section: 4 },
  { page: "S&P/TSX 60", market: "CA", country: "CA", cur: "CAD", exchange: "TSX", section: 1 },
  { page: "KOSPI 200", market: "KR", country: "KR", cur: "KRW", exchange: "KRX", section: 4 },
  { page: "List of NIKKEI 225 companies", market: "JP", country: "JP", cur: "JPY", exchange: "TSE", section: 1 },
  { page: "Nikkei 225", market: "JP", country: "JP", cur: "JPY", exchange: "TSE", section: 0, nikkeiSections: true },
  { page: "VN30 Index", market: "VN", country: "VN", cur: "VND", exchange: "HOSE", section: 0 },
  { page: "VN 30", market: "VN", country: "VN", cur: "VND", exchange: "HOSE", section: 0 },
  { page: "List of companies of South Korea", market: "KR", country: "KR", cur: "KRW", exchange: "KRX", section: 0 },
  { page: "KOSPI Composite Index", market: "KR", country: "KR", cur: "KRW", exchange: "KRX", section: 0 },
];

/** ดึง wikitext ของหน้า (section = -1 → ทั้งหน้าใน request เดียว) พร้อม cache + maxlag + Retry-After */
async function fetchWikitext(page: string, section = -1): Promise<string> {
  const cacheFile = path.join(
    CACHE_DIR,
    `${page.replace(/[^A-Za-z0-9]+/g, "_")}${section >= 0 ? `.s${section}` : ""}.txt`,
  );
  const missFile = `${cacheFile}.missing`; // หน้าหาย — cache คำตอบว่าไม่มี เพื่อไม่ยิงซ้ำทุกรอบ
  if (!REFRESH && existsSync(missFile)) throw new Error(`${page} → หน้าหาย (cache marker)`);
  if (!REFRESH && existsSync(cacheFile)) {
    return readFileSync(cacheFile, "utf8"); // cache hit — ไม่แตะ network
  }
  usedNetwork = true;
  for (let attempt = 0; attempt < 4; attempt++) {
    const url =
      `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}` +
      `&format=json&prop=wikitext&redirects=1&maxlag=5` +
      (section >= 0 ? `&section=${section}` : "");
    const res = await fetch(url, { headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" } });
    if (res.status === 429 || res.status === 503) {
      // ฟัง Retry-After ที่ Wikipedia ส่งมา (ไม่นอนรอแบบตายตัว)
      const ra = res.headers.get("retry-after");
      const wait = ra ? Number(ra) * 1000 : 5000 * (attempt + 1);
      console.log(`  ⏳ rate-limited (${page}) รอ ${Math.round(wait / 1000)}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${page} → HTTP ${res.status}`);
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } }; error?: { info?: string } };
    if (json.error) {
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(missFile, json.error.info ?? "missing", "utf8");
      throw new Error(`${page} → ${json.error.info}`);
    }
    const text = json.parse?.wikitext?.["*"];
    if (!text) throw new Error(`${page} → ไม่มี wikitext`);
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(cacheFile, text, "utf8");
    return text;
  }
  throw new Error(`${page} → rate-limited เกิน`);
}

/** หา section ที่มีตารางหุ้น (Constituents/Components/Companies) อัตโนมัติ */
async function findStockSection(page: string): Promise<number> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=sections&redirects=1`;
  const res = await fetch(url, { headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" } });
  if (!res.ok) return 0;
  const json = (await res.json()) as { parse?: { sections?: Array<{ index: string; line: string; toclevel: number }> } };
  const sections = json.parse?.sections ?? [];
  const keywords = ["constituent", "component", "companies", "list of", "members", "composition"];
  const hit = sections.find((s) => {
    const line = s.line.toLowerCase();
    return keywords.some((k) => line.includes(k)) && s.toclevel <= 3;
  });
  return hit ? Number(hit.index) : 0;
}

/** map ชื่อ section ของ Nikkei (Air transport/Automotive/...) → GICS sector */
const NIKKEI_SECTION_SECTOR: Record<string, string> = {
  "Air transport": "Transportation",
  "Automotive": "Automobiles & Components",
  "Banking": "Banks",
  "Chemicals": "Chemicals",
  "Communications": "Communication Services",
  "Construction": "Construction",
  "Electric machinery": "Technology",
  "Electric power": "Utilities",
  "Fishery": "Food & Beverage",
  "Foods": "Food & Beverage",
  "Gas": "Utilities",
  "Glass & ceramics": "Materials",
  "Insurance": "Insurance",
  "Land transport": "Transportation",
  "Machinery": "Machinery",
  "Marine transport": "Transportation",
  "Mining": "Metals & Mining",
  "Nonferrous metals": "Metals & Mining",
  "Other financial services": "Financial Services",
  "Other manufacturing": "Industrials",
  "Petroleum": "Energy",
  "Pharmaceuticals": "Pharmaceuticals",
  "Precision instruments": "Technology",
  "Pulp & paper": "Paper & Forest Products",
  "Railway/bus": "Transportation",
  "Real estate": "Real Estate",
  "Retail": "Retailing",
  "Securities": "Financial Services",
  "Services": "Consumer Discretionary",
  "Shipbuilding": "Capital Goods",
  "Steel": "Metals & Mining",
  "Textiles & apparels": "Consumer Products",
  "Trading companies": "Conglomerates",
  "Warehousing": "Transportation",
  "Wholesale": "Retailing",
};

/** แยกแถวตาราง wikitext: symbol อยู่บรรทัด |{{X|SYM}} ตามด้วย |ชื่อ||sector||... */
function parseTableRows(wikitext: string, page: string): Array<{ symbol: string; name: string; sector: string }> {
  const rows: Array<{ symbol: string; name: string; sector: string }> = [];
  const lines = wikitext.split("\n");

  if (page.includes("Hang Seng")) {
    // format: |{{SEHK|5}} / |[[HSBC Holdings plc]] / |Finance  (คนละบรรทัด)
    for (let i = 0; i < lines.length; i++) {
      const symMatch = lines[i].match(/^\|\s*\{\{[^|}]*\|(\d+)\}\}/);
      if (!symMatch) continue;
      const symbol = `${symMatch[1]}.HK`;
      const name = (lines[i + 1] ?? "").match(/^\|\s*\[?\[?([^\]|]+?)\]?\]?\s*$/)?.slice(1)?.[0]?.trim() ?? "";
      const sector = (lines[i + 2] ?? "").match(/^\|\s*([^|]+)/)?.slice(1)?.[0]?.trim() ?? "";
      if (name && sector) rows.push({ symbol, name, sector });
    }
    return rows;
  }

  if (page.includes("ASX 200")) {
    // format: |360 / |[[Life360]] / |Information Technology  (symbol→ชื่อ→sector คนละบรรทัด)
    for (let i = 0; i < lines.length; i++) {
      const symMatch = lines[i].match(/^\|\s*([A-Z0-9.-]{1,8})\s*\|?$/);
      if (!symMatch) continue;
      const symbol = symMatch[1].trim();
      if (symbol === "-" || /^[a-z]/.test(symbol)) continue;
      const name = (lines[i + 1] ?? "").match(/^\|\s*\[?\[?([^\]|]+?)\]?\]?\s*\|?$/)?.slice(1)?.[0]?.trim().replace(/\(.*\)/, "").trim() ?? "";
      const sector = (lines[i + 2] ?? "").match(/^\|\s*([^|]+)/)?.slice(1)?.[0]?.trim() ?? "";
      if (name && sector && /^[A-Z0-9.-]+$/.test(symbol)) rows.push({ symbol: `${symbol}.AX`, name, sector });
    }
    return rows;
  }

  if (page.includes("TSX 60")) {
    // format: | {{TSX link|AEM}} || [[Agnico Eagle|...]] || Basic Materials  (บรรทัดเดียว)
    for (const line of lines) {
      const m = line.match(/^\|\s*\{\{[^|}]*\|([A-Z0-9.-]{1,6})\}\}\s*\|\|\s*\[?\[?([^\]|]+?)\]?\]?\s*\|\|\s*([^|]+)/);
      if (!m) continue;
      const symbol = m[1].trim();
      const name = m[2].trim().replace(/\(.*\)/, "").trim();
      const sector = m[3].trim().replace(/\[\[|\]\]/g, "").trim();
      if (symbol && name && sector) rows.push({ symbol: `${symbol}.TO`, name, sector });
    }
    return rows;
  }

  if (page.includes("KOSPI")) {
    // format: | [[Amorepacific Corporation|Amorepacific]] || 090430 || Consumer Staples  หรือ | APR || 278470 || ...
    for (const line of lines) {
      const m = line.match(/^\|\s*\[?\[?([^\]|]+?)\]?\]?\s*\|\|\s*(\d{6})\s*\|\|\s*([^|]+)/);
      if (!m) continue;
      const name = m[1].trim().replace(/\(.*\)/, "").trim();
      const symbol = `${m[2]}.KS`;
      const sector = m[3].trim().replace(/\[\[|\]\]/g, "").trim();
      if (name && sector) rows.push({ symbol, name, sector });
    }
    return rows;
  }

  if (page.includes("Nikkei")) {
    // format: ===Automotive=== / *[[Honda|Honda Motor]] Co., Ltd. ({{tyo2|7267}})
    // wikitext = หลาย section ต่อกัน → ไล่ title (===X===) แล้ว parse bullet ใต้ title นั้น
    let currentSector = "Unknown";
    for (const line of lines) {
      const titleMatch = line.match(/^===\s*(.+?)\s*===/);
      if (titleMatch) {
        currentSector = NIKKEI_SECTION_SECTOR[titleMatch[1].trim()] ?? "Unknown";
        continue;
      }
      const m = line.match(/^\*\s*\[?\[?(?:[^\]|]+\|)?([^\]|]+?)\]?\]?\s*[\s\S]*?\{\{[^|}]*\|(\d{4}[A-Z]?)\}\}/);
      if (!m) continue;
      const name = m[1].trim().replace(/\(.*\)/, "").trim();
      const symbol = `${m[2]}.T`;
      if (name && symbol && currentSector !== "Unknown") rows.push({ symbol, name, sector: currentSector });
    }
    return rows;
  }

  if (page.includes("NIFTY")) {
    // format: | [[Adani Enterprises]] / | ADANIENT / | Metals & Mining  (ชื่อ→symbol→sector)
    for (let i = 0; i < lines.length; i++) {
      const nameMatch = lines[i].match(/^\|\s*\[?\[?([^\]|]+?)\]?\]?\s*$/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim().replace(/\(.*\)/, "").trim();
      if (!name || name === "-" || /^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
      const symbol = (lines[i + 1] ?? "").match(/^\|\s*([A-Z0-9.-]{1,12})\s*$/)?.[1]?.trim() ?? "";
      const sector = (lines[i + 2] ?? "").match(/^\|\s*([^|]+)/)?.[1]?.trim() ?? "";
      if (name && symbol && symbol !== "-" && sector) rows.push({ symbol, name, sector });
    }
    return rows;
  }

  for (let i = 0; i < lines.length; i++) {
    // บรรทัด symbol: |{{NyseSymbol|MMM}} หรือ |{{TickerSymbol|...}} หรือ |MMM (แต่ข้าม "-" ที่เป็นเครื่องหมาย)
    const symMatch = lines[i].match(/^\|\s*\{\{[^|}]*\|([A-Z0-9.-]{1,10})\}\}/) || lines[i].match(/^\|\s*([A-Z0-9.-]{1,10})\s*$/);
    if (!symMatch) continue;
    const symbol = symMatch[1].trim();
    if (!/^[A-Z0-9.-]+$/.test(symbol) || symbol === "-" || symbol.length < 1 || symbol.length > 10) continue;

    // บรรทัดถัดไป (หรือถัดๆ ไป) ที่มีชื่อ + sector: |ชื่อ||Sector||...
    let name = "";
    let sector = "";
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const dataMatch = lines[j].match(/^\|\s*\[?\[?([^\]|]+?)\]?\]?\s*\|\|\s*([^|]+)/);
      if (dataMatch) {
        name = dataMatch[1].trim().replace(/\(.*\)/, "").trim();
        sector = dataMatch[2].trim().replace(/\[\[|\]\]/g, "").trim();
        break;
      }
    }
    if (name && sector) {
      rows.push({ symbol, name, sector });
    }
  }
  return rows;
}

async function main() {
  // merge กับไฟล์เดิม (หุ้นที่ map มือละเอียดอยู่แล้ว ไม่ทับ)
  const fs = await import("node:fs");
  const existing = JSON.parse(fs.readFileSync(OUT, "utf8")) as { stocks: Array<{ ticker: string }> };
  const existingTickers = new Set(existing.stocks.map((s) => s.ticker));
  const allStocks: unknown[] = [...existing.stocks];
  let merged = 0;
  let skippedTotal = 0;

  for (const src of SOURCES) {
    console.log(`\n📡 ${src.page} (${src.market})...`);
    try {
      let text: string;
      if ((src as { nikkeiSections?: boolean }).nikkeiSections) {
        text = await fetchWikitext(src.page, -1); // ทั้งหน้า 1 request — parseTableRows ไล่ ===sector=== เอง
      } else {
        const section = src.section ?? (await findStockSection(src.page));
        text = await fetchWikitext(src.page, section);
      }
      const rows = parseTableRows(text, src.page);
      console.log(`  พบ ${rows.length} แถว`);

      let added = 0;
      let skipped = 0;
      for (const r of rows) {
        // ข้ามตัวที่ซ้ำกับที่มีอยู่แล้ว (map มือละเอียดกว่า)
        if (existingTickers.has(r.symbol)) {
          skipped++;
          continue;
        }
        const element = SECTOR_TO_ELEMENT[r.sector];
        if (!element) {
          skipped++;
          continue; // sector ไม่รู้จัก — ข้าม (กันธาตุผิด)
        }
        const meta = MARKET_META[src.market];
        allStocks.push({
          type: "stock",
          ticker: r.symbol,
          name: r.name,
          nameEn: r.name,
          country: src.country,
          market: src.exchange,
          currency: src.cur,
          sector: r.sector,
          business: r.name,
          businessKeywords: [],
          growthStage: "large",
          theme: [],
          risingStar: false,
          listedDate: null,
          elements: [element],
          primaryElement: element,
          elementReason: `GICS sector: ${r.sector} → ธาตุ ${element} (auto-map — รอซินแสตรวจ)`,
          elementSource: "Wikipedia GICS sector (auto) — draft รอตรวจ",
          tier: "mega",
          isHighLiquidity: true,
          status: "draft",
          reviewedBy: null,
          reviewedAt: null,
          notes: `ธาตุตลาด ${meta.country} = ${meta.marketElement} (ทิศ${meta.direction}) — ใช้บท 8; verdict หุ้นใช้ธาตุธุรกิจนี้`,
        });
        existingTickers.add(r.symbol);
        added++;
      }
      merged += added;
      skippedTotal += skipped;
      console.log(`  ✅ เพิ่ม ${added} (ข้าม ${skipped} — ซ้ำ/ sector ไม่รู้จัก)`);
    } catch (err) {
      console.log(`  ⚠️ ข้าม (${(err as Error).message})`);
    }
    if (usedNetwork) await new Promise((r) => setTimeout(r, 4000)); // กัน rate-limit (เฉพาะรอบที่ fetch จริง)
  }

  const db = {
    meta: {
      market: "GLOBAL",
      label: "หุ้นโลกจาก Wikipedia (S&P500/NIFTY50/HangSeng/ASX200/TSX60/KOSPI200/NIKKEI225/VN30) + map มือ",
      updatedAt: new Date().toISOString().slice(0, 10),
      reviewStatus: "draft",
      note: "auto-fetch จาก Wikipedia — ธาตุจาก GICS sector ต้องให้ซินแสตรวจ",
      markets: MARKET_META,
    },
    stocks: allStocks,
  };

  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`\n✅ รวม ${allStocks.length} ตัว (เพิ่มใหม่ ${merged}, ข้าม ${skippedTotal}) → ${OUT}`);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
