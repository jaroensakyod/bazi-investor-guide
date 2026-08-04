/**
 * เทสต์ core engine "ดวงนักลงทุน" — deterministic กับดวงอ้างอิง
 *
 * ดวงอ้างอิง 1: 1988-06-08 12:08 female Bangkok (วัน 甲午) — จาก README ต้นทาง
 * ดวงอ้างอิง 2: 1990-01-15 08:30 male Bangkok (วันต่าง)
 */
import { describe, it, expect } from "vitest";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";
import {
  resolveInvestElements,
  scoreStock,
  resolveInvestorPersona,
  buildInvestorTimeline,
  resolveForexSuitability,
  dayMasterElementTh,
  wealthElementTh,
  outputElementTh,
} from "@/lib/investor/investor-guide";

async function chart(birthDate: string, birthTime: string, gender: "male" | "female") {
  return calculateBaziChart(
    { birthDate, birthTime, gender, province: "Bangkok", timezone: "Asia/Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
}

describe("ดวงนักลงทุน — ธาตุ", () => {
  it("1988-06-08 female: day master = ไม้ (甲)", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    expect(dayMasterElementTh(state)).toBe("ไม้");
  });

  it("ธาตุลาภ/ถ่ายเท คำนวณจากวงจร 5 ธาตุ", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    // ไม้ (甲) → ถ่ายเท = ไฟ, ลาภ = ดิน (ไม้พิฆาตดิน)
    expect(outputElementTh(state)).toBe("ไฟ");
    expect(wealthElementTh(state)).toBe("ดิน");
  });

  it("resolveInvestElements: ได้ธาตุที่ควรลงทุน + ธาตุเลี่ยง (ไม่ซ้ำ, มีค่าครบ)", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const { invest, avoid } = resolveInvestElements(state);
    expect(invest.length).toBeGreaterThan(0);
    expect(avoid.length).toBeGreaterThan(0);
    // deterministic: คำนวณซ้ำได้ผลเดิม
    expect(resolveInvestElements(state)).toEqual(resolveInvestElements(state));
  });
});

describe("ดวงนักลงทุน — verdict หุ้น (score 5 กฎ)", () => {
  it("หุ้นธาตุต้องห้าม → avoid (score ติดลบ)", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const { avoid } = resolveInvestElements(state);
    const avoidElement = avoid[0];
    const result = scoreStock(state, {
      ticker: "TEST", name: "หุ้นทดสอบ", business: "ธุรกิจทดสอบ",
      elements: [avoidElement], primaryElement: avoidElement,
    });
    expect(result.verdict).toBe("avoid");
    expect(result.score).toBeLessThan(0);
  });

  it("หุ้นธาตุที่ควรทำอันดับ 1 → good/very-good", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const { invest } = resolveInvestElements(state);
    const top = invest[0];
    const result = scoreStock(state, {
      ticker: "GOOD", name: "หุ้นดี", business: "ธุรกิจดี",
      elements: [top], primaryElement: top,
    });
    expect(["good", "very-good"]).toContain(result.verdict);
    expect(result.score).toBeGreaterThan(0);
  });

  it("deterministic: score หุ้นตัวเดียวกันซ้ำ → ผลเดิม", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const a = scoreStock(state, { ticker: "KBANK", name: "ธนาคารกสิกรไทย", business: "ธนาคาร", elements: ["น้ำ", "ดิน"], primaryElement: "น้ำ" });
    const b = scoreStock(state, { ticker: "KBANK", name: "ธนาคารกสิกรไทย", business: "ธนาคาร", elements: ["น้ำ", "ดิน"], primaryElement: "น้ำ" });
    expect(a).toEqual(b);
  });
});

describe("ดวงนักลงทุน — การ์ดตัวตน 15 แบบ", () => {
  it("ได้การ์ด 1 ใน 15 แบบ (ธาตุ × กำลัง)", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const persona = resolveInvestorPersona(state);
    expect(persona.name).toBeTruthy();
    expect(persona.emoji).toBeTruthy();
    expect(persona.allocation).toBeTruthy();
    expect(["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]).toContain(persona.element);
  });

  it("deterministic: การ์ดซ้ำ → ผลเดิม", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    expect(resolveInvestorPersona(state)).toEqual(resolveInvestorPersona(state));
  });
});

describe("ดวงนักลงทุน — ไทม์ไลน์วัยจร", () => {
  it("มีช่วงวัยจรครบ (≥8) แต่ละช่วงมี verdict + คำแนะนำ", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const timeline = buildInvestorTimeline(state);
    expect(timeline.length).toBeGreaterThanOrEqual(8);
    for (const phase of timeline) {
      expect(["invest", "accumulate", "avoid", "no-risk"]).toContain(phase.verdict);
      expect(phase.advice.length).toBeGreaterThan(10);
      expect(phase.ageRange).toMatch(/\d+–\d+/);
    }
  });

  it("มีอย่างน้อย 1 ช่วงที่ verdict = invest หรือ accumulate (ไม่ใช่ avoid ทั้งหมด)", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const timeline = buildInvestorTimeline(state);
    expect(timeline.some((p) => p.verdict === "invest" || p.verdict === "accumulate")).toBe(true);
  });

  it("deterministic: ไทม์ไลน์ซ้ำ → ผลเดิม", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    expect(buildInvestorTimeline(state)).toEqual(buildInvestorTimeline(state));
  });
});

describe("ดวงนักลงทุน — forex", () => {
  it("คืน conditions ครบ 3 ข้อ + suitable bool", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    const result = resolveForexSuitability(state);
    expect(result.conditions.length).toBe(3);
    expect(typeof result.suitable).toBe("boolean");
  });

  it("deterministic: forex ซ้ำ → ผลเดิม", async () => {
    const state = await chart("1988-06-08", "12:08", "female");
    expect(resolveForexSuitability(state)).toEqual(resolveForexSuitability(state));
  });
});
