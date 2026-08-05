/**
 * EXPAND ตลาดที่ต่ำกว่า 100 ตัว ให้ครบ 100+ (KNOWN-ISSUES เป้า: ทุกประเทศ ≥ 100)
 *
 * ตลาดเป้าหมาย:
 *   🇮🇳 อินเดีย 53 → 100: Wikipedia "NIFTY Next 50" (parser เดียวกับ NIFTY 50)
 *   🇨🇦 แคนาดา 40 → 100: Wikipedia "S&P/TSX Composite Index" 237 ตัว (parser TSX 60)
 *   🇨🇳 จีน    35 → 100: Wikipedia "CSI 300 Index" (parser ใหม่: |{{SSE|600519}} / |ชื่อ / |Sector)
 *   🇭🇰 ฮ่องกง 85 → 100: TradingView scanner HKEX top-100 (มี sector taxonomy)
 *   🇻🇳 เวียดนาม 35 → 100: TradingView scanner HOSE top-100
 *
 * ธาตุ: GICS sector → ธาตุ (Wikipedia) / TradingView sector taxonomy → ธาตุ
 * ตัวที่มีอยู่แล้ว (map มือ/auto เดิม) ไม่ทับ — เฉพาะเพิ่มตัวใหม่
 *
 * รัน: npx tsx scripts/expand-to-100.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

type El = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** GICS sector → ธาตุ (ไทย) */
const SECTOR_TO_ELEMENT: Record<string, El> = {
  // ไม้ (การสื่อสาร/ข้อมูล/การเรียนรู้)
  "Communication Services": "ไม้", "Communication": "ไม้", "Telecommunication Services": "ไม้", "Media": "ไม้",
  // ไฟ (พลังงาน/สุขภาพ/ความร้อน)
  "Energy": "ไฟ", "Utilities": "ไฟ", "Health Care": "ไฟ", "Pharmaceuticals": "ไฟ",
  "Biotechnology": "ไฟ", "Power": "ไฟ", "Oil, Gas & Consumable Fuels": "ไฟ",
  // ดิน (อสังหา/ก่อสร้าง)
  "Real Estate": "ดิน", "Construction": "ดิน", "Construction Materials": "ดิน",
  "Construction & Engineering": "ดิน", "Real Estate Investment Trusts": "ดิน",
  // ทอง (เทคโนโลยี/อุตสาหกรรม/วัสดุ)
  "Technology": "ทอง", "Information Technology": "ทอง", "Semiconductors": "ทอง",
  "Industrials": "ทอง", "Capital Goods": "ทอง", "Materials": "ทอง",
  "Metals & Mining": "ทอง", "Chemicals": "ทอง", "Machinery": "ทอง",
  "Automobiles & Components": "ทอง", "Automobile and Auto Components": "ทอง",
  "Consumer Durables": "ทอง",
  "Basic Materials": "ทอง", "Paper & Forest Products": "ทอง",
  "Financial Services": "น้ำ", "Financials": "น้ำ", "Banks": "น้ำ", "Insurance": "น้ำ",
  "Capital Markets": "น้ำ", "Consumer Discretionary": "น้ำ", "Consumer Staples": "น้ำ",
  "Food & Beverage": "น้ำ", "Retailing": "น้ำ", "Transportation": "น้ำ",
  "Conglomerates": "น้ำ", "Fast Moving Consumer Goods": "น้ำ",
  "Consumer Products": "น้ำ", "Household & Personal Products": "น้ำ",
  "Consumer Services": "น้ำ",
  "Healthcare": "ไฟ", "Realty": "ดิน",
};

/** TradingView sector taxonomy → ธาตุ (fallback: GICS เหมือนกันส่วนใหญ่ + เทียบเคียง) */
const TV_SECTOR_TO_ELEMENT: Record<string, El> = {
  "Technology Services": "ทอง", "Electronic Technology": "ทอง",
  "Producer Manufacturing": "ทอง", "Process Industries": "ทอง",
  "Non-Energy Minerals": "ทอง", "Industrial Services": "ทอง",
  "Finance": "น้ำ", "Retail Trade": "น้ำ", "Distribution Services": "น้ำ",
  "Consumer Non-Durables": "น้ำ", "Consumer Durables": "ทอง",
  "Consumer Services": "น้ำ", "Transportation": "น้ำ", "Health Services": "ไฟ",
  "Health Technology": "ไฟ", "Energy Minerals": "ไฟ", "Utilities": "ไฟ",
  "Communications": "ไม้", "Commercial Services": "น้ำ", "Miscellaneous": "น้ำ",
};

interface Row {
  symbol: string; name: string; sector: string; market: string;
  country: string; currency: string; tvSector?: string;
}

// ───────── Wikipedia parsers ─────────

