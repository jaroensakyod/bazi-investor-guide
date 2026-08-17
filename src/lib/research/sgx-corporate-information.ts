import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const SGX_CORPORATE_INFORMATION_URL = "https://www.sgx.com/stock-exchange/corporate-information";

export type SgxCorporateDateRow = {
  ticker: string;
  companyName: string;
  listingDate: string;
  listingDates: string[];
  listingBoard: string;
  sourceUrl: string;
};

export type SgxCorporateDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: SgxCorporateDateRow[];
};

export type SgxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  companyName: string | null;
  listingDate: string | null;
  listingDates: string[];
  listingBoard: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function parseSgxListingDate(value: unknown): string | null {
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

export function normalizeSgxCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

function isOfficialSgxCorporateUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "links.sgx.com"
      && /^\/1\.0\.0\/corporate-information\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

export function parseSgxCorporateDatePayload(payload: unknown): SgxCorporateDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("SGX corporate-date payload must be an object");
  const input = payload as { retrievedAt?: unknown; sourceRowCount?: unknown; records?: unknown };
  if (typeof input.retrievedAt !== "string" || !Number.isFinite(Date.parse(input.retrievedAt))) {
    throw new Error("SGX corporate-date payload has an invalid retrievedAt");
  }
  const sourceRowCount = Number(input.sourceRowCount);
  if (!Number.isInteger(sourceRowCount) || sourceRowCount < 1) {
    throw new Error("SGX corporate-date payload has an invalid sourceRowCount");
  }
  if (!Array.isArray(input.records)) throw new Error("SGX corporate-date payload is missing records");

  const records = input.records.flatMap((value): SgxCorporateDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const ticker = normalizeSgxCatalogTicker(String(row.ticker ?? ""));
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const listingBoard = String(row.listingBoard ?? "").replace(/\s+/g, " ").trim().toUpperCase();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const listingDates = Array.isArray(row.listingDates)
      ? [...new Set(row.listingDates.map(parseSgxListingDate).filter((date): date is string => date !== null))].sort()
      : [];
    const listingDate = parseSgxListingDate(row.listingDate);
    if (!/^[A-Z0-9]{1,12}$/.test(ticker) || !companyName || !listingBoard || !listingDate
      || listingDates.length === 0 || listingDate !== listingDates[0] || !isOfficialSgxCorporateUrl(sourceUrl)) {
      return [];
    }
    return [{ ticker, companyName, listingDate, listingDates, listingBoard, sourceUrl }];
  });
  if (records.length === 0) throw new Error("SGX corporate-date payload contains no valid records");
  if (sourceRowCount < records.length) throw new Error("SGX sourceRowCount cannot be lower than compact record count");

  return {
    retrievedAt: new Date(input.retrievedAt).toISOString(),
    sourceRowCount,
    records,
  };
}

export function matchSgxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: SgxCorporateDatePayload,
): SgxOfficialDateRecord[] {
  const byTicker = new Map<string, SgxCorporateDateRow[]>();
  for (const row of payload.records) {
    const current = byTicker.get(row.ticker) ?? [];
    if (!current.some((item) => item.sourceUrl === row.sourceUrl && item.listingDate === row.listingDate)) current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "SGX")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const securityId = securityIdOf("SGX", ticker);
      const matches = byTicker.get(normalizeSgxCatalogTicker(ticker)) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          companyName: stock.name || null,
          listingDate: null,
          listingDates: [],
          listingBoard: null,
          sourceUrl: null,
          events: [],
          warnings: [matches.length === 0
            ? "Ticker has no verified day-precision date in the SGX Corporate Information snapshot"
            : `Found ${matches.length} conflicting SGX corporate-information rows`],
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
        timeZone: "Asia/Singapore",
        exchange: "SGX",
        venueCity: "Singapore",
        venueCountry: "SG",
        evidence: {
          authority: "exchange",
          sourceName: "Singapore Exchange — Corporate Information",
          sourceUrl: row.sourceUrl,
          retrievedAt: payload.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Earliest day-precision SGX Listed Date & Board entry (${row.listingBoard}); issuer-level exchange admission only. Alternate trading counters may share this issuer event, and no exact counter first-trade time is claimed.`,
      };
      return {
        securityId,
        ticker,
        status: "matched" as const,
        companyName: row.companyName,
        listingDate: row.listingDate,
        listingDates: row.listingDates,
        listingBoard: row.listingBoard,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
