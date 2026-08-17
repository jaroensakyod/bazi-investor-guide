import { describe, expect, it } from "vitest";
import {
  commaSeparatedSet,
  emptyMarketDataFetchLedger,
  recordMarketDataFetch,
  retryWithBackoff,
  selectMarketDataTargets,
  shouldDeferMarketDataRetry,
  type MarketDataTarget,
} from "../src/lib/research/market-data-batch";

const targets: MarketDataTarget[] = [
  {
    securityId: "NASDAQ:MSFT",
    ticker: "MSFT",
    providerTicker: "MSFT",
    market: "NASDAQ",
    country: "US",
    currency: "USD",
    priority: 20,
  },
  {
    securityId: "SET:PTT",
    ticker: "PTT",
    providerTicker: "PTT.BK",
    market: "SET",
    country: "TH",
    currency: "THB",
    priority: 30,
  },
  {
    securityId: "NASDAQ:AAPL",
    ticker: "AAPL",
    providerTicker: "AAPL",
    market: "NASDAQ",
    country: "US",
    currency: "USD",
    priority: 40,
  },
];

describe("research market-data batch", () => {
  it("filters by country/market/ticker and keeps deterministic priority order", () => {
    expect(
      selectMarketDataTargets(targets, {
        country: "us",
        markets: commaSeparatedSet("nasdaq"),
      }).map((target) => target.securityId),
    ).toEqual(["NASDAQ:AAPL", "NASDAQ:MSFT"]);

    expect(
      selectMarketDataTargets(targets, { tickers: commaSeparatedSet("ptt.bk") }).map(
        (target) => target.securityId,
      ),
    ).toEqual(["SET:PTT"]);
  });

  it("records resumable success/failure state without losing the previous success", () => {
    const ledger = emptyMarketDataFetchLedger(new Date("2026-08-10T00:00:00.000Z"));
    const success = recordMarketDataFetch(
      ledger,
      {
        dataset: "eod_1d",
        securityId: "NASDAQ:AAPL",
        provider: "test",
        providerTicker: "AAPL",
        status: "succeeded",
        rowCount: 500,
      },
      new Date("2026-08-10T01:00:00.000Z"),
    );
    const failure = recordMarketDataFetch(
      ledger,
      {
        dataset: "eod_1d",
        securityId: "NASDAQ:AAPL",
        provider: "test",
        providerTicker: "AAPL",
        status: "failed",
        error: "HTTP 429",
      },
      new Date("2026-08-10T02:00:00.000Z"),
    );

    expect(success.lastSuccessAt).toBe("2026-08-10T01:00:00.000Z");
    expect(failure.attempts).toBe(2);
    expect(failure.consecutiveFailures).toBe(1);
    expect(failure.lastSuccessAt).toBe("2026-08-10T01:00:00.000Z");
    expect(failure.rowCount).toBe(500);
    expect(
      shouldDeferMarketDataRetry(
        ledger,
        { dataset: "eod_1d", securityId: "NASDAQ:AAPL", provider: "test" },
        24,
        new Date("2026-08-10T03:00:00.000Z"),
      ),
    ).toBe(true);
    expect(
      shouldDeferMarketDataRetry(
        ledger,
        { dataset: "eod_1d", securityId: "NASDAQ:AAPL", provider: "test" },
        24,
        new Date("2026-08-12T03:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("retries transient work with bounded attempts", async () => {
    let attempts = 0;
    const result = await retryWithBackoff(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error("temporary");
        return "ok";
      },
      { attempts: 3, baseDelayMs: 0 },
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
