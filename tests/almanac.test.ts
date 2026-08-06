import { describe, it, expect } from "vitest";
import { buildAlmanacDay, buildAlmanacMonth, checkHour } from "../src/lib/bazi/almanac/almanac-engine";

describe("almanac — ปฏิทินโหราศาสตร์ (port จาก bazi-sft-dataset)", () => {
  it("2026-08-05 fixture ตรงต้นฉบับ (cross-check ผ่าน)", () => {
    const d = buildAlmanacDay(2026, 8, 5);
    expect(d.weekday).toBe("พุธ");
    expect(d.dayPillar.ganzhi).toBe("辛亥");
    expect(d.monthPillar.ganzhi).toBe("乙未");
    expect(d.yearPillar.ganzhi).toBe("丙午");
    // สีมงคล
    expect(d.colors.some((c) => c.element === "ทอง" && c.colors.includes("ขาว"))).toBe(true);
    expect(d.colors.some((c) => c.element === "น้ำ")).toBe(true);
    // ประตู 八門 เปิด (開)
    expect(d.gates.some((g) => g.name === "開")).toBe(true);
  });

  it("deterministic — รันซ้ำ output เหมือนเดิม", () => {
    const a = JSON.stringify(buildAlmanacDay(2026, 8, 5));
    const b = JSON.stringify(buildAlmanacDay(2026, 8, 5));
    expect(a).toBe(b);
  });

  it("มีข้อมูลครบ: ยามมงคล/ทิศ/จันทรคติ/ดาวประจำวัน", () => {
    const d = buildAlmanacDay(2026, 8, 5);
    expect(d.luckyHours.length).toBeGreaterThan(0);
    expect(d.luckyHours[0]).toHaveProperty("code");
    expect(d.luckyHours[0]).toHaveProperty("range");
    expect(d.luckyDirection).toBeTruthy();
    expect(d.asura.day).toBeTruthy();
    expect(d.thaiLunar).toBeTruthy();
    expect(Array.isArray(d.dayStars)).toBe(true);
  });

  it("checkHour — ยาม 09:00 ได้คุณภาพ + ช่วงเวลา", () => {
    const h = checkHour(2026, 8, 5, 9);
    expect(h).toHaveProperty("range");
    expect(h).toHaveProperty("good");
    expect(h.range).toContain("9");
  });

  it("buildAlmanacMonth — เดือนมีวันครบ + ทุกวันมี monthInfo", () => {
    const m = buildAlmanacMonth(2026, 8);
    expect(m.yearBE).toBe(2569);
    expect(m.days.length).toBe(31);
    expect(m.days[0].monthInfo).toHaveProperty("deity");
  });
});
