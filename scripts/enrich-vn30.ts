/**
 * ENRICH หุ้นเวียดนาม: เติม VN30 ให้ครบ 30 ตัว — แก้ KNOWN-ISSUES #3
 *
 * แหล่งข้อมูล:
 *   - รายชื่อ VN30: investing.com VN 30 Components (2026-08-04, ผ่าน browser —
 *     curl โดน 403) — รายชื่อ 30 ตัวจริงตามที่ HOSE ประกาศ
 *   - sector/industry: stockanalysis.com /quote/hose/{SYM}/ (ฟรี ไม่ต้อง key)
 *
 * หมายเหตุ: BVH หลุดจาก VN30 (เกณฑ์ liquidity ใหม่ July 2025) ถูกแทนที่ด้วย DGC
 *   — ตามประกาศ ssc.gov.vn; รายชื่อล่าสุด (2026-08) มี VPL (Vinpearl) เข้ามา
 *
 * รัน: npx tsx scripts/enrich-vn30.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

type El = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** VN30 constituents (investing.com components, 2026-08-04) */
const VN30: Array<{ symbol: string; name: string }> = [
  { symbol: "ACB", name: "Asia Commercial Bank" },
  { symbol: "SHB", name: "Sai Gon - Hanoi Bank" },
  { symbol: "BID", name: "BIDV" },
  { symbol: "CTG", name: "VietinBank" },
  { symbol: "FPT", name: "FPT Corporation" },
  { symbol: "GAS", name: "Petrovietnam Gas" },
  { symbol: "HPG", name: "Hoa Phat Group" },
  { symbol: "MBB", name: "MBBank" },
  { symbol: "MSN", name: "Masan Group" },
  { symbol: "MWG", name: "Mobile World" },
  { symbol: "SSI", name: "SSI Securities" },
  { symbol: "STB", name: "Sacombank" },
  { symbol: "VCB", name: "Vietcombank" },
  { symbol: "VIC", name: "Vingroup" },
  { symbol: "VNM", name: "Vinamilk" },
  { symbol: "SAB", name: "Sabeco" },
  { symbol: "VIB", name: "VIB Bank" },
  { symbol: "VJC", name: "Vietjet" },
  { symbol: "PLX", name: "Petrolimex" },
  { symbol: "VPB", name: "VPBank" },
  { symbol: "LPB", name: "LienVietPostBank" },
  { symbol: "VRE", name: "Vincom Retail" },
  { symbol: "HDB", name: "HDBank" },
  { symbol: "BSR", name: "Binh Son Refining" },
  { symbol: "VHM", name: "Vinhomes" },
  { symbol: "GVR", name: "Vietnam Rubber" },
  { symbol: "TPB", name: "TPBank" },
  { symbol: "TCB", name: "Techcombank" },
  { symbol: "SSB", name: "SEA Bank" },
  { symbol: "VPL", name: "Vinpearl" },
];

/** industry text → GICS sector (keyword rules — เดียวกับ enrich-hk-gics) */
const INDUSTRY_TO_SECTOR: Array<{ kw: RegExp; sector: string }> = [
  { kw: /bank|financial|finance|insurance|securities|investment|asset/i, sector: "Financials" },
  { kw: /petroleum|oil|gas|energy|coal|petrochemical|refin|fuel/i, sector: "Energy" },
  { kw: /electric|power|utility|water/i, sector: "Utilities" },
  { kw: /real estate|property|reit|nonresidential|buildings/i, sector: "Real Estate" },
  { kw: /pharmaceutical|biotech|biologics|drug|medical|health|hospital|medication|medicine|pharma/i, sector: "Health Care" },
  { kw: /semiconductor|chip/i, sector: "Semiconductors" },
  { kw: /technology|software|internet|e-commerce|telecom|communication|video game|online|electronics|computer|hardware|artificial intelligence|photovoltaic|solar/i, sector: "Technology" },
  { kw: /automobile|auto|motor|vehicle|car/i, sector: "Automobiles & Components" },
  { kw: /airline|aviation|transport|logistics|shipping|railway|express/i, sector: "Transportation" },
  { kw: /steel|metal|mining|aluminum|aluminium|glass|cement|material|chemical|rubber/i, sector: "Materials" },
  { kw: /retail|department store|supermarket|consumer|apparel|footwear|textile|hygiene|trading/i, sector: "Consumer Discretionary" },
  { kw: /food|beverage|beer|brew|dairy|snack/i, sector: "Food & Beverage" },
  { kw: /hotel|casino|gaming|restaurant|leisure|travel|tourism|resort|amusement|recreation/i, sector: "Hotels, Restaurants & Leisure" },
  { kw: /toy|jewelry|jewellery|personal|household/i, sector: "Consumer Products" },
  { kw: /machinery|industrial|equipment|manufacturing|construction/i, sector: "Industrials" },
  { kw: /conglomerate|holding/i, sector: "Conglomerates" },
];

function industryToSector(industry: string): string | null {
  const text = industry.replace(/\[\[|\]\]|\{\{|\}\}|\|/g, "").toLowerCase();
  for (const { kw, sector } of INDUSTRY_TO_SECTOR) {
    if (kw.test(text)) return sector;
  }
  return null;
}

