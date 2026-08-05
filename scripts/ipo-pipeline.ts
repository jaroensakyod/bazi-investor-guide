/**
 * IPO PIPELINE CLI: ดึง IPO กำลังจะเข้าเทรด (StockAnalysis — US) → merge data/ipo.json
 *
 * รัน: npx tsx scripts/ipo-pipeline.ts
 *   (รันซ้ำได้ — merge ไม่ซ้ำ; ตัวที่เข้าเทรดแล้ว → listed)
 * TODO: เอเชีย (TW/JP/KR/...) — Investing.com calendar ผ่าน browser (pattern enrich-vn30)
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchIposFromStockAnalysis, markListed, mergeIpos, upcomingIpos, type IpoEntry } from "../src/lib/investor/ipo";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/ipo.json");

function load(): IpoEntry[] {
  if (!existsSync(FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as IpoEntry[] | { entries?: IpoEntry[] };
    return Array.isArray(parsed) ? parsed : (parsed.entries ?? []);
  } catch {
    return [];
  }
}

async function main() {
  const existing = markListed(load());
  console.log(`📡 ดึง IPO จาก StockAnalysis calendar...`);
  const incoming = await fetchIposFromStockAnalysis();
  const { entries, added, updated } = mergeIpos(existing, incoming);
  writeFileSync(
    FILE,
    JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), count: entries.length, entries }, null, 2) + "\n",
    "utf8",
  );
  console.log(`\n✅ รวม ${entries.length} รายการ (ใหม่ ${added}, อัปเดต ${updated}) → ${FILE}`);

  const upcoming = upcomingIpos(entries);
  console.log(`\n🗓 IPO กำลังจะเข้า ${upcoming.length} ตัว (2 สัปดาห์ข้างหน้า):`);
  const twoWeeks = upcoming.filter((e) => e.ipoDate <= new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10));
  for (const e of twoWeeks.slice(0, 15)) {
    console.log(`   • ${e.ipoDate} ${e.name} (${e.exchange}) ${e.priceRange ?? ""}`);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
