import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";
import {
  dayElementOf, dayFitForUser, favorElementsToday, stocksForDay, monthInvestFit,
  luckyDaysForAsset, ipoFitForWeek, COMPLIANCE_NOTE,
} from "../src/lib/fortune/investment-days";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("fortune × investment — ดวงจับคู่การลงทุน (deterministic)", () => {
  it("dayElementOf — ธาตุวันจาก almanac (2026-08-05 = 辛亥 = ทอง)", () => {
    expect(dayElementOf("2026-08-05")).toBe("ทอง");
  });

  it("dayFitForUser — วันธาตุทอง เทียบดวงผู้ใช้ (invest/avoid) ไม่พัง", () => {
    const fit = dayFitForUser(state, "2026-08-05");
    expect(["good", "neutral", "avoid"]).toContain(fit);
  });

  it("favorElementsToday — ได้ธาตุควรทำจากตาราง B (ไม่ว่าง)", () => {
    const favor = favorElementsToday(state, "2026-08-05");
    expect(favor.length).toBeGreaterThan(0);
  });

  it("stocksForDay — หุ้นตรงธาตุวันนี้ + ราคาจริง (มีข้อมูล)", () => {
    const rows = stocksForDay(state, "2026-08-05", 5);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toHaveProperty("changePct");
  });

  it("monthInvestFit — ธาตุเดือน + ทิศเงิน + วันดีทั้งเดือน", () => {
    const m = monthInvestFit(state, 2026, 8);
    expect(m.monthElement).toBeTruthy();
    expect(m.caishenDir).toBeTruthy();
    expect(m.goodDays.length).toBeGreaterThan(0);
    expect(m.avoidDays.length).toBeGreaterThanOrEqual(0);
  });

  it("luckyDaysForAsset — วันธาตุดิน (ซื้อที่ดิน) ในเดือน", () => {
    const days = luckyDaysForAsset(state, 2026, 8, "ดิน", 3);
    expect(days.length).toBeGreaterThan(0);
    expect(days[0].dayElement).toBe("ดิน");
    expect(days[0].reason).toContain("ตรงธาตุ");
  });

  it("ipoFitForWeek — IPO ช่วงสัปดาห์ จับคู่ดวง (good/neutral/avoid)", () => {
    const r = ipoFitForWeek(state, "2026-08-01", "2026-08-31", 10);
    expect(r.entries.length).toBeGreaterThan(0);
    expect(["good", "neutral", "avoid"]).toContain(r.entries[0].fit);
    expect(r.entries[0]).toHaveProperty("birthDayElement");
  });

  it("COMPLIANCE_NOTE — ข้อความย้ำตามที่กำหนด", () => {
    expect(COMPLIANCE_NOTE).toContain("ไม่ใช่คำแนะนำการลงทุน");
    expect(COMPLIANCE_NOTE).toContain("บทวิเคราะห์อ้างอิง");
  });
});
