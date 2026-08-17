import { describe, expect, it } from "vitest";
import { canonicalizePriceSeries, type PriceBar, type PriceSeriesMetadata } from "../src/lib/research/price-series";
import { analyzePricePattern, evaluateTrendObservationModel } from "../src/lib/research/pattern-engine";

const metadata: PriceSeriesMetadata = {
  schemaVersion: 1,
  securityId: "NASDAQ:TREND",
  ticker: "TREND",
  exchange: "NASDAQ",
  currency: "USD",
  timeZone: "America/New_York",
  timeframe: "1d",
  adjustment: "split_adjusted",
  source: { provider: "fixture", fetchedAt: "2026-08-08T00:00:00.000Z", asOf: "2026-08-07", license: "development_only" },
};

function trendBars(count: number, dailyStep: number): PriceBar[] {
  const start = Date.UTC(2024, 0, 1);
  return Array.from({ length: count }, (_, index) => {
    const close = 100 + dailyStep * index + Math.sin(index / 5) * 0.25;
    return {
      timestamp: new Date(start + index * 86_400_000).toISOString().slice(0, 10),
      open: close - 0.2,
      high: close + 0.8,
      low: close - 0.8,
      close,
      volume: 1_000 + index,
    };
  });
}

describe("pattern observation engine", () => {
  it("ระบุแนวโน้มขึ้นจากข้อมูลที่เพียงพอและไม่เรียก historical range ว่า forecast", () => {
    const series = canonicalizePriceSeries(metadata, trendBars(320, 0.2));
    const result = analyzePricePattern(series);
    expect(result.regime).toBe("uptrend");
    expect(result.dataQuality.sufficientForEvaluation).toBe(true);
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.scenarios.every((scenario) => scenario.label === "historical_distribution_not_forecast")).toBe(true);
    expect(result.publication.forecastRelease).toContain("internal_only");
  });

  it("ประเมินแบบ walk-forward และไม่เก็บ event ทุกจุดโดยค่าเริ่มต้น", () => {
    const series = canonicalizePriceSeries(metadata, trendBars(360, 0.15));
    const compact = evaluateTrendObservationModel(series, 20);
    expect(compact.observations).toBeGreaterThan(0);
    expect(compact.events).toEqual([]);
    expect(compact.productionReady).toBe(false);

    const auditable = evaluateTrendObservationModel(series, 20, { includeEvents: true, minimumDirectionalSignals: 10 });
    expect(auditable.events.length).toBe(auditable.observations);
    expect(auditable.events[0].asOf).toBeTruthy();
  });
});

