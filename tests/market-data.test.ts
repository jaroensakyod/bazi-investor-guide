import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";
import { yahooTicker } from "../src/lib/market/yahoo";
import { buildSnapshot, normalizeQuote, loadSnapshot, withMarketData, saveSnapshot } from "../src/lib/market/market-data";
import type { StockEntry } from "../src/lib/investor/stock-database";

describe("yahooTicker — แปลง ticker คลังเรา → รูปแบบ Yahoo", () => {
  it("ไทย SET/mai → .BK", () => {
    expect(yahooTicker("KBANK", "SET")).toBe("KBANK.BK");
    expect(yahooTicker("SISB", "mai")).toBe("SISB.BK");
  });
  it("ฮ่องกง zero-pad 4 หลัก", () => {
    expect(yahooTicker("2.HK", "HKEX")).toBe("0002.HK");
    expect(yahooTicker("0700.HK", "HKEX")).toBe("0700.HK");
  });
  it("หุ้น class ใช้ขีด", () => {
    expect(yahooTicker("BRK.B", "NYSE")).toBe("BRK-B");
    expect(yahooTicker("BF.B", "NASDAQ")).toBe("BF-B");
  });
  it("US ไม่มี suffix", () => {
    expect(yahooTicker("AAPL", "NASDAQ")).toBe("AAPL");
    expect(yahooTicker("MMM", "NYSE")).toBe("MMM");
  });
  it("ตลาดเอเชียใหม่", () => {
    expect(yahooTicker("2330", "TWSE")).toBe("2330.TW");
    expect(yahooTicker("D05", "SGX")).toBe("D05.SI");
    expect(yahooTicker("BBCA", "IDX")).toBe("BBCA.JK");
    expect(yahooTicker("TENAGA", "BURSA")).toBe("TENAGA.KL");
    expect(yahooTicker("SM", "PSE")).toBe("SM.PS");
  });
});

describe("normalizeQuote — v7 quote → schema ชั้น B", () => {
  it("แมปฟิลด์ครบ + dividendYield ทศนิยม → %", () => {
    const md = normalizeQuote(
      {
        symbol: "KBANK.BK",
        currency: "THB",
        regularMarketPrice: 150.5,
        regularMarketChangePercent: 1.25,
        trailingPE: 8.4,
        priceToBook: 1.1,
        dividendYield: 0.0456,
        marketCap: 350000000000,
        averageVolume: 20000000,
        fiftyTwoWeekHigh: 180,
        fiftyTwoWeekLow: 120,
      },
      "2026-08-05T00:00:00Z",
    );
    expect(md.price).toBe(150.5);
    expect(md.changePct).toBe(1.25);
    expect(md.pe).toBe(8.4);
    expect(md.pbv).toBe(1.1);
    expect(md.dividendYield).toBe(4.56);
    expect(md.marketCap).toBe(350000000000);
    expect(md.high52w).toBe(180);
    expect(md.low52w).toBe(120);
    expect(md.currency).toBe("THB");
    expect(md.updatedAt).toBe("2026-08-05T00:00:00Z");
  });
  it("quote ไม่มีราคา → ฟิลด์ว่างไม่โผล่", () => {
    const md = normalizeQuote({ symbol: "X" }, "t");
    expect(md.price).toBeUndefined();
  });
});

describe("snapshot + merge", () => {
  const snap = buildSnapshot(
    [
      { symbol: "KBANK.BK", regularMarketPrice: 150.5, currency: "THB" },
      { symbol: "AAPL", regularMarketPrice: 210.1, regularMarketChangePercent: -0.5, currency: "USD" },
    ],
    "2026-08-05T00:00:00Z",
  );

  it("buildSnapshot: key = yahoo symbol", () => {
    expect(Object.keys(snap.quotes).length).toBe(2);
    expect(snap.quotes["AAPL"].price).toBe(210.1);
    expect(snap.quotes["AAPL"].changePct).toBe(-0.5);
  });

  it("save/load roundtrip (temp dir — กันเขียนทับของจริง)", () => {
    const tmp = path.join(os.tmpdir(), `bazi-test-${Date.now()}`);
    const file = saveSnapshot(snap, "2026-08-05", tmp);
    expect(file).toContain("2026-08-05");
    const loaded = loadSnapshot("2026-08-05", tmp);
    expect(loaded?.quotes["KBANK.BK"].price).toBe(150.5);
    expect(loadSnapshot(undefined, tmp)?.quotes["AAPL"].price).toBe(210.1); // latest.json
  });

  it("withMarketData: เติม marketData ให้หุ้นที่ตรง (ไทย ticker เปล่า → KBANK.BK)", () => {
    const stock = {
      ticker: "KBANK",
      market: "SET",
      type: "stock",
      name: "กสิกรไทย",
    } as unknown as StockEntry;
    const merged = withMarketData(stock, snap);
    expect(merged.marketData?.price).toBe(150.5);
  });

  it("withMarketData: หุ้นที่ไม่มีราคา → null (ไม่เดา)", () => {
    const stock = {
      ticker: "ZZZZ",
      market: "SET",
      type: "stock",
      name: "ไม่จริง",
    } as unknown as StockEntry;
    const merged = withMarketData(stock, snap);
    expect(merged.marketData).toBeNull();
  });
});
