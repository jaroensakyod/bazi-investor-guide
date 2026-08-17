import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const XETRA_NEW_COMPANIES_PAGE_URL =
  "https://www.cashmarket.deutsche-boerse.com/cash-en/Data-Tech/statistics/New-Companies";
export const XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL =
  "https://www.cashmarket.deutsche-boerse.com/cash-en/Data-Tech/statistics/New-Companies/downloads-primary-market-statistics";

export type XetraTransactionType = "NI" | "LI" | "PP" | "DL" | "TR";

export type XetraPrimaryMarketRow = {
  symbol: string;
  isin: string;
  companyName: string;
  firstTradingDate: string;
  transactionType: XetraTransactionType;
  market: string;
  currentSegment: string;
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type XetraPrimaryMarketPayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: XetraPrimaryMarketRow[];
};

export type XetraOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  isin: string | null;
  companyName: string | null;
  firstTradingDate: string | null;
  transactionTypes: XetraTransactionType[];
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

export function parseXetraFirstTradingDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const sourceMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(normalized);
  return sourceMatch
    ? isoDate(Number(sourceMatch[3]), Number(sourceMatch[2]), Number(sourceMatch[1]))
    : null;
}

export function normalizeXetraSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol) ? symbol : "";
}

const LEGAL_SUFFIXES = new Set([
  "AG",
  "SE",
  "GMBH",
  "KGAA",
  "SA",
  "PLC",
  "LTD",
  "LIMITED",
  "INC",
  "INCORPORATED",
  "CORPORATION",
  "CORP",
  "NV",
  "CO",
]);

