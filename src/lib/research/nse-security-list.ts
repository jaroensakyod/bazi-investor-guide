import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const NSE_EQUITY_LIST_URL = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
export const NSE_REIT_LIST_URL = "https://nsearchives.nseindia.com/content/equities/REITS_L.csv";
export const NSE_INVIT_LIST_URL = "https://nsearchives.nseindia.com/content/equities/INVITS_L.csv";

export type NseSecurityListRow = {
  symbol: string;
  companyName: string;
  series: string;
  listingDate: string;
  isin: string;
  sourceName: string;
  sourceUrl: string;
};

export type NseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  companyName: string | null;
  series: string | null;
  isin: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function parseNseOfficialDateSupplements(payload: unknown): NseSecurityListRow[] {
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { records?: unknown }).records)) {
    throw new Error("NSE official-date supplement payload is missing records");
  }
  return (payload as { records: unknown[] }).records.flatMap((value): NseSecurityListRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const series = String(row.series ?? "").trim().toUpperCase();
    const listingDate = String(row.listingDate ?? "").trim();
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const sourceName = String(row.sourceName ?? "").replace(/\s+/g, " ").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    let officialUrl = false;
    try {
      const url = new URL(sourceUrl);
      officialUrl = url.protocol === "https:" && ["nsearchives.nseindia.com", "www.nseindia.com"].includes(url.hostname);
    } catch {
      officialUrl = false;
    }
    if (!/^[A-Z0-9-]{2,30}$/.test(symbol) || !companyName || !series
      || !/^\d{4}-\d{2}-\d{2}$/.test(listingDate) || !/^[A-Z]{2}[A-Z0-9]{10}$/.test(isin)
      || !sourceName || !officialUrl) return [];
    const date = new Date(`${listingDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== listingDate) return [];
    return [{ symbol, companyName, series, listingDate, isin, sourceName, sourceUrl }];
  });
}

function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows;
}

const MONTHS: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
};

export function parseNseListingDate(value: string): string | null {
  const match = /^(\d{1,2})-([A-Z]{3})-(\d{2}|\d{4})$/i.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = MONTHS[match[2].toUpperCase()];
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  if (!month) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function normalizeNseCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.(NS|RR|IV)$/i, "").replace(/_/g, "-");
}

export function parseNseSecurityList(csv: string, sourceName: string, sourceUrl: string): NseSecurityListRow[] {
  const rows = csvRows(csv);
  const headers = rows.shift()?.map((value) => value.trim().toUpperCase()) ?? [];
  const index = (name: string) => headers.indexOf(name);
  const symbolIndex = index("SYMBOL");
  const nameIndex = index("NAME OF COMPANY");
  const seriesIndex = index("SERIES");
  const listingIndex = index("DATE OF LISTING");
  const isinIndex = index("ISIN NUMBER");
  if ([symbolIndex, nameIndex, seriesIndex, listingIndex, isinIndex].some((value) => value < 0)) {
    throw new Error(`NSE CSV headers are unsupported: ${headers.join(",")}`);
  }
  return rows.flatMap((row) => {
    const symbol = String(row[symbolIndex] ?? "").trim().toUpperCase();
    const listingDate = parseNseListingDate(String(row[listingIndex] ?? ""));
    if (!symbol || !listingDate) return [];
    return [{
      symbol,
      companyName: String(row[nameIndex] ?? "").trim(),
      series: String(row[seriesIndex] ?? "").trim().toUpperCase(),
      listingDate,
      isin: String(row[isinIndex] ?? "").trim().toUpperCase(),
      sourceName,
      sourceUrl,
    }];
  });
}

export function matchNseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly NseSecurityListRow[],
  retrievedAt: string,
): NseOfficialDateRecord[] {
  const bySymbol = new Map<string, NseSecurityListRow[]>();
  for (const row of rows) {
    const key = normalizeNseCatalogTicker(row.symbol);
    const current = bySymbol.get(key) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.isin === row.isin)) current.push(row);
    bySymbol.set(key, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "NSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeNseCatalogTicker(ticker);
      const securityId = securityIdOf("NSE", ticker);
      const matches = bySymbol.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceSymbol: null,
          companyName: stock.name || null,
          series: null,
          isin: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0 ? "ไม่พบ symbol ใน NSE official lists" : `พบ ${matches.length} official rows ที่ขัดกัน`],
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
        timeZone: "Asia/Kolkata",
        exchange: "NSE",
        venueCity: "Mumbai",
        venueCountry: "IN",
        evidence: {
          authority: "exchange",
          sourceName: row.sourceName,
          sourceUrl: row.sourceUrl,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `NSE official DATE OF LISTING; series ${row.series || "unknown"}, ISIN ${row.isin || "unknown"}; exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceSymbol: row.symbol,
        companyName: row.companyName || stock.name || null,
        series: row.series || null,
        isin: row.isin || null,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
