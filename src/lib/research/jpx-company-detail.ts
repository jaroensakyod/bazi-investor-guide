import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const JPX_LISTED_COMPANY_SEARCH_URL = "https://www.jpx.co.jp/english/listing/co-search/01.html";
export const JPX_SEARCH_SESSION_URL = "https://www2.jpx.co.jp/tseHpFront/JJK010010Action.do?Show=Show";
export const JPX_DETAIL_ACTION_URL = "https://www2.jpx.co.jp/tseHpFront/JJK010030Action.do";
export const JPX_PREFERRED_ISSUES_URL = "https://www.jpx.co.jp/english/equities/products/preferred-stocks/issues/";

export type JpxCompanyDateRow = {
  ticker: string;
  managerCode: string;
  companyName: string;
  companyNameEnglish: string;
  isin: string;
  establishmentDate: string | null;
  listingDate: string;
  headOffice: string;
  sourceType?: "listed_company_search" | "preferred_issue_list";
  sourceUrl?: string;
  sourceHash?: string;
};

export type JpxPreferredIssueRow = {
  ticker: string;
  issueName: string;
  listingDate: string;
  marketSegment: string;
};

export type JpxCompanyDetail = Omit<JpxCompanyDateRow, "ticker" | "listingDate"> & {
  listingDate: string | null;
  warnings: string[];
};

export type JpxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceTicker: string | null;
  companyName: string | null;
  establishmentDate: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

type HtmlCell = { kind: "th" | "td"; text: string };

function decodeHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function tableRows(html: string): HtmlCell[][] {
  const rows: HtmlCell[][] = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells: HtmlCell[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      cells.push({ kind: cellMatch[1].toLowerCase() as "th" | "td", text: decodeHtml(cellMatch[2]) });
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function valueAfterHeader(rows: readonly HtmlCell[][], label: string): string {
  for (let index = 0; index < rows.length; index += 1) {
    const header = rows[index];
    const headerIndex = header.findIndex((cell) => cell.kind === "th" && cell.text.includes(label));
    if (headerIndex < 0) continue;
    for (let next = index + 1; next < Math.min(rows.length, index + 4); next += 1) {
      const values = rows[next].filter((cell) => cell.kind === "td");
      if (values.length > headerIndex) return values[headerIndex].text;
      if (values.length > 0 && headerIndex === 0) return values[0].text;
    }
  }
  return "";
}

function slashDate(value: string): string | null {
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}`
    : null;
}

function englishMonthDate(value: string): string | null {
  const match = /^([A-Z][a-z]{2})\.\s+(\d{2}),\s+(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months.indexOf(match[1]) + 1;
  if (month < 1) return null;
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${match[3]}-${String(month).padStart(2, "0")}-${match[2]}`
    : null;
}

/** Parse the exchange's separate issue-level table for listed preferred/class shares. */
export function parseJpxPreferredIssuesHtml(html: string): JpxPreferredIssueRow[] {
  const rows: JpxPreferredIssueRow[] = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => decodeHtml(match[1]));
    if (cells.length < 4) continue;
    const listingDate = englishMonthDate(cells[0]);
    const ticker = cells[1].trim().toUpperCase();
    const issueName = cells[2].replace(/\s+/g, " ").trim();
    const marketSegment = cells[3].replace(/\s+/g, " ").trim();
    if (!listingDate || !/^\d{5}$/.test(ticker) || !issueName || !marketSegment) continue;
    rows.push({ ticker, issueName, listingDate, marketSegment });
  }
  return rows;
}

export function normalizeJpxCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.T$/i, "");
}

export function jpxManagerCode(ticker: string): string {
  const normalized = normalizeJpxCatalogTicker(ticker);
  if (!/^[0-9A-Z]{4,5}$/.test(normalized)) throw new Error(`Unsupported JPX ticker: ${ticker}`);
  return normalized.length === 4 ? `${normalized}0` : normalized;
}

