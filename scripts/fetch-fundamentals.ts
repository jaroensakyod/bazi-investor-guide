/**
 * FETCH FUNDAMENTALS: ดึงตัวเลขพื้นฐาน (financialData) ของหุ้นเด่น → cache data/cache/fundamentals.json
 *
 * รัน: npx tsx scripts/fetch-fundamentals.ts --limit 60
 *   (default: top 30 ไทย + top 30 โลก โดย market cap จาก snapshot ล่าสุด — resumable)
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import { fetchFundamentals, loadFundamentalsCache, saveFundamentalsCache } from "../src/lib/market/fundamentals";
import { loadSnapshot } from "../src/lib/market/market-data";
import { getAllStocks } from "../src/lib/investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const snap = loadSnapshot();
  if (!snap) throw new Error("ยังไม่มี snapshot ราคา — รัน scripts/fetch-market-data.ts ก่อน");

  const cache = loadFundamentalsCache();
  const all = getAllStocks()
    .map((s) => ({ s, yt: yahooTicker(s.ticker, s.market), cap: snap.quotes[yahooTicker(s.ticker, s.market)]?.marketCap ?? 0 }))
    .filter(({ yt }) => yt && !cache.has(yt));

  // 1) ตัวใหญ่ 40 (รายงาน/เช็คลิสต์) 2) ตัวกลาง-เล็ก 160 (hidden gems — กลุ่มที่ใต้ผืนน้ำจริง)
  const TOP_TIERS = new Set(["SET50", "SET100", "mega", "large"]);
  const big = all.filter(({ s }) => TOP_TIERS.has(s.tier)).sort((a, b) => b.cap - a.cap).slice(0, 40);
  const midSmall = all
    .filter(({ s }) => !TOP_TIERS.has(s.tier) && snap.quotes[yahooTicker(s.ticker, s.market)]?.marketCap)
    .sort((a, b) => b.cap - a.cap)
    .slice(0, 160);
  const pending = [...big, ...midSmall];
  const seen = new Set<string>();
  const targets = pending.filter(({ yt }) => (seen.has(yt) ? false : (seen.add(yt), true)));
  console.log(`📡 fundamentals: จะ fetch ${targets.length} ตัว (ใหญ่ ${big.length} + กลาง-เล็ก ${midSmall.length})`);

  const session = await openYahooSession();
  let ok = 0;
  let i = 0;
  for (const { s } of targets) {
    i++;
    const yt = yahooTicker(s.ticker, s.market);
    const f = await fetchFundamentals(yt, session, cache);
    if (f) ok++;
    if (i % 10 === 0 || i === targets.length) {
      console.log(`  progress ${i}/${targets.length} (ได้ ${ok})`);
      saveFundamentalsCache(cache);
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  saveFundamentalsCache(cache);
  console.log(`\n✅ fundamentals cache: ${cache.size} ตัว (รอบนี้ได้ ${ok})`);
  console.log("ตัวอย่าง (KBANK):");
  const kb = cache.get("KBANK.BK");
  if (kb) console.log(`   ROE=${kb.roe}% D/E=${kb.debtToEquity}% GM=${kb.grossMargin}% growth=${kb.revenueGrowth}%`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
