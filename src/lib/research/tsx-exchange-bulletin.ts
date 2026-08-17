import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";
import { hasTsxIssuerIdentityOverlap, normalizeTsxCatalogTicker } from "./tsx-listed-company";

export const TSX_NEW_COMPANY_LISTINGS_URL = "https://www.tsx.com/en/news/new-company-listings";

export function tsxExchangeBulletinUrl(id: number): string {
  if (!Number.isInteger(id) || id < 1 || id > 100_000) throw new Error("Invalid TSX exchange bulletin id");
  return `${TSX_NEW_COMPANY_LISTINGS_URL}?id=${id}`;
}

export type TsxExchangeBulletinRow = {
  bulletinId: number;
  symbol: string;
  issuerName: string;
  listingDate: string;
  postedForTradingDate: string | null;
  sourceTitle: string;
  sourceUrl: string;
  retrievedAt: string;
};

export type TsxExchangeBulletinPayload = {
  retrievedAt: string;
  firstBulletinId: number;
  lastBulletinId: number;
  processedBulletinCount: number;
  records: TsxExchangeBulletinRow[];
};

export type TsxBulletinOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  listingDate: string | null;
  postedForTradingDate: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

const MONTHS: Readonly<Record<string, number>> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
    : null;
}

export function parseTsxBulletinDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i.exec(value);
  if (!match) return null;
  return isoDate(Number(match[3]), MONTHS[match[1].toLowerCase()], Number(match[2]));
}

