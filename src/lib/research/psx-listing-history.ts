import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const PSX_LISTINGS_HISTORY_PAGE_URL =
  "https://www.psx.com.pk/psx/resources-and-tools/listings/listings-history";
export const PSX_CURRENT_LISTINGS_URL = "https://dps.psx.com.pk/listings-table/main/nc";

export function psxCompanyProfileUrl(symbol: string): string {
  const ticker = normalizePsxTicker(symbol);
  if (!ticker) throw new Error("Invalid PSX company-profile symbol");
  return `https://dps.psx.com.pk/company/${encodeURIComponent(ticker)}`;
}

export const PSX_LISTING_HISTORY_ARCHIVE_URLS: Readonly<Record<number, string>> = Object.freeze({
  2000: "https://www.psx.com.pk/psx/Equlity/floatation2000.zip",
  2001: "https://www.psx.com.pk/psx/Equlity/floatation2001.zip",
  2002: "https://www.psx.com.pk/psx/Equlity/floatation2002.zip",
  2003: "https://www.psx.com.pk/psx/Equlity/floatation2003.zip",
  2004: "https://www.psx.com.pk/psx/Equlity/floatation2004.zip",
  2005: "https://www.psx.com.pk/psx/Equlity/floatation2005.zip",
  2006: "https://www.psx.com.pk/psx/Equlity/floatation2006.zip",
  2007: "https://www.psx.com.pk/psx/Equlity/floatation2007.zip",
  2008: "https://www.psx.com.pk/psx/Equlity/floatation2008.zip",
  2009: "https://www.psx.com.pk/psx/Equlity/floatation2009.zip",
  2010: "https://www.psx.com.pk/psx/Equlity/floatation2010.zip",
  2011: "https://www.psx.com.pk/psx/Equlity/floatation2011.zip",
  2012: "https://www.psx.com.pk/psx/Equlity/floatation2012.zip",
  2013: "https://www.psx.com.pk/psx/Equlity/floatation2013.zip",
  2014: "https://www.psx.com.pk/psx/Equlity/floatation2014.zip",
  2015: "https://www.psx.com.pk/psx/Equlity/floatation2015.zip",
  2016: "https://www.psx.com.pk/psx/Equlity/floatation2016.zip",
  2017: "https://www.psx.com.pk/psx/Equlity/floatation2017.zip",
  2018: "https://www.psx.com.pk/psx/themes/psx/uploads/New_Listing_2018_1.zip",
  2019: "https://www.psx.com.pk/psx/themes/psx/uploads/New_Listing_2019_2.zip",
  2020: "https://www.psx.com.pk/psx/themes/psx/uploads/floatation2020.zip",
  2021: "https://www.psx.com.pk/psx/themes/psx/uploads/New_Listing_2021_Equity_71021.zip",
  2022: "https://www.psx.com.pk/psx/themes/psx/uploads/New_Listing_-_Equities_2022_(27-Dec-2022).zip",
  2023: "https://www.psx.com.pk/psx/themes/psx/uploads/New_Listing_-_Equities_2023_(02-Jan-2024).zip",
  2024: "https://www.psx.com.pk/psx/themes/psx/uploads/New-Listing-Equity-18-Oct-2024.zip",
  2025: "https://www.psx.com.pk/psx/themes/psx/uploads/New-Listing-Equity-31-Dec-2025.zip",
  2026: "https://www.psx.com.pk/psx/themes/psx/uploads/New-Listing-14-Jul-2026.zip",
});

export type PsxListingDirectoryRow = {
  symbol: string;
  name: string;
  sector: string;
};

export type PsxListingHistoryRow = {
  sourceType: "annual_listing_history" | "company_profile";
  year: number;
  companyName: string;
  symbol: string | null;
  listingDate: string;
  evidenceExcerpt: string | null;
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type PsxListingDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  directorySourceUrl: string;
  directorySourceHash: string;
  directoryRows: PsxListingDirectoryRow[];
  records: PsxListingHistoryRow[];
};

