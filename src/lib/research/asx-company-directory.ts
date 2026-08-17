import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const ASX_COMPANY_DIRECTORY_PAGE_URL = "https://www.asx.com.au/markets/trade-our-cash-market/directory.html";
export const ASX_COMPANY_DIRECTORY_CSV_URL = "https://asx.api.markitdigital.com/asx-research/1.0/companies/directory/file?access_token=83ff96335c2d45a094df02a206a39ff4";

export type AsxCompanyDirectoryRow = {
  code: string;
  companyName: string;
  industryGroup: string;
  listingDate: string;
};

export type AsxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceCode: string | null;
  companyName: string | null;
  industryGroup: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

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

export function parseAsxListingDate(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${match[3]}-${match[2]}-${match[1]}`
    : null;
}

export function normalizeAsxCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.AX$/i, "");
}

export function parseAsxCompanyDirectory(csv: string): AsxCompanyDirectoryRow[] {
  const rows = csvRows(csv);
  const headers = rows.shift()?.map((value) => value.replace(/^\uFEFF/, "").trim().toUpperCase()) ?? [];
  const index = (name: string): number => headers.indexOf(name);
  const codeIndex = index("ASX CODE");
  const nameIndex = index("COMPANY NAME");
  const industryIndex = index("GICS INDUSTRY GROUP");
  const listingIndex = index("LISTING DATE");
  if ([codeIndex, nameIndex, industryIndex, listingIndex].some((value) => value < 0)) {
    throw new Error(`ASX Company Directory CSV headers are unsupported: ${headers.join(",")}`);
  }
  return rows.flatMap((row) => {
    const code = normalizeAsxCatalogTicker(String(row[codeIndex] ?? ""));
    const listingDate = parseAsxListingDate(String(row[listingIndex] ?? ""));
    if (!/^[A-Z0-9]{3}$/.test(code) || !listingDate) return [];
    return [{
      code,
      companyName: String(row[nameIndex] ?? "").trim(),
      industryGroup: String(row[industryIndex] ?? "").trim(),
      listingDate,
    }];
  });
}

export function matchAsxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly AsxCompanyDirectoryRow[],
  retrievedAt: string,
): AsxOfficialDateRecord[] {
  const byCode = new Map<string, AsxCompanyDirectoryRow[]>();
  for (const row of rows) {
    const current = byCode.get(row.code) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.companyName === row.companyName)) current.push(row);
    byCode.set(row.code, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "ASX")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeAsxCatalogTicker(ticker);
      const securityId = securityIdOf("ASX", ticker);
      const matches = byCode.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceCode: null,
          companyName: stock.name || null,
          industryGroup: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0 ? "Code not found in the ASX Company Directory CSV" : `Found ${matches.length} conflicting ASX rows`],
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
        timeZone: "Australia/Sydney",
        exchange: "ASX",
        venueCity: "Sydney",
        venueCountry: "AU",
        evidence: {
          authority: "licensed_market_data",
          sourceName: "ASX Company Directory (data supplied by LSEG/Morningstar)",
          sourceUrl: ASX_COMPANY_DIRECTORY_PAGE_URL,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `ASX-hosted Company Directory Listing date${row.industryGroup ? `; industry ${row.industryGroup}` : ""}; exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceCode: row.code,
        companyName: row.companyName || stock.name || null,
        industryGroup: row.industryGroup || null,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
