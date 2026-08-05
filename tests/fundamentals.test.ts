import { describe, it, expect } from "vitest";
import { normalizeFundamentals } from "../src/lib/market/fundamentals";
import { buffettChecks, buffettScore } from "../src/lib/report/buffett-checks";

describe("normalizeFundamentals — Yahoo financialData → %", () => {
  it("ทศนิยม → % (ROE 0.18 → 18)", () => {
    const f = normalizeFundamentals({
      returnOnEquity: 0.18,
      debtToEquity: 45.2,
      grossMargins: 0.456,
      operatingMargins: 0.123,
      profitMargins: 0.091,
      revenueGrowth: 0.075,
      currentRatio: 1.5,
      totalRevenue: 1000000000,
      financialCurrency: "THB",
      industry: "Banks",
    });
    expect(f.roe).toBe(18);
    expect(f.debtToEquity).toBe(45.2);
    expect(f.grossMargin).toBe(45.6);
    expect(f.operatingMargin).toBe(12.3);
    expect(f.profitMargin).toBe(9.1);
    expect(f.revenueGrowth).toBe(7.5);
    expect(f.currentRatio).toBe(1.5);
    expect(f.currency).toBe("THB");
  });
  it("ค่า NaN/ไม่มี → undefined (ไม่ปั้นตัวเลข)", () => {
    const f = normalizeFundamentals({ returnOnEquity: NaN, grossMargins: undefined });
    expect(f.roe).toBeUndefined();
    expect(f.grossMargin).toBeUndefined();
  });
  it("Yahoo v10 format { raw, fmt } → แกะ raw", () => {
    const f = normalizeFundamentals({
      returnOnEquity: { raw: 0.08772, fmt: "8.77%" },
      grossMargins: { raw: 0.456, fmt: "45.60%" },
      revenueGrowth: { raw: 0.075, fmt: "7.50%" },
      debtToEquity: {}, // ธนาคารมักเป็นก้อนว่าง
      financialCurrency: "THB",
    });
    expect(f.roe).toBe(8.8);
    expect(f.grossMargin).toBe(45.6);
    expect(f.revenueGrowth).toBe(7.5);
    expect(f.debtToEquity).toBeUndefined(); // {} → ไม่ปั้นตัวเลข
  });
});

describe("buffettChecks — ตัวกรองคุณภาพ", () => {
  const good = normalizeFundamentals({
    returnOnEquity: 0.2,
    debtToEquity: 30,
    grossMargins: 0.4,
    revenueGrowth: 0.05,
    profitMargins: 0.1,
  });
  const bad = normalizeFundamentals({
    returnOnEquity: 0.03,
    debtToEquity: 250,
    grossMargins: 0.05,
    revenueGrowth: -0.1,
    profitMargins: -0.05,
  });

  it("หุ้นดี → pass ครบ + score สูง", () => {
    const checks = buffettChecks(good);
    expect(checks.every((c) => c.status === "pass")).toBe(true);
    expect(buffettScore(checks)).toBe(10);
  });
  it("หุ้นแย่ → fail ครบ + score 0", () => {
    const checks = buffettChecks(bad);
    expect(checks.every((c) => c.status === "fail")).toBe(true);
    expect(buffettScore(checks)).toBe(0);
  });
  it("ไม่มีข้อมูล → fail (ไม่เดา ไม่พาส)", () => {
    const checks = buffettChecks({});
    expect(checks.every((c) => c.status === "fail")).toBe(true);
    expect(checks.every((c) => c.detail === "ไม่มีข้อมูล")).toBe(true);
  });
  it("ขอบเขต warn: ROE 10-15 / D/E 50-100", () => {
    const mid = normalizeFundamentals({ returnOnEquity: 0.12, debtToEquity: 70, grossMargins: 0.15, revenueGrowth: 0.01, profitMargins: 0.02 });
    const checks = buffettChecks(mid);
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.status]));
    expect(byId.roe).toBe("warn");
    expect(byId.debt).toBe("warn");
    expect(byId.margin).toBe("warn");
    expect(buffettScore(checks)).toBe(7); // 3 warn × 1 + 2 pass × 2
  });
});
