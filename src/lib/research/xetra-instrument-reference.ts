import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";
import type { XetraOfficialDateRecord as XetraPrimaryMarketDateRecord } from "./xetra-primary-market";

export const XETRA_TRADABLE_INSTRUMENTS_PAGE_URL =
  "https://www.cashmarket.deutsche-boerse.com/cash-en/trading/Tradable-Instruments-Xetra";

export type XetraInstrumentReferenceRow = {
  symbol: string;
  isin: string;
  instrumentName: string;
  instrumentType: "CS";
  micCode: "XETR";
  primaryMarketMicCode: string;
  currency: string;
  firstTradingDate: string;
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type XetraInstrumentReferencePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: XetraInstrumentReferenceRow[];
};

export type XetraInstrumentDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  isin: string | null;
  instrumentName: string | null;
  firstTradingDate: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export type XetraCombinedDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceType: "primary_market_history" | "current_instrument_reference" | "none";
  sourceSymbol: string | null;
  isin: string | null;
  companyName: string | null;
  firstTradingDate: string | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
  comparison: {
    primaryMarketDate: string | null;
    instrumentReferenceDate: string | null;
    sourcesAgree: boolean | null;
  };
};

function isoDate(value: string): string | null {
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

export function normalizeXetraInstrumentSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(symbol) ? symbol : "";
}

export function isOfficialXetraInstrumentCsvUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "www.cashmarket.deutsche-boerse.com"
      && /^\/resource\/blob\/\d+\/[a-f0-9]{16,64}\/data\/t7-xetr-allTradableInstruments\.csv$/i.test(url.pathname);
  } catch {
    return false;
  }
}

export function extractXetraInstrumentCsvUrl(html: string): string {
  const decoded = html.replace(/&amp;/g, "&");
  const match = decoded.match(
    /(?:https:\/\/www\.cashmarket\.deutsche-boerse\.com)?\/resource\/blob\/\d+\/[a-f0-9]{16,64}\/data\/t7-xetr-allTradableInstruments\.csv/iu,
  );
  if (!match) throw new Error("Deutsche Börse Xetra page does not expose the All Tradable Instruments CSV");
  const url = new URL(match[0], XETRA_TRADABLE_INSTRUMENTS_PAGE_URL).toString();
  if (!isOfficialXetraInstrumentCsvUrl(url)) throw new Error("Deutsche Börse instrument CSV link is not approved");
  return url;
}

