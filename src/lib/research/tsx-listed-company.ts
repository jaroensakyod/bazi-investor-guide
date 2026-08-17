import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const TSX_LISTED_COMPANY_DIRECTORY_URL =
  "https://www.tsx.com/en/listings/listing-with-us/listed-company-directory";
export const TSX_CURRENT_LISTED_COMPANIES_XLSX_URL = "https://www.tsx.com/en/resource/571";

export function tsxCompanyDirectorySearchUrl(query: string): string {
  if (!/^(?:[A-Z]|0-9)$/i.test(query)) throw new Error("Invalid TSX directory search query");
  return `https://www.tsx.com/json/company-directory/search/tsx/${encodeURIComponent(query.toUpperCase())}`;
}

export type TsxListedCompanyRow = {
  issuerId: string;
  rootTicker: string;
  issuerName: string;
  listingType: string | null;
  listingDate: string;
  rootInstrumentConfirmed: boolean;
  currentDirectoryIssuerName: string | null;
  currentInstrumentName: string | null;
  xlsxSourceUrl: string;
  xlsxSourceHash: string;
  directorySourceUrl: string;
  directorySnapshotHash: string;
  retrievedAt: string;
};

export type TsxListedCompanyPayload = {
  retrievedAt: string;
  sourceRowCount: number;
  directoryIssuerCount: number;
  records: TsxListedCompanyRow[];
};

export type TsxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  rootTicker: string | null;
  issuerId: string | null;
  issuerName: string | null;
  listingDate: string | null;
  listingType: string | null;
  rootInstrumentConfirmed: boolean;
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

export function parseTsxListingDate(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  const compact = /^(\d{4})(\d{2})(\d{2})$/.exec(normalized);
  if (compact) return isoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  return iso ? isoDate(Number(iso[1]), Number(iso[2]), Number(iso[3])) : null;
}

export function normalizeTsxCatalogTicker(value: string): string {
  const ticker = value.trim().toUpperCase().replace(/\.TO$/i, "");
  return /^[A-Z0-9][A-Z0-9.-]{0,24}$/.test(ticker) ? ticker : "";
}

const TSX_LEGAL_NAME_TOKENS = new Set([
  "INC",
  "INCORPORATED",
  "CORPORATION",
  "CORP",
  "LIMITED",
  "LTD",
  "COMPANY",
  "CO",
  "LP",
  "LLP",
  "PLC",
  "THE",
]);

const TSX_WEAK_IDENTITY_TOKENS = new Set([
  "BANK",
  "CANADA",
  "CANADIAN",
  "ENERGY",
  "FUND",
  "GOLD",
  "GROUP",
  "HOLDINGS",
  "INTERNATIONAL",
  "MINING",
  "POWER",
  "REAL",
  "ESTATE",
  "RESOURCES",
  "SILVER",
  "TRUST",
]);

export function tsxCompanyNameTokens(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !TSX_LEGAL_NAME_TOKENS.has(token));
}

const TSX_VERIFIED_ISSUER_NAME_ALIASES: Readonly<Record<string, { catalog: string; official: string }>> = {
  BNS: { catalog: "SCOTIABANK", official: "BANK OF NOVA SCOTIA" },
  DOO: { catalog: "BOMBARDIER RECREATIONAL PRODUCTS", official: "BRP" },
  EQB: { catalog: "EQUITABLE BANK", official: "EQB" },
};

function hasVerifiedTsxIssuerNameAlias(ticker: string, catalogName: string, officialName: string): boolean {
  const alias = TSX_VERIFIED_ISSUER_NAME_ALIASES[ticker];
  if (!alias) return false;
  return tsxCompanyNameTokens(catalogName).join(" ") === alias.catalog
    && tsxCompanyNameTokens(officialName).join(" ") === alias.official;
}

export function hasTsxIssuerIdentityOverlap(catalogName: string, ...officialNames: Array<string | null>): boolean {
  const catalogTokens = new Set(tsxCompanyNameTokens(catalogName));
  if (catalogTokens.size === 0) return false;
  return officialNames.some((name) => name !== null
    && tsxCompanyNameTokens(name).some((token) =>
      catalogTokens.has(token) && !TSX_WEAK_IDENTITY_TOKENS.has(token),
    ));
}

function exactUrl(value: string, expected: string): boolean {
  try {
    return new URL(value).toString() === new URL(expected).toString();
  } catch {
    return false;
  }
}

