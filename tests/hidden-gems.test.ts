import { describe, it, expect } from "vitest";
import { underwaterScoreOf, riskTierOf, rankHiddenGems, type StrengthBand } from "../src/lib/market/hidden-gems";
import type { StockEntry } from "../src/lib/investor/stock-database";
import type { MarketData } from "../src/lib/market/market-data";
import type { Fundamentals } from "../src/lib/market/fundamentals";

function mkStock(partial: Partial<StockEntry>): StockEntry {
  return {
    type: "stock",
    ticker: "X",
    name: "X Co",
    country: "TH",
    market: "SET",
    currency: "THB",
    sector: "Banks",
    business: "ธนาคาร",
    businessKeywords: [],
    growthStage: "mid",
    theme: [],
    risingStar: false,
    listedDate: null,
    elements: ["น้ำ"],
    primaryElement: "น้ำ",
    elementReason: "ธนาคาร = น้ำ",
    elementSource: "test",
    tier: "mid",
    isHighLiquidity: false,
    status: "draft",
    reviewedBy: null,
    reviewedAt: null,
    ...partial,
  };
}

const goodFund: Fundamentals = { roe: 18, debtToEquity: 40, grossMargin: 30, revenueGrowth: 5, profitMargin: 8 };
const badFund: Fundamentals = { roe: 2, debtToEquity: 250, grossMargin: 4, revenueGrowth: -8, profitMargin: -3 };

const mdLiquid: MarketData = { price: 10, avgVolume: 5_000_000, marketCap: 50e9, pe: 12, updatedAt: "t" };
const mdThin: MarketData = { price: 5, avgVolume: 200_000, marketCap: 8e9, pe: 45, updatedAt: "t" };

describe("underwaterScoreOf — ใต้ผืนน้ำแค่ไหน", () => {
  it("ตัวท็อป+ใหญ่+คล่อง+PE ปกติ → คะแนนต่ำ (คนเห็นหมด)", () => {
    const mdBig: MarketData = { price: 100, avgVolume: 20_000_000, marketCap: 500e9, pe: 15, updatedAt: "t" };
    const { score, parts } = underwaterScoreOf(mkStock({ tier: "SET50" }), mdBig);
    expect(score).toBe(0);
    expect(parts).toEqual({ notTopIndex: 0, midSmallCap: 0, lowLiquidity: 0, unloved: 0 });
  });
  it("mid cap + สภาพคล่องเบาบาง + PE สูง → ใต้ผืนน้ำมาก", () => {
    const { score, parts } = underwaterScoreOf(mkStock({ tier: "mid" }), mdThin);
    expect(score).toBe(100);
    expect(parts.notTopIndex).toBe(30);
    expect(parts.midSmallCap).toBe(30);
    expect(parts.lowLiquidity).toBe(20);
    expect(parts.unloved).toBe(20);
  });
});

describe("riskTierOf — ไม่เสี่ยงเกินไป", () => {
  it("คุณภาพดี + สภาพคล่อง + ขนาดพอ → 🟢", () => {
    expect(riskTierOf(mkStock({ tier: "mid" }), mdLiquid, goodFund)).toBe("safe");
  });
  it("คุณภาพกลาง (Buffett 5-7) → 🟡", () => {
    const midFund: Fundamentals = { roe: 12, debtToEquity: 80, grossMargin: 15, revenueGrowth: 1, profitMargin: 2 };
    expect(riskTierOf(mkStock({ tier: "mid" }), mdLiquid, midFund)).toBe("medium");
  });
  it("คุณภาพแย่ → 🔴", () => {
    expect(riskTierOf(mkStock({ tier: "mid" }), mdLiquid, badFund)).toBe("risky");
  });
  it("ไม่มี fundamentals → 🔴 (ไม่เดา)", () => {
    expect(riskTierOf(mkStock({ tier: "mid" }), mdLiquid, undefined)).toBe("risky");
  });
});

describe("rankHiddenGems — กรอง + เรียง + ตามกำลังดวง", () => {
  const stocks = [
    mkStock({ ticker: "GOOD1", tier: "mid", primaryElement: "ทอง", elements: ["ทอง"] }), // mid + liquid + good → safe
    mkStock({ ticker: "GOOD2", tier: "mid", primaryElement: "น้ำ", elements: ["น้ำ"] }),
    mkStock({ ticker: "BAD1", tier: "mid", primaryElement: "ไฟ", elements: ["ไฟ"] }), // bad fund → risky
    mkStock({ ticker: "BIG1", tier: "SET50", primaryElement: "ทอง", elements: ["ทอง"] }), // top → score 0 → ตกรอบ
  ];
  const quotes: Record<string, MarketData> = {
    "GOOD1.BK": mdLiquid,
    "GOOD2.BK": mdLiquid,
    "BAD1.BK": mdLiquid,
    "BIG1.BK": mdLiquid,
  };
  const funds = new Map<string, Fundamentals>([
    ["GOOD1.BK", goodFund],
    ["GOOD2.BK", goodFund],
    ["BAD1.BK", badFund],
  ]);

  it("กรอง 🔴/ตัวท็อปออก เหลือแค่ 🟢🟡 ใต้ผืนน้ำ", () => {
    const gems = rankHiddenGems({ stocks, quotes, fundamentals: funds, limit: 10 });
    const tickers = gems.map((g) => g.ticker);
    expect(tickers).toContain("GOOD1");
    expect(tickers).toContain("GOOD2");
    expect(tickers).not.toContain("BAD1"); // risky
    expect(tickers).not.toContain("BIG1"); // ไม่ใต้ผืนน้ำ
  });

  it("กรอง element ตรงดวง", () => {
    const gems = rankHiddenGems({ stocks, quotes, fundamentals: funds, usefulElements: ["ทอง"], limit: 10 });
    expect(gems.every((g) => g.element === "ทอง")).toBe(true);
  });

  it("ดวงอ่อน (weak) → เห็นแค่ 🟢", () => {
    const gems = rankHiddenGems({ stocks, quotes, fundamentals: funds, strengthBand: "weak" as StrengthBand, limit: 10 });
    expect(gems.every((g) => g.tier === "safe")).toBe(true);
  });

  it("element ตรงดวงมาก่อน + underwater สูงก่อน", () => {
    const gems = rankHiddenGems({ stocks, quotes, fundamentals: funds, usefulElements: ["ทอง"], limit: 10 });
    expect(gems[0].ticker).toBe("GOOD1"); // ทอง ตรง usefulElements
  });
});