export function parseJpxCompanyDetail(html: string, expectedManagerCode: string): JpxCompanyDetail {
  const base = html.split(/<div\s+id=["']body_disclosure["']/i)[0];
  const rows = tableRows(base);
  const managerCode = rows
    .flat()
    .filter((cell) => cell.kind === "td")
    .map((cell) => cell.text)
    .find((value) => value === expectedManagerCode) ?? "";
  const companyName = decodeHtml(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i.exec(base)?.[1] ?? "");
  const companyNameEnglish = valueAfterHeader(rows, "英文商号");
  const establishmentRaw = valueAfterHeader(rows, "設立年月日");
  const listingRaw = valueAfterHeader(rows, "上場年月日");
  const headOffice = valueAfterHeader(rows, "本社所在地");
  const isin = rows.flat().map((cell) => cell.text).find((value) => /^[A-Z]{2}[A-Z0-9]{10}$/.test(value)) ?? "";
  const establishmentDate = slashDate(establishmentRaw);
  const listingDate = slashDate(listingRaw);
  const warnings: string[] = [];
  if (!managerCode) warnings.push(`JPX detail did not confirm manager code ${expectedManagerCode}`);
  if (!companyName) warnings.push("JPX detail is missing company name");
  if (!listingDate) warnings.push(`JPX listing date is invalid or missing: ${listingRaw || "<missing>"}`);
  if (establishmentRaw && establishmentRaw !== "-" && !establishmentDate) {
    warnings.push(`JPX establishment date is invalid: ${establishmentRaw}`);
  }
  return {
    managerCode,
    companyName,
    companyNameEnglish,
    isin,
    establishmentDate,
    listingDate,
    headOffice,
    warnings,
  };
}

export function parseJpxCompanyDatePayload(payload: unknown): JpxCompanyDateRow[] {
  if (!payload || typeof payload !== "object") throw new Error("JPX company-date payload must be an object");
  const records = (payload as { records?: unknown }).records;
  if (!Array.isArray(records)) throw new Error("JPX company-date payload is missing records");
  return records.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row.status !== "matched") return [];
    const ticker = normalizeJpxCatalogTicker(String(row.ticker ?? ""));
    const listingDate = String(row.listingDate ?? "");
    if (!/^[0-9A-Z]{4,5}$/.test(ticker) || !/^\d{4}-\d{2}-\d{2}$/.test(listingDate)) return [];
    return [{
      ticker,
      managerCode: String(row.managerCode ?? ""),
      companyName: String(row.companyName ?? ""),
      companyNameEnglish: String(row.companyNameEnglish ?? ""),
      isin: String(row.isin ?? ""),
      establishmentDate: typeof row.establishmentDate === "string" ? row.establishmentDate : null,
      listingDate,
      headOffice: String(row.headOffice ?? ""),
      sourceType: row.sourceType === "preferred_issue_list" ? "preferred_issue_list" : "listed_company_search",
      sourceUrl: typeof row.sourceUrl === "string" ? row.sourceUrl : undefined,
      sourceHash: typeof row.sourceHash === "string" ? row.sourceHash : undefined,
    }];
  });
}

export function matchJpxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly JpxCompanyDateRow[],
  retrievedAt: string,
): JpxOfficialDateRecord[] {
  const byTicker = new Map<string, JpxCompanyDateRow[]>();
  for (const row of rows) {
    const current = byTicker.get(row.ticker) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.isin === row.isin)) current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "TSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeJpxCatalogTicker(ticker);
      const securityId = securityIdOf("TSE", ticker);
      const matches = byTicker.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceTicker: null,
          companyName: stock.name || null,
          establishmentDate: null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0 ? "ไม่พบ ticker ใน JPX staged details" : `พบ ${matches.length} JPX rows ที่ขัดกัน`],
        };
      }

      const row = matches[0];
      const isPreferredIssue = row.sourceType === "preferred_issue_list";
      const evidence = {
        authority: "exchange" as const,
        sourceName: isPreferredIssue
          ? "JPX — Listed Issues (Preferred Stocks, etc.)"
          : "JPX — Listed Company Search (Basic Information)",
        sourceUrl: row.sourceUrl || (isPreferredIssue ? JPX_PREFERRED_ISSUES_URL : JPX_LISTED_COMPANY_SEARCH_URL),
        retrievedAt,
        verification: "verified" as const,
        displayRights: "unknown" as const,
      };
      const events: SecurityEvent[] = [{
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Tokyo",
        exchange: "TSE",
        venueCity: "Tokyo",
        venueCountry: "JP",
        evidence,
        note: isPreferredIssue
          ? "JPX official issue-level Listing Date for a preferred/class share; exact first-trade time is not stated."
          : "JPX official 上場年月日 (listing date); exact first-trade time is not stated.",
      }];
      if (row.establishmentDate) {
        events.push({
          schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
          securityId,
          kind: "incorporation",
          localDate: row.establishmentDate,
          localTime: null,
          timePrecision: "unknown",
          timeZone: "Asia/Tokyo",
          venueCountry: "JP",
          evidence,
          note: `JPX official 設立年月日 (establishment date)${row.headOffice ? `; head office ${row.headOffice}` : ""}; company context only.`,
        });
      }
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceTicker: row.ticker,
        companyName: row.companyNameEnglish || row.companyName || stock.name || null,
        establishmentDate: row.establishmentDate,
        listingDate: row.listingDate,
        events,
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
