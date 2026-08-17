import { canonicalizePriceSeries, type CanonicalPriceSeries, type PriceBar, type PriceTimeframe } from "./price-series";
import type { PriceHistoryProvider, PriceHistoryRequest } from "./price-history-provider";

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      meta?: { currency?: string; exchangeName?: string; exchangeTimezoneName?: string };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
        adjclose?: Array<{ adjclose?: Array<number | null> }>;
      };
    }>;
    error?: { code?: string; description?: string } | null;
  };
};

const YAHOO_INTERVAL: Record<PriceTimeframe, string> = {
  "1d": "1d",
  "1h": "1h",
  "15m": "15m",
  "5m": "5m",
  "1m": "1m",
};

function unixSeconds(date: string): number {
  const milliseconds = Date.parse(date);
  if (!Number.isFinite(milliseconds)) throw new Error(`วันที่ไม่ถูกต้อง: ${date}`);
  return Math.floor(milliseconds / 1000);
}

export function parseYahooChartResponse(request: PriceHistoryRequest, payload: YahooChartResponse): CanonicalPriceSeries {
  const error = payload.chart?.error;
  if (error) throw new Error(`${error.code ?? "YAHOO"}: ${error.description ?? "chart error"}`);
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error("Yahoo chart ไม่มีผลลัพธ์");
  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];
  if (!quote) throw new Error("Yahoo chart ไม่มี OHLC");
  const adjusted = result.indicators?.adjclose?.[0]?.adjclose ?? [];
  const timeZone = request.timeZone || result.meta?.exchangeTimezoneName || "UTC";
  const bars: PriceBar[] = [];

  const localDate = (unixTimestamp: number): string => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(unixTimestamp * 1000));
    const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${byType.year}-${byType.month}-${byType.day}`;
  };

  for (let index = 0; index < timestamps.length; index += 1) {
    const open = quote.open?.[index];
    const high = quote.high?.[index];
    const low = quote.low?.[index];
    const close = quote.close?.[index];
    if ([open, high, low, close].some((value) => typeof value !== "number" || !Number.isFinite(value))) continue;
    const volume = quote.volume?.[index];
    const adjustedClose = adjusted[index];
    bars.push({
      timestamp:
        request.timeframe === "1d"
          ? localDate(timestamps[index])
          : new Date(timestamps[index] * 1000).toISOString(),
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      ...(typeof volume === "number" && Number.isFinite(volume) ? { volume } : {}),
      ...(request.adjustment !== "raw" && typeof adjustedClose === "number" && Number.isFinite(adjustedClose) ? { adjustedClose } : {}),
    });
  }

  return canonicalizePriceSeries(
    {
      schemaVersion: 1,
      securityId: request.securityId,
      ticker: request.ticker,
      exchange: request.exchange || result.meta?.exchangeName || "UNKNOWN",
      currency: request.currency || result.meta?.currency || "UNKNOWN",
      timeZone,
      timeframe: request.timeframe,
      adjustment: request.adjustment,
      source: {
        provider: "yahoo-development-chart",
        fetchedAt: new Date().toISOString(),
        asOf: bars.at(-1)?.timestamp ?? request.to,
        license: "development_only",
      },
    },
    bars,
  );
}

/** Development adapter only. Replace with a licensed provider for production. */
export class YahooDevelopmentHistoryProvider implements PriceHistoryProvider {
  readonly id = "yahoo-development-chart";
  readonly licence = "development_only" as const;

  async fetchSeries(request: PriceHistoryRequest): Promise<CanonicalPriceSeries> {
    const period1 = unixSeconds(request.from);
    const period2 = unixSeconds(request.to);
    if (period2 <= period1) throw new Error("to ต้องอยู่หลัง from");
    const params = new URLSearchParams({
      period1: String(period1),
      period2: String(period2),
      interval: YAHOO_INTERVAL[request.timeframe],
      events: "div,splits",
      includeAdjustedClose: "true",
    });
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(request.ticker)}?${params}`;
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; bazi-investor-guide-development/1.0)" } });
    if (!response.ok) throw new Error(`Yahoo chart HTTP ${response.status}`);
    return parseYahooChartResponse(request, (await response.json()) as YahooChartResponse);
  }
}
