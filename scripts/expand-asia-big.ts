/**
 * EXPAND universe ใหญ่ขึ้น (ตาม user: ตลาดใหญ่กว่าไทย ต้องมีหุ้นมากกว่านี้)
 * อินเดีย 300 · ญี่ปุ่น 400 · ไต้หวัน 200 · อินโดนีเซีย 150 · สิงคโปร์ 100  (+~1,150)
 *
 * แหล่ง: TradingView scanner (top by market cap) — pattern เดียวกับ expand-asia-universe
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts แล้ว npx tsx scripts/fetch-market-data.ts --force
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/global.json");

const MARKETS: Array<{ tv: string; exchange: string; country: string; market: string; currency: string; limit: number; name: string }> = [
  { tv: "india", exchange: "NSE", country: "IN", market: "NSE", currency: "INR", limit: 300, name: "อินเดีย" },
  { tv: "japan", exchange: "TSE", country: "JP", market: "TSE", currency: "JPY", limit: 400, name: "ญี่ปุ่น" },
  { tv: "taiwan", exchange: "TWSE", country: "TW", market: "TWSE", currency: "TWD", limit: 200, name: "ไต้หวัน" },
  { tv: "indonesia", exchange: "IDX", country: "ID", market: "IDX", currency: "IDR", limit: 150, name: "อินโดนีเซีย" },
  { tv: "singapore", exchange: "SGX", country: "SG", market: "SGX", currency: "SGD", limit: 100, name: "สิงคโปร์" },
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
  if (!res.ok) throw new Error(`${m.name} HTTP ${res.status}`);
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
  const db = JSON.parse(readFileSync(FILE, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
  const seen = new Set(db.stocks.map((s) => `${s.market}:${s.ticker}`));
  let added = 0;
  for (const m of MARKETS) {
    try {
      const rows = await fetchTradingView(m);
      let inMarket = 0;
      for (const r of rows) {
        const key = `${m.market}:${r.symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        db.stocks.push({
          type: "stock", ticker: r.symbol, name: r.name, nameEn: r.name, country: m.country, market: m.market, currency: m.currency,
          sector: r.sector, business: "", businessKeywords: [], primaryElement: sectorToElement(r.sector), elementReason: `GICS ${r.sector} → ${sectorToElement(r.sector)} (ตารางซินแส Source4/6)`,
          tier: r.cap > 1e11 ? "mega" : r.cap > 1e10 ? "large" : "mid", riskTier: "medium", cap: r.cap,
        });
        added += 1;
        inMarket += 1;
      }
      console.log(`📡 ${m.name} (${m.market}): ดึง ${rows.length} → เพิ่มใหม่ ${inMarket}`);
    } catch (e) {
      console.log(`❌ ${m.name}: ${(e as Error).message}`);
    }
  }
  db.meta.updatedAt = "2026-08-07";
  writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`\n✅ เพิ่มรวม ${added} ตัว → ทั้งหมด ${db.stocks.length}`);
}
main();
