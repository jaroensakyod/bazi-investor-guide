/**
 * เทียบ "ยาม" (hour pillar) ที่ engine คำนวณ กับตารางซินแส (ตารางตั้งคงใหม่)
 *
 * ตารางซินแส (Google Sheets — วัน stem 甲):
 *   0:00-0:59 甲子 | 1:00-2:59 乙丑 | 3:00-4:59 丙寅 | 5:00-6:59 丁卯
 *   7:00-8:59 戊辰 | 9:00-10:59 己巳 | 11:00-12:59 庚午 | 13:00-14:59 辛未
 *   15:00-16:59 壬申 | 17:00-18:59 癸酉 | 19:00-20:59 甲戌 | 21:00-22:59 乙亥
 *   23:00-23:59 甲子
 *
 * รัน: npx tsx scripts/check-hour-pillar.ts
 */
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";

// ตารางซินแส: [เวลา, ยามที่คาดหวัง] — วัน stem 甲 (ใช้ดวง 1988-06-08 = วัน 甲午)
const SINSAE_TABLE: Array<[string, string]> = [
  ["00:30", "甲子"],
  ["01:30", "乙丑"],
  ["03:30", "丙寅"],
  ["05:30", "丁卯"],
  ["07:30", "戊辰"],
  ["09:30", "己巳"],
  ["11:30", "庚午"],
  ["13:30", "辛未"],
  ["15:30", "壬申"],
  ["17:30", "癸酉"],
  ["19:30", "甲戌"],
  ["21:30", "乙亥"],
  ["23:30", "甲子"], // ★ จุดสำคัญ: 23:00-23:59 = 甲子 (ไม่เปลี่ยนวัน)
];

async function main() {
  const repo = createInMemoryKnowledgeRepository();
  let pass = 0;
  let fail = 0;

  for (const [time, expected] of SINSAE_TABLE) {
    const state = await calculateBaziChart(
      { birthDate: "1988-06-08", birthTime: time, gender: "female", province: "Bangkok", timezone: "Asia/Bangkok" },
      repo,
    );
    const { stem, branch } = state.fourPillars.hour;
    const actual = `${stem}${branch}`;
    const dayPillar = `${state.fourPillars.day.stem}${state.fourPillars.day.branch}`;
    const ok = actual === expected;
    if (ok) pass++;
    else {
      fail++;
      console.log(`❌ ${time} → engine: ${actual} (วัน ${dayPillar}) | ซินแส: ${expected}`);
    }
  }

  console.log(`\nผลลัพธ์: ${pass}/${SINSAE_TABLE.length} ตรงกับตารางซินแส, ไม่ตรง ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main();
