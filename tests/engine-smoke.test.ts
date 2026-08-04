/**
 * Smoke test: พิสูจน์ว่า engine ที่คัดลอกมา คำนวณดวงได้จริง + deterministic
 * ใช้ดวงอ้างอิงเดียวกันกับ bazi-sft-dataset (1988-06-08 12:08 female Bangkok — จาก README)
 */
import { describe, it, expect } from "vitest";
import { calculateBaziChart } from "@/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "@/lib/bazi/in-memory-repository";
import type { RawInputValue } from "@/lib/bazi/schema-types";

const BASE_INPUT: RawInputValue = {
  birthDate: "1988-06-08",
  birthTime: "12:08",
  gender: "female",
  province: "Bangkok",
  timezone: "Asia/Bangkok",
};

describe("bazi engine (คัดลอกจาก bazi-sft-dataset)", () => {
  it("คำนวณสี่เสาได้ครบ (ปี/เดือน/วัน/ยาม)", async () => {
    const state = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    expect(state.fourPillars.year.stem).toBeTruthy();
    expect(state.fourPillars.year.branch).toBeTruthy();
    expect(state.fourPillars.month.stem).toBeTruthy();
    expect(state.fourPillars.day.stem).toBeTruthy();
    expect(state.fourPillars.hour.stem).toBeTruthy();
  });

  it("มี dayMaster + strengthScore", async () => {
    const state = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    expect(state.dayMaster).toBeTruthy();
    expect(typeof state.strengthScore).toBe("number");
  });

  it("มีวัยจร (daYun) อย่างน้อย 8 ช่วง", async () => {
    const state = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    expect(state.daYun.length).toBeGreaterThanOrEqual(8);
    expect(state.daYun[0].startAge).toBeGreaterThanOrEqual(0);
  });

  it("deterministic: คำนวณซ้ำ 2 ครั้ง ได้ผลเหมือนกัน", async () => {
    const a = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    const b = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("ดวงอ้างอิง: 1988-06-08 female → ก้าน/กิ่งวันครบ (ค่าไม่ว่าง)", async () => {
    const state = await calculateBaziChart(BASE_INPUT, createInMemoryKnowledgeRepository());
    expect(state.fourPillars.day.stem.length).toBe(1); // ก้าน 1 ตัวอักษรจีน
    expect(state.fourPillars.day.branch.length).toBe(1); // กิ่ง 1 ตัวอักษรจีน
  });
});