export type PsxOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  matchMethod: "explicit_symbol" | "exact_official_name" | "official_profile" | null;
  directoryName: string | null;
  historyCompanyName: string | null;
  historyYear: number | null;
  listingDate: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const MONTHS: Readonly<Record<string, number>> = Object.freeze({
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
});

export function parsePsxListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const numericMatch = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(normalized);
  if (numericMatch) return isoDate(Number(numericMatch[3]), Number(numericMatch[2]), Number(numericMatch[1]));
  const dayFirstMatch = /^(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})[\s,-]+(\d{2}|\d{4})$/i.exec(normalized);
  const monthFirstMatch = /^([A-Za-z]{3,9})[\s-]+(\d{1,2})(?:st|nd|rd|th)?,?[\s-]+(\d{2}|\d{4})$/i.exec(normalized);
  const monthName = dayFirstMatch?.[2] ?? monthFirstMatch?.[1];
  const day = Number(dayFirstMatch?.[1] ?? monthFirstMatch?.[2]);
  const rawYear = Number(dayFirstMatch?.[3] ?? monthFirstMatch?.[3]);
  if (!monthName || !Number.isFinite(day) || !Number.isFinite(rawYear)) return null;
  const month = MONTHS[monthName.toLowerCase()];
  const year = rawYear < 100 ? (rawYear >= 70 ? 1900 + rawYear : 2000 + rawYear) : rawYear;
  return month ? isoDate(year, month, day) : null;
}

export function normalizePsxTicker(value: string): string {
  const ticker = value.trim().toUpperCase().replace(/\.KA$/i, "");
  return /^[A-Z0-9][A-Z0-9./-]{0,19}$/.test(ticker) ? ticker : "";
}

/**
 * Normalize typography and legal suffixes only. Substantive words such as
 * Corporation and Holdings stay intact so corporate successors are not joined
 * to an older company merely because their names are similar.
 */
export function normalizePsxCompanyName(value: string): string {
  let normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\*+/g, " ")
    .replace(/\((?=[^)]*\b(?:CLASS|ISSUE|SHARES?|OFFERING|PREF(?:ERENCE)?|ORDINARY)\b)[^)]*\)/g, " ")
    .replace(/&/g, " AND ")
    .replace(/\bFERTILISER\b/g, "FERTILIZER")
    .replace(/\bINDUSTRIES\b/g, "INDUSTRY")
    .replace(/\bPAK\b/g, "PAKISTAN")
    .replace(/\bCO\b/g, "COMPANY")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/^THE\s+/, " ")
    .replace(/\s+/g, " ")
    .trim();
  while (/\s+(?:LIMITED|LTD|PLC|INC)$/.test(normalized)) {
    normalized = normalized.replace(/\s+(?:LIMITED|LTD|PLC|INC)$/, "").trim();
  }
  return normalized;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export type PsxCompanyProfileListingEvidence = {
  symbol: string;
  listingDate: string;
  evidenceExcerpt: string;
};

/**
 * Extract only an explicit day-precision listing statement from the official
 * PSX company profile. A phrase such as "incorporated as a public listed
 * company on ..." is deliberately rejected because that date describes
 * incorporation, not exchange admission.
 */
