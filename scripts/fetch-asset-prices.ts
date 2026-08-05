/**
 * FETCH ASSET PRICES: ดึงราคาสินทรัพย์ (ทอง/น้ำมัน/คริปโต/ETF/REIT/บอนด์/forex) จาก Yahoo
 * → merge เข้า market snapshot เดียวกับหุ้น (data/cache/market/latest.json)
 *
 * หมายเหตุ: ใช้ Yahoo ทั้งหมด (รวม BTC-USD/ETH-USD — Yahoo มีให้) ไม่ต้อง CoinGecko แยก
 *
 * รัน: npx tsx scripts/fetch-asset-prices.ts
 */
import { getAssets } from "../src/lib/assets/asset-universe";
import { fetchQuotes, openYahooSession, type YahooQuote } from "../src/lib/market/yahoo";
import { loadSnapshot, saveSnapshot, type MarketSnapshot } from "../src/lib/market/market-data";

async function main() {
  // เฉพาะตัวที่มี Yahoo ticker (มี "." หรือเป็นสัญลักษณ์ฟิวเจอร์/คริปโต) — ข้ามข้อมูลนิ่ง
  const assets = getAssets().filter((a) => !a.ticker.includes("_") && a.ticker !== "THAIBOND" && !a.ticker.startsWith("S50"));
  const symbols = assets.map((a) => a.ticker);
  console.log(`📡 ดึงราคาสินทรัพย์ ${symbols.length} รายการ (${symbols.join(", ")})...`);

  const session = await openYahooSession();
  const quotes = await fetchQuotes(symbols, session);

  // merge เข้า snapshot เดิม (เก็บราคาหุ้นไว้ด้วย)
  const existing = loadSnapshot();
  const merged = buildSnapshotWithAssets(existing, quotes);
  const file = saveSnapshot(merged);
  console.log(`✅ snapshot อัปเดต → ${file} (มี ${Object.keys(merged.quotes).length} รายการ)`);

  for (const [sym, q] of quotes.entries()) {
    console.log(`   • ${sym}: ${q.regularMarketPrice} (${q.regularMarketChangePercent ?? 0}%)`);
  }
}

/** snapshot เดิม + ราคาสินทรัพย์ใหม่ (หุ้นคงเดิม สินทรัพย์ทับด้วยของสด) */
function buildSnapshotWithAssets(existing: MarketSnapshot | null, quotes: Map<string, YahooQuote>): MarketSnapshot {
  const base = existing ?? { updatedAt: new Date().toISOString(), quotes: {} };
  const all = new Map(Object.entries(base.quotes));
  for (const [sym, q] of quotes.entries()) {
    all.set(sym, {
      price: round2(q.regularMarketPrice),
      changePct: round2(q.regularMarketChangePercent),
      marketCap: q.marketCap,
      avgVolume: q.averageVolume,
      currency: q.currency,
      updatedAt: new Date().toISOString(),
    });
  }
  return { updatedAt: new Date().toISOString(), quotes: Object.fromEntries(all) };
}

function round2(n: number | undefined): number | undefined {
  return typeof n === "number" ? Math.round(n * 100) / 100 : undefined;
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
