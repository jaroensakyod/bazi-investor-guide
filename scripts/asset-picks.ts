/**
 * หาสินทรัพย์ตามดวง (Asset Picks): ใส่วันเกิดจริง → เรียงหุ้นทั้งคลังตาม verdict
 *
 * รัน:
 *   npx tsx scripts/asset-picks.ts --birth "1990-05-15" --time "14:30" --gender female
 *   npx tsx scripts/asset-picks.ts --birth "1988-06-08" --time "12:08" --gender female --market TH --limit 10
 *
 * ตัวเลือก:
 *   --birth YYYY-MM-DD   (บังคับ)
 *   --time HH:MM         (บังคับ — ยามสำคัญ)
 *   --gender male|female (บังคับ — ทิศธาตุลาภ/วัยจร)
 *   --province ชื่อจังหวัด  (default Bangkok — ใช้ปรับเวลาจริง)
 *   --timezone IANA       (default Asia/Bangkok)
 *   --market TH|GLOBAL|ALL (default ALL)
 *   --element ไม้          (กรองเฉพาะธาตุที่ควรลงทุน)
 *   --limit N             (จำนวนหุ้นที่แสดงต่อกลุ่ม — default 15)
 */
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";
import {
  resolveInvestElements,
  scoreStock,
  resolveInvestorPersona,
  buildInvestorTimeline,
  wealthElementTh,
  type StockScore,
} from "@/lib/investor/investor-guide";
import { getThaiStocks, getGlobalStocks } from "@/lib/investor/stock-database";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name: string) => process.argv.includes(name);

const ICON: Record<StockScore["verdict"], string> = {
  "very-good": "✅✅",
  good: "✅",
  neutral: "🟡",
  avoid: "⛔",
};

async function main() {
  const birth = arg("--birth");
  const time = arg("--time");
  const gender = arg("--gender");
  if (!birth || !time || !gender) {
    console.error("❌ ต้องระบุ --birth --time --gender (ดูหัวไฟล์)");
    process.exit(1);
  }

  const state = await calculateBaziChart(
    {
      birthDate: birth,
      birthTime: time,
      gender,
      province: arg("--province") ?? "Bangkok",
      timezone: arg("--timezone") ?? "Asia/Bangkok",
    },
    createInMemoryKnowledgeRepository(),
  );

  const { year, month, day, hour } = state.fourPillars;
  const persona = resolveInvestorPersona(state);
  const { invest, avoid } = resolveInvestElements(state);
  const wealth = wealthElementTh(state);
  const age = state.ageSnapshot?.thaiAge ?? 0;
  const phase = buildInvestorTimeline(state).find((p) => age >= p.startAge && age <= p.endAge);

  console.log("══════════ หาสินทรัพย์ตามดวง ══════════");
  console.log(`เกิด: ${birth} ${time} (${gender}) อายุ ${age} ปี`);
  console.log(`สี่เสา: ${year.stem}${year.branch} / ${month.stem}${month.branch} / ${day.stem}${day.branch} / ${hour.stem}${hour.branch}`);
  console.log(`ธาตุลาภ: ${wealth} · การ์ดตัวตน: ${persona.emoji} ${persona.name} (${persona.element} ${persona.band})`);
  console.log(`ธาตุที่ควรลงทุน: ${invest.join(" > ")} · ควรเลี่ยง: ${avoid.join(", ")}`);
  if (phase) {
    const icon = phase.verdict === "invest" ? "🟢" : phase.verdict === "accumulate" ? "🔵" : phase.verdict === "avoid" ? "🟠" : "🔴";
    console.log(`วัยจรปัจจุบัน (${phase.ageRange}): ${icon} ${phase.verdict} — ${phase.advice}`);
  }

  // ── เรียง verdict ทั้งคลัง ──
  const market = (arg("--market") ?? "ALL").toUpperCase();
  const elementFilter = arg("--element");
  const limit = Number(arg("--limit") ?? 15);
  const pool =
    market === "TH" ? getThaiStocks() : market === "GLOBAL" ? getGlobalStocks() : [...getThaiStocks(), ...getGlobalStocks()];

  const scored = pool
    .filter((s) => !elementFilter || s.primaryElement === elementFilter)
    .map((s) =>
      scoreStock(state, {
        ticker: s.ticker,
        name: s.name,
        business: s.business,
        elements: s.elements,
        primaryElement: s.primaryElement,
      }),
    )
    .sort((a, b) => b.score - a.score || a.ticker.localeCompare(b.ticker));

  const countryOf = new Map(pool.map((s) => [s.ticker, `${s.country ?? ""}/${s.market ?? ""}`]));

  console.log(`\n── อันดับหุ้น (${market === "TH" ? "ไทย" : market === "GLOBAL" ? "โลก" : "ไทย+โลก"} ${pool.length} ตัว) ──`);

  const group = (v: StockScore["verdict"], title: string, cap: number) => {
    const rows = scored.filter((r) => r.verdict === v).slice(0, cap);
    if (rows.length === 0) return;
    console.log(`\n【${title}】${rows.length > 0 ? "" : ""}`);
    for (const r of rows) {
      console.log(`  ${ICON[r.verdict]} ${r.ticker.padEnd(10)} (${r.primaryElement}) score=${r.score} ${countryOf.get(r.ticker) ?? ""}`);
      console.log(`       ${r.business || "—"}`);
      console.log(`       ${r.reasons[0]}`);
    }
  };

  group("very-good", "เหมาะมาก — ลงทุนได้เต็มที่ (score ≥ 4)", limit);
  group("good", "เหมาะ — ลงทุนได้ (score 2-3)", limit);
  group("neutral", "กลาง — เก็บไว้พิจารณา (score 1)", Math.min(limit, 8));
  group("avoid", "ควรเลี่ยง — ธาตุขัดดวง (score ≤ 0)", Math.min(limit, 8));

  // สรุปจำนวน
  const count = (v: StockScore["verdict"]) => scored.filter((r) => r.verdict === v).length;
  console.log(
    `\nสรุป: ✅✅ ${count("very-good")} · ✅ ${count("good")} · 🟡 ${count("neutral")} · ⛔ ${count("avoid")}`,
  );
  console.log("หมายเหตุ: ข้อมูลหุ้น auto ยังไม่ผ่านซินแสตรวจ (elementSource ระบุแหล่ง) — ใช้ประกอบการตัดสินใจ");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