export function parsePsxCompanyProfileListingEvidence(
  html: string,
  expectedSymbol: string,
): PsxCompanyProfileListingEvidence | null {
  const symbol = normalizePsxTicker(expectedSymbol);
  if (!symbol) return null;
  const titleSymbol = normalizePsxTicker(stripHtml(/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "").split(" - ")[0]);
  if (titleSymbol !== symbol) return null;
  const descriptionMatch = /BUSINESS DESCRIPTION[\s\S]{0,1800}?<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!descriptionMatch) return null;
  const description = stripHtml(descriptionMatch[1]);
  if (!description || description.length > 5_000) return null;

  const month = "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)";
  const date = `(?:\\d{1,2}(?:st|nd|rd|th)?[\\s-]+${month}[\\s,-]+\\d{4}|${month}[\\s-]+\\d{1,2}(?:st|nd|rd|th)?,?[\\s-]+\\d{4}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{4})`;
  const exchange = "(?:Pakistan Stock Exchange(?: Limited)?|PSX|Karachi Stock Exchange(?: Limited)?|KSE|Lahore Stock Exchange(?: Limited)?|Islamabad Stock Exchange(?: Limited)?)";
  const patterns = [
    new RegExp(`\\bgot\\s+listed\\s+(?:on|from)\\s+(${date})`, "i"),
    new RegExp(`\\b(?:company|shares?|it)\\s+(?:was|were|is|are|became)\\s+(?:subsequently\\s+)?(?:listed|quoted)\\b[^.!?]{0,160}?\\b(?:on|since|from)\\s+(${date})`, "i"),
    new RegExp(`\\b(?:listed|quoted)\\s+(?:on|at|with|in)\\s+(?:the\\s+)?${exchange}[^.!?]{0,80}?\\b(?:on|since|from)\\s+(${date})`, "i"),
    new RegExp(`\\b(?:effective|with\\s+effect)\\s+from\\s+(${date})[^.!?]{0,140}?\\b(?:company|shares?|it)\\s+(?:was|were|is|are)\\s+(?:listed|quoted)\\b`, "i"),
    new RegExp(`\\b(?:listed|quoted)\\s+(?:on|from)\\s+(${date})`, "i"),
  ];
  const sentences = description.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    if (!/\b(?:listed|quoted)\b/i.test(sentence)) continue;
    for (const pattern of patterns) {
      const match = pattern.exec(sentence);
      const listingDate = match ? parsePsxListingDate(match[1]) : null;
      if (listingDate) {
        return {
          symbol,
          listingDate,
          evidenceExcerpt: sentence.slice(0, 600),
        };
      }
    }
  }
  return null;
}

function htmlAttribute(attributes: string, name: string): string {
  const match = new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)')`, "i").exec(attributes);
  return decodeHtmlEntities(match?.[1] ?? match?.[2] ?? "");
}

