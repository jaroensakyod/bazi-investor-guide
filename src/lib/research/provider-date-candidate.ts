import type { StockEntry } from "../investor/stock-database";
import type { YahooQuote } from "../market/yahoo";
import { securityIdOf } from "./security-birth";

export type ProviderDateCandidate = {
  securityId: string;
  ticker: string;
  market: string;
  providerTicker: string;
  status: "candidate" | "missing" | "rejected";
  candidateLocalDate: string | null;
  providerTimestampMs: number | null;
  providerExchange: string | null;
  providerExchangeName: string | null;
  providerTimeZone: string | null;
  eligibleForSecurityBirth: false;
  limitation: string;
};

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function localIsoDate(timestampMs: number, timeZone: string): string | null {
  if (!Number.isFinite(timestampMs) || timestampMs <= 0 || !validTimeZone(timeZone)) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(timestampMs));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
}

/**
 * Convert Yahoo's firstTradeDateMilliseconds into a quarantined candidate.
 *
 * The field is useful for finding records to review, but it is demonstrably a
 * provider-history boundary for some long-listed non-US shares.  Consequently
 * this function can never return a canonical SecurityEvent.
 */
export function buildYahooDateCandidate(
  stock: Pick<StockEntry, "ticker" | "market">,
  providerTicker: string,
  quote: YahooQuote | undefined,
  nowMs = Date.now(),
): ProviderDateCandidate {
  const base = {
    securityId: securityIdOf(stock.market, stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    market: stock.market.trim().toUpperCase(),
    providerTicker,
    providerExchange: quote?.exchange ?? null,
    providerExchangeName: quote?.fullExchangeName ?? null,
    providerTimeZone: quote?.exchangeTimezoneName ?? null,
    eligibleForSecurityBirth: false as const,
  };
  const timestamp = quote?.firstTradeDateMilliseconds;
  const timeZone = quote?.exchangeTimezoneName;

  if (!Number.isFinite(timestamp) || !timeZone) {
    return {
      ...base,
      status: "missing",
      candidateLocalDate: null,
      providerTimestampMs: null,
      limitation: "Yahoo did not return a usable firstTradeDateMilliseconds/time zone pair",
    };
  }

  const candidateLocalDate = localIsoDate(timestamp as number, timeZone);
  if (!candidateLocalDate || (timestamp as number) > nowMs + 86_400_000) {
    return {
      ...base,
      status: "rejected",
      candidateLocalDate: null,
      providerTimestampMs: timestamp as number,
      limitation: "Provider timestamp is invalid or in the future",
    };
  }

  return {
    ...base,
    status: "candidate",
    candidateLocalDate,
    providerTimestampMs: timestamp as number,
    limitation:
      "Candidate only: Yahoo may report the beginning of its price history rather than the legal listing/first-trading date; official evidence is required before use",
  };
}

