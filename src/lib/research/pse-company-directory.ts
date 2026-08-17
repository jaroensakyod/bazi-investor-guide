import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const PSE_COMPANY_DIRECTORY_PAGE_URL = "https://edge.pse.com.ph/companyDirectory/form.do";
export const PSE_COMPANY_DIRECTORY_SEARCH_URL = "https://edge.pse.com.ph/companyDirectory/search.ax";
export const PSE_STOCK_DATA_PAGE_URL = "https://edge.pse.com.ph/companyPage/stockData.do";

export type PseCompanyDirectoryRow = {
  companyId: string;
  securityId: string;
  companyName: string;
  symbol: string;
  sector: string;
  subsector: string;
  listingDate: string | null;
  sourceUrl?: string | null;
};

export type PseStockDataSecurityOption = {
  companyId: string;
  securityId: string;
  symbol: string;
};

export type PseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  sourceCompanyId: string | null;
  sourceSecurityId: string | null;
  companyName: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

const MONTHS = new Map([
  ["JAN", "01"], ["FEB", "02"], ["MAR", "03"], ["APR", "04"],
  ["MAY", "05"], ["JUN", "06"], ["JUL", "07"], ["AUG", "08"],
  ["SEP", "09"], ["OCT", "10"], ["NOV", "11"], ["DEC", "12"],
]);

function decodeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function pseCompanyDirectorySearchUrl(pageNo: number): string {
  const page = Math.max(1, Math.trunc(pageNo));
  const query = new URLSearchParams({
    pageNo: String(page),
    sortType: "symbol",
    symbolSortType: "ASC",
  });
  return `${PSE_COMPANY_DIRECTORY_SEARCH_URL}?${query.toString()}`;
}

export function pseStockDataUrl(companyId: string, securityId: string): string {
  if (!/^\d+$/.test(companyId) || !/^\d+$/.test(securityId)) {
    throw new Error("PSE EDGE stock-data identifiers must be numeric");
  }
  const query = new URLSearchParams({ cmpy_id: companyId, security_id: securityId });
  return `${PSE_STOCK_DATA_PAGE_URL}?${query.toString()}`;
}

export function parsePseDirectoryPageCount(html: string): number {
  const match = /\[\s*\d+\s*\/\s*(\d+)\s*\]/.exec(html);
  const count = Number(match?.[1]);
  if (!Number.isInteger(count) || count < 1 || count > 1_000) {
    throw new Error("PSE EDGE Company List is missing a valid page count");
  }
  return count;
}

