import { describe, it, expect } from "vitest";
import { topMovers, topMoversByElement } from "../src/lib/market/movers";
import { buildSnapshot } from "../src/lib/market/market-data";

// หุ้นตัวอย่างในคลัง (ตรงกับ stock-database: KBANK/AAPL/PTT — สร้าง snapshot ที่อ้างอิง ticker จริง)
const snap = buildSnapshot(
  [
    { symbol: "KBANK.BK", regularMarketPrice: 150, regularMarketChangePercent: 2.5, currency: "THB" },
    { symbol: "PTT.BK", regularMarketPrice: 30, regularMarketChangePercent: -3.1, currency: "THB" },
    { symbol: "AAPL", regularMarketPrice: 210, regularMarketChangePercent: 1.2, currency: "USD" },
    { symbol: "7203.T", regularMarketPrice: 3000, regularMarketChangePercent: 4.4, currency: "JPY" },
  ],
  "2026-08-05T00:00:00Z",
);

describe("topMovers — หุ้นเด่นวันนี้จาก snapshot", () => {
  it("gainers เรียง % ลง (limit)", () => {
    const rows = topMovers(snap, { limit: 2, direction: "gainers" });
    expect(rows.length).toBe(2);
    expect(rows[0].ticker).toBe("7203.T"); // +4.4% มากสุด (คลังใช้ ticker มี suffix)
    expect(rows[1].ticker).toBe("KBANK"); // +2.5%
  });

  it("losers เรียง % ขึ้น (ติดลบมากสุดก่อน)", () => {
    const rows = topMovers(snap, { limit: 1, direction: "losers" });
    expect(rows[0].ticker).toBe("PTT");
    expect(rows[0].changePct).toBe(-3.1);
  });

  it("กรองตลาด TH (SET/mai)", () => {
    const rows = topMovers(snap, { market: "TH", limit: 10 });
    expect(rows.every((r) => ["KBANK", "PTT"].includes(r.ticker))).toBe(true);
  });

  it("ทุกแถวมี element จากคลัง", () => {
    const rows = topMovers(snap, { limit: 10 });
    expect(rows.every((r) => r.element)).toBe(true);
    const kbank = rows.find((r) => r.ticker === "KBANK");
    expect(kbank?.element).toBe("น้ำ"); // ธนาคาร = น้ำ
  });

  it("snapshot ว่าง → [] (ไม่พัง)", () => {
    expect(topMovers(null, { limit: 5 })).toEqual([]);
  });
});

describe("topMoversByElement — ตรงธาตุวันนี้ (daily-content/แชท)", () => {
  it("ได้เฉพาะหุ้นธาตุที่ระบุ", () => {
    const rows = topMoversByElement("น้ำ", snap, 5);
    expect(rows.every((r) => r.element === "น้ำ")).toBe(true);
  });
});
