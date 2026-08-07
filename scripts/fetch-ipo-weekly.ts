/**
 * FETCH IPO รายสัปดาห์ (ทุกวันจันทร์) — ส่วนอัตโนมัติ 100% (หัวรันได้)
 *
 * 1. markListed — IPO ที่วันขึ้นผ่านไปแล้ว → status=listed (กันหลุดจาก upcoming)
 * 2. US: StockAnalysis calendar (fetchIposFromStockAnalysis)
 * 3. AU: ASX upcoming floats (fetchAsxIpos)
 * 4. merge ไม่ซ้ำ (market+ticker) → เขียน data/ipo.json + สรุป
 *
 * ส่วน curated (TH SET/browser · KR/HK/MY/VN/AE/IN — web search) ทำใน cron agent
 * รัน: npx tsx scripts/fetch-ipo-weekly.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fetchIposFromStockAnalysis, markListed, mergeIpos } from "../src/lib/investor/ipo";
import type { IpoEntry } from "../src/lib/investor/ipo";
import { fetchAsxIpos } from "./fetch-ipo-asx";

const FILE = "data/ipo.json";

type Db = { updatedAt: string; count: number; entries: IpoEntry[] };

export function loadIpoDb(): Db {
  return JSON.parse(readFileSync(FILE, "utf8")) as Db;
}

export async function runWeeklyIpoFetch(): Promise<{ total: number; added: number; listed: number; upcoming: number }> {
  const before = loadIpoDb().entries.length;
  const existing = markListed(loadIpoDb().entries);
  const listed = existing.filter((e) => e.status === "listed").length;

  let entries = existing;
  let added = 0;
  try {
    const us = await fetchIposFromStockAnalysis();
    const merged = mergeIpos(entries, us);
    added += merged.added;
    entries = merged.entries;
    console.log(`📡 US (StockAnalysis): +${merged.added} ใหม่ / อัปเดต ${merged.updated}`);
  } catch (e) {
    console.log(`⚠️ US ล้มเหลว: ${(e as Error).message} — ข้าม (ใช้ข้อมูลเดิม)`);
  }
  try {
    const au = fetchAsxIpos() as IpoEntry[];
    const merged2 = mergeIpos(entries, au);
    added += merged2.added;
    entries = merged2.entries;
    console.log(`📡 AU (ASX): +${merged2.added} ใหม่`);
  } catch (e) {
    console.log(`⚠️ AU ล้มเหลว: ${(e as Error).message} — ข้าม`);
  }

  writeFileSync(FILE, JSON.stringify({ updatedAt: new Date().toISOString().slice(0, 10), count: entries.length, entries }, null, 2) + "\n", "utf8");
  const upcoming = entries.filter((e) => e.status !== "listed").length;
  console.log(`\n✅ รวม ${entries.length} (เดิม ${before}, เพิ่ม ${added}, listed ${listed}) — upcoming ${upcoming} → ${FILE}`);
  return { total: entries.length, added, listed, upcoming };
}

runWeeklyIpoFetch().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
