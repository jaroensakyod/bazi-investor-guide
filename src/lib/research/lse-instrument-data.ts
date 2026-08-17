import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const LSE_ISSUER_PROFILE_HELP_URL = "https://www.londonstockexchange.com/help/whats-issuer-profile-our-story";
export const LSE_INSTRUMENT_DATA_BASE_URL = "https://api.londonstockexchange.com/api/gw/lse/instruments/alldata";

export type LseInstrumentDateRow = {
  ticker: string;
  sourceTicker: string;
  description: string;
  instrumentName: string;
  isin: string;
  country: string;
  market: string;
  segment: string;
  issuerCode: string;
  issuerName: string;
  instrumentType: string;
  listingAdmissionDate: string;
  sourceHash?: string;
};

export type LseInstrumentDetail = Omit<LseInstrumentDateRow, "ticker" | "listingAdmissionDate"> & {
  listingAdmissionDate: string | null;
  warnings: string[];
};

export type LseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceTicker: string | null;
  companyName: string | null;
  isin: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

function stringField(record: Record<string, unknown>, key: string): string {
  return typeof record[key] === "string" ? record[key].trim() : "";
}

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeLseCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase();
}

export function lseOfficialTidmCandidates(ticker: string): string[] {
  const normalized = normalizeLseCatalogTicker(ticker);
  if (!/^[A-Z0-9.]+$/.test(normalized)) return [];
  return normalized.endsWith(".") || !/^[A-Z0-9]+$/.test(normalized)
    ? [normalized]
    : [normalized, `${normalized}.`];
}

function lseIssuerNameTokens(value: string): Set<string> {
  return new Set(value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !["PLC", "LIMITED", "LTD", "GROUP", "HOLDINGS"].includes(token)));
}

export function hasLseIssuerIdentityOverlap(catalogName: string, officialName: string): boolean {
  const catalog = lseIssuerNameTokens(catalogName);
  const official = lseIssuerNameTokens(officialName);
  return catalog.size > 0 && [...catalog].some((token) => official.has(token));
}

export function lseInstrumentDataUrl(ticker: string): string {
  const normalized = normalizeLseCatalogTicker(ticker);
  if (!/^[A-Z0-9.]+$/.test(normalized)) throw new Error(`Unsupported LSE TIDM: ${ticker}`);
  // A trailing full stop is part of several official TIDMs (for example RR.).
  // It must remain literal in the path; the LSE gateway does not decode %2E.
  return `${LSE_INSTRUMENT_DATA_BASE_URL}/${normalized}`;
}

export function parseLseInstrumentResponse(payload: unknown, expectedTicker: string): LseInstrumentDetail {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("LSE instrument payload must be an object");
  }
  const record = payload as Record<string, unknown>;
  const sourceTicker = normalizeLseCatalogTicker(stringField(record, "tidm"));
  const normalizedExpected = normalizeLseCatalogTicker(expectedTicker);
  const listingRaw = stringField(record, "listingadmissiondate");
  const listingAdmissionDate = validIsoDate(listingRaw) ? listingRaw : null;
  const warnings: string[] = [];
  if (sourceTicker !== normalizedExpected) {
    warnings.push(`LSE returned TIDM ${sourceTicker || "<missing>"} instead of ${normalizedExpected}`);
  }
  if (!listingAdmissionDate) {
    warnings.push(`LSE listingadmissiondate is invalid or missing: ${listingRaw || "<missing>"}`);
  }
  return {
    sourceTicker,
    description: stringField(record, "description"),
    instrumentName: stringField(record, "name"),
    isin: stringField(record, "isin"),
    country: stringField(record, "country"),
    market: stringField(record, "market"),
    segment: stringField(record, "segment"),
    issuerCode: stringField(record, "issuercode"),
    issuerName: stringField(record, "issuername"),
    instrumentType: stringField(record, "instrumenttype"),
    listingAdmissionDate,
    warnings,
  };
}

export function parseLseInstrumentDatePayload(payload: unknown): LseInstrumentDateRow[] {
  if (!payload || typeof payload !== "object") throw new Error("LSE instrument-date payload must be an object");
  const records = (payload as { records?: unknown }).records;
  if (!Array.isArray(records)) throw new Error("LSE instrument-date payload is missing records");
  return records.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row.status !== "matched") return [];
    const ticker = normalizeLseCatalogTicker(String(row.ticker ?? ""));
    const sourceTicker = normalizeLseCatalogTicker(String(row.sourceTicker ?? ""));
    const listingAdmissionDate = String(row.listingAdmissionDate ?? "");
    const exactOrTrailingDotAlias = ticker === sourceTicker || sourceTicker === `${ticker}.`;
    if (!ticker || !exactOrTrailingDotAlias || !validIsoDate(listingAdmissionDate)) return [];
    return [{
      ticker,
      sourceTicker,
      description: String(row.description ?? ""),
      instrumentName: String(row.instrumentName ?? ""),
      isin: String(row.isin ?? ""),
      country: String(row.country ?? ""),
      market: String(row.market ?? ""),
      segment: String(row.segment ?? ""),
      issuerCode: String(row.issuerCode ?? ""),
      issuerName: String(row.issuerName ?? ""),
      instrumentType: String(row.instrumentType ?? ""),
      listingAdmissionDate,
      sourceHash: typeof row.sourceHash === "string" ? row.sourceHash : undefined,
    }];
  });
}

export function matchLseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly LseInstrumentDateRow[],
  retrievedAt: string,
): LseOfficialDateRecord[] {
  const byTicker = new Map<string, LseInstrumentDateRow[]>();
  for (const row of rows) {
    const normalized = normalizeLseCatalogTicker(row.ticker);
    const current = byTicker.get(normalized) ?? [];
    if (!current.some((item) => item.listingAdmissionDate === row.listingAdmissionDate && item.isin === row.isin)) {
      current.push(row);
    }
    byTicker.set(normalized, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "LSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeLseCatalogTicker(ticker);
      const securityId = securityIdOf("LSE", ticker);
      const matches = byTicker.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceTicker: null,
          companyName: stock.name || null,
          isin: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0 ? "Ticker not found in staged LSE instrument data" : `Found ${matches.length} conflicting LSE rows`],
        };
      }

      const row = matches[0];
      const trailingDotAlias = row.sourceTicker === `${normalizedTicker}.`;
      if (trailingDotAlias && !hasLseIssuerIdentityOverlap(stock.name, row.issuerName)) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: "unmatched" as const,
          sourceTicker: row.sourceTicker,
          companyName: stock.name || null,
          isin: row.isin || null,
          listingDate: null,
          events: [],
          warnings: ["Trailing-dot TIDM exists, but catalog and official issuer names share no identity token"],
        };
      }
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingAdmissionDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Europe/London",
        exchange: "LSE",
        venueCity: "London",
        venueCountry: "GB",
        evidence: {
          authority: "exchange",
          sourceName: "London Stock Exchange — instrument reference data",
          sourceUrl: lseInstrumentDataUrl(row.sourceTicker),
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: trailingDotAlias
          ? `LSE official listingadmissiondate (Admission date); catalog TIDM ${normalizedTicker} is joined to official TIDM ${row.sourceTicker} only through the exact trailing-dot variant plus issuer-name identity. Exact first-trade time is not stated.`
          : "LSE official listingadmissiondate (Admission date); exact first-trade time is not stated.",
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceTicker: row.sourceTicker,
        companyName: row.issuerName || stock.name || null,
        isin: row.isin || null,
        listingDate: row.listingAdmissionDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
