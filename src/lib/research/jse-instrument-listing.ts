import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const JSE_LISTED_COMPANIES_URL = "https://clientportal.jse.co.za/companies-and-financial-instruments";
export const JSE_ALL_ISSUERS_SERVICE_URL =
  "https://clientportal.jse.co.za/_vti_bin/JSE/CustomerRoleService.svc/GetAllIssuers";
export const JSE_INSTRUMENTS_SERVICE_URL =
  "https://clientportal.jse.co.za/_vti_bin/JSE/SharesService.svc/GetAllInstrumentsForIssuer";
export const JSE_DATA_DISCLAIMER_URL = "https://www.jse.co.za/disclaimer";

export function jseIssuerProfileUrl(issuerMasterId: number): string {
  return `${JSE_LISTED_COMPANIES_URL}/issuer-profile?issuermasterid=${issuerMasterId}`;
}

export type JseInstrumentListingRow = {
  symbol: string;
  isin: string;
  companyName: string;
  instrumentName: string;
  instrumentType: string;
  board: string;
  listingDate: string;
  issuerMasterId: number;
  instrumentMasterId: number;
  sourceUrl: string;
  sourceApiUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type JseInstrumentListingPayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: JseInstrumentListingRow[];
};

export type JseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  isin: string | null;
  companyName: string | null;
  instrumentName: string | null;
  listingDate: string | null;
  issuerMasterId: number | null;
  instrumentMasterId: number | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1800 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function jseApiCalendarDate(value: Date): string | null {
  if (!Number.isFinite(value.getTime())) return null;
  // SharesService serializes venue-midnight values with a fixed +02:00 offset,
  // including pre-1900 dates. IANA's historical Johannesburg +01:30 offset
  // would otherwise shift those old records to the preceding civil day.
  const adjusted = new Date(value.getTime() + 2 * 60 * 60 * 1_000);
  return isoDate(adjusted.getUTCFullYear(), adjusted.getUTCMonth() + 1, adjusted.getUTCDate());
}

/** Parse the .NET JSON date as a Johannesburg calendar date, not a UTC date. */
export function parseJseListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const displayMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(normalized);
  if (displayMatch) return isoDate(Number(displayMatch[3]), Number(displayMatch[2]), Number(displayMatch[1]));
  const dotNetMatch = /^\/?Date\((-?\d+)(?:[+-]\d{4})?\)\/?$/.exec(normalized);
  return dotNetMatch ? jseApiCalendarDate(new Date(Number(dotNetMatch[1]))) : null;
}

export function normalizeJseSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{1,12}$/.test(symbol) ? symbol : "";
}

const LEGAL_ENDINGS: readonly (readonly string[])[] = [
  ["LIMITED"], ["LTD"], ["PLC"], ["N", "V"], ["NV"], ["SOC"], ["INC"], ["CORPORATION"],
];

export function normalizeJseCompanyName(value: string): string {
  let tokens = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token === "CO" ? "COMPANY" : token);
  if (tokens.length >= 2 && tokens[tokens.length - 2] === "CLASS" && /^[A-Z0-9]$/.test(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -2);
  }
  if (tokens[0] === "THE") tokens = tokens.slice(1);
  let changed = true;
  while (changed) {
    changed = false;
    for (const ending of LEGAL_ENDINGS) {
      if (tokens.length < ending.length) continue;
      const offset = tokens.length - ending.length;
      if (ending.every((token, index) => tokens[offset + index] === token)) {
        tokens = tokens.slice(0, offset);
        changed = true;
        break;
      }
    }
  }
  return tokens.join(" ");
}

function exactUrl(value: string, expected: string): boolean {
  try {
    return new URL(value).toString() === new URL(expected).toString();
  } catch {
    return false;
  }
}

function validProfileUrl(value: string, issuerMasterId: number): boolean {
  return exactUrl(value, jseIssuerProfileUrl(issuerMasterId));
}

