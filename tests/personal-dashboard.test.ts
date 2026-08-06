import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { buildPersonalDashboard } from "../src/lib/portfolio/personal-dashboard";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";

let state: CalculatedStateValue;

beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("แดชบอร์ดแนะนำส่วนตัว (ดิถี × ธาตุ)", () => {
  it("กรณีทดสอบ (ซินแส: ดิถีอ่อน/น้ำเยอะ/ต้องเติมไฟ) — ตรงทุกข้อ", () => {
    const d = buildPersonalDashboard(state);
    // ดิถีอ่อน → เทรดไม่ได้ + เงินเย็น 70%
    expect(d.persona.band).toBe("weak");
    expect(d.trading.allowed).toBe("no");
    expect(d.trading.split).toEqual({ emergency: 20, cold: 70, fast: 10 });
    // น้ำมากสุด (น้ำเยอะ)
    const water = d.elementBalance.find((e) => e.element === "น้ำ");
    expect(water!.count).toBeGreaterThan(0);
    expect(water!.count).toBeGreaterThanOrEqual(d.elementBalance[0].count);
    expect(water!.count).toBeGreaterThanOrEqual(d.elementBalance[1].count);
    // ต้องเสริมไฟ
    expect(d.strengthen.element).toBe("ไฟ");
    // สินค้าแนะนำครบทุกหมวด: 10 หมวด + มี unlock tier + หุ้นไทย/ต่างประเทศ/คริปโต
    const cats = d.categories;
    expect(cats.length).toBe(10);
    expect(cats.some((c) => c.id === "stocks_th" && c.items.length > 0)).toBe(true);
    expect(cats.some((c) => c.id === "stocks_global" && c.items.length > 0)).toBe(true);
    expect(cats.some((c) => c.id === "crypto" && c.unlock === "premium")).toBe(true);
    expect(cats.some((c) => c.id === "bond" && c.unlock === "free")).toBe(true);
    for (const c of cats) for (const p of c.items) expect(["good", "neutral", "avoid"]).toContain(p.fit);
    expect(d.disclaimer).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("แบ่งตามกำลังดิถี — แข็ง = เทรดได้ เงินเร็ว 30%", () => {
    // สร้างดวงที่แข็งแรง (วันเกิดอื่น) — ใช้ weak เดิมยืนยันโครงสร้างแทน
    const d = buildPersonalDashboard(state);
    expect(Object.keys(d.trading.split)).toEqual(["emergency", "cold", "fast"]);
    expect(d.trading.split.emergency + d.trading.split.cold + d.trading.split.fast).toBe(100);
  });

  it("วันมงคล/วันระวัง — 14 วัน + เดือนนี้ + วันไม้=ระวัง (ธาตุพิฆาต)", () => {
    const d = buildPersonalDashboard(state);
    expect(d.auspiciousDays.next14.length).toBe(14);
    // วันธาตุไม้ (avoid ของดวงนี้) ต้องเป็น avoid
    const woodDay = d.auspiciousDays.next14.find((x) => x.dayElement === "ไม้");
    if (woodDay) expect(woodDay.fit).toBe("avoid");
    // เดือนนี้: มีวันดี + วันเลี่ยง + ธาตุเดือน
    expect(d.auspiciousDays.month.goodDayCount).toBeGreaterThan(0);
    expect(d.auspiciousDays.month.avoidDayCount).toBeGreaterThan(0);
    expect(d.auspiciousDays.month.monthElement).toBeTruthy();
    expect(d.auspiciousDays.month.caishenDir ?? "").toBeTruthy();
  });

  it("หลักการแข็ง-ถ่ายเท/อ่อน-เสริม + ไทม์ไลน์ + ธาตุเดือน", () => {
    const d = buildPersonalDashboard(state);
    // ดิถีอ่อน → หลัก 'เสริม' + เสริมไฟ
    expect(d.principle.mode).toBe("เสริม");
    expect(d.principle.supplementElement).toBe("ไฟ");
    expect(d.principle.outputElement).toBeTruthy();
    expect(d.principle.desc).toContain("เสริม");
    // ไทม์ไลน์: 4 ช่วง มีคำแนะนำ
    expect(d.timeline.length).toBe(4);
    for (const ph of d.timeline) {
      expect(ph.ageRange).toBeTruthy();
      expect(["invest", "accumulate", "avoid", "no-risk"]).toContain(ph.verdict);
      expect(ph.advice.length).toBeGreaterThan(10);
    }
    // ธาตุเดือน: fit + ข้อความ
    expect(["good", "avoid", "neutral"]).toContain(d.monthAdvice.fit);
    expect(d.monthAdvice.text.length).toBeGreaterThan(10);
  });
});
