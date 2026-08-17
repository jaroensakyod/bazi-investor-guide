import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const SIX_IPO_HISTORY_PAGE_URL = "https://www.six-group.com/en/market-data/shares/ipo-history.html";
export const SIX_IPO_HISTORY_XLS_URL =
  "https://www.six-group.com/en/market-data/shares/ipo-history/_jcr_content/sections/section/content/grid/par0/innerParsys/xlsexporter.iposxls.xls";
export const SIX_SPONSORED_FOREIGN_SHARES_PAGE_URL =
  "https://www.six-group.com/en/market-data/shares/sponsored-foreign-shares.html";
export const SIX_SHARE_EXPLORER_PAGE_URL =
  "https://www.six-group.com/en/market-data/shares/share-explorer.html";
export const SIX_SPONSORED_FOREIGN_SHARES_RECENT_CSV_URL =
  "https://www.six-group.com/fqs/ref.csv?select=ShortName,ValorSymbol,ISIN,GeographicalAreaCode,TradingBaseCurrency,FirstTradingDate&where=ProductLine=PS*PortalSegment=EQ*FirstTradingDate^2026|2025&orderby=FirstTradingDate&page=1&pagesize=999999";
export const SIX_SPONSORED_FOREIGN_SHARES_CSV_URL =
  "https://www.six-group.com/fqs/ref.csv?select=ShortName,ValorSymbol,ISIN,GeographicalAreaCode,TradingBaseCurrency,FirstTradingDate&where=ProductLine=PS*PortalSegment=EQ&orderby=FirstTradingDate&page=1&pagesize=999999";
export const SIX_DOMESTIC_SHARES_CSV_URL =
  "https://www.six-group.com/fqs/ref.csv?select=ShortName,ValorSymbol,ISIN,GeographicalAreaCode,TradingBaseCurrency,FirstTradingDate&where=ProductLine=DS*PortalSegment=EQ&orderby=FirstTradingDate&page=1&pagesize=999999";
export const SIX_BLUE_CHIP_SHARES_CSV_URL =
  "https://www.six-group.com/fqs/ref.csv?select=ShortName,ValorSymbol,ISIN,GeographicalAreaCode,TradingBaseCurrency,FirstTradingDate&where=ProductLine=BC*PortalSegment=EQ&orderby=FirstTradingDate&page=1&pagesize=999999";
export const SIX_FOREIGN_SHARES_CSV_URL =
  "https://www.six-group.com/fqs/ref.csv?select=ShortName,ValorSymbol,ISIN,GeographicalAreaCode,TradingBaseCurrency,FirstTradingDate&where=ProductLine=FS*PortalSegment=EQ&orderby=FirstTradingDate&page=1&pagesize=999999";

export type SixListingSourceType =
  | "ipo_history"
  | "blue_chip_share_reference"
  | "domestic_share_reference"
  | "foreign_share_reference"
  | "sponsored_foreign_share";

export type SixListingDateRow = {
  sourceType: SixListingSourceType;
  symbol: string;
  isin: string;
  companyName: string;
  listingDate: string;
  tradingCurrency: string | null;
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type SixListingDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: SixListingDateRow[];
};

export type SixOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceType: SixListingSourceType | null;
  sourceSymbol: string | null;
  isin: string | null;
  companyName: string | null;
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

export function parseSixListingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const compactMatch = /^(\d{4})(\d{2})(\d{2})$/.exec(normalized);
  if (compactMatch) return isoDate(Number(compactMatch[1]), Number(compactMatch[2]), Number(compactMatch[3]));
  const swissMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(normalized);
  return swissMatch ? isoDate(Number(swissMatch[3]), Number(swissMatch[2]), Number(swissMatch[1])) : null;
}

export function normalizeSixSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol) ? symbol : "";
}

function normalizeCurrency(value: unknown): string | null {
  const currency = String(value ?? "").trim().toUpperCase();
  return currency ? (/^[A-Z]{3}$/.test(currency) ? currency : null) : null;
}

function exactUrl(value: string, expected: string): boolean {
  try {
    return new URL(value).toString() === new URL(expected).toString();
  } catch {
    return false;
  }
}

