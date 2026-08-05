/**
 * FETCH NEWS: ดึงข่าวจาก RSS (Yahoo/Investing/MarketWatch) → data/news.json (snapshot รายวัน)
 *
 * รัน: npx tsx scripts/fetch-news.ts
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchAllNews, type NewsItem } from "../src/lib/market/news";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/news.json");

function load(): NewsItem[] {
  if (!existsSync(FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as NewsItem[] | { items?: NewsItem[] };
    return Array.isArray(parsed) ? parsed : (parsed.items ?? []);
  } catch {
    return [];
  }
}

async function main() {
  console.log("📡 ดึงข่าวจาก RSS...");
  const fresh = await fetchAllNews();
  // merge: เก็บของเก่าไม่เกิน 7 วัน + ใหม่
  const existing = load();
  const cutoff = Date.now() - 7 * 864e5;
  const keep = existing.filter((i) => {
    const t = Date.parse(i.pubDate);
    return !isNaN(t) && t >= cutoff;
  });
  const byLink = new Map<string, NewsItem>();
  for (const i of [...keep, ...fresh]) byLink.set(i.link, i);
  const all = [...byLink.values()].sort((a, b) => Date.parse(b.pubDate) - Date.parse(a.pubDate)).slice(0, 200);

  writeFileSync(FILE, JSON.stringify({ updatedAt: new Date().toISOString(), count: all.length, items: all }, null, 1) + "\n", "utf8");
  console.log(`\n✅ ข่าวรวม ${all.length} รายการ (ใหม่ ${fresh.length}) → ${FILE}`);
  console.log("ตัวอย่าง:");
  for (const i of all.slice(0, 5)) {
    console.log(`   • [${i.source}] ${i.title.slice(0, 80)}${i.elements?.length ? ` (ธาตุ: ${i.elements.join("/")})` : ""}`);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
