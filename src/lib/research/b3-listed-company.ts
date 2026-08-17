import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const B3_LISTED_COMPANIES_PAGE_URL =
  "https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=en-us";
export const B3_LISTED_COMPANIES_API_BASE =
  "https://sistemaswebb3-listados.b3.com.br/listedCompaniesProxy/CompanyCall";

export type B3CompanyDateRow = {
  issuingCompany: string;
  codeCvm: string;
  companyName: string;
  tradingName: string;
  listingDate: string;
  quotationDate: string | null;
  codes: string[];
  market: string;
  sourceUrl: string;
  sourceHash: string | null;
  retrievedAt: string;
};

export type B3CompanyDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: B3CompanyDateRow[];
};

export type B3OfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  issuingCompany: string | null;
  codeCvm: string | null;
  companyName: string | null;
  listingDate: string | null;
  quotationDate: string | null;
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

export function parseB3ListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalized);
  return match ? isoDate(Number(match[3]), Number(match[2]), Number(match[1])) : null;
}

export function parseB3QuotationDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  return match ? isoDate(Number(match[3]), Number(match[1]), Number(match[2])) : null;
}

export function normalizeB3CatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.SA$/i, "");
}

export function b3IssuerCodeFromTicker(ticker: string): string {
  const normalized = normalizeB3CatalogTicker(ticker);
  return /^[A-Z0-9]{4}[A-Z0-9]{1,4}$/.test(normalized) ? normalized.slice(0, 4) : "";
}

export function b3CompanyDetailUrl(codeCvm: string, issuingCompany: string): string {
  if (!/^\d{3,9}$/.test(codeCvm) || !/^[A-Z0-9]{4}$/.test(issuingCompany)) {
    throw new Error("Invalid B3 company identity");
  }
  return `https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/main/${codeCvm}/${issuingCompany}/overview?language=en-us`;
}

function isB3CompanyDetailUrl(value: string, codeCvm: string, issuingCompany: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "sistemaswebb3-listados.b3.com.br"
      && url.pathname === `/listedCompaniesPage/main/${codeCvm}/${issuingCompany}/overview`
      && url.searchParams.get("language") === "en-us";
  } catch {
    return false;
  }
}

function normalizeB3Code(value: unknown): string {
  const code = String(value ?? "").trim().toUpperCase();
  return /^[A-Z0-9]{4,12}$/.test(code) ? code : "";
}

export function parseB3CompanyDatePayload(payload: unknown): B3CompanyDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("B3 company-date payload must be an object");
  const input = payload as { retrievedAt?: unknown; updatedAt?: unknown; sourceRowCount?: unknown; records?: unknown };
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) {
    throw new Error("B3 company-date payload has an invalid retrievedAt");
  }
  if (!Array.isArray(input.records)) throw new Error("B3 company-date payload is missing records");
  const records = input.records.flatMap((value): B3CompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row.status !== undefined && row.status !== "matched") return [];
    const issuingCompany = String(row.issuingCompany ?? "").trim().toUpperCase();
    const codeCvm = String(row.codeCvm ?? row.codeCVM ?? "").trim();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const tradingName = String(row.tradingName ?? "").replace(/\s+/g, " ").trim();
    const listingDate = parseB3ListingDate(row.listingDate);
    const quotationDate = row.quotationDate == null ? null : parseB3ListingDate(row.quotationDate);
    const codes = Array.isArray(row.codes)
      ? [...new Set(row.codes.map(normalizeB3Code).filter(Boolean))].sort()
      : [];
    const market = String(row.market ?? "").replace(/\s+/g, " ").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase() || null;
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!/^[A-Z0-9]{4}$/.test(issuingCompany) || !/^\d{3,9}$/.test(codeCvm)
      || !companyName || !listingDate || codes.length === 0
      || !isB3CompanyDetailUrl(sourceUrl, codeCvm, issuingCompany)
      || (sourceHash !== null && !/^[a-f0-9]{64}$/.test(sourceHash))
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      issuingCompany,
      codeCvm,
      companyName,
      tradingName,
      listingDate,
      quotationDate,
      codes,
      market,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("B3 company-date payload contains no valid matched records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records,
  };
}

export function matchB3OfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: B3CompanyDatePayload,
): B3OfficialDateRecord[] {
  const byIssuer = new Map<string, B3CompanyDateRow[]>();
  for (const row of payload.records) {
    const current = byIssuer.get(row.issuingCompany) ?? [];
    if (!current.some((item) => item.codeCvm === row.codeCvm && item.listingDate === row.listingDate)) current.push(row);
    byIssuer.set(row.issuingCompany, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "BOVESPA")
    .map((stock) => {
      const ticker = normalizeB3CatalogTicker(stock.ticker);
      const securityId = securityIdOf("BOVESPA", ticker);
      if (ticker.endsWith("F")) {
        return {
          securityId,
          ticker,
          status: "invalid" as const,
          issuingCompany: b3IssuerCodeFromTicker(ticker),
          codeCvm: null,
          companyName: stock.name || null,
          listingDate: null,
          quotationDate: null,
          sourceUrl: null,
          events: [],
          warnings: ["B3 odd-lot code ending in F is a trading-segment alias, not a separate security birth"],
        };
      }
      const issuingCompany = b3IssuerCodeFromTicker(ticker);
      if (!issuingCompany) {
        return {
          securityId,
          ticker,
          status: "invalid" as const,
          issuingCompany: null,
          codeCvm: null,
          companyName: stock.name || null,
          listingDate: null,
          quotationDate: null,
          sourceUrl: null,
          events: [],
          warnings: ["Catalog ticker does not follow a supported B3 security-code shape"],
        };
      }
      const matches = (byIssuer.get(issuingCompany) ?? []).filter((row) => row.codes.includes(ticker));
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          issuingCompany,
          codeCvm: null,
          companyName: stock.name || null,
          listingDate: null,
          quotationDate: null,
          sourceUrl: null,
          events: [],
          warnings: [matches.length === 0
            ? "Exact security code was not confirmed in the B3 Listed Companies detail snapshot"
            : `Found ${matches.length} conflicting B3 issuer rows for exact code ${ticker}`],
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
        timeZone: "America/Sao_Paulo",
        exchange: "B3",
        venueCity: "Sao Paulo",
        venueCountry: "BR",
        evidence: {
          authority: "exchange",
          sourceName: "B3 Listed Companies",
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `B3 issuer-level dateListing; exact catalog code ${ticker} is confirmed in GetDetail. This is not claimed as the share-class first-trading day or time.`,
      };
      return {
        securityId,
        ticker,
        status: "matched" as const,
        issuingCompany: row.issuingCompany,
        codeCvm: row.codeCvm,
        companyName: row.companyName,
        listingDate: row.listingDate,
        quotationDate: row.quotationDate,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