function validSourceUrl(sourceType: SixListingSourceType, sourceUrl: string): boolean {
  if (sourceType === "ipo_history") return exactUrl(sourceUrl, SIX_IPO_HISTORY_XLS_URL);
  if (sourceType === "blue_chip_share_reference") return exactUrl(sourceUrl, SIX_BLUE_CHIP_SHARES_CSV_URL);
  if (sourceType === "domestic_share_reference") return exactUrl(sourceUrl, SIX_DOMESTIC_SHARES_CSV_URL);
  if (sourceType === "foreign_share_reference") return exactUrl(sourceUrl, SIX_FOREIGN_SHARES_CSV_URL);
  return exactUrl(sourceUrl, SIX_SPONSORED_FOREIGN_SHARES_CSV_URL);
}

export function parseSixListingDatePayload(payload: unknown): SixListingDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("SIX listing-date payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("SIX payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("SIX payload is missing records");
  const records = input.records.flatMap((value): SixListingDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const sourceType = String(row.sourceType ?? "") as SixListingSourceType;
    const symbol = normalizeSixSymbol(String(row.symbol ?? ""));
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const listingDate = parseSixListingDate(row.listingDate);
    const tradingCurrency = normalizeCurrency(row.tradingCurrency);
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!(["ipo_history", "blue_chip_share_reference", "domestic_share_reference", "foreign_share_reference", "sponsored_foreign_share"] as string[]).includes(sourceType)
      || !symbol || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !companyName || !listingDate
      || (sourceType !== "ipo_history" && tradingCurrency === null)
      || !validSourceUrl(sourceType, sourceUrl) || !/^[a-f0-9]{64}$/.test(sourceHash)
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      sourceType,
      symbol,
      isin,
      companyName,
      listingDate,
      tradingCurrency,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("SIX payload contains no valid listing-date records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records: [...records].sort((a, b) =>
      a.symbol.localeCompare(b.symbol) || a.listingDate.localeCompare(b.listingDate),
    ),
  };
}

function uniqueRows(rows: readonly SixListingDateRow[]): SixListingDateRow[] {
  const unique = new Map<string, SixListingDateRow>();
  for (const row of rows) {
    unique.set(`${row.sourceType}\u0000${row.symbol}\u0000${row.tradingCurrency ?? ""}\u0000${row.listingDate}`, row);
  }
  return [...unique.values()];
}