export function parseJseInstrumentListingPayload(payload: unknown): JseInstrumentListingPayload {
  if (!payload || typeof payload !== "object") throw new Error("JSE listing payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("JSE payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("JSE payload is missing records");
  const records = input.records.flatMap((value): JseInstrumentListingRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeJseSymbol(String(row.symbol ?? ""));
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const instrumentName = String(row.instrumentName ?? "").replace(/\s+/g, " ").trim();
    const instrumentType = String(row.instrumentType ?? "").replace(/\s+/g, " ").trim();
    const board = String(row.board ?? "").replace(/\s+/g, " ").trim();
    const listingDate = parseJseListingDate(row.listingDate);
    const issuerMasterId = Number(row.issuerMasterId);
    const instrumentMasterId = Number(row.instrumentMasterId);
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceApiUrl = String(row.sourceApiUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!symbol || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !companyName || !normalizeJseCompanyName(companyName)
      || !instrumentName || !instrumentType || !board || !listingDate
      || !Number.isInteger(issuerMasterId) || issuerMasterId <= 0
      || !Number.isInteger(instrumentMasterId) || instrumentMasterId <= 0
      || !validProfileUrl(sourceUrl, issuerMasterId) || !exactUrl(sourceApiUrl, JSE_INSTRUMENTS_SERVICE_URL)
      || !/^[a-f0-9]{64}$/.test(sourceHash) || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      symbol,
      isin,
      companyName,
      instrumentName,
      instrumentType,
      board,
      listingDate,
      issuerMasterId,
      instrumentMasterId,
      sourceUrl,
      sourceApiUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("JSE payload contains no valid listing records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records: [...records].sort((a, b) => a.symbol.localeCompare(b.symbol) || a.listingDate.localeCompare(b.listingDate)),
  };
}

function emptyRecord(
  stock: Pick<StockEntry, "ticker" | "name">,
  status: JseOfficialDateRecord["status"],
): JseOfficialDateRecord {
  return {
    securityId: securityIdOf("JSE", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    status,
    isin: null,
    companyName: stock.name || null,
    instrumentName: null,
    listingDate: null,
    issuerMasterId: null,
    instrumentMasterId: null,
    sourceUrl: null,
    events: [],
    warnings: [],
  };
}

export function matchJseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: JseInstrumentListingPayload,
): JseOfficialDateRecord[] {
  const bySymbol = new Map<string, JseInstrumentListingRow[]>();
  for (const row of payload.records) {
    const rows = bySymbol.get(row.symbol) ?? [];
    if (!rows.some((item) => item.isin === row.isin && item.listingDate === row.listingDate)) rows.push(row);
    bySymbol.set(row.symbol, rows);
  }
  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "JSE")
    .map((stock): JseOfficialDateRecord => {
      const ticker = normalizeJseSymbol(stock.ticker);
      const empty = emptyRecord(stock, "unmatched");
      if (!ticker) return { ...empty, status: "invalid", warnings: ["Catalog ticker is not a supported JSE alpha code"] };
      empty.ticker = ticker;
      empty.securityId = securityIdOf("JSE", ticker);
      const rows = bySymbol.get(ticker) ?? [];
      if (rows.length === 0) {
        return { ...empty, warnings: ["Exact current JSE instrument alpha code was not found"] };
      }
      const catalogName = normalizeJseCompanyName(stock.name);
      const identityRows = rows.filter((row) => normalizeJseCompanyName(row.companyName) === catalogName);
      if (identityRows.length === 0) {
        return {
          ...empty,
          warnings: ["Exact JSE alpha code exists, but the official issuer identity differs from the catalog company"],
        };
      }
      const distinct = new Set(identityRows.map((row) => `${row.isin}\u0000${row.listingDate}`));
      if (distinct.size !== 1) {
        return {
          ...empty,
          status: "ambiguous",
          warnings: [`Exact JSE alpha code and issuer identity map to ${distinct.size} ISIN/date combinations`],
        };
      }
      const row = identityRows[0];
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: empty.securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Africa/Johannesburg",
        exchange: "Johannesburg Stock Exchange",
        venueCity: "Johannesburg",
        venueCountry: "ZA",
        evidence: {
          authority: "exchange",
          sourceName: "JSE Client Portal Listed Companies / SharesService",
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Official JSE ListingDate for exact alpha code ${row.symbol}, exact normalized issuer identity and ISIN ${row.isin}; date-only.`,
      };
      return {
        ...empty,
        status: "matched",
        isin: row.isin,
        companyName: row.companyName,
        instrumentName: row.instrumentName,
        listingDate: row.listingDate,
        issuerMasterId: row.issuerMasterId,
        instrumentMasterId: row.instrumentMasterId,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
