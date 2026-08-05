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
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1] ?? 60);

async function main() {
  const snap = loadSnapshot();
  if (!snap) throw new Error("ยังไม่มี snapshot ราคา — รัน scripts/fetch-market-data.ts ก่อน");

  // เรียงตาม market cap ในคลัง แล้วเลือก top (ไทย/โลก แยก)
  const ranked = getAllStocks()
    .map((s) => ({ s, cap: snap.quotes[yahooTicker(s.ticker, s.market)]?.marketCap ?? 0 }))
    .sort((a, b) => b.cap - a.cap);
  const th = ranked.filter((r) => r.s.market === "SET" || r.s.market === "mai").slice(0, Math.ceil(LIMIT / 2));
  const gl = ranked.filter((r) => !(r.s.market === "SET" || r.s.market === "mai")).slice(0, Math.floor(LIMIT / 2));
  const targets = [...th, ...gl];

  const cache = loadFundamentalsCache();
  const pending = targets.filter(({ s }) => !cache.has(yahooTicker(s.ticker, s.market)));
  console.log(`📡 fundamentals: เป้า ${targets.length} ตัว, มี cache แล้ว ${targets.length - pending.length}, จะ fetch ${pending.length}`);

  const session = await openYahooSession();
  let ok = 0;
  let i = 0;
  for (const { s } of pending) {
    i++;
    const yt = yahooTicker(s.ticker, s.market);
    const f = await fetchFundamentals(yt, session, cache);
    if (f) ok++;
    if (i % 10 === 0 || i === pending.length) {
      console.log(`  progress ${i}/${pending.length} (ได้ ${ok})`);
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
