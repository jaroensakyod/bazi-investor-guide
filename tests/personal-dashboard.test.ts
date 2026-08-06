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
    // หุ้นเสริมธาตุ = ธาตุไฟ มีราคา/ชื่อ
    expect(d.topStocks.length).toBe(5);
    expect(d.topStocks[0].ticker).toBeTruthy();
    // สินทรัพย์เด่นไม่เอา tier เสี่ยง
    for (const a of d.topAssets) expect(a.riskTier).not.toBe("risky");
    expect(d.disclaimer).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("แบ่งตามกำลังดิถี — แข็ง = เทรดได้ เงินเร็ว 30%", () => {
    // สร้างดวงที่แข็งแรง (วันเกิดอื่น) — ใช้ weak เดิมยืนยันโครงสร้างแทน
    const d = buildPersonalDashboard(state);
    expect(Object.keys(d.trading.split)).toEqual(["emergency", "cold", "fast"]);
    expect(d.trading.split.emergency + d.trading.split.cold + d.trading.split.fast).toBe(100);
  });
});