const SECTOR_TO_ELEMENT: Record<string, El> = {
  Financials: "น้ำ", "Financial Services": "น้ำ", Energy: "ไฟ", Utilities: "ไฟ",
  "Real Estate": "ดิน", "Health Care": "ไฟ", Semiconductors: "ทอง", Technology: "ทอง",
  "Automobiles & Components": "ทอง", Transportation: "น้ำ", Materials: "ทอง",
  "Consumer Discretionary": "น้ำ", "Food & Beverage": "น้ำ",
  "Hotels, Restaurants & Leisure": "น้ำ", "Consumer Products": "น้ำ",
  Industrials: "ทอง", Conglomerates: "น้ำ", "Communication Services": "ไม้",
  "Basic Materials": "ทอง", "Consumer Staples": "น้ำ", "Consumer Defensive": "น้ำ",
  "Consumer Cyclical": "น้ำ", Healthcare: "ไฟ", "Information Technology": "ทอง",
  "Telecommunication Services": "ไม้",
};

/** ดึง industry/sector จาก stockanalysis.com /quote/hose/{SYM}/ */
async function fetchStockAnalysis(symbol: string): Promise<{ sector: string | null; industry: string | null }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://stockanalysis.com/quote/hose/${symbol}/`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (!res.ok) return { sector: null, industry: null };
      const html = await res.text();
      // Sector/Industry box: 2 รูปแบบ
      //   แบบมี link:  <a href="/stocks/sector/technology/">Technology</a>
      //   แบบ plain:  <span class="block font-semibold">Industry</span> <!--[!--><span>Commercial Banks</span>
      const sectorM = html.match(/<a href="\/stocks\/sector\/([a-z-]+)\/"/);
      const industryM =
        html.match(/<a href="\/stocks\/industry\/([a-z-]+)\/"/) ??
        html.match(/font-semibold">Industry<\/span>\s*<!--\[!--><span>([^<]+)<\/span>/);
      const fmt = (s: string) =>
        s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      return {
        sector: sectorM ? fmt(sectorM[1]) : null,
        industry: industryM ? fmt(industryM[1]) : null,
      };
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  return { sector: null, industry: null };
}

async function main() {
  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };
  const byTicker = new Map(db.stocks.map((s) => [s.ticker as string, s]));

  let added = 0;
  let enriched = 0;
  const missingSector: string[] = [];

  for (const v of VN30) {
    const existing = byTicker.get(v.symbol);
    if (existing) {
      // ตัวที่มีอยู่แล้ว (map มือ) — อัปเดตชื่อให้ตรง VN30 + mark ว่าเป็น VN30
      existing.vn30 = true;
      enriched++;
      continue;
    }
    // ตัวใหม่ — ดึง sector/industry จาก stockanalysis
    const { sector, industry } = await fetchStockAnalysis(v.symbol);
    const sectorFinal = sector ?? (industry ? industryToSector(industry) : null) ?? null;
    const el = sectorFinal ? SECTOR_TO_ELEMENT[sectorFinal] : undefined;
    if (!sectorFinal || !el) {
      missingSector.push(v.symbol);
      console.log(`  ⚠️ ${v.symbol} (${v.name}): หา sector ไม่เจอ (sector=${sector}, industry=${industry})`);
      continue;
    }
    db.stocks.push({
      type: "stock",
      ticker: v.symbol,
      name: v.name,
      nameEn: v.name,
      country: "VN",
      market: "HOSE",
      currency: "VND",
      sector: sectorFinal,
      business: v.name,
      businessKeywords: [],
      growthStage: "large",
      theme: [],
      risingStar: false,
      listedDate: null,
      elements: [el],
      primaryElement: el,
      elementReason: `GICS sector (stockanalysis): ${sectorFinal} → ธาตุ ${el} (auto — รอซินแสตรวจ)`,
      elementSource: "stockanalysis.com GICS (auto) — draft รอตรวจ",
      tier: "large",
      isHighLiquidity: true,
      status: "draft",
      reviewedBy: null,
      reviewedAt: null,
      vn30: true,
      notes: "ธาตุตลาด เวียดนาม = ไม้ (ทิศตะวันออกเฉียงใต้) — ใช้บท 8; verdict หุ้นใช้ธาตุธุรกิจนี้",
    });
    byTicker.set(v.symbol, db.stocks[db.stocks.length - 1]);
    added++;
    console.log(`  ✅ ${v.symbol} (${v.name}) → ${sectorFinal} → ${el}`);
    await new Promise((r) => setTimeout(r, 600)); // กัน anti-bot
  }

  // mark ตัว VN ที่มีอยู่แล้วว่าไม่ใช่ VN30 (PNJ/PVD/DPM/VND/DGC)
  for (const s of db.stocks) {
    if ((s.country as string) === "VN" && !byTicker.get(s.ticker as string)?.vn30) {
      s.vn30 = false;
    }
  }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  console.log(`\n✅ VN: เพิ่มใหม่ ${added} ตัว, mark VN30 ${enriched} ตัว`);
  if (missingSector.length) console.log(`  ⚠️ sector ไม่เจอ: ${missingSector.join(", ")}`);
  console.log(`→ ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
