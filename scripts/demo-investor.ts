/**
 * DEMO: แสดงสิ่งที่ "ดวงนักลงทุน" ผลิตได้จากวันเกิด (ใช้ดวง 1988-06-08 12:08 female)
 * รัน: npx tsx scripts/demo-investor.ts
 */
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";
import {
  resolveInvestElements,
  scoreStock,
  resolveInvestorPersona,
  buildInvestorTimeline,
  resolveForexSuitability,
  wealthElementTh,
} from "@/lib/investor/investor-guide";

async function main() {
  const state = await calculateBaziChart(
    { birthDate: "1988-06-08", birthTime: "12:08", gender: "female", province: "Bangkok", timezone: "Asia/Bangkok" },
    createInMemoryKnowledgeRepository(),
  );

  const { year, month, day, hour } = state.fourPillars;
  console.log("════════ ดวงนักลงทุน — DEMO ════════");
  console.log(`สี่เสา: ${year.stem}${year.branch} / ${month.stem}${month.branch} / ${day.stem}${day.branch} / ${hour.stem}${hour.branch}`);
  console.log(`ธาตุลาภ: ${wealthElementTh(state)}`);

  // 1. การ์ดตัวตน
  const persona = resolveInvestorPersona(state);
  console.log("\n── การ์ดตัวตน ──");
  console.log(`${persona.emoji} คุณคือ "${persona.name}" (ธาตุ${persona.element} ${persona.band})`);
  console.log(`  จุดแข็ง: ${persona.strengths}`);
  console.log(`  จุดอ่อน: ${persona.weaknesses}`);
  console.log(`  สไตล์: ${persona.style}`);
  console.log(`  จัดพอร์ต: ${persona.allocation}`);

  // 2. ธาตุที่ควรลงทุน
  const { invest, avoid } = resolveInvestElements(state);
  console.log("\n── ธาตุที่ควรลงทุน ──");
  console.log(`  ควร: ${invest.join(" > ")}`);
  console.log(`  เลี่ยง: ${avoid.join(", ")}`);

  // 3. verdict หุ้นตัวอย่าง
  console.log("\n── verdict หุ้นตัวอย่าง ──");
  const samples: Array<{ ticker: string; name: string; business: string; elements: Array<"ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ">; primaryElement: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ" }> = [
    { ticker: "KBANK", name: "ธนาคารกสิกรไทย", business: "ธนาคาร สินเชื่อ การเงิน", elements: ["น้ำ", "ดิน"], primaryElement: "น้ำ" },
    { ticker: "ADVANC", name: "แอดวานซ์ อินโฟร์", business: "โทรคมนาคม อินเทอร์เน็ต", elements: ["ไม้"], primaryElement: "ไม้" },
    { ticker: "CPALL", name: "ซีพี ออลล์", business: "ค้าปลีก สะดวกซื้อ", elements: ["น้ำ", "ไม้"], primaryElement: "น้ำ" },
    { ticker: "PTT", name: "ปตท.", business: "พลังงาน ปิโตรเคมี", elements: ["ไฟ"], primaryElement: "ไฟ" },
  ];
  for (const s of samples) {
    const r = scoreStock(state, s);
    const icon = r.verdict === "very-good" ? "✅✅" : r.verdict === "good" ? "✅" : r.verdict === "neutral" ? "🟡" : "⛔";
    console.log(`  ${icon} ${r.ticker} (ธาตุ${r.primaryElement}) score=${r.score} — ${r.reasons[0]}`);
  }

  // 4. ไทม์ไลน์
  console.log("\n── ไทม์ไลน์วัยจร (ย่อ 6 ช่วงแรก) ──");
  for (const p of buildInvestorTimeline(state).slice(0, 6)) {
    const icon = p.verdict === "invest" ? "🟢" : p.verdict === "accumulate" ? "🔵" : p.verdict === "avoid" ? "🟠" : "🔴";
    console.log(`  ${icon} อายุ ${p.ageRange} (${p.stem}${p.branch}) ${p.verdict} — ${p.advice}`);
  }

  // 5. forex
  const fx = resolveForexSuitability(state);
  console.log("\n── Forex ──");
  console.log(`  เหมาะ: ${fx.suitable ? "✅" : "❌"}`);
  for (const c of fx.conditions) console.log(`  ${c.ok ? "✅" : "❌"} ${c.text}`);
}

main().catch((err) => { console.error(err); process.exit(1); });

// ─── ส่วนที่ 2: verdict จากคลังหุ้นจริง ───
async function main2() {
  const { getThaiStocks } = await import("@/lib/investor/stock-database");
  const { scoreStock } = await import("@/lib/investor/investor-guide");
  const { calculateBaziChart } = await import("@/lib/bazi/symbolic-engine");
  const { createInMemoryKnowledgeRepository } = await import("@/lib/bazi/in-memory-repository");

  const state = await calculateBaziChart(
    { birthDate: "1988-06-08", birthTime: "12:08", gender: "female", province: "Bangkok", timezone: "Asia/Bangkok" },
    createInMemoryKnowledgeRepository(),
  );

  const stocks = getThaiStocks();
  const scored = stocks
    .map((s) => scoreStock(state, { ticker: s.ticker, name: s.name, business: s.business, elements: s.elements, primaryElement: s.primaryElement }))
    .sort((a, b) => b.score - a.score);

  console.log("\n════════ verdict คลังหุ้นไทยทั้งหมด (" + scored.length + " ตัว) ════════");
  console.log("\n-- เหมาะมาก (score ≥ 4) --");
  for (const r of scored.filter((r) => r.verdict === "very-good")) console.log(`  ✅✅ ${r.ticker} (${r.primaryElement}) score=${r.score}`);
  console.log("\n-- เหมาะ (score 2-3) --");
  for (const r of scored.filter((r) => r.verdict === "good")) console.log(`  ✅ ${r.ticker} (${r.primaryElement}) score=${r.score}`);
  console.log("\n-- กลาง (score 1) --");
  for (const r of scored.filter((r) => r.verdict === "neutral")) console.log(`  🟡 ${r.ticker} (${r.primaryElement}) score=${r.score}`);
  console.log("\n-- ควรเลี่ยง (score ≤ 0) --");
  for (const r of scored.filter((r) => r.verdict === "avoid")) console.log(`  ⛔ ${r.ticker} (${r.primaryElement}) score=${r.score}`);
}

main2().catch((err) => { console.error(err); process.exit(1); });
