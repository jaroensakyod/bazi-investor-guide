import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const KRX_KIND_COMPANY_LIST_PAGE_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage";
export const KRX_KIND_COMPANY_LIST_URL = "https://kind.krx.co.kr/corpgeneral/corpList.do?method=download&searchType=13";

export type KrxKindCompanyRow = {
  ticker: string;
  companyName: string;
  marketName: string;
  industry: string;
  products: string;
  listingDate: string | null;
  fiscalMonth: string;
  representative: string;
  website: string;
  region: string;
};

export type KrxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceTicker: string | null;
  companyName: string | null;
  marketName: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

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

function tableRows(html: string): Array<Array<{ kind: "th" | "td"; text: string }>> {
  const rows: Array<Array<{ kind: "th" | "td"; text: string }>> = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: Array<{ kind: "th" | "td"; text: string }> = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      cells.push({ kind: cellMatch[1].toLowerCase() as "th" | "td", text: decodeHtml(cellMatch[2]) });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

export function parseKrxKindListingDate(value: string): string | null {
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

export function normalizeKrxCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.(?:KS|KQ)$/i, "");
}

export function parseKrxKindCompanyList(html: string): KrxKindCompanyRow[] {
  const rows = tableRows(html);
  const headerIndex = rows.findIndex((row) => {
    const labels = row.filter((cell) => cell.kind === "th").map((cell) => cell.text);
    return labels.includes("회사명") && labels.includes("종목코드") && labels.includes("상장일");
  });
  if (headerIndex < 0) throw new Error("KRX KIND company list is missing the expected header row");
  const headers = rows[headerIndex].map((cell) => cell.text);
  const indexOf = (label: string): number => {
    const index = headers.indexOf(label);
    if (index < 0) throw new Error(`KRX KIND company list is missing column ${label}`);
    return index;
  };
  const columns = {
    companyName: indexOf("회사명"),
    marketName: indexOf("시장구분"),
    ticker: indexOf("종목코드"),
    industry: indexOf("업종"),
    products: indexOf("주요제품"),
    listingDate: indexOf("상장일"),
    fiscalMonth: indexOf("결산월"),
    representative: indexOf("대표자명"),
    website: indexOf("홈페이지"),
    region: indexOf("지역"),
  };

  const output: KrxKindCompanyRow[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const values = row.map((cell) => cell.text);
    const ticker = normalizeKrxCatalogTicker(values[columns.ticker] ?? "");
    if (!/^[0-9A-Z]{6}$/.test(ticker)) continue;
    output.push({
      ticker,
      companyName: values[columns.companyName] ?? "",
      marketName: values[columns.marketName] ?? "",
      industry: values[columns.industry] ?? "",
      products: values[columns.products] ?? "",
      listingDate: parseKrxKindListingDate(values[columns.listingDate] ?? ""),
      fiscalMonth: values[columns.fiscalMonth] ?? "",
      representative: values[columns.representative] ?? "",
      website: values[columns.website] ?? "",
      region: values[columns.region] ?? "",
    });
  }
  if (output.length === 0) throw new Error("KRX KIND company list contains no valid security rows");
  return output;
}

export function matchKrxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly KrxKindCompanyRow[],
  retrievedAt: string,
): KrxOfficialDateRecord[] {
  const byTicker = new Map<string, KrxKindCompanyRow[]>();
  for (const row of rows) {
    const current = byTicker.get(row.ticker) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.companyName === row.companyName)) current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "KRX")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeKrxCatalogTicker(ticker);
      const securityId = securityIdOf("KRX", ticker);
      const matches = byTicker.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceTicker: null,
          companyName: stock.name || null,
          marketName: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0 ? "Ticker not found in the KRX KIND listed-company file" : `Found ${matches.length} conflicting KRX KIND rows`],
        };
      }

      const row = matches[0];
      if (!row.listingDate) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: "invalid" as const,
          sourceTicker: row.ticker,
          companyName: row.companyName || stock.name || null,
          marketName: row.marketName || null,
          listingDate: null,
          events: [],
          warnings: ["KRX KIND listing date is invalid or missing"],
        };
      }

      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Seoul",
        exchange: "KRX",
        venueCity: "Seoul",
        venueCountry: "KR",
        evidence: {
          authority: "exchange",
          sourceName: "KRX KIND — Listed Companies",
          sourceUrl: KRX_KIND_COMPANY_LIST_URL,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `KRX KIND official 상장일 (listing date)${row.marketName ? `; market ${row.marketName}` : ""}; exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceTicker: row.ticker,
        companyName: row.companyName || stock.name || null,
        marketName: row.marketName || null,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
