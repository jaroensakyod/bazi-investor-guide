/**
 * WEEKLY FORTUNE — รายงาน "ฤกษ์รายสัปดาห์" (7 วัน) — ใช้กับ cron/digest (ไม่ต้องใช้ดวงผู้ใช้)
 *
 * รัน: npx tsx scripts/weekly-fortune.ts [--from 2026-08-10] [--days 7]
 */
import { weeklyAlmanacReport } from "../src/lib/fortune/investment-days";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const now = new Date();
const from = arg("--from") ?? now.toISOString().slice(0, 10);
const days = Number(arg("--days") ?? 7);

const r = weeklyAlmanacReport(from, days);
console.log(`🗓️ ฤกษ์ประจำสัปดาห์ (${r.fromDate} — ${r.days.length} วัน)\n`);
for (const d of r.days) {
  const specials = d.specialDays.length ? ` 📌${d.specialDays.join(" / ")}` : "";
  const star = d.goodStars >= 2 ? " ⭐" : "";
  console.log(
    `${d.date} (${d.weekday}) · ธาตุ${d.dayElement ?? "?"}${d.jianchu ? ` · ${d.jianchu.name} (${d.jianchu.meaning})` : ""}${star}${specials}`,
  );
  console.log(`   🎨 ${d.colors}`);
  if (d.luckyHours.length) console.log(`   ⏰ ยามดี: ${d.luckyHours.join(" · ")}`);
}
if (r.highlightDays.length) {
  console.log(`\n🌟 วันเด่นประจำสัปดาห์: ${r.highlightDays.map((h) => `${h.date} (${h.weekday}) ธาตุ${h.dayElement}`).join(" · ")}`);
}
console.log(`\n${r.compliance}`);