export function parsePseListingDate(value: string): string | null {
  const match = /^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const month = MONTHS.get(match[1].toUpperCase());
  if (!month) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, Number(month) - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${match[3]}-${month}-${String(day).padStart(2, "0")}`;
}

export function normalizePseCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.PS$/i, "");
}

function isOfficialPseSourceUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "edge.pse.com.ph"
      && (url.pathname === "/companyPage/stockData.do" || url.pathname === "/companyDirectory/form.do");
  } catch {
    return false;
  }
}

export function parsePseStockDataSecurityOptions(
  html: string,
  expectedCompanyId: string,
): PseStockDataSecurityOption[] {
  if (!/^\d+$/.test(expectedCompanyId)) throw new Error("PSE EDGE company identifier must be numeric");
  const companyInput = /<input\b[^>]*name=["']cmpy_id["'][^>]*value=["'](\d+)["'][^>]*>/i.exec(html)
    ?? /<input\b[^>]*value=["'](\d+)["'][^>]*name=["']cmpy_id["'][^>]*>/i.exec(html);
  if (companyInput?.[1] !== expectedCompanyId) {
    throw new Error(`PSE EDGE stock-data page does not belong to company ${expectedCompanyId}`);
  }

  const select = /<select\b[^>]*name=["']security_id["'][^>]*>([\s\S]*?)<\/select>/i.exec(html)?.[1] ?? "";
  const options = [...select.matchAll(/<option\b[^>]*value=["'](\d+)["'][^>]*>([\s\S]*?)<\/option>/gi)]
    .flatMap((match): PseStockDataSecurityOption[] => {
      const symbol = normalizePseCatalogTicker(decodeHtml(match[2]));
      return /^[A-Z0-9.-]{1,20}$/.test(symbol)
        ? [{ companyId: expectedCompanyId, securityId: match[1], symbol }]
        : [];
    });
  if (options.length === 0) throw new Error("PSE EDGE stock-data page contains no security options");
  return options;
}

export function parsePseStockDataPage(
  html: string,
  expectedCompanyId: string,
  expectedSecurityId: string,
): PseCompanyDirectoryRow {
  const options = parsePseStockDataSecurityOptions(html, expectedCompanyId);
  const option = options.find((item) => item.securityId === expectedSecurityId);
  if (!option) throw new Error(`PSE EDGE stock-data page does not contain security ${expectedSecurityId}`);

  const selectedOption = new RegExp(
    `<option\\b(?=[^>]*\\bvalue=["']${expectedSecurityId}["'])(?=[^>]*\\bselected(?:\\s|>|=))[^>]*>`,
    "i",
  );
  const requestedInScript = new RegExp(`sendData\\.security_id\\s*=\\s*["']${expectedSecurityId}["']`, "i");
  if (!selectedOption.test(html) && !requestedInScript.test(html)) {
    throw new Error(`PSE EDGE stock-data response did not select security ${expectedSecurityId}`);
  }

  const companyName = decodeHtml(
    /<div\b[^>]*class=["'][^"']*compInfo[^"']*["'][^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] ?? "",
  );
  const listingDateText = decodeHtml(
    /<th\b[^>]*>\s*Listing Date\s*<\/th>\s*<td\b[^>]*>([\s\S]*?)<\/td>/i.exec(html)?.[1] ?? "",
  );
  const listingDate = parsePseListingDate(listingDateText);
  if (!companyName || !listingDate) throw new Error("PSE EDGE stock-data page is missing company name or Listing Date");

  return {
    companyId: expectedCompanyId,
    securityId: expectedSecurityId,
    companyName,
    symbol: option.symbol,
    sector: "",
    subsector: "",
    listingDate,
    sourceUrl: pseStockDataUrl(expectedCompanyId, expectedSecurityId),
  };
}

function parsePseIsoListingDate(value: unknown): string | null {
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

export function parsePseCompanyDirectory(payload: unknown): PseCompanyDirectoryRow[] {
  if (payload && typeof payload === "object" && Array.isArray((payload as { records?: unknown }).records)) {
    const records = (payload as { records: unknown[] }).records.flatMap((value): PseCompanyDirectoryRow[] => {
      if (!value || typeof value !== "object") return [];
      const row = value as Record<string, unknown>;
      const companyId = String(row.companyId ?? "").trim();
      const securityId = String(row.securityId ?? "").trim();
      const symbol = normalizePseCatalogTicker(String(row.symbol ?? ""));
      const listingDate = parsePseIsoListingDate(row.listingDate);
      const sourceUrlValue = String(row.sourceUrl ?? "").trim();
      if (!/^\d+$/.test(companyId) || !/^\d+$/.test(securityId) || !/^[A-Z0-9.-]{1,20}$/.test(symbol) || !listingDate
        || (sourceUrlValue && !isOfficialPseSourceUrl(sourceUrlValue))) {
        return [];
      }
      return [{
        companyId,
        securityId,
        companyName: String(row.companyName ?? "").trim(),
        symbol,
        sector: String(row.sector ?? "").trim(),
        subsector: String(row.subsector ?? "").trim(),
        listingDate,
        sourceUrl: sourceUrlValue || null,
      }];
    });
    if (records.length === 0) throw new Error("PSE EDGE normalized payload contains no valid security rows");
    return records;
  }

  const pages = typeof payload === "string"
    ? [payload]
    : payload && typeof payload === "object" && Array.isArray((payload as { pages?: unknown }).pages)
      ? (payload as { pages: unknown[] }).pages.filter((page): page is string => typeof page === "string")
      : [];
  if (pages.length === 0) throw new Error("PSE EDGE Company List payload contains no HTML pages");

  const output: PseCompanyDirectoryRow[] = [];
  for (const html of pages) {
    for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = rowMatch[1];
      const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => decodeHtml(match[1]));
      if (cells.length !== 5) continue;
      const detail = /cmDetail\(\s*['"](\d+)['"]\s*,\s*['"](\d+)['"]\s*\)/i.exec(rowHtml);
      const symbol = normalizePseCatalogTicker(cells[1]);
      if (!detail || !/^[A-Z0-9.-]{1,20}$/.test(symbol)) continue;
      output.push({
        companyId: detail[1],
        securityId: detail[2],
        companyName: cells[0],
        symbol,
        sector: cells[2],
        subsector: cells[3],
        listingDate: parsePseListingDate(cells[4]),
        sourceUrl: PSE_COMPANY_DIRECTORY_PAGE_URL,
      });
    }
  }
  if (output.length === 0) throw new Error("PSE EDGE Company List contains no valid security rows");
  return output;
}

export function matchPseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly PseCompanyDirectoryRow[],
  retrievedAt: string,
): PseOfficialDateRecord[] {
  const bySymbol = new Map<string, PseCompanyDirectoryRow[]>();
  for (const row of rows) {
    const current = bySymbol.get(row.symbol) ?? [];
    if (!current.some((item) => item.companyId === row.companyId && item.securityId === row.securityId && item.listingDate === row.listingDate)) {
      current.push(row);
    }
    bySymbol.set(row.symbol, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "PSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizePseCatalogTicker(ticker);
      const canonicalSecurityId = securityIdOf("PSE", ticker);
      const matches = bySymbol.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId: canonicalSecurityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceSymbol: null,
          sourceCompanyId: null,
          sourceSecurityId: null,
          companyName: stock.name || null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0
            ? "Ticker not found in the PSE EDGE Company List"
            : `Found ${matches.length} conflicting PSE EDGE rows`],
        };
      }

      const row = matches[0];
      if (!row.listingDate) {
        return {
          securityId: canonicalSecurityId,
          ticker,
          normalizedTicker,
          status: "invalid" as const,
          sourceSymbol: row.symbol,
          sourceCompanyId: row.companyId,
          sourceSecurityId: row.securityId,
          companyName: row.companyName || stock.name || null,
          listingDate: null,
          events: [],
          warnings: ["PSE EDGE listing date is invalid or missing"],
        };
      }

      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: canonicalSecurityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Manila",
        exchange: "PSE",
        venueCity: "Taguig",
        venueCountry: "PH",
        evidence: {
          authority: "exchange",
          sourceName: row.sourceUrl?.includes("/companyPage/stockData.do")
            ? "PSE EDGE Stock Data"
            : "PSE EDGE Company List",
          sourceUrl: row.sourceUrl ?? PSE_COMPANY_DIRECTORY_PAGE_URL,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `PSE EDGE official security-level Listing Date${row.sector ? `; sector ${row.sector}` : ""}; exact first-trade time is not stated.`,
      };
      return {
        securityId: canonicalSecurityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceSymbol: row.symbol,
        sourceCompanyId: row.companyId,
        sourceSecurityId: row.securityId,
        companyName: row.companyName || stock.name || null,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
