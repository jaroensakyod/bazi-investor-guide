export type PriceTimeframe = "1d" | "1h" | "15m" | "5m" | "1m";
export type PriceAdjustment = "raw" | "split_adjusted" | "total_return";

export type PriceBar = {
  /** ISO timestamp. Daily data may use YYYY-MM-DD. */
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  adjustedClose?: number;
};

export type PriceSeriesSource = {
  provider: string;
  sourceRef?: string;
  fetchedAt: string;
  asOf: string;
  license: "commercial" | "development_only" | "unknown";
};

export type PriceSeriesMetadata = {
  schemaVersion: 1;
  securityId: string;
  ticker: string;
  exchange: string;
  currency: string;
  timeZone: string;
  timeframe: PriceTimeframe;
  adjustment: PriceAdjustment;
  source: PriceSeriesSource;
};

export type PriceBarIssue = {
  index: number;
  code: "invalid_timestamp" | "invalid_price" | "invalid_range" | "invalid_volume" | "invalid_adjusted_close";
  detail: string;
};

export type CanonicalPriceSeries = {
  metadata: PriceSeriesMetadata;
  bars: PriceBar[];
  issues: PriceBarIssue[];
  startAt: string | null;
  endAt: string | null;
};

export type CompactPriceSeries = {
  schemaVersion: 1;
  metadata: PriceSeriesMetadata;
  columns: readonly ["timestamp", "open", "high", "low", "close", "volume", "adjustedClose"];
  rows: Array<[string, number, number, number, number, number | null, number | null]>;
};

export const PRICE_SERIES_RETENTION_DAYS: Record<PriceTimeframe, number | null> = {
  "1d": null,
  "1h": 730,
  "15m": 365,
  "5m": 180,
  "1m": 90,
};

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === value;
}

function validIsoTimestamp(value: string): boolean {
  if (validIsoDate(value)) return true;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function validateBar(bar: PriceBar, index: number): PriceBarIssue[] {
  const issues: PriceBarIssue[] = [];
  if (typeof bar.timestamp !== "string" || !validIsoTimestamp(bar.timestamp)) {
    issues.push({ index, code: "invalid_timestamp", detail: `timestamp ไม่ถูกต้อง: ${bar.timestamp}` });
  }
  if (![bar.open, bar.high, bar.low, bar.close].every(finitePositive)) {
    issues.push({ index, code: "invalid_price", detail: "OHLC ต้องเป็นตัวเลขมากกว่า 0" });
  } else if (bar.high < Math.max(bar.open, bar.close, bar.low) || bar.low > Math.min(bar.open, bar.close, bar.high)) {
    issues.push({ index, code: "invalid_range", detail: "high/low ไม่ครอบ open และ close" });
  }
  if (bar.volume !== undefined && (!Number.isFinite(bar.volume) || bar.volume < 0)) {
    issues.push({ index, code: "invalid_volume", detail: "volume ต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป" });
  }
  if (bar.adjustedClose !== undefined && !finitePositive(bar.adjustedClose)) {
    issues.push({ index, code: "invalid_adjusted_close", detail: "adjustedClose ต้องมากกว่า 0" });
  }
  return issues;
}

/** Sort, validate and de-duplicate bars. The last valid row wins per timestamp. */
export function canonicalizePriceSeries(metadata: PriceSeriesMetadata, input: readonly PriceBar[]): CanonicalPriceSeries {
  const issues: PriceBarIssue[] = [];
  const byTimestamp = new Map<string, PriceBar>();

  input.forEach((bar, index) => {
    const rowIssues = validateBar(bar, index);
    issues.push(...rowIssues);
    if (rowIssues.length === 0) byTimestamp.set(bar.timestamp, { ...bar });
  });

  const bars = [...byTimestamp.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  return {
    metadata,
    bars,
    issues,
    startAt: bars[0]?.timestamp ?? null,
    endAt: bars.at(-1)?.timestamp ?? null,
  };
}

export function mergePriceSeries(existing: CanonicalPriceSeries | null, incoming: CanonicalPriceSeries): CanonicalPriceSeries {
  if (existing && seriesKey(existing.metadata) !== seriesKey(incoming.metadata)) {
    throw new Error("รวม series คนละ security/timeframe/adjustment ไม่ได้");
  }
  const bars = existing ? [...existing.bars, ...incoming.bars] : incoming.bars;
  return canonicalizePriceSeries(incoming.metadata, bars);
}

export function applySeriesRetention(
  series: CanonicalPriceSeries,
  asOf = new Date(),
  retentionDays = PRICE_SERIES_RETENTION_DAYS[series.metadata.timeframe],
): CanonicalPriceSeries {
  if (retentionDays === null) return series;
  const cutoff = asOf.getTime() - retentionDays * 86_400_000;
  return canonicalizePriceSeries(
    series.metadata,
    series.bars.filter((bar) => Date.parse(bar.timestamp) >= cutoff),
  );
}

export function seriesKey(metadata: Pick<PriceSeriesMetadata, "securityId" | "timeframe" | "adjustment">): string {
  return `${metadata.securityId}|${metadata.timeframe}|${metadata.adjustment}`;
}

export function compactPriceSeries(series: CanonicalPriceSeries): CompactPriceSeries {
  return {
    schemaVersion: 1,
    metadata: series.metadata,
    columns: ["timestamp", "open", "high", "low", "close", "volume", "adjustedClose"],
    rows: series.bars.map((bar) => [
      bar.timestamp,
      bar.open,
      bar.high,
      bar.low,
      bar.close,
      bar.volume ?? null,
      bar.adjustedClose ?? null,
    ]),
  };
}

export function expandPriceSeries(compact: CompactPriceSeries): CanonicalPriceSeries {
  if (compact.schemaVersion !== 1) throw new Error(`price-series schema ${compact.schemaVersion} ไม่รองรับ`);
  return canonicalizePriceSeries(
    compact.metadata,
    compact.rows.map(([timestamp, open, high, low, close, volume, adjustedClose]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      ...(volume === null ? {} : { volume }),
      ...(adjustedClose === null ? {} : { adjustedClose }),
    })),
  );
}

/**
 * Expand a file written by saveStoredPriceSeries without sorting and
 * re-validating every bar. Ingestion already canonicalizes the payload before
 * the atomic write; callers must use this only for the application's own cache.
 */
export function expandCanonicalStoredPriceSeries(compact: CompactPriceSeries): CanonicalPriceSeries {
  if (compact.schemaVersion !== 1) throw new Error(`price-series schema ${compact.schemaVersion} ไม่รองรับ`);
  if (!Array.isArray(compact.rows)) throw new Error("price-series rows ไม่ถูกต้อง");
  const bars = compact.rows.map(([timestamp, open, high, low, close, volume, adjustedClose]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    ...(volume === null ? {} : { volume }),
    ...(adjustedClose === null ? {} : { adjustedClose }),
  }));
  return {
    metadata: compact.metadata,
    bars,
    issues: [],
    startAt: bars[0]?.timestamp ?? null,
    endAt: bars.at(-1)?.timestamp ?? null,
  };
}