export function parsePsxCurrentListingsHtml(html: string): PsxListingDirectoryRow[] {
  const parsed: PsxListingDirectoryRow[] = [];
  for (const rowMatch of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = rowMatch[1];
    const anchor = /<a\b([^>]*)>[\s\S]*?<strong\b[^>]*>([\s\S]*?)<\/strong>[\s\S]*?<\/a>/i.exec(rowHtml);
    if (!anchor || !/\btbl__symbol\b/i.test(htmlAttribute(anchor[1], "class"))) continue;
    const symbol = normalizePsxTicker(stripHtml(anchor[2]));
    const href = htmlAttribute(anchor[1], "href");
    const name = stripHtml(htmlAttribute(anchor[1], "data-title"));
    const sectorMatch = /<td\b[^>]*data-code=(?:"[^"]*"|'[^']*')[^>]*>([\s\S]*?)<\/td>/i.exec(rowHtml);
    const sector = sectorMatch ? stripHtml(sectorMatch[1]) : "";
    if (!symbol || href !== `/company/${symbol}` || !name) continue;
    parsed.push({ symbol, name, sector });
  }
  const unique = new Map<string, PsxListingDirectoryRow>();
  for (const row of parsed) {
    if (unique.has(row.symbol)) throw new Error(`PSX current listings contains duplicate symbol ${row.symbol}`);
    unique.set(row.symbol, row);
  }
  if (unique.size === 0) throw new Error("PSX current listings contains no valid company rows");
  return [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function isExactUrl(value: string, expected: string): boolean {
  try {
    return new URL(value).toString() === new URL(expected).toString();
  } catch {
    return false;
  }
}

function isPsxHistoryArchiveUrl(value: string, year: number): boolean {
  const expected = PSX_LISTING_HISTORY_ARCHIVE_URLS[year];
  return typeof expected === "string" && isExactUrl(value, expected);
}

export function parsePsxListingDatePayload(payload: unknown): PsxListingDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("PSX listing-date payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("PSX payload has an invalid retrievedAt");
  const directorySourceUrl = String(input.directorySourceUrl ?? "").trim();
  const directorySourceHash = String(input.directorySourceHash ?? "").trim().toLowerCase();
  if (!isExactUrl(directorySourceUrl, PSX_CURRENT_LISTINGS_URL) || !/^[a-f0-9]{64}$/.test(directorySourceHash)) {
    throw new Error("PSX payload has invalid current-directory provenance");
  }
  if (!Array.isArray(input.directoryRows) || !Array.isArray(input.records)) {
    throw new Error("PSX payload is missing directoryRows or records");
  }
  const directoryRows = input.directoryRows.flatMap((value): PsxListingDirectoryRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizePsxTicker(String(row.symbol ?? ""));
    const name = String(row.name ?? "").replace(/\s+/g, " ").trim();
    const sector = String(row.sector ?? "").replace(/\s+/g, " ").trim();
    return symbol && name ? [{ symbol, name, sector }] : [];
  });
  const duplicateDirectorySymbols = directoryRows.length - new Set(directoryRows.map((row) => row.symbol)).size;
  if (directoryRows.length === 0 || duplicateDirectorySymbols > 0) {
    throw new Error("PSX payload has an empty or duplicate current directory");
  }
  const records = input.records.flatMap((value): PsxListingHistoryRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const sourceType = String(row.sourceType ?? "annual_listing_history") as PsxListingHistoryRow["sourceType"];
    const year = Number(row.year);
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const rawSymbol = row.symbol == null ? "" : String(row.symbol);
    const symbol = rawSymbol.trim() ? normalizePsxTicker(rawSymbol) : null;
    const listingDate = parsePsxListingDate(row.listingDate);
    const evidenceExcerpt = String(row.evidenceExcerpt ?? "").replace(/\s+/g, " ").trim() || null;
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    const validAnnualSource = sourceType === "annual_listing_history"
      && isPsxHistoryArchiveUrl(sourceUrl, year)
      && evidenceExcerpt === null;
    const validProfileSource = sourceType === "company_profile"
      && symbol !== null
      && isExactUrl(sourceUrl, psxCompanyProfileUrl(symbol))
      && evidenceExcerpt !== null
      && evidenceExcerpt.length <= 600
      && /\b(?:listed|quoted)\b/i.test(evidenceExcerpt)
      && year === Number(listingDate?.slice(0, 4));
    if (!Number.isInteger(year) || !companyName || (rawSymbol.trim() && !symbol) || !listingDate
      || (!validAnnualSource && !validProfileSource) || !/^[a-f0-9]{64}$/.test(sourceHash)
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      sourceType,
      year,
      companyName,
      symbol,
      listingDate,
      evidenceExcerpt,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("PSX payload contains no valid listing-history records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    directorySourceUrl,
    directorySourceHash,
    directoryRows: [...directoryRows].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    records: [...records].sort((a, b) => a.listingDate.localeCompare(b.listingDate) || a.companyName.localeCompare(b.companyName)),
  };
}

function uniqueHistoryDates(rows: readonly PsxListingHistoryRow[]): PsxListingHistoryRow[] {
  const unique = new Map<string, PsxListingHistoryRow>();
  for (const row of rows) {
    unique.set(`${row.sourceType}\u0000${row.listingDate}\u0000${row.companyName}\u0000${row.symbol ?? ""}`, row);
  }
  return [...unique.values()];
}

export function matchPsxOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: PsxListingDatePayload,
): PsxOfficialDateRecord[] {
  const directoryBySymbol = new Map(payload.directoryRows.map((row) => [row.symbol, row]));
  const historyBySymbol = new Map<string, PsxListingHistoryRow[]>();
  const historyByName = new Map<string, PsxListingHistoryRow[]>();
  for (const row of payload.records) {
    if (row.symbol) {
      const current = historyBySymbol.get(row.symbol) ?? [];
      current.push(row);
      historyBySymbol.set(row.symbol, current);
    } else {
      const name = normalizePsxCompanyName(row.companyName);
      if (!name) continue;
      const current = historyByName.get(name) ?? [];
      current.push(row);
      historyByName.set(name, current);
    }
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "KSE")
    .map((stock): PsxOfficialDateRecord => {
      const ticker = normalizePsxTicker(stock.ticker);
      const securityId = securityIdOf("KSE", stock.ticker);
      if (!ticker) {
        return {
          securityId,
          ticker: stock.ticker.trim().toUpperCase(),
          status: "invalid",
          matchMethod: null,
          directoryName: null,
          historyCompanyName: null,
          historyYear: null,
          listingDate: null,
          sourceUrl: null,
          events: [],
          warnings: ["Catalog ticker does not follow a supported PSX symbol shape"],
        };
      }
      const directory = directoryBySymbol.get(ticker);
      if (!directory) {
        return {
          securityId,
          ticker,
          status: "unmatched",
          matchMethod: null,
          directoryName: null,
          historyCompanyName: null,
          historyYear: null,
          listingDate: null,
          sourceUrl: null,
          events: [],
          warnings: ["Exact catalog symbol is absent from the official PSX current listings directory"],
        };
      }

      const explicitMatches = uniqueHistoryDates(historyBySymbol.get(ticker) ?? []);
      const directoryName = normalizePsxCompanyName(directory.name);
      const nameMatches = explicitMatches.length === 0
        ? uniqueHistoryDates(historyByName.get(directoryName) ?? [])
        : [];
      const matches = explicitMatches.length > 0 ? explicitMatches : nameMatches;
      const distinctDates = new Set(matches.map((row) => row.listingDate));
      if (matches.length === 0) {
        return {
          securityId,
          ticker,
          status: "unmatched",
          matchMethod: null,
          directoryName: directory.name,
          historyCompanyName: null,
          historyYear: null,
          listingDate: null,
          sourceUrl: null,
          events: [],
          warnings: ["No unambiguous PSX formal-listing record was found for this current security from 2000 onward"],
        };
      }
      if (distinctDates.size !== 1) {
        return {
          securityId,
          ticker,
          status: "ambiguous",
          matchMethod: null,
          directoryName: directory.name,
          historyCompanyName: null,
          historyYear: null,
          listingDate: null,
          sourceUrl: null,
          events: [],
          warnings: [`PSX history contains ${distinctDates.size} different formal-listing dates for this identity`],
        };
      }

      const row = [...matches].sort((a, b) =>
        (a.sourceType === "annual_listing_history" ? -1 : 1)
        - (b.sourceType === "annual_listing_history" ? -1 : 1)
        || a.year - b.year
        || a.companyName.localeCompare(b.companyName),
      )[0];
      const method = row.sourceType === "company_profile"
        ? "official_profile" as const
        : explicitMatches.length > 0
          ? "explicit_symbol" as const
          : "exact_official_name" as const;
      const namesDiffer = normalizePsxCompanyName(row.companyName) !== directoryName;
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Karachi",
        exchange: "PSX",
        venueCity: "Karachi",
        venueCountry: "PK",
        evidence: {
          authority: "exchange",
          sourceName: row.sourceType === "company_profile"
            ? "Pakistan Stock Exchange Company Profile"
            : "Pakistan Stock Exchange Listings History",
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: row.sourceType === "company_profile"
          ? `Day-precision listing statement published in the exact-symbol PSX company profile; predecessor venue may be unspecified and no first-trade time is claimed. Evidence excerpt: ${row.evidenceExcerpt}`
          : `PSX Date of Formal Listing; date-only and matched by ${method === "explicit_symbol" ? "explicit official symbol" : "exact normalized official company name"}.`,
      };
      return {
        securityId,
        ticker,
        status: "matched",
        matchMethod: method,
        directoryName: directory.name,
        historyCompanyName: row.companyName,
        historyYear: row.year,
        listingDate: row.listingDate,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: namesDiffer && method === "explicit_symbol"
          ? ["Historical and current official names differ; exact PSX symbol was used as the identity anchor"]
          : [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
