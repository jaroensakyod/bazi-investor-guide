/**
 * EXPAND universe ยุโรป (Task 0.14): อังกฤษ/เยอรมนี/ฝรั่งเศส/สวิส
 *
 * TradingView scanner + is_primary=true (ตัด foreign listing เช่น NVDA บน Xetra)
 *   uk/LSE 100 · germany/XETR 80 · france (EURONEXT) 80 · switzerland/SIX 60
 * Yahoo suffix: LSE=.L · XETR=.DE · EPA=.PA · SWX=.SW (เพิ่มใน yahoo.ts แล้ว)
 *
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts (desc) แล้วเช็ค element distribution
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";
import type { ThaiElement } from "../src/lib/investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/global.json");

const MARKETS: Array<{ tv: string; exchange: string | null; country: string; market: string; currency: string; limit: number; name: string }> = [
  { tv: "uk", exchange: "LSE", country: "GB", market: "LSE", currency: "GBP", limit: 100, name: "อังกฤษ" },
  { tv: "germany", exchange: "XETR", country: "DE", market: "XETR", currency: "EUR", limit: 80, name: "เยอรมนี" },
  { tv: "france", exchange: null, country: "FR", market: "EPA", currency: "EUR", limit: 80, name: "ฝรั่งเศส" },
  { tv: "switzerland", exchange: "SIX", country: "CH", market: "SWX", currency: "CHF", limit: 60, name: "สวิส" },
];

type Row = { symbol: string; name: string; sector: string; cap: number };

async function fetchTradingView(m: (typeof MARKETS)[number]): Promise<Row[]> {
  const filter: Array<Record<string, unknown>> = [
    { left: "is_primary", operation: "equal", right: true },
    { left: "type", operation: "equal", right: "stock" },
  ];
  if (m.exchange) filter.push({ left: "exchange", operation: "equal", right: m.exchange });
  const res = await fetch(`https://scanner.tradingview.com/${m.tv}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "sector", "market_cap_basic"],
      filter,
      options: { lang: "en" },
      range: [0, m.limit],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const out: Row[] = [];
  let skippedSector = 0;
  for (const r of json.data ?? []) {
    const [name, desc, sector, cap] = r.d as [string, string, string, number];
    if (!sectorToElement(sector)) {
      skippedSector++;
      continue;
    }
    const symbol = (r.s.split(":")[1] ?? "").replace(/\.$/, ""); // RR. → RR (Yahoo ใช้ RR.L)
    if (!symbol) continue;
    out.push({ symbol, name: desc || name, sector, cap: cap ?? 0 });
  }
  if (skippedSector > 0) console.log(`  (ข้าม ${skippedSector} แถว sector ไม่มี map)`);
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
    console.log(`📡 ${m.name} (${m.tv}/${m.exchange ?? "EURONEXT"})...`);
    const rows = await fetchTradingView(m).catch((e) => {
      console.log(`  ⚠️ ${(e as Error).message}`);
      return [] as Row[];
    });
    console.log(`  พบ ${rows.length} แถว`);
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
    db.meta.label = `หุ้นโลก (Wikipedia/TradingView — รวมเอเชีย TW/SG/ID/MY/PH + ยุโรป GB/DE/FR/CH)`;
    writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  }
  const byCountry: Record<string, number> = {};
  db.stocks.forEach((s) => {
    byCountry[String(s.country)] = (byCountry[String(s.country)] ?? 0) + 1;
  });
  console.log(`\n✅ รวม ${db.stocks.length} ตัว (เพิ่ม ${added}, ข้ามซ้ำ ${skipped})`);
  console.log("by country:", JSON.stringify(byCountry));
  console.log("\nขั้นต่อไป: npx tsx scripts/enrich-descriptions-yahoo.ts");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