/** Conservative legal-name key used only after an exact Deutsche Börse symbol match. */
export function normalizeXetraCompanyName(value: string): string {
  const asciiGerman = value
    .replace(/\bS\.\s*A\./gi, "SA")
    .replace(/\bN\.\s*V\./gi, "NV")
    .replace(/[Ää]/g, "ae")
    .replace(/[Öö]/g, "oe")
    .replace(/[Üü]/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/\bAKTIENGESELLSCHAFT\b/g, "AG")
    .replace(/&/g, " AND ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
  const tokens = asciiGerman ? asciiGerman.split(/\s+/) : [];

  // The official Porsche row uses the registered honorific prefix
  // "Dr. Ing. h.c. F." while the catalog uses the common issuer name.
  const prefix = tokens.slice(0, 5).join(" ");
  if (prefix === "DR ING H C F") tokens.splice(0, 5);
  else if (tokens.slice(0, 4).join(" ") === "DR ING HC F") tokens.splice(0, 4);

  let removedLegalSuffix = false;
  while (tokens.length > 0) {
    const last = tokens[tokens.length - 1];
    if (LEGAL_SUFFIXES.has(last)) {
      tokens.pop();
      removedLegalSuffix = true;
      continue;
    }
    if (removedLegalSuffix && last === "AND") {
      tokens.pop();
      continue;
    }
    break;
  }
  return tokens.join(" ");
}

export function isOfficialXetraPrimaryMarketCsvUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "www.cashmarket.deutsche-boerse.com"
      && /^\/resource\/blob\/\d+\/[a-f0-9]{16,64}\/data\/PM_Statistik_EN\.csv$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function extractXetraPrimaryMarketCsvUrl(html: string): string {
  const decoded = html.replace(/&amp;/g, "&");
  const match = decoded.match(/(?:https:\/\/www\.cashmarket\.deutsche-boerse\.com)?\/resource\/blob\/\d+\/[a-f0-9]{16,64}\/data\/PM_Statistik_EN\.csv/iu);
  if (!match) throw new Error("Deutsche Börse download page does not expose PM_Statistik_EN.csv");
  const url = new URL(match[0], XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL).toString();
  if (!isOfficialXetraPrimaryMarketCsvUrl(url)) throw new Error("Deutsche Börse CSV link is not an approved official URL");
  return url;
}

function validTransactionType(value: string): value is XetraTransactionType {
  return (["NI", "LI", "PP", "DL", "TR"] as string[]).includes(value);
}

export function parseXetraPrimaryMarketPayload(payload: unknown): XetraPrimaryMarketPayload {
  if (!payload || typeof payload !== "object") throw new Error("Xetra primary-market payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("Xetra payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("Xetra payload is missing records");

  const records = input.records.flatMap((value): XetraPrimaryMarketRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeXetraSymbol(String(row.symbol ?? ""));
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const firstTradingDate = parseXetraFirstTradingDate(row.firstTradingDate);
    const transactionType = String(row.transactionType ?? "").trim().toUpperCase();
    const market = String(row.market ?? "").replace(/\s+/g, " ").trim();
    const currentSegment = String(row.currentSegment ?? "").replace(/\s+/g, " ").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!symbol || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !companyName || !normalizeXetraCompanyName(companyName)
      || !firstTradingDate || !validTransactionType(transactionType) || !market || !currentSegment
      || !isOfficialXetraPrimaryMarketCsvUrl(sourceUrl) || !/^[a-f0-9]{64}$/.test(sourceHash)
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      symbol,
      isin,
      companyName,
      firstTradingDate,
      transactionType,
      market,
      currentSegment,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("Xetra payload contains no valid primary-market records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records: [...records].sort((a, b) =>
      a.symbol.localeCompare(b.symbol)
      || a.firstTradingDate.localeCompare(b.firstTradingDate)
      || a.isin.localeCompare(b.isin),
    ),
  };
}

function baseRecord(stock: Pick<StockEntry, "ticker" | "name">, status: XetraOfficialDateRecord["status"]): XetraOfficialDateRecord {
  return {
    securityId: securityIdOf("XETR", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    status,
    sourceSymbol: null,
    isin: null,
    companyName: stock.name || null,
    firstTradingDate: null,
    transactionTypes: [],
    sourceUrl: null,
    events: [],
    warnings: [],
  };
}

export function matchXetraOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: XetraPrimaryMarketPayload,
): XetraOfficialDateRecord[] {
  const bySymbol = new Map<string, XetraPrimaryMarketRow[]>();
  for (const row of payload.records) {
    const rows = bySymbol.get(row.symbol) ?? [];
    if (!rows.some((item) => item.isin === row.isin
      && item.firstTradingDate === row.firstTradingDate
      && item.transactionType === row.transactionType)) {
      rows.push(row);
    }
    bySymbol.set(row.symbol, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "XETR")
    .map((stock): XetraOfficialDateRecord => {
      const ticker = normalizeXetraSymbol(stock.ticker);
      const empty = baseRecord(stock, "unmatched");
      if (!ticker) {
        return {
          ...empty,
          status: "invalid",
          warnings: ["Catalog ticker does not follow a supported Xetra symbol shape"],
        };
      }
      empty.ticker = ticker;
      empty.securityId = securityIdOf("XETR", ticker);
      empty.sourceSymbol = ticker;
      const symbolRows = bySymbol.get(ticker) ?? [];
      if (symbolRows.length === 0) {
        return {
          ...empty,
          warnings: ["Exact symbol was not found in the official Deutsche Börse New Companies history"],
        };
      }

      const catalogName = normalizeXetraCompanyName(stock.name);
      if (!catalogName) {
        return {
          ...empty,
          status: "invalid",
          warnings: ["Catalog company name cannot be normalized safely"],
        };
      }
      const identityRows = symbolRows.filter((row) => normalizeXetraCompanyName(row.companyName) === catalogName);
      if (identityRows.length === 0) {
        return {
          ...empty,
          warnings: ["Symbol exists in the official history, but the legal-name identity differs; the ticker may have been reused"],
        };
      }

      const isins = [...new Set(identityRows.map((row) => row.isin))];
      if (isins.length !== 1) {
        return {
          ...empty,
          status: "ambiguous",
          warnings: [`Exact symbol and normalized company name map to ${isins.length} different ISINs`],
        };
      }

      const rows = identityRows
        .filter((row) => row.isin === isins[0])
        .sort((a, b) => a.firstTradingDate.localeCompare(b.firstTradingDate));
      const row = rows[0];
      const transactionTypes = [...new Set(rows.map((item) => item.transactionType))].sort();
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: empty.securityId,
        kind: "first_trading_day",
        localDate: row.firstTradingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Europe/Berlin",
        exchange: "Frankfurt Stock Exchange (FWB/Xetra)",
        venueCity: "Frankfurt",
        venueCountry: "DE",
        evidence: {
          authority: "exchange",
          sourceName: "Deutsche Börse New Companies / Primary Market Statistics",
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Official Deutsche Börse First Trading Day for exact symbol ${ticker}, exact normalized issuer name and ISIN ${row.isin}; earliest matching transaction (${transactionTypes.join(", ")}), date-only.`,
      };
      return {
        ...empty,
        status: "matched",
        isin: row.isin,
        companyName: row.companyName,
        firstTradingDate: row.firstTradingDate,
        transactionTypes,
        sourceUrl: row.sourceUrl,
        events: [event],
        warnings: rows.length > 1
          ? [`Selected the earliest of ${rows.length} official transactions for the same symbol, normalized issuer name and ISIN`]
          : [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
