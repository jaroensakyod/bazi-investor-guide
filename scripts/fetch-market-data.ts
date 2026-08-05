/**
 * FETCH market data: ดึงราคา/valuation ของหุ้นทั้งคลัง (ไทย 129 + โลก 1,894) จาก Yahoo
 * → บันทึก snapshot ไว้ data/cache/market/<date>.json + latest.json
 *
 * ไม่เขียนกลับไฟล์คลัง (data/stocks/*.json) — merge ตอน runtime (market-data.ts)
 *
 * รัน: npx tsx scripts/fetch-market-data.ts
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQuotes, openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import { buildSnapshot, saveSnapshot } from "../src/lib/market/market-data";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function main() {
  const dbs = ["data/stocks/thailand.json", "data/stocks/global.json"].map((f) => {
    const db = JSON.parse(readFileSync(path.join(ROOT, f), "utf8")) as {
      stocks: Array<{ ticker: string; market: string }>;
    };
    return { file: f, stocks: db.stocks };
  });

  // รวบรวม yahoo ticker (dedupe)
  const byTicker = new Map<string, { ticker: string; market: string; src: string }>();
  for (const { file, stocks } of dbs) {
    for (const s of stocks) {
      const yt = yahooTicker(s.ticker, s.market);
      if (yt && !byTicker.has(yt)) byTicker.set(yt, { ...s, src: file });
    }
  }
  const symbols = [...byTicker.keys()];
  console.log(`📡 ดึงราคา ${symbols.length} ตัว (ไทย 129 + โลก ${symbols.length - 129}) จาก Yahoo...`);

  const session = await openYahooSession();
  const quotes = await fetchQuotes(symbols, session);
  console.log(`✅ ได้ราคา ${quotes.size}/${symbols.length} ตัว`);

  const snapshot = buildSnapshot(quotes.values());
  const file = saveSnapshot(snapshot);
  console.log(`💾 บันทึก snapshot → ${file}`);

  // ตัวอย่าง
  const sample = Object.entries(snapshot.quotes).slice(0, 5);
  for (const [sym, md] of sample) {
    console.log(`   • ${sym}: ${md.price} (${md.changePct ?? 0}%) PE=${md.pe ?? "-"} mcap=${md.marketCap ?? "-"}`);
  }
  const missing = symbols.length - quotes.size;
  if (missing > 0) console.log(`⚠️ ไม่ได้ราคา ${missing} ตัว (รันซ้ำรอบหน้าเติมให้)`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
