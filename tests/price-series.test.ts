import { describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import {
  canonicalizePriceSeries,
  compactPriceSeries,
  expandCanonicalStoredPriceSeries,
  expandPriceSeries,
  type PriceSeriesMetadata,
} from "../src/lib/research/price-series";
import {
  loadCanonicalStoredPriceSeries,
  loadStoredPriceSeries,
  saveStoredPriceSeries,
} from "../src/lib/research/price-series-store";
import { parseYahooChartResponse } from "../src/lib/research/yahoo-development-history";

const metadata: PriceSeriesMetadata = {
  schemaVersion: 1,
  securityId: "NASDAQ:TEST",
  ticker: "TEST",
  exchange: "NASDAQ",
  currency: "USD",
  timeZone: "America/New_York",
  timeframe: "1d",
  adjustment: "split_adjusted",
  source: {
    provider: "fixture",
    fetchedAt: "2026-08-08T00:00:00.000Z",
    asOf: "2026-08-07",
    license: "development_only",
  },
};

describe("shared compressed price series", () => {
  it("เรียงเวลา ตัดแถวผิด และ dedupe timestamp โดยแถวหลังชนะ", () => {
    const series = canonicalizePriceSeries(metadata, [
      { timestamp: "2026-08-02", open: 10, high: 12, low: 9, close: 11 },
      { timestamp: "bad", open: 10, high: 12, low: 9, close: 11 },
      { timestamp: "2026-02-30", open: 10, high: 12, low: 9, close: 11 },
      { timestamp: "2026-08-01", open: 9, high: 10, low: 8, close: 9.5 },
      { timestamp: "2026-08-02", open: 11, high: 13, low: 10, close: 12 },
    ]);
    expect(series.issues).toHaveLength(2);
    expect(series.bars.map((bar) => bar.timestamp)).toEqual(["2026-08-01", "2026-08-02"]);
    expect(series.bars.at(-1)?.close).toBe(12);
  });

  it("parse development provider เป็น canonical series พร้อมป้ายสิทธิ์ development_only", () => {
    const series = parseYahooChartResponse(
      { ...metadata, from: "2026-08-01", to: "2026-08-03" },
      {
        chart: {
          result: [
            {
              meta: { currency: "USD", exchangeName: "NASDAQ", exchangeTimezoneName: "America/New_York" },
              timestamp: [Date.parse("2026-08-01T14:30:00Z") / 1000],
              indicators: {
                quote: [{ open: [10], high: [12], low: [9], close: [11], volume: [100] }],
                adjclose: [{ adjclose: [10.8] }],
              },
            },
          ],
          error: null,
        },
      },
    );
    expect(series.bars).toHaveLength(1);
    expect(series.metadata.source.license).toBe("development_only");
    expect(series.metadata.timeZone).toBe("America/New_York");
  });

  it("compact/expand roundtrip", () => {
    const series = canonicalizePriceSeries(metadata, [
      { timestamp: "2026-08-01", open: 9, high: 10, low: 8, close: 9.5, volume: 100 },
    ]);
    const compact = compactPriceSeries(series);
    expect(expandPriceSeries(compact).bars).toEqual(series.bars);
    expect(expandCanonicalStoredPriceSeries(compact).bars).toEqual(series.bars);
  });

  it("เก็บ gzip หนึ่งชุดต่อ security/timeframe และ merge โดยไม่ทำสำเนาต่อผู้ใช้", () => {
    const root = path.join(os.tmpdir(), `research-series-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    saveStoredPriceSeries(metadata, [{ timestamp: "2026-08-01", open: 9, high: 10, low: 8, close: 9.5 }], root);
    const result = saveStoredPriceSeries(metadata, [{ timestamp: "2026-08-02", open: 10, high: 11, low: 9, close: 10.5 }], root);
    expect(result.rowCount).toBe(2);
    expect(result.file.endsWith("1d-split_adjusted.json.gz")).toBe(true);
    expect(loadStoredPriceSeries(metadata, root)?.bars).toHaveLength(2);
    expect(loadCanonicalStoredPriceSeries(metadata, root)?.bars).toHaveLength(2);
  });
});
