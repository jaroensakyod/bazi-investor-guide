import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const SZSE_SECURITY_LIST_PAGE_URL = "https://www.szse.cn/market/product/stock/list/index.html";
export const SZSE_SECURITY_LIST_API_URL = "https://www.szse.cn/api/report/ShowReport/data";
export const SZSE_SECURITY_LIST_DOWNLOAD_URL =
  "https://www.szse.cn/api/report/ShowReport?SHOWTYPE=xlsx&CATALOGID=1110&TABKEY=tab1";

export type SzseSecurityListTab = "tab1" | "tab2";

export function szseSecurityListApiUrl(pageNo = 1, tabKey: SzseSecurityListTab = "tab1"): string {
  const query = new URLSearchParams({
    SHOWTYPE: "JSON",
    CATALOGID: "1110",
    TABKEY: tabKey,
    PAGENO: String(pageNo),
  });
  return `${SZSE_SECURITY_LIST_API_URL}?${query.toString()}`;
}

export type SzseSecurityListRow = {
  ticker: string;
  listingDate: string;
  board: string;
  shortName: string;
  securityType: "A" | "B";
};

export type SzseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous";
  sourceTicker: string | null;
  companyName: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

function validIsoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}`
    : null;
}

function stripHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeRawRows(rows: readonly unknown[]): SzseSecurityListRow[] {
  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const securityType = String(row.securityType ?? (row.bgdm ? "B" : "A")).toUpperCase() === "B" ? "B" as const : "A" as const;
    const ticker = String(row.ticker ?? row.agdm ?? row.bgdm ?? "").trim().toUpperCase();
    const listingDate = validIsoDate(String(row.listingDate ?? row.agssrq ?? row.bgssrq ?? ""));
    if (!/^\d{6}$/.test(ticker) || !listingDate) return [];
    return [{
      ticker,
      listingDate,
      board: stripHtml(row.board ?? row.bk),
      shortName: stripHtml(row.shortName ?? row.agjc ?? row.bgjc),
      securityType,
    }];
  });
}

/** Accepts a raw ShowReport page, a {pages:[...]} bundle, or the normalized XLSX bridge. */
export function parseSzseSecurityList(payload: unknown): SzseSecurityListRow[] {
  if (Array.isArray(payload)) {
    const reportRows = payload.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const report = value as { metadata?: { tabkey?: unknown }; data?: unknown };
      const tabKey = String(report.metadata?.tabkey ?? "");
      if ((tabKey !== "tab1" && tabKey !== "tab2") || !Array.isArray(report.data)) return [];
      return normalizeRawRows(report.data);
    });
    if (reportRows.length > 0) return reportRows;
    return normalizeRawRows(payload);
  }
  if (!payload || typeof payload !== "object") throw new Error("SZSE security-list payload must be an object or array");
  const object = payload as { pages?: unknown; rows?: unknown };
  if (Array.isArray(object.pages)) return object.pages.flatMap((page) => parseSzseSecurityList(page));
  if (Array.isArray(object.rows)) return normalizeRawRows(object.rows);
  throw new Error("SZSE security-list payload is missing pages/rows or tab1 report data");
}

export function normalizeSzseCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.SZ$/i, "");
}

export function matchSzseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly SzseSecurityListRow[],
  retrievedAt: string,
): SzseOfficialDateRecord[] {
  const byTicker = new Map<string, SzseSecurityListRow[]>();
  for (const row of rows) {
    const current = byTicker.get(row.ticker) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.securityType === row.securityType)) current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "SZSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeSzseCatalogTicker(ticker);
      const securityId = securityIdOf("SZSE", ticker);
      const matches = byTicker.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceTicker: null,
          companyName: stock.name || null,
          listingDate: null,
          events: [],
          warnings: [matches.length === 0
            ? "ไม่พบ ticker ใน SZSE official current list"
            : `พบ ${matches.length} SZSE rows ที่ขัดกัน`],
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
        timeZone: "Asia/Shanghai",
        exchange: "SZSE",
        venueCity: "Shenzhen",
        venueCountry: "CN",
        evidence: {
          authority: "exchange",
          sourceName: `Shenzhen Stock Exchange — ${row.securityType}-share List`,
          sourceUrl: SZSE_SECURITY_LIST_PAGE_URL,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `SZSE official listing date; ${row.securityType}-share${row.board ? `; board ${row.board}` : ""}; exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceTicker: row.ticker,
        companyName: row.shortName || stock.name || null,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
