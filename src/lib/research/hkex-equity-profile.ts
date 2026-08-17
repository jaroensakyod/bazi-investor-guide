import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const HKEX_EQUITIES_QUOTE_PAGE_URL =
  "https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities/Equities-Quote";
export const HKEX_EQUITY_QUOTE_API_URL =
  "https://www1.hkex.com.hk/hkexwidget/data/getequityquote";

export type HkexEquityQuoteSnapshot = {
  symbol: string;
  ric: string;
  companyName: string;
  listingDate: string | null;
  transferOfListingDate: string | null;
  productType: string;
  productSubtype: string | null;
  primaryExchange: string;
  databaseUpdatedAt: string | null;
};

export type HkexCompanyDateRow = Omit<HkexEquityQuoteSnapshot, "listingDate"> & {
  listingDate: string;
  sourceUrl: string;
  sourceHash: string | null;
  retrievedAt: string;
};

export type HkexCompanyDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: HkexCompanyDateRow[];
};

export type HkexOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  ric: string | null;
  companyName: string | null;
  listingDate: string | null;
  transferOfListingDate: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const ELIGIBLE_PRODUCT_TYPES = new Set(["EQTY", "REIT"]);

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseHkexListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const englishMatch = /^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/.exec(normalized);
  if (!englishMatch) return null;
  const month = MONTHS[englishMatch[2].toLowerCase()];
  return month ? isoDate(Number(englishMatch[3]), month, Number(englishMatch[1])) : null;
}

export function normalizeHkexCatalogTicker(ticker: string): string {
  const raw = ticker.trim().toUpperCase().replace(/\.HK$/i, "");
  if (!/^\d{1,5}$/.test(raw)) return "";
  const numeric = Number(raw);
  return Number.isInteger(numeric) && numeric > 0 ? String(numeric) : "";
}

export function hkexEquityQuotePageUrl(symbol: string): string {
  const normalized = normalizeHkexCatalogTicker(symbol);
  if (!normalized) throw new Error(`Invalid HKEX equity symbol: ${symbol}`);
  const url = new URL(HKEX_EQUITIES_QUOTE_PAGE_URL);
  url.searchParams.set("sym", normalized);
  url.searchParams.set("sc_lang", "en");
  return url.toString();
}

function parseJsonp(value: string): unknown {
  const text = value.trim();
  if (text.startsWith("{")) return JSON.parse(text) as unknown;
  const start = text.indexOf("(");
  const end = text.lastIndexOf(")");
  if (start < 1 || end <= start) throw new Error("HKEX quote response is not valid JSONP");
  return JSON.parse(text.slice(start + 1, end)) as unknown;
}

export function parseHkexEquityQuoteJsonp(value: string): HkexEquityQuoteSnapshot {
  const payload = parseJsonp(value) as {
    data?: { responsecode?: unknown; quote?: Record<string, unknown> };
  };
  if (!payload?.data || String(payload.data.responsecode ?? "") !== "000" || !payload.data.quote) {
    throw new Error(`HKEX quote response code ${String(payload?.data?.responsecode ?? "missing")}`);
  }
  const quote = payload.data.quote;
  const symbol = normalizeHkexCatalogTicker(String(quote.sym ?? ""));
  const ric = String(quote.ric ?? "").trim().toUpperCase();
  const productType = String(quote.product_type ?? "").trim().toUpperCase();
  const productSubtype = String(quote.product_subtype ?? "").trim().toUpperCase() || null;
  const primaryExchange = String(quote.primaryexch ?? "").trim().toUpperCase();
  if (!symbol || !/^\d{4,5}\.HK$/.test(ric) || !ELIGIBLE_PRODUCT_TYPES.has(productType) || primaryExchange !== "HKEX") {
    throw new Error("HKEX quote response does not identify an eligible listed equity or REIT on HKEX");
  }
  return {
    symbol,
    ric,
    companyName: String(quote.nm ?? "").replace(/\s+/g, " ").trim(),
    listingDate: parseHkexListingDate(quote.listing_date),
    transferOfListingDate: parseHkexListingDate(quote.transfer_of_listing_date),
    productType,
    productSubtype,
    primaryExchange,
    databaseUpdatedAt: String(quote.db_updatetime ?? "").replace(/\s+/g, " ").trim() || null,
  };
}

function isHkexEquityQuotePage(value: string, symbol: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "www.hkex.com.hk"
      && url.pathname.toLowerCase() === "/market-data/securities-prices/equities/equities-quote"
      && normalizeHkexCatalogTicker(url.searchParams.get("sym") ?? "") === symbol;
  } catch {
    return false;
  }
}

