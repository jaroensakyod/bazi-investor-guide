/**
 * ทำความสะอาดคลังหลัง expand ใหญ่ (รัน AFTER enrich-descriptions-yahoo จบ):
 * 1. dedupe ticker ซ้ำ — normalize (ตัด suffix .T/.KS/.AX/.VN/.HK/.NS/.TW/.SI/.JK/.KL/.PS/.TO/.BK/.SS/.SZ/.TWO)
 *    เก็บแถวที่ดีที่สุด (มี elements+business — เดิม suffix ชนะ) — กัน "7203.T" vs "7203"
 * 2. backfill elements = [primaryElement] (กฎเหล็ก: primaryElement ∈ elements)
 * 3. backfill business = sector (GICS — ข้อมูลจริง ไม่มโน) สำหรับตัวที่ Yahoo ไม่มี
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "data/stocks/global.json";
const db = JSON.parse(readFileSync(FILE, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };

const SUFFIX = /\.(BK|T|KS|SS|SZ|HK|TW|TWO|SI|JK|KL|PS|TO|AX|VN|NS|L|DE|PA|SW|BO|NE|MX|SA|TA|IS)$/i;
const norm = (tk: string) => tk.replace(SUFFIX, "").toUpperCase();

const byTicker = new Map<string, number>();
const keep: Array<Record<string, unknown>> = [];
let dupRemoved = 0;

for (const s of db.stocks) {
  const key = norm(String(s.ticker ?? ""));
  const existingIdx = byTicker.get(key);
  if (existingIdx !== undefined) {
    const ex = keep[existingIdx];
    const score = (x: Record<string, unknown>) =>
      (Array.isArray(x.elements) && x.elements.length ? 2 : 0) +
      (typeof x.business === "string" && x.business.length > 3 ? 1 : 0) +
      (typeof x.cap === "number" && x.cap > 0 ? 0.5 : 0);
    if (score(s) > score(ex)) keep[existingIdx] = s;
    dupRemoved += 1;
    continue;
  }
  byTicker.set(key, keep.length);
  keep.push(s);
}

// backfill elements + business
let elFilled = 0;
let bizFilled = 0;
for (const s of keep) {
  if (!Array.isArray(s.elements) || s.elements.length === 0) {
    s.elements = [s.primaryElement];
    elFilled += 1;
  }
  if (typeof s.business !== "string" || s.business.length <= 3) {
    s.business = `ประกอบธุรกิจในกลุ่ม ${String(s.sector ?? "—")} (GICS)`;
    bizFilled += 1;
  }
}

db.meta.updatedAt = "2026-08-07";
db.meta.cleaned = { dupRemoved, elFilled, bizFilled };
db.stocks = keep;
writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
console.log(`🧹 dedupe ลบ ${dupRemoved} · backfill elements ${elFilled} · business ${bizFilled} → รวม ${keep.length}`);
