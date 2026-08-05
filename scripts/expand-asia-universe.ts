/**
 * EXPAND universe เอเชีย (Task 0.15): ไต้หวัน/สิงคโปร์/อินโดนีเซีย/มาเลเซีย/ฟิลิปปินส์
 *
 * แหล่ง: TradingView scanner (pattern เดียวกับ expand-thai-universe) — top by market cap
 *   taiwan/TWSE 100 · singapore/SGX 60 · indonesia/IDX 60 · malaysia/KLSE 60 · philippines/PSE 60
 *
 * หมายเหตุ: ธาตุตลาด (ทิศจากไทย → ธาตุ) ของ 5 ตลาดใหม่ ยังไม่กำหนด — **รอซินแส** (decision-log)
 *   verdict รายตัวใช้ธาตุธุรกิจ (GICS → ธาตุ) เหมือนเดิม
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts (suffix .TW/.SI/.JK/.KL/.PS มีแล้ว)
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";
import type { ThaiElement } from "../src/lib/investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/global.json");

const MARKETS: Array<{ tv: string; exchange: string; country: string; market: string; currency: string; limit: number; name: string }> = [
  { tv: "taiwan", exchange: "TWSE", country: "TW", market: "TWSE", currency: "TWD", limit: 100, name: "ไต้หวัน" },
  { tv: "singapore", exchange: "SGX", country: "SG", market: "SGX", currency: "SGD", limit: 60, name: "สิงคโปร์" },
  { tv: "indonesia", exchange: "IDX", country: "ID", market: "IDX", currency: "IDR", limit: 60, name: "อินโดนีเซีย" },
  { tv: "malaysia", exchange: "MYX", country: "MY", market: "BURSA", currency: "MYR", limit: 60, name: "มาเลเซีย" },
  { tv: "philippines", exchange: "PSE", country: "PH", market: "PSE", currency: "PHP", limit: 60, name: "ฟิลิปปินส์" },
];

type Row = { symbol: string; name: string; sector: string; cap: number };

async function fetchTradingView(m: (typeof MARKETS)[number]): Promise<Row[]> {
  const res = await fetch(`https://scanner.tradingview.com/${m.tv}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "sector", "market_cap_basic"],
      filter: [
        { left: "exchange", operation: "equal", right: m.exchange },
        { left: "type", operation: "equal", right: "stock" },
      ],
      options: { lang: "en" },
      range: [0, m.limit],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const out: Row[] = [];
  for (const r of json.data ?? []) {
    const [name, desc, sector, cap] = r.d as [string, string, string, number];
    if (!sectorToElement(sector)) continue;
    const symbol = r.s.split(":")[1] ?? "";
    if (!symbol) continue;
    out.push({ symbol, name: desc || name, sector, cap: cap ?? 0 });
  }
  return out;
}

async function main() {
  const db = JSON.parse(readFileSync(FILE, "utf8")) as {
    meta: Record<string, unknown>;
    stocks: Array<Record<string, unknown>>;
  };
  const existing = new Set(db.stocks.map((s) => String(s.ticker)));

  let added = 0;
  let skipped = 0;
  for (const m of MARKETS) {
    console.log(`📡 ${m.name} (${m.tv}/${m.exchange})...`);
    const rows = await fetchTradingView(m).catch((e) => {
      console.log(`  ⚠️ ${(e as Error).message}`);
      return [] as Row[];
    });
    console.log(`  พบ ${rows.length} แถว (sector map ได้)`);
    rows.forEach((r, i) => {
      if (existing.has(r.symbol)) {
        skipped++;
        return;
      }
      const element = sectorToElement(r.sector) as ThaiElement;
      const tier = i < 20 ? "large" : "mid";
      db.stocks.push({
        type: "stock",
        ticker: r.symbol,
        name: r.name,
        nameEn: r.name,
        country: m.country,
        market: m.market,
        currency: m.currency,
        sector: r.sector,
        business: r.name,
        businessKeywords: [],
        growthStage: tier === "large" ? "large" : "mid",
        theme: [],
        risingStar: false,
        listedDate: null,
        elements: [element],
        primaryElement: element,
        elementReason: `TradingView sector: ${r.sector} → ธาตุ ${element} (auto-map — รอซินแสตรวจ)`,
        elementSource: "TradingView sector (auto) — draft รอตรวจ",
        tier,
        isHighLiquidity: tier === "large",
        status: "draft",
        reviewedBy: null,
        reviewedAt: null,
        notes: `ธาตุตลาด ${m.name} (ทิศ→ธาตุ) รอซินแส — verdict รายตัวใช้ธาตุธุรกิจนี้`,
      });
      existing.add(r.symbol);
      added++;
    });
    await new Promise((r) => setTimeout(r, 1500));
  }

  if (added > 0) {
    db.meta.updatedAt = new Date().toISOString().slice(0, 10);
    db.meta.label = `หุ้นโลก (Wikipedia/TradingView — รวมเอเชีย TW/SG/ID/MY/PH)`;
    writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  }
  const byCountry: Record<string, number> = {};
  db.stocks.forEach((s) => {
    byCountry[String(s.country)] = (byCountry[String(s.country)] ?? 0) + 1;
  });
  console.log(`\n✅ รวม ${db.stocks.length} ตัว (เพิ่ม ${added}, ข้ามซ้ำ ${skipped})`);
  console.log("by country:", JSON.stringify(byCountry));
  console.log("\nขั้นต่อไป: npx tsx scripts/enrich-descriptions-yahoo.ts (เติม description)");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