export function parseHkexCompanyDatePayload(payload: unknown): HkexCompanyDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("HKEX company-date payload must be an object");
  const input = payload as { retrievedAt?: unknown; updatedAt?: unknown; sourceRowCount?: unknown; records?: unknown };
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) {
    throw new Error("HKEX company-date payload has an invalid retrievedAt");
  }
  if (!Array.isArray(input.records)) throw new Error("HKEX company-date payload is missing records");
  const records = input.records.flatMap((value): HkexCompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    if (row.status !== undefined && row.status !== "matched") return [];
    const symbol = normalizeHkexCatalogTicker(String(row.symbol ?? ""));
    const ric = String(row.ric ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const listingDate = parseHkexListingDate(row.listingDate);
    const transferOfListingDate = row.transferOfListingDate == null
      ? null
      : parseHkexListingDate(row.transferOfListingDate);
    const productType = String(row.productType ?? "").trim().toUpperCase();
    const productSubtype = String(row.productSubtype ?? "").trim().toUpperCase() || null;
    const primaryExchange = String(row.primaryExchange ?? "").trim().toUpperCase();
    const databaseUpdatedAt = String(row.databaseUpdatedAt ?? "").replace(/\s+/g, " ").trim() || null;
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase() || null;
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!symbol || !/^\d{4,5}\.HK$/.test(ric) || !companyName || !listingDate
      || !ELIGIBLE_PRODUCT_TYPES.has(productType) || ["EW", "RGHT"].includes(productSubtype ?? "")
      || primaryExchange !== "HKEX" || !isHkexEquityQuotePage(sourceUrl, symbol)
      || (sourceHash !== null && !/^[a-f0-9]{64}$/.test(sourceHash))
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      symbol,
      ric,
      companyName,
      listingDate,
      transferOfListingDate,
      productType,
      productSubtype,
      primaryExchange,
      databaseUpdatedAt,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("HKEX company-date payload contains no valid matched records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records,
  };
}

export function matchHkexOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: HkexCompanyDatePayload,
): HkexOfficialDateRecord[] {
  const bySymbol = new Map<string, HkexCompanyDateRow[]>();
  for (const row of payload.records) {
    const current = bySymbol.get(row.symbol) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.ric === row.ric)) current.push(row);
    bySymbol.set(row.symbol, current);
  }
  const hkStocks = stocks.filter((stock) => stock.market.trim().toUpperCase() === "HKEX");
  const catalogCounts = new Map<string, number>();
  for (const stock of hkStocks) {
    const symbol = normalizeHkexCatalogTicker(stock.ticker);
    catalogCounts.set(symbol, (catalogCounts.get(symbol) ?? 0) + 1);
  }

  return hkStocks.map((stock) => {
    const ticker = stock.ticker.trim().toUpperCase();
    const symbol = normalizeHkexCatalogTicker(ticker);
    const securityId = securityIdOf("HKEX", ticker);
    if (!symbol) {
      return {
        securityId,
        ticker,
        status: "invalid" as const,
        sourceSymbol: null,
        ric: null,
        companyName: stock.name || null,
        listingDate: null,
        transferOfListingDate: null,
        sourceUrl: null,
        events: [],
        warnings: ["Catalog ticker is not a numeric HKEX stock code"],
      };
    }
    const matches = bySymbol.get(symbol) ?? [];
    if (matches.length !== 1) {
      return {
        securityId,
        ticker,
        status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
        sourceSymbol: null,
        ric: null,
        companyName: stock.name || null,
        listingDate: null,
        transferOfListingDate: null,
        sourceUrl: null,
        events: [],
        warnings: [matches.length === 0
          ? "Ticker has no verified listing date in the HKEX equity-profile snapshot"
          : `Found ${matches.length} conflicting HKEX equity-profile rows`],
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
      timeZone: "Asia/Hong_Kong",
      exchange: "HKEX",
      venueCity: "Hong Kong",
      venueCountry: "HK",
      evidence: {
        authority: "licensed_market_data",
        sourceName: "HKEX Equities Quote company profile (supplied by Refinitiv)",
        sourceUrl: row.sourceUrl,
        retrievedAt: row.retrievedAt,
        verification: "verified",
        displayRights: "unknown",
      },
      note: `Listing Date displayed on the HKEX-hosted company profile supplied by Refinitiv${row.transferOfListingDate ? `; transfer-of-listing date ${row.transferOfListingDate}` : ""}. Date-only exchange admission; no exact first-trade time is claimed and commercial reuse remains license-gated.`,
    };
    const warnings = (catalogCounts.get(symbol) ?? 0) > 1
      ? [`HKEX code ${symbol} is shared by ${catalogCounts.get(symbol)} catalog aliases; each alias keeps its own security ID pending catalog migration.`]
      : [];
    return {
      securityId,
      ticker,
      status: "matched" as const,
      sourceSymbol: row.symbol,
      ric: row.ric,
      companyName: row.companyName,
      listingDate: row.listingDate,
      transferOfListingDate: row.transferOfListingDate,
      sourceUrl: row.sourceUrl,
      events: [event],
      warnings,
    };
  }).sort((a, b) => a.securityId.localeCompare(b.securityId));
}