export function parseTsxListedCompanyPayload(payload: unknown): TsxListedCompanyPayload {
  if (!payload || typeof payload !== "object") throw new Error("TSX listed-company payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("TSX payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("TSX payload is missing records");

  const records = input.records.flatMap((value): TsxListedCompanyRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const issuerId = String(row.issuerId ?? "").trim().toUpperCase();
    const rootTicker = normalizeTsxCatalogTicker(String(row.rootTicker ?? ""));
    const issuerName = String(row.issuerName ?? "").replace(/\s+/g, " ").trim();
    const listingType = String(row.listingType ?? "").replace(/\s+/g, " ").trim() || null;
    const listingDate = parseTsxListingDate(row.listingDate);
    const rootInstrumentConfirmed = row.rootInstrumentConfirmed === true;
    const currentDirectoryIssuerName = String(row.currentDirectoryIssuerName ?? "").replace(/\s+/g, " ").trim() || null;
    const currentInstrumentName = String(row.currentInstrumentName ?? "").replace(/\s+/g, " ").trim() || null;
    const xlsxSourceUrl = String(row.xlsxSourceUrl ?? "").trim();
    const xlsxSourceHash = String(row.xlsxSourceHash ?? "").trim().toLowerCase();
    const directorySourceUrl = String(row.directorySourceUrl ?? "").trim();
    const directorySnapshotHash = String(row.directorySnapshotHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!/^[A-Z0-9-]{2,24}$/.test(issuerId) || !rootTicker || !issuerName || !listingDate
      || !exactUrl(xlsxSourceUrl, TSX_CURRENT_LISTED_COMPANIES_XLSX_URL)
      || !exactUrl(directorySourceUrl, TSX_LISTED_COMPANY_DIRECTORY_URL)
      || !/^[a-f0-9]{64}$/.test(xlsxSourceHash) || !/^[a-f0-9]{64}$/.test(directorySnapshotHash)
      || !Number.isFinite(Date.parse(rowRetrievedAt))
      || (rootInstrumentConfirmed && (!currentDirectoryIssuerName || !currentInstrumentName))) {
      return [];
    }
    return [{
      issuerId,
      rootTicker,
      issuerName,
      listingType,
      listingDate,
      rootInstrumentConfirmed,
      currentDirectoryIssuerName,
      currentInstrumentName,
      xlsxSourceUrl,
      xlsxSourceHash,
      directorySourceUrl,
      directorySnapshotHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("TSX payload contains no valid listed-company records");
  const sourceRowCount = Number(input.sourceRowCount);
  const directoryIssuerCount = Number(input.directoryIssuerCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    directoryIssuerCount: Number.isInteger(directoryIssuerCount) && directoryIssuerCount >= 0
      ? directoryIssuerCount
      : 0,
    records: [...records].sort((a, b) => a.rootTicker.localeCompare(b.rootTicker)),
  };
}

function emptyRecord(stock: Pick<StockEntry, "ticker" | "name">): TsxOfficialDateRecord {
  return {
    securityId: securityIdOf("TSX", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    status: "unmatched",
    rootTicker: null,
    issuerId: null,
    issuerName: stock.name || null,
    listingDate: null,
    listingType: null,
    rootInstrumentConfirmed: false,
    sourceUrl: null,
    events: [],
    warnings: [],
  };
}

export function matchTsxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: TsxListedCompanyPayload,
): TsxOfficialDateRecord[] {
  const byRootTicker = new Map<string, TsxListedCompanyRow[]>();
  for (const row of payload.records) {
    const rows = byRootTicker.get(row.rootTicker) ?? [];
    if (!rows.some((item) => item.issuerId === row.issuerId && item.listingDate === row.listingDate)) rows.push(row);
    byRootTicker.set(row.rootTicker, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "TSX")
    .map((stock): TsxOfficialDateRecord => {
      const ticker = normalizeTsxCatalogTicker(stock.ticker);
      const empty = emptyRecord(stock);
      if (!ticker) {
        return { ...empty, status: "invalid", warnings: ["Catalog ticker does not follow a supported TSX symbol shape"] };
      }
      empty.rootTicker = ticker;
      const rows = byRootTicker.get(ticker) ?? [];
      if (rows.length === 0) {
        return {
          ...empty,
          warnings: ["Exact catalog ticker was not present as a TSX issuer root in the current official listed-company workbook"],
        };
      }
      if (rows.length !== 1) {
        return {
          ...empty,
          status: "ambiguous",
          warnings: [`TSX workbook contains ${rows.length} issuer rows for exact root ticker ${ticker}`],
        };
      }
      const row = rows[0];
      if (!row.rootInstrumentConfirmed) {
        return {
          ...empty,
          issuerId: row.issuerId,
          issuerName: row.issuerName,
          listingType: row.listingType,
          rootInstrumentConfirmed: false,
          sourceUrl: row.xlsxSourceUrl,
          warnings: ["The TSX issuer root is not itself a current tradable instrument; its issuer-level date is not borrowed by a class or preferred-share ticker"],
        };
      }
      const identityConfirmed = hasTsxIssuerIdentityOverlap(stock.name, row.issuerName, row.currentDirectoryIssuerName)
        || hasVerifiedTsxIssuerNameAlias(ticker, stock.name, row.issuerName)
        || (row.currentDirectoryIssuerName !== null
          && hasVerifiedTsxIssuerNameAlias(ticker, stock.name, row.currentDirectoryIssuerName));
      if (!identityConfirmed) {
        return {
          ...empty,
          issuerId: row.issuerId,
          issuerName: row.issuerName,
          listingType: row.listingType,
          rootInstrumentConfirmed: true,
          sourceUrl: row.xlsxSourceUrl,
          warnings: ["Exact TSX ticker is current, but the catalog and official issuer names share no identity token; possible catalog venue error or ticker reuse"],
        };
      }

      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: empty.securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "America/Toronto",
        exchange: "Toronto Stock Exchange",
        venueCity: "Toronto",
        venueCountry: "CA",
        evidence: {
          authority: "exchange",
          sourceName: "TSX & TSXV Listed Companies / Listed Company Directory",
          sourceUrl: row.xlsxSourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Official TSX issuer-level Listing Date; exact issuer root ${ticker} is also confirmed as a current tradable instrument in the official directory. This is not claimed as a share-class first-trading time.`,
      };
      return {
        ...empty,
        status: "matched",
        issuerId: row.issuerId,
        issuerName: row.issuerName,
        listingDate: row.listingDate,
        listingType: row.listingType,
        rootInstrumentConfirmed: true,
        sourceUrl: row.xlsxSourceUrl,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