/** NIFTY Next 50: | [[ABB|ABB India]] ||ABB || Capital Goods */
function parseNiftyNext50(wt: string): Row[] {
  const rows: Row[] = [];
  for (const line of wt.split("\n")) {
    const m = line.match(/^\|\s*\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]\s*\|\|\s*([A-Z0-9.-]+)\s*\|\|\s*([^|]+)/);
    if (!m) continue;
    const name = (m[2] ?? m[1]).trim().replace(/\(.*\)/, "").trim();
    const sector = m[4].trim();
    if (name && sector && SECTOR_TO_ELEMENT[sector]) {
      rows.push({ symbol: `${m[3]}.NS`, name, sector, market: "NSE", country: "IN", currency: "INR" });
    }
  }
  return rows;
}

/** S&P/TSX Composite: | {{TSX link|VNP}} || [[5N Plus|5N Plus Inc.]] || Materials || Chemicals */
function parseTsxComposite(wt: string): Row[] {
  const rows: Row[] = [];
  for (const line of wt.split("\n")) {
    const m = line.match(/^\|\s*\{\{[^|}]*\|([A-Z0-9.-]{1,6})\}\}\s*\|\|\s*\[?\[?([^\]|]+?)(?:\|[^\]|]+?)?\]?\]?\s*\|\|\s*([^|]+)/);
    if (!m) continue;
    const name = m[2].trim().replace(/\(.*\)/, "").trim();
    const sector = m[3].trim();
    if (name && sector && SECTOR_TO_ELEMENT[sector]) {
      rows.push({ symbol: `${m[1]}.TO`, name, sector, market: "TSX", country: "CA", currency: "CAD" });
    }
  }
  return rows;
}

/** CSI 300: |{{SSE|600519}} / |[[Kweichow Moutai]] หรือ |Zhangzhou Pharma (ชื่อเปล่า) / |Consumer Staples / |Shanghai */
function parseCsi300(wt: string): Row[] {
  const rows: Row[] = [];
  const lines = wt.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\|\{\{(SSE|SZSE)\|(\d{6})\}\}/);
    if (!m) continue;
    const nameLine = lines[i + 1] ?? "";
    // รองรับทั้ง |[[ชื่อ]] และ |ชื่อเปล่า (ไม่มีลิงก์)
    const name = nameLine
      .match(/^\|\s*\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]/)?.slice(1)?.filter(Boolean)?.[0]?.trim()
      ?? nameLine.match(/^\|\s*([^|]+?)\s*$/)?.slice(1)?.[0]?.trim()
      ?? "";
    const sector = (lines[i + 2] ?? "").match(/^\|\s*([^|]+)/)?.[1]?.trim() ?? "";
    if (name && sector && SECTOR_TO_ELEMENT[sector]) {
      const isSSE = m[1] === "SSE";
      rows.push({
        symbol: isSSE ? `${m[2]}.SS` : `${m[2]}.SZ`,
        name, sector,
        market: isSSE ? "SSE" : "SZSE",
        country: "CN", currency: "CNY",
      });
    }
  }
  return rows;
}

// ───────── TradingView scanner ─────────

async function fetchTradingView(market: string, exchange: string): Promise<Row[]> {
  const res = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "market_cap_basic", "sector"],
      filter: [
        { left: "exchange", operation: "equal", right: exchange },
        { left: "type", operation: "equal", right: "stock" },
      ],
      options: { lang: "en" },
      range: [0, 120],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const out: Row[] = [];
  for (const r of json.data ?? []) {
    const [name, desc, , tvSector] = r.d as [string, string, number, string];
    const el = TV_SECTOR_TO_ELEMENT[tvSector];
    if (!el) continue;
    const symRaw = r.s.split(":")[1] ?? name;
    const isHK = market === "hongkong";
    const isVN = market === "vietnam";
    // HKEX RMB counter (5 หลักขึ้นต้น 8: 80700 = 700.HK) — ซ้ำกับหุ้นหลัก ข้าม
    if (isHK && /^8\d{4}$/.test(symRaw)) continue;
    const symbol = isHK ? `${symRaw}.HK` : symRaw;
    out.push({
      symbol,
      name: desc || name,
      sector: tvSector,
      tvSector,
      market: isHK ? "HKEX" : isVN ? "HOSE" : exchange,
      country: isHK ? "HK" : isVN ? "VN" : "?",
      currency: isHK ? "HKD" : isVN ? "VND" : "?",
    });
  }
  return out;
}

// ───────── main ─────────

