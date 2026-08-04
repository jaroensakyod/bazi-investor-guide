/**
 * Smoke CLI: คำนวณดวงจากวันเกิด → แสดงผลสั้น ๆ (ใช้ตรวจ engine หลังคัดลอก)
 * รัน: npm run smoke
 */
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";

async function main() {
  const state = await calculateBaziChart(
    {
      birthDate: "1988-06-08",
      birthTime: "12:08",
      gender: "female",
      province: "Bangkok",
      timezone: "Asia/Bangkok",
    },
    createInMemoryKnowledgeRepository(),
  );

  const { year, month, day, hour } = state.fourPillars;
  console.log("ดิถี (Day Master):", state.dayMaster);
  console.log("สี่เสา: ปี", `${year.stem}${year.branch}`, "· เดือน", `${month.stem}${month.branch}`, "· วัน", `${day.stem}${day.branch}`, "· ยาม", `${hour.stem}${hour.branch}`);
  console.log("strengthScore:", state.strengthScore);
  console.log("วัยจร:", state.daYun.length, "ช่วง", "· ช่วงแรก อายุ", state.daYun[0]?.startAge, "–", state.daYun[0]?.endAge);
  console.log("elementAnalysis:", JSON.stringify(state.elementAnalysis?.elementStrengths ?? []));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
