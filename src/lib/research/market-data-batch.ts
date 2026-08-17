import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const MARKET_DATA_FETCH_LEDGER_FILE = path.join(
  ROOT,
  "data/staging/research-market-fetch-ledger.json",
);

export type MarketDataTarget = {
  securityId: string;
  ticker: string;
  providerTicker: string;
  market: string;
  country: string;
  currency: string;
  priority: number;
};

export type MarketDataTargetFilters = {
  tickers?: ReadonlySet<string>;
  markets?: ReadonlySet<string>;
  country?: string;
};

export function commaSeparatedSet(value: string | undefined): Set<string> {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean),
  );
}

export function selectMarketDataTargets(
  candidates: readonly MarketDataTarget[],
  filters: MarketDataTargetFilters = {},
): MarketDataTarget[] {
  const country = filters.country?.trim().toUpperCase() ?? "";
  return candidates
    .filter((candidate) => {
      const ticker = candidate.ticker.toUpperCase();
      const providerTicker = candidate.providerTicker.toUpperCase();
      const market = candidate.market.toUpperCase();
      return (
        (!filters.tickers?.size || filters.tickers.has(ticker) || filters.tickers.has(providerTicker))
        && (!filters.markets?.size || filters.markets.has(market))
        && (!country || candidate.country.toUpperCase() === country)
      );
    })
    .sort((left, right) => right.priority - left.priority || left.securityId.localeCompare(right.securityId));
}

export function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Math.floor(Number(value ?? fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

export function isDateWithinDays(value: string | null | undefined, maximumAgeDays: number, now = new Date()): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && now.getTime() - timestamp <= maximumAgeDays * 86_400_000;
}

export function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function retryWithBackoff<T>(
  task: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {},
): Promise<T> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 3));
  const baseDelayMs = Math.max(0, Math.floor(options.baseDelayMs ?? 1_000));
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || options.shouldRetry?.(error) === false) break;
      await delay(baseDelayMs * attempt);
    }
  }
  throw lastError;
}

export type MarketDataDataset = "fundamentals" | "eod_1d";
export type MarketDataFetchStatus = "succeeded" | "no_data" | "failed" | "protected_commercial";

export type MarketDataFetchRecord = {
  dataset: MarketDataDataset;
  securityId: string;
  provider: string;
  providerTicker: string;
  status: MarketDataFetchStatus;
  attempts: number;
  consecutiveFailures: number;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastError: string | null;
  rowCount: number | null;
};

export type MarketDataFetchLedger = {
  schemaVersion: 1;
  updatedAt: string;
  records: Record<string, MarketDataFetchRecord>;
};

export function emptyMarketDataFetchLedger(now = new Date()): MarketDataFetchLedger {
  return { schemaVersion: 1, updatedAt: now.toISOString(), records: {} };
}

export function marketDataFetchKey(dataset: MarketDataDataset, securityId: string, provider: string): string {
  return `${dataset}|${securityId}|${provider}`;
}

export function shouldDeferMarketDataRetry(
  ledger: MarketDataFetchLedger,
  input: { dataset: MarketDataDataset; securityId: string; provider: string },
  retryAfterHours = 24,
  now = new Date(),
): boolean {
  const record = ledger.records[marketDataFetchKey(input.dataset, input.securityId, input.provider)];
  if (!record || record.status === "succeeded" || record.status === "protected_commercial") return false;
  const lastAttemptAt = Date.parse(record.lastAttemptAt);
  return Number.isFinite(lastAttemptAt) && now.getTime() - lastAttemptAt < retryAfterHours * 3_600_000;
}

export function recordMarketDataFetch(
  ledger: MarketDataFetchLedger,
  input: {
    dataset: MarketDataDataset;
    securityId: string;
    provider: string;
    providerTicker: string;
    status: MarketDataFetchStatus;
    error?: string | null;
    rowCount?: number | null;
  },
  now = new Date(),
): MarketDataFetchRecord {
  const key = marketDataFetchKey(input.dataset, input.securityId, input.provider);
  const previous = ledger.records[key];
  const succeeded = input.status === "succeeded";
  const record: MarketDataFetchRecord = {
    dataset: input.dataset,
    securityId: input.securityId,
    provider: input.provider,
    providerTicker: input.providerTicker,
    status: input.status,
    attempts: (previous?.attempts ?? 0) + 1,
    consecutiveFailures: succeeded ? 0 : (previous?.consecutiveFailures ?? 0) + 1,
    lastAttemptAt: now.toISOString(),
    lastSuccessAt: succeeded ? now.toISOString() : previous?.lastSuccessAt ?? null,
    lastError: succeeded ? null : input.error ?? input.status,
    rowCount: input.rowCount ?? previous?.rowCount ?? null,
  };
  ledger.records[key] = record;
  ledger.updatedAt = now.toISOString();
  return record;
}

export function loadMarketDataFetchLedger(file = MARKET_DATA_FETCH_LEDGER_FILE): MarketDataFetchLedger {
  if (!existsSync(file)) return emptyMarketDataFetchLedger();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as MarketDataFetchLedger;
    if (parsed.schemaVersion === 1 && parsed.records && typeof parsed.records === "object") return parsed;
  } catch {
    // A malformed ledger must not prevent the resumable fetch from rebuilding its operational state.
  }
  return emptyMarketDataFetchLedger();
}

export function saveMarketDataFetchLedger(
  ledger: MarketDataFetchLedger,
  file = MARKET_DATA_FETCH_LEDGER_FILE,
): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  renameSync(temporary, file);
}
