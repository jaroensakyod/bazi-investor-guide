import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const IDX_LISTED_COMPANY_PROFILES_URL = "https://www.idx.co.id/en/listed-companies/company-profiles";

export type IdxCompanyDateRow = {
  symbol: string;
  listingDate: string;
  isin?: string;
  sourceName?: string;
  sourceUrl?: string;
};

export type IdxCompanyDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: IdxCompanyDateRow[];
};

export type IdxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function parseIdxListingDate(value: unknown): string | null {
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

export function normalizeIdxCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.JK$/i, "");
}

export function parseIdxCompanyDatePayload(payload: unknown): IdxCompanyDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("IDX company-date payload must be an object");
  const input = payload as { retrievedAt?: unknown; sourceRowCount?: unknown; records?: unknown };
  if (typeof input.retrievedAt !== "string" || !Number.isFinite(Date.parse(input.retrievedAt))) {
    throw new Error("IDX company-date payload has an invalid retrievedAt");
  }
  if (!Array.isArray(input.records)) throw new Error("IDX company-date payload is missing records");
  const records = input.records.flatMap((value): IdxCompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeIdxCatalogTicker(String(row.symbol ?? ""));
    const listingDate = parseIdxListingDate(row.listingDate);
    if (!/^[A-Z0-9]{3,8}$/.test(symbol) || !listingDate) return [];
    return [{ symbol, listingDate }];
  });
  if (records.length === 0) throw new Error("IDX company-date payload contains no valid records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(input.retrievedAt).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length ? sourceRowCount : records.length,
    records,
  };
}

export function parseIdxOfficialDateSupplements(payload: unknown): IdxCompanyDateRow[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { records?: unknown }).records)) {
    throw new Error("IDX official-date supplement payload is missing records");
  }
  return (payload as { records: unknown[] }).records.flatMap((value): IdxCompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeIdxCatalogTicker(String(row.symbol ?? ""));
    const listingDate = parseIdxListingDate(row.listingDate);
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const sourceName = String(row.sourceName ?? "").replace(/\s+/g, " ").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    let officialUrl = false;
    try {
      const url = new URL(sourceUrl);
      officialUrl = url.protocol === "https:"
        && ["www.ksei.co.id", "web.ksei.co.id", "www.idx.co.id"].includes(url.hostname);
    } catch {
      officialUrl = false;
    }
    if (!/^[A-Z0-9]{3,8}$/.test(symbol) || !listingDate || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)
      || !sourceName || !officialUrl) return [];
    return [{ symbol, listingDate, isin, sourceName, sourceUrl }];
  });
}

export function matchIdxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: IdxCompanyDatePayload,
): IdxOfficialDateRecord[] {
  const bySymbol = new Map<string, IdxCompanyDateRow[]>();
  for (const row of payload.records) {
    const current = bySymbol.get(row.symbol) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate)) current.push(row);
    bySymbol.set(row.symbol, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "IDX")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeIdxCatalogTicker(ticker);
      const securityId = securityIdOf("IDX", ticker);
      const matches = bySymbol.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceSymbol: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0
            ? "Ticker not found in the IDX Listed Company Profiles snapshot"
            : `Found ${matches.length} conflicting IDX rows`],
        };
      }
      const row = matches[0];
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Jakarta",
        exchange: "IDX",
        venueCity: "Jakarta",
        venueCountry: "ID",
        evidence: {
          authority: "exchange",
          sourceName: row.sourceName ?? "Indonesia Stock Exchange — Listed Company Profiles",
          sourceUrl: row.sourceUrl ?? IDX_LISTED_COMPANY_PROFILES_URL,
          retrievedAt: payload.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: row.isin
          ? `Official listing date for ${row.symbol}; ISIN ${row.isin}; exact first-trade time is not stated.`
          : "IDX official Tanggal Pencatatan (listing date); exact first-trade time is not stated.",
      };
      return {
        securityId,
        ticker,
        status: "matched" as const,
        sourceSymbol: row.symbol,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
