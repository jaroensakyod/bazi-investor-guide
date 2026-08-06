/**
 * FETCH market data: ดึงราคา/valuation ของหุ้นทั้งคลัง (ไทย + โลก) จาก Yahoo
 * → บันทึก snapshot ไว้ data/cache/market/<date>.json + latest.json
 *
 * ปลอดภัยกับ rate limit:
 *  - batch 25 ตัว/request (fetchQuotes) → 2,900 หุ้น = ~116 requests
 *  - freshness gate: เพิ่งอัปเดตภายใน COOLDOWN_HOURS → ข้าม (กันรันซ้ำซ้อน)
 *  - circuit breaker: 429 ติดกัน 3 ครั้ง → หยุด บันทึกของที่ได้
 *
 * รัน: npx tsx scripts/fetch-market-data.ts [--force]
 */
import { readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQuotes, openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import { buildSnapshot, saveSnapshot } from "../src/lib/market/market-data";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LATEST = path.join(ROOT, "data/cache/market/latest.json");
/** ข้ามถ้า snapshot อัปเดตภายในกี่ชั่วโมง (ค่าเริ่มต้น 6h — กันรันซ้ำ/รันคู่) */
const COOLDOWN_HOURS = Number(process.env.FETCH_COOLDOWN_HOURS ?? 6);

function isFresh(): { fresh: boolean; ageH: number } {
  if (!existsSync(LATEST)) return { fresh: false, ageH: 999 };
  const ageH = (Date.now() - statSync(LATEST).mtimeMs) / 3_600_000;
  return { fresh: ageH < COOLDOWN_HOURS, ageH };
}

async function main() {
  const force = process.argv.includes("--force");

  // freshness gate — กันรันซ้ำซ้อน (cron รายวัน + manual ไม่เบิ้ลกัน)
  const { fresh, ageH } = isFresh();
  if (fresh && !force) {
    console.log(`⏭️  ข้าม — snapshot อัปเดตไปแล้วเมื่อ ${ageH.toFixed(1)} ชม.ที่แล้ว (cooldown ${COOLDOWN_HOURS}h) ใช้ --force ถ้าต้องการบังคับ`);
    return;
  }
  if (force) console.log(`🔁 โหมดบังคับ (--force) — ข้าม freshness gate (snapshot อายุ ${ageH.toFixed(1)} ชม.)`);

  const t0 = Date.now();
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
  console.log(`📡 ดึงราคา ${symbols.length} ตัว (ไทย ${symbols.filter((s) => s.endsWith(".BK")).length} + โลก) จาก Yahoo...`);

  const session = await openYahooSession();
  const quotes = await fetchQuotes(symbols, session, 25, 800, {
    onProgress: (done, total) => {
      if (done % 500 < 25) console.log(`   ...${done}/${total} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    },
  });
  const elapsed = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`✅ ได้ราคา ${quotes.size}/${symbols.length} ตัว ใน ${elapsed}s`);

  const snapshot = buildSnapshot(quotes.values());
  const file = saveSnapshot(snapshot);
  console.log(`💾 บันทึก snapshot → ${file}`);

  // ตัวอย่าง
  const sample = Object.entries(snapshot.quotes).slice(0, 5);
  for (const [sym, md] of sample) {
    console.log(`   • ${sym}: ${md.price} (${md.changePct ?? 0}%) PE=${md.pe ?? "-"} mcap=${md.marketCap ?? "-"}`);
  }
  const missing = symbols.length - quotes.size;
  if (missing > 0) console.log(`⚠️ ไม่ได้ราคา ${missing} ตัว (รันซ้ำรอบหน้าเติมให้ — resumable)`);
  console.log(`🛡️  สถิติ: ${symbols.length} ตัว = ~${Math.ceil(symbols.length / 25)} requests · หน่วง 800ms/chunk · circuit breaker เปิด`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