export function matchSixOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name" | "currency">[],
  payload: SixListingDatePayload,
): SixOfficialDateRecord[] {
  const primaryBySymbol = new Map<string, SixListingDateRow[]>();
  const blueChipBySymbol = new Map<string, SixListingDateRow[]>();
  const domesticBySymbol = new Map<string, SixListingDateRow[]>();
  const foreignBySymbol = new Map<string, SixListingDateRow[]>();
  const sponsoredBySymbol = new Map<string, SixListingDateRow[]>();
  for (const row of payload.records) {
    const target = row.sourceType === "ipo_history"
      ? primaryBySymbol
      : row.sourceType === "blue_chip_share_reference"
        ? blueChipBySymbol
        : row.sourceType === "domestic_share_reference"
          ? domesticBySymbol
          : row.sourceType === "foreign_share_reference"
            ? foreignBySymbol
            : sponsoredBySymbol;
    const current = target.get(row.symbol) ?? [];
    current.push(row);
    target.set(row.symbol, current);
  }
  const swxStocks = stocks.filter((stock) => stock.market.trim().toUpperCase() === "SWX");

  return swxStocks.map((stock): SixOfficialDateRecord => {
    const ticker = normalizeSixSymbol(stock.ticker);
    const securityId = securityIdOf("SWX", stock.ticker);
    if (!ticker) {
      return {
        securityId,
        ticker: stock.ticker.trim().toUpperCase(),
        status: "invalid",
        sourceType: null,
        sourceSymbol: null,
        isin: null,
        companyName: stock.name || null,
        listingDate: null,
        sourceUrl: null,
        events: [],
        warnings: ["Catalog ticker does not follow a supported SIX symbol shape"],
      };
    }
    const usdAlias = ticker.endsWith(".USD");
    const sourceSymbol = usdAlias ? ticker.slice(0, -4) : ticker;
    const catalogCurrency = normalizeCurrency(stock.currency);
    const expectedTradingCurrency = usdAlias ? "USD" : catalogCurrency;

    const primary = usdAlias ? [] : uniqueRows(primaryBySymbol.get(ticker) ?? []);
    const referenceRows = (source: Map<string, SixListingDateRow[]>): SixListingDateRow[] =>
      uniqueRows((source.get(sourceSymbol) ?? []).filter((row) =>
        expectedTradingCurrency === null || row.tradingCurrency === expectedTradingCurrency,
      ));
    const blueChip = usdAlias ? [] : referenceRows(blueChipBySymbol);
    const domestic = usdAlias
      ? []
      : referenceRows(domesticBySymbol);
    const foreign = referenceRows(foreignBySymbol);
    const sponsored = referenceRows(sponsoredBySymbol);
    const matches = primary.length > 0
      ? primary
      : blueChip.length > 0
        ? blueChip
        : domestic.length > 0
          ? domestic
          : foreign.length > 0
            ? foreign
            : sponsored;
    const distinctDates = new Set(matches.map((row) => row.listingDate));
    if (matches.length === 0) {
      return {
        securityId,
        ticker,
        status: "unmatched",
        sourceType: null,
        sourceSymbol,
        isin: null,
        companyName: stock.name || null,
        listingDate: null,
        sourceUrl: null,
        events: [],
        warnings: ["Exact SIX symbol and trading currency were not found in IPO History or the current Blue-Chip, Domestic, Foreign, or Sponsored Foreign Shares reference tables"],
      };
    }
    if (distinctDates.size !== 1) {
      return {
        securityId,
        ticker,
        status: "ambiguous",
        sourceType: matches[0].sourceType,
        sourceSymbol,
        isin: null,
        companyName: stock.name || null,
        listingDate: null,
        sourceUrl: null,
        events: [],
        warnings: [`SIX source contains ${distinctDates.size} different dates for exact symbol ${sourceSymbol}`],
      };
    }
    const row = [...matches].sort((a, b) =>
      (a.tradingCurrency === "CHF" ? -1 : 1) - (b.tradingCurrency === "CHF" ? -1 : 1),
    )[0];
    const event: SecurityEvent = {
      schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
      securityId,
      kind: row.sourceType === "ipo_history" ? "exchange_admission" : "first_trading_day",
      localDate: row.listingDate,
      localTime: null,
      timePrecision: "unknown",
      timeZone: "Europe/Zurich",
      exchange: "SIX Swiss Exchange",
      venueCity: "Zurich",
      venueCountry: "CH",
      evidence: {
        authority: "exchange",
        sourceName: row.sourceType === "ipo_history"
          ? "SIX IPO History"
          : row.sourceType === "blue_chip_share_reference"
          ? "SIX Share Explorer Blue-Chip Shares"
            : row.sourceType === "domestic_share_reference"
              ? "SIX Share Explorer Domestic Shares"
            : row.sourceType === "foreign_share_reference"
              ? "SIX Share Explorer Foreign Shares"
              : "SIX Sponsored Foreign Shares",
        sourceUrl: row.sourceUrl,
        retrievedAt: row.retrievedAt,
        verification: "verified",
        displayRights: "unknown",
      },
      note: row.sourceType === "ipo_history"
        ? `Official SIX First Listing Date for exact symbol ${row.symbol}; date-only.`
        : `Official SIX First Trading Date for ${row.sourceType.replaceAll("_", " ")} ${row.symbol} in ${row.tradingCurrency}; date-only.`,
    };
    return {
      securityId,
      ticker,
      status: "matched",
      sourceType: row.sourceType,
      sourceSymbol: row.symbol,
      isin: row.isin,
      companyName: row.companyName,
      listingDate: row.listingDate,
      sourceUrl: row.sourceUrl,
      events: [event],
      warnings: [],
    };
  }).sort((a, b) => a.securityId.localeCompare(b.securityId));
}