function decodeHtml(value: string): string {
  return value
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;?/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function labelledCell(html: string, label: string): string | null {
  const pattern = new RegExp(`<t[dh][^>]*>\\s*${label}\\s*:?\\s*</t[dh]>\\s*<t[dh][^>]*>([\\s\\S]*?)</t[dh]>`, "i");
  const match = pattern.exec(html);
  return match ? decodeHtml(match[1]) : null;
}

export function parseTsxExchangeBulletin(
  html: string,
  bulletinId: number,
  retrievedAt: string,
): TsxExchangeBulletinRow[] {
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error("TSX bulletin retrievedAt is invalid");
  const sourceUrl = tsxExchangeBulletinUrl(bulletinId);
  const contentStart = html.search(/<h2(?:\s[^>]*)?>/i);
  if (contentStart < 0) return [];
  const contentEnd = html.indexOf('<div id="page-sidebar"', contentStart);
  const content = html.slice(contentStart, contentEnd >= 0 ? contentEnd : undefined);
  const titleMatch = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/i.exec(content);
  const sourceTitle = titleMatch ? decodeHtml(titleMatch[1]) : "";
  if (!/To Trade On Toronto Stock Exchange/i.test(sourceTitle)) return [];
  const titleIdentity = /^(.*?)\s*\(([^()]*)\)\s*To Trade On Toronto Stock Exchange\s*$/i.exec(sourceTitle);
  if (!titleIdentity) return [];
  const issuerName = titleIdentity[1].replace(/\s+/g, " ").trim();
  const listingDate = parseTsxBulletinDate(labelledCell(content, "Listing date"));
  if (!issuerName || !listingDate) return [];
  const postedForTradingDate = parseTsxBulletinDate(labelledCell(content, "Posted for trading date"));
  const symbols = titleIdentity[2]
    .split(",")
    .map((value) => normalizeTsxCatalogTicker(value))
    .filter(Boolean);
  return [...new Set(symbols)].map((symbol) => ({
    bulletinId,
    symbol,
    issuerName,
    listingDate,
    postedForTradingDate,
    sourceTitle,
    sourceUrl,
    retrievedAt: new Date(retrievedAt).toISOString(),
  }));
}

function exactBulletinUrl(value: string, bulletinId: number): boolean {
  try {
    return new URL(value).toString() === new URL(tsxExchangeBulletinUrl(bulletinId)).toString();
  } catch {
    return false;
  }
}

export function parseTsxExchangeBulletinPayload(payload: unknown): TsxExchangeBulletinPayload {
  if (!payload || typeof payload !== "object") throw new Error("TSX bulletin payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAt = String(input.retrievedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAt))) throw new Error("TSX bulletin payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("TSX bulletin payload is missing records");
  const firstBulletinId = Number(input.firstBulletinId);
  const lastBulletinId = Number(input.lastBulletinId);
  const processedBulletinCount = Number(input.processedBulletinCount);
  if (!Number.isInteger(firstBulletinId) || firstBulletinId < 1
    || !Number.isInteger(lastBulletinId) || lastBulletinId < firstBulletinId
    || !Number.isInteger(processedBulletinCount) || processedBulletinCount < 0
    || processedBulletinCount > lastBulletinId - firstBulletinId + 1) {
    throw new Error("TSX bulletin payload has invalid crawl bounds");
  }
  const records = input.records.flatMap((value): TsxExchangeBulletinRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const bulletinId = Number(row.bulletinId);
    const symbol = normalizeTsxCatalogTicker(String(row.symbol ?? ""));
    const issuerName = String(row.issuerName ?? "").replace(/\s+/g, " ").trim();
    const listingDate = parseTsxBulletinDate(String(row.listingDate ?? "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1"))
      ?? (/^\d{4}-\d{2}-\d{2}$/.test(String(row.listingDate ?? "")) ? String(row.listingDate) : null);
    const postedRaw = row.postedForTradingDate;
    const postedForTradingDate = postedRaw === null || postedRaw === undefined || postedRaw === ""
      ? null
      : (/^\d{4}-\d{2}-\d{2}$/.test(String(postedRaw)) ? String(postedRaw) : null);
    const sourceTitle = String(row.sourceTitle ?? "").replace(/\s+/g, " ").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAt);
    if (!Number.isInteger(bulletinId) || bulletinId < firstBulletinId || bulletinId > lastBulletinId
      || !symbol || !issuerName || !listingDate || !sourceTitle
      || !exactBulletinUrl(sourceUrl, bulletinId) || !Number.isFinite(Date.parse(rowRetrievedAt))) return [];
    const checkedListingDate = /^\d{4}-\d{2}-\d{2}$/.test(listingDate)
      ? isoDate(Number(listingDate.slice(0, 4)), Number(listingDate.slice(5, 7)), Number(listingDate.slice(8, 10)))
      : null;
    const checkedTradingDate = postedForTradingDate
      ? isoDate(Number(postedForTradingDate.slice(0, 4)), Number(postedForTradingDate.slice(5, 7)), Number(postedForTradingDate.slice(8, 10)))
      : null;
    if (!checkedListingDate || (postedForTradingDate && !checkedTradingDate)) return [];
    return [{
      bulletinId,
      symbol,
      issuerName,
      listingDate: checkedListingDate,
      postedForTradingDate: checkedTradingDate,
      sourceTitle,
      sourceUrl,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  return {
    retrievedAt: new Date(retrievedAt).toISOString(),
    firstBulletinId,
    lastBulletinId,
    processedBulletinCount,
    records,
  };
}

export function matchTsxBulletinOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: TsxExchangeBulletinPayload,
): TsxBulletinOfficialDateRecord[] {
  const bySymbol = new Map<string, TsxExchangeBulletinRow[]>();
  for (const row of payload.records) {
    const rows = bySymbol.get(row.symbol) ?? [];
    if (!rows.some((item) => item.bulletinId === row.bulletinId)) rows.push(row);
    bySymbol.set(row.symbol, rows);
  }
  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "TSX")
    .map((stock): TsxBulletinOfficialDateRecord => {
      const ticker = normalizeTsxCatalogTicker(stock.ticker);
      const securityId = securityIdOf("TSX", stock.ticker);
      if (!ticker) return {
        securityId,
        ticker: stock.ticker.trim().toUpperCase(),
        status: "invalid",
        listingDate: null,
        postedForTradingDate: null,
        sourceUrl: null,
        events: [],
        warnings: ["Catalog ticker does not follow a supported TSX symbol shape"],
      };
      const identityMatches = (bySymbol.get(ticker) ?? [])
        .filter((row) => hasTsxIssuerIdentityOverlap(stock.name, row.issuerName));
      const uniqueDates = [...new Set(identityMatches.map((row) => row.listingDate))];
      if (uniqueDates.length !== 1) return {
        securityId,
        ticker: stock.ticker.trim().toUpperCase(),
        status: uniqueDates.length > 1 ? "ambiguous" : "unmatched",
        listingDate: null,
        postedForTradingDate: null,
        sourceUrl: null,
        events: [],
        warnings: [identityMatches.length === 0
          ? "No exact-symbol TSX exchange bulletin also matched the current catalog issuer identity"
          : `Found ${uniqueDates.length} different exact-symbol TSX bulletin listing dates`],
      };
      const row = identityMatches.find((item) => item.listingDate === uniqueDates[0])!;
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId,
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
          sourceName: `TSX Exchange Bulletin — ${row.sourceTitle}`,
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: row.postedForTradingDate
          ? `Exact-symbol TSX Listing date; the bulletin separately states Posted for trading date ${row.postedForTradingDate}. Exact first-trade time is not claimed.`
          : "Exact-symbol TSX Listing date; exact first-trade time is not stated.",
      };
      return {
        securityId,
        ticker: stock.ticker.trim().toUpperCase(),
        status: "matched",
        listingDate: row.listingDate,
        postedForTradingDate: row.postedForTradingDate,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
