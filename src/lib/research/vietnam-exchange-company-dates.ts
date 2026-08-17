import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const HOSE_LISTED_STOCKS_URL = "https://www.hsx.vn/vi/quan-ly-niem-yet/co-phieu";
export const HOSE_LISTED_STOCKS_API_URL = "https://api.hsx.vn/l/api/v1/1/securities/stock";
export const HNX_LISTED_STOCKS_URL = "https://hnx.vn/en-gb/cophieu-etfs/chung-khoan-ny.html";
export const HNX_LISTED_STOCKS_API_URL = "https://hnx.vn/ModuleIssuer/List/ListSearch_Datas";

export type VietnamExchange = "HOSE" | "HNX";

export type VietnamCompanyDateRow = {
  symbol: string;
  exchange: VietnamExchange;
  listingDate: string;
  isin: string | null;
  figi: string | null;
};

export type VietnamCompanyDatePayload = {
  retrievedAt: string;
  sourceRowCount: { hose: number; hnx: number };
  records: VietnamCompanyDateRow[];
};

export type VietnamOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  sourceExchange: VietnamExchange | null;
  listingDate: string | null;
  isin: string | null;
  figi: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function parseVietnamListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

export function normalizeVietnamCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function optionalIdentifier(value: unknown, pattern: RegExp): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return pattern.test(normalized) ? normalized : null;
}

export function parseVietnamCompanyDatePayload(payload: unknown): VietnamCompanyDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("Vietnam company-date payload must be an object");
  const input = payload as { retrievedAt?: unknown; sourceRowCount?: unknown; records?: unknown };
  if (typeof input.retrievedAt !== "string" || !Number.isFinite(Date.parse(input.retrievedAt))) {
    throw new Error("Vietnam company-date payload has an invalid retrievedAt");
  }
  if (!Array.isArray(input.records)) throw new Error("Vietnam company-date payload is missing records");
  const counts = input.sourceRowCount as { hose?: unknown; hnx?: unknown } | undefined;
  const hoseCount = Number(counts?.hose);
  const hnxCount = Number(counts?.hnx);
  if (!Number.isInteger(hoseCount) || hoseCount < 0 || !Number.isInteger(hnxCount) || hnxCount < 0) {
    throw new Error("Vietnam company-date payload has invalid source row counts");
  }

  const records = input.records.flatMap((value): VietnamCompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeVietnamCatalogTicker(String(row.symbol ?? ""));
    const exchange = String(row.exchange ?? "").trim().toUpperCase();
    const listingDate = parseVietnamListingDate(row.listingDate);
    if (!/^[A-Z0-9]{2,12}$/.test(symbol) || (exchange !== "HOSE" && exchange !== "HNX") || !listingDate) {
      return [];
    }
    return [{
      symbol,
      exchange,
      listingDate,
      isin: optionalIdentifier(row.isin, /^VN[A-Z0-9]{10}$/),
      figi: optionalIdentifier(row.figi, /^BBG[A-Z0-9]{9}$/),
    }];
  });
  if (records.length === 0) throw new Error("Vietnam company-date payload contains no valid records");
  if (hoseCount < records.filter((row) => row.exchange === "HOSE").length
    || hnxCount < records.filter((row) => row.exchange === "HNX").length) {
    throw new Error("Vietnam source row counts cannot be lower than compact record counts");
  }

  return {
    retrievedAt: new Date(input.retrievedAt).toISOString(),
    sourceRowCount: { hose: hoseCount, hnx: hnxCount },
    records,
  };
}

export function matchVietnamOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: VietnamCompanyDatePayload,
): VietnamOfficialDateRecord[] {
  const bySymbol = new Map<string, VietnamCompanyDateRow[]>();
  for (const row of payload.records) {
    const current = bySymbol.get(row.symbol) ?? [];
    if (!current.some((item) => item.exchange === row.exchange && item.listingDate === row.listingDate)) current.push(row);
    bySymbol.set(row.symbol, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "HOSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeVietnamCatalogTicker(ticker);
      const securityId = securityIdOf("HOSE", ticker);
      const matches = bySymbol.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceSymbol: null,
          sourceExchange: null,
          listingDate: null,
          isin: null,
          figi: null,
          events: [],
          warnings: [matches.length === 0
            ? "Ticker not found in the official HOSE or HNX listed-stock snapshots"
            : `Found ${matches.length} conflicting Vietnam exchange rows`],
        };
      }

      const row = matches[0];
      const isHose = row.exchange === "HOSE";
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Ho_Chi_Minh",
        exchange: row.exchange,
        venueCity: isHose ? "Ho Chi Minh City" : "Hanoi",
        venueCountry: "VN",
        evidence: {
          authority: "exchange",
          sourceName: isHose
            ? "Ho Chi Minh Stock Exchange — Listed Stocks"
            : "Hanoi Stock Exchange — List of Stocks",
          sourceUrl: isHose ? HOSE_LISTED_STOCKS_URL : HNX_LISTED_STOCKS_URL,
          retrievedAt: payload.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `${row.exchange} official listing date; the legacy catalog market code HOSE is a Vietnam country bucket, so the actual venue is preserved on this event. Exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        status: "matched" as const,
        sourceSymbol: row.symbol,
        sourceExchange: row.exchange,
        listingDate: row.listingDate,
        isin: row.isin,
        figi: row.figi,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
