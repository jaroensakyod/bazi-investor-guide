/**
 * เทสต์คลังหุ้นโลก (global.json — 8 ตลาด)
 */
import { describe, it, expect } from "vitest";
import { getGlobalStocks, getMarketMeta, validateStocks, getAllStocks } from "@/lib/investor/stock-database";

describe("คลังหุ้นโลก (global.json)", () => {
  it("มีหุ้นครบ 8 ตลาด (จีน/เวียดนาม/ญี่ปุ่น/US/แคนาดา/ออส/เกาหลี/อินเดีย) รวม ≥ 80 ตัว", () => {
    const stocks = getGlobalStocks();
    expect(stocks.length).toBeGreaterThanOrEqual(80);
    const countries = new Set(stocks.map((s) => s.country));
    for (const c of ["CN", "VN", "JP", "US", "CA", "AU", "KR", "IN"]) {
      expect(countries.has(c)).toBe(true);
    }
  });

  it("validate ผ่าน: ไม่มี ticker ซ้ำ / elementReason ครบ / ธาตุถูกต้อง", () => {
    const problems = validateStocks(getGlobalStocks());
    expect(problems).toEqual([]);
  });

  it("ทุกตัวมี primaryElement ∈ elements + business + elementReason (กฎเหล็ก)", () => {
    for (const s of getGlobalStocks()) {
      expect(s.elements).toContain(s.primaryElement);
      expect(s.business.length).toBeGreaterThan(5);
      expect(s.elementReason.length).toBeGreaterThan(10);
    }
  });

  it("getMarketMeta: มี 8 ประเทศ พร้อมทิศ+ธาตุตลาด (ใช้บท 8 เท่านั้น)", () => {
    const meta = getMarketMeta();
    expect(Object.keys(meta).length).toBe(8);
    expect(meta.CN.marketElement).toBe("น้ำ"); // จีน = ทิศเหนือ
    expect(meta.US.marketElement).toBe("ไม้");
    expect(meta.IN.marketElement).toBe("ทอง"); // อินเดีย = ทิศตะวันตก
    expect(meta.CN.direction).toBeTruthy();
  });

  it("getAllStocks: ไทย + โลก รวม ≥ 200 ตัว", () => {
    const all = getAllStocks();
    expect(all.length).toBeGreaterThanOrEqual(200);
  });

  it("หุ้นตัวอย่างที่รู้จักมีธาตุถูกต้อง (NVDA=ทอง, JPM=น้ำ, Toyota=ทอง, Samsung=ทอง, BABA=ทอง)", () => {
    const byTicker = new Map(getGlobalStocks().map((s) => [s.ticker, s]));
    expect(byTicker.get("NVDA")?.primaryElement).toBe("ทอง");
    expect(byTicker.get("JPM")?.primaryElement).toBe("น้ำ");
    expect(byTicker.get("7203.T")?.primaryElement).toBe("ทอง");
    expect(byTicker.get("005930.KS")?.primaryElement).toBe("ทอง");
    expect(byTicker.get("BABA")?.primaryElement).toBe("ทอง");
  });
});