async function main() {
  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };
  const existing = new Set(db.stocks.map((s) => s.ticker as string));
  const added: string[] = [];
  const skipped: Record<string, number> = {};

  const addRows = (rows: Row[], source: string) => {
    for (const r of rows) {
      if (existing.has(r.symbol)) {
        skipped[r.symbol] = (skipped[r.symbol] ?? 0) + 1;
        continue;
      }
      const el = SECTOR_TO_ELEMENT[r.sector] ?? TV_SECTOR_TO_ELEMENT[r.tvSector ?? ""];
      if (!el) continue;
      db.stocks.push({
        type: "stock",
        ticker: r.symbol,
        name: r.name,
        nameEn: r.name,
        country: r.country,
        market: r.market,
        currency: r.currency,
        sector: r.sector,
        business: r.name,
        businessKeywords: [],
        growthStage: "large",
        theme: [],
        risingStar: false,
        listedDate: null,
        elements: [el],
        primaryElement: el,
        elementReason: `GICS sector: ${r.sector} → ธาตุ ${el} (auto-map — รอซินแสตรวจ)`,
        elementSource: source,
        tier: "large",
        isHighLiquidity: true,
        status: "draft",
        reviewedBy: null,
        reviewedAt: null,
        notes: "auto-fetch — ธาตุจาก sector ต้องให้ซินแสตรวจ",
      });
      existing.add(r.symbol);
      added.push(r.symbol);
    }
  };

  // 1. อินเดีย — NIFTY Next 50
  console.log("📡 NIFTY Next 50 (Wikipedia)...");
  try {
    const res = await fetch(
      "https://en.wikipedia.org/w/api.php?action=parse&page=NIFTY%20Next%2050&format=json&prop=wikitext&redirects=1",
      { headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" } },
    );
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
    const rows = parseNiftyNext50(json.parse?.wikitext?.["*"] ?? "");
    console.log(`  พบ ${rows.length} แถว`);
    addRows(rows, "Wikipedia GICS sector (auto) — draft รอตรวจ");
  } catch (e) { console.log(`  ⚠️ ${(e as Error).message}`); }
  await new Promise((r) => setTimeout(r, 2000));

  // 2. แคนาดา — S&P/TSX Composite
  console.log("📡 S&P/TSX Composite (Wikipedia)...");
  try {
    const res = await fetch(
      "https://en.wikipedia.org/w/api.php?action=parse&page=S%26P%2FTSX%20Composite%20Index&format=json&prop=wikitext&redirects=1",
      { headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" } },
    );
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
    const rows = parseTsxComposite(json.parse?.wikitext?.["*"] ?? "");
    console.log(`  พบ ${rows.length} แถว`);
    addRows(rows, "Wikipedia GICS sector (auto) — draft รอตรวจ");
  } catch (e) { console.log(`  ⚠️ ${(e as Error).message}`); }
  await new Promise((r) => setTimeout(r, 2000));

  // 3. จีน — CSI 300
  console.log("📡 CSI 300 (Wikipedia)...");
  try {
    const res = await fetch(
      "https://en.wikipedia.org/w/api.php?action=parse&page=CSI%20300%20Index&format=json&prop=wikitext&redirects=1",
      { headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" } },
    );
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } } };
    const rows = parseCsi300(json.parse?.wikitext?.["*"] ?? "");
    console.log(`  พบ ${rows.length} แถว`);
    addRows(rows, "Wikipedia GICS sector (auto) — draft รอตรวจ");
  } catch (e) { console.log(`  ⚠️ ${(e as Error).message}`); }
  await new Promise((r) => setTimeout(r, 2000));

  // 4. ฮ่องกง — TradingView HKEX top-100
  console.log("📡 HKEX top-100 (TradingView)...");
  try {
    const rows = await fetchTradingView("hongkong", "HKEX");
    console.log(`  พบ ${rows.length} แถว`);
    addRows(rows, "TradingView sector (auto) — draft รอตรวจ");
  } catch (e) { console.log(`  ⚠️ ${(e as Error).message}`); }
  await new Promise((r) => setTimeout(r, 2000));

  // 5. เวียดนาม — TradingView HOSE top-100
  console.log("📡 HOSE top-100 (TradingView)...");
  try {
    const rows = await fetchTradingView("vietnam", "HOSE");
    console.log(`  พบ ${rows.length} แถว`);
    addRows(rows, "TradingView sector (auto) — draft รอตรวจ");
  } catch (e) { console.log(`  ⚠️ ${(e as Error).message}`); }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  // สรุปต่อตลาด
  const byMarket: Record<string, number> = {};
  for (const s of db.stocks) {
    const m = s.market as string;
    byMarket[m] = (byMarket[m] ?? 0) + 1;
  }
  console.log(`\n✅ เพิ่มใหม่ ${added.length} ตัว → รวม ${db.stocks.length}`);
  console.log("   ตลาด:", JSON.stringify(byMarket));
  console.log(`→ ${OUT}`);
}

main().catch((err) => { console.error("❌", err); process.exit(1); });
