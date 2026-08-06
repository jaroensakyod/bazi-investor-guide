import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { buildFullReport } from "../src/lib/report/full-report";
import { buildReportPdf } from "../src/api/report-pdf";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("รายงานสไตล์สถาบัน (Phase 3) — full report + PDF", () => {
  it("buildFullReport — ครบทุก section (KBANK + ดวง)", () => {
    const r = buildFullReport("KBANK", state);
    expect(r.meta.ticker).toBe("KBANK");
    expect(r.meta.name).toBeTruthy();
    expect(r.verdict).not.toBeNull();
    expect(r.verdict?.invest.length).toBeGreaterThan(0);
    expect(r.verdict?.reasons.length).toBeGreaterThan(0);
    expect(r.month).not.toBeNull();
    expect(r.month?.caishenDir).toBeTruthy();
    expect(r.dayStocks.length).toBeGreaterThan(0);
    expect(r.topAssets.length).toBeGreaterThan(0);
    expect(r.disclaimer).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("buildFullReport — ไม่มีโปรไฟล์ก็ได้ (verdict null แต่ meta ครบ)", () => {
    const r = buildFullReport("PTT");
    expect(r.meta.ticker).toBe("PTT");
    expect(r.verdict).toBeNull();
    expect(r.month).toBeNull();
  });

  it("buildReportPdf — สร้าง PDF จริง (%PDF header + ไม่ว่าง)", async () => {
    const buf = await buildReportPdf("KBANK", state);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  }, 30000);
});