export function parseXetraInstrumentReferencePayload(payload: unknown): XetraInstrumentReferencePayload {
  if (!payload || typeof payload !== "object") throw new Error("Xetra instrument payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("Xetra instrument payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("Xetra instrument payload is missing records");

  const records = input.records.flatMap((value): XetraInstrumentReferenceRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeXetraInstrumentSymbol(String(row.symbol ?? ""));
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const instrumentName = String(row.instrumentName ?? "").replace(/\s+/g, " ").trim();
    const instrumentType = String(row.instrumentType ?? "").trim().toUpperCase();
    const micCode = String(row.micCode ?? "").trim().toUpperCase();
    const primaryMarketMicCode = String(row.primaryMarketMicCode ?? "").trim().toUpperCase();
    const currency = String(row.currency ?? "").trim().toUpperCase();
    const firstTradingDate = isoDate(String(row.firstTradingDate ?? ""));
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!symbol || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !instrumentName
      || instrumentType !== "CS" || micCode !== "XETR" || !/^[A-Z0-9]{4}$/.test(primaryMarketMicCode)
      || !/^[A-Z]{3}$/.test(currency) || !firstTradingDate || !isOfficialXetraInstrumentCsvUrl(sourceUrl)
      || !/^[a-f0-9]{64}$/.test(sourceHash) || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      symbol,
      isin,
      instrumentName,
      instrumentType: "CS",
      micCode: "XETR",
      primaryMarketMicCode,
      currency,
      firstTradingDate,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("Xetra instrument payload contains no valid records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records: [...records].sort((a, b) => a.symbol.localeCompare(b.symbol) || a.isin.localeCompare(b.isin)),
  };
}

function baseRecord(
  stock: Pick<StockEntry, "ticker" | "name">,
  status: XetraInstrumentDateRecord["status"],
): XetraInstrumentDateRecord {
  return {
    securityId: securityIdOf("XETR", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    status,
    sourceSymbol: null,
    isin: null,
    instrumentName: stock.name || null,
    firstTradingDate: null,
    sourceUrl: null,
    events: [],
    warnings: [],
  };
}

export function matchXetraInstrumentDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: XetraInstrumentReferencePayload,
): XetraInstrumentDateRecord[] {
  const bySymbol = new Map<string, XetraInstrumentReferenceRow[]>();
  for (const row of payload.records) {
    const rows = bySymbol.get(row.symbol) ?? [];
    if (!rows.some((item) => item.isin === row.isin && item.firstTradingDate === row.firstTradingDate)) rows.push(row);
    bySymbol.set(row.symbol, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "XETR")
    .map((stock): XetraInstrumentDateRecord => {
      const ticker = normalizeXetraInstrumentSymbol(stock.ticker);
      const empty = baseRecord(stock, "unmatched");
      if (!ticker) {
        return { ...empty, status: "invalid", warnings: ["Catalog ticker does not follow a supported Xetra symbol shape"] };
      }
      empty.ticker = ticker;
      empty.securityId = securityIdOf("XETR", ticker);
      empty.sourceSymbol = ticker;
      const rows = bySymbol.get(ticker) ?? [];
      if (rows.length === 0) {
        return { ...empty, warnings: ["Exact symbol was not found in the active Xetra instrument reference"] };
      }
      const identities = new Set(rows.map((row) => `${row.isin}|${row.firstTradingDate}`));
      if (identities.size !== 1) {
        return {
          ...empty,
          status: "ambiguous",
          warnings: [`Exact active symbol maps to ${identities.size} ISIN/date combinations`],
        };
      }
      const row = rows[0];
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
          sourceName: "Deutsche Börse Xetra All Tradable Instruments reference data",
          sourceUrl: row.sourceUrl,
          retrievedAt: row.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Official First Trading Date for the current active Xetra instrument ${ticker} (${row.isin}); this venue-instrument date is not claimed as the issuer's incorporation date, original IPO date, or exact first-trade time.`,
      };
      return {
        ...empty,
        status: "matched",
        isin: row.isin,
        instrumentName: row.instrumentName,
        firstTradingDate: row.firstTradingDate,
        sourceUrl: row.sourceUrl,
        events: [event],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}

/**
 * Primary Market history is semantically closer to a new-company admission.
 * Use the current instrument reference only as a venue-instrument fallback;
 * do not overwrite an older primary-market event when the dates differ.
 */
export function combineXetraDateRecords(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  primaryMarketRecords: readonly XetraPrimaryMarketDateRecord[],
  instrumentRecords: readonly XetraInstrumentDateRecord[],
): XetraCombinedDateRecord[] {
  const primaryById = new Map(primaryMarketRecords.map((record) => [record.securityId, record]));
  const instrumentById = new Map(instrumentRecords.map((record) => [record.securityId, record]));

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "XETR")
    .map((stock): XetraCombinedDateRecord => {
      const securityId = securityIdOf("XETR", stock.ticker);
      const ticker = stock.ticker.trim().toUpperCase();
      const primary = primaryById.get(securityId);
      const instrument = instrumentById.get(securityId);
      const primaryDate = primary?.status === "matched" ? primary.firstTradingDate : null;
      const instrumentDate = instrument?.status === "matched" ? instrument.firstTradingDate : null;
      const comparison = {
        primaryMarketDate: primaryDate,
        instrumentReferenceDate: instrumentDate,
        sourcesAgree: primaryDate && instrumentDate ? primaryDate === instrumentDate : null,
      };

      if (primary?.status === "matched") {
        const warnings = [...primary.warnings];
        if (instrumentDate && primaryDate === instrumentDate) {
          warnings.push("Primary Market history and current instrument reference agree on the date");
        } else if (instrumentDate) {
          warnings.push(
            `Current instrument reference reports ${instrumentDate}; retained Primary Market history ${primaryDate} because it is closer to the original new-company transaction`,
          );
        }
        return {
          securityId,
          ticker,
          status: "matched",
          sourceType: "primary_market_history",
          sourceSymbol: primary.sourceSymbol,
          isin: primary.isin,
          companyName: primary.companyName,
          firstTradingDate: primary.firstTradingDate,
          sourceUrl: primary.sourceUrl,
          events: primary.events,
          warnings,
          comparison,
        };
      }

      if (instrument?.status === "matched") {
        return {
          securityId,
          ticker,
          status: "matched",
          sourceType: "current_instrument_reference",
          sourceSymbol: instrument.sourceSymbol,
          isin: instrument.isin,
          companyName: instrument.instrumentName,
          firstTradingDate: instrument.firstTradingDate,
          sourceUrl: instrument.sourceUrl,
          events: instrument.events,
          warnings: [
            ...instrument.warnings,
            "Used the current active venue-instrument reference because no conservative Primary Market history match was available",
          ],
          comparison,
        };
      }

      const statuses = [primary?.status, instrument?.status].filter(Boolean);
      const status: XetraCombinedDateRecord["status"] = statuses.includes("ambiguous")
        ? "ambiguous"
        : statuses.includes("invalid")
          ? "invalid"
          : "unmatched";
      return {
        securityId,
        ticker,
        status,
        sourceType: "none",
        sourceSymbol: ticker,
        isin: null,
        companyName: stock.name || null,
        firstTradingDate: null,
        sourceUrl: null,
        events: [],
        warnings: [...(primary?.warnings ?? []), ...(instrument?.warnings ?? [])],
        comparison,
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
