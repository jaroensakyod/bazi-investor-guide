/**
 * FETCH IPO — ASX (ออสเตรเลีย) — curl ได้ ไม่มี bot block
 * รัน: npx tsx scripts/fetch-ipo-asx.ts  (merge เข้า data/ipo.json ไม่ซ้ำ)
 *
 * ครอบคลุมตลาด (2026-08): US=StockAnalysis (scripts/ipo-pipeline.ts) · TH=SET API (ต้องผ่าน browser — Incapsula บล็อก curl)
 * · AU=ไฟล์นี้ · KR/VN/HK/MY/CN/CA/AE=รอเพิ่มแหล่ง (ดู UPDATE.md)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const URL = "https://www.asx.com.au/listings/upcoming-floats-and-listings";

export function fetchAsxIpos(): Array<Record<string, unknown>> {
  const html = execSync(`curl -s -m 20 -A "${UA}" "${URL}"`, { encoding: "utf8" });
  const items = html.split('class="cmp-accordion__item"').slice(1);
  const out: Array<Record<string, unknown>> = [];
  const MONTHS: Record<string, string> = { january: "01", february: "02", march: "03", april: "04", may: "05", june: "06", july: "07", august: "08", september: "09", october: "10", november: "11", december: "12" };
  for (const it of items) {
    const title = it.match(/cmp-accordion__title">([^<]+)</)?.[1] ?? "";
    const code = it.match(/Security code<\/b><\/td><td[^>]*>\s*([A-Z0-9]{2,6})\s*</i)?.[1];
    if (!code) continue;
    const dm = title.match(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/i);
    const ipoDate = dm ? `${dm[3]}-${MONTHS[dm[2].toLowerCase()]}-${String(Number(dm[1])).padStart(2, "0")}` : null;
    const price = it.match(/Issue price<\/b><\/td><td[^>]*>\s*\$?\s*([0-9.]+)/i)?.[1];
    const activities = it.match(/Principal activities<\/b><\/td><td[^>]*>\s*([^<]+)/i)?.[1]?.trim();
    const name = title.replace(/-\s*\d{1,2} (?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}.*/i, "").replace(/#+$/, "").trim();
    out.push({ ticker: code, name, ipoDate, priceRange: price ? `A$${price}` : null, business: activities ?? "", status: "upcoming", market: "ASX", country: "AU", exchange: "ASX", currency: "AUD", source: "ASX upcoming floats" });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}`) {
  const FILE = "data/ipo.json";
  const db = JSON.parse(readFileSync(FILE, "utf8")) as { entries: Array<Record<string, unknown>>; count?: number };
  const seen = new Set(db.entries.map((e) => `${e.market}:${e.ticker}`));
  let added = 0;
  for (const o of fetchAsxIpos()) {
    if (!seen.has(`ASX:${o.ticker}`)) {
      db.entries.push({ ...o, fetchedAt: new Date().toISOString() });
      added += 1;
    }
  }
  db.count = db.entries.length;
  writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`📡 ASX: เพิ่ม ${added} ตัว → รวม ${db.entries.length}`);
}
