import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const SSE_SECURITY_LIST_PAGE_URL = "https://www.sse.com.cn/assortment/stock/list/share/";
export const SSE_SECURITY_LIST_API_URL = "https://query.sse.com.cn/sseQuery/commonQuery.do";

export function sseSecurityListApiUrl(stockType: "1" | "2" | "8"): string {
  const query = new URLSearchParams({
    STOCK_TYPE: stockType,
    REG_PROVINCE: "",
    CSRC_CODE: "",
    STOCK_CODE: "",
    sqlId: "COMMON_SSE_CP_GPJCTPZ_GPLB_GP_L",
    COMPANY_STATUS: "2,4,5,7,8",
    type: "inParams",
    isPagination: "true",
    "pageHelp.cacheSize": "1",
    "pageHelp.beginPage": "1",
    "pageHelp.pageSize": "3000",
    "pageHelp.pageNo": "1",
  });
  return `${SSE_SECURITY_LIST_API_URL}?${query.toString()}`;
}

export type SseSecurityListRow = {
  ticker: string;
  companyCode: string;
  companyName: string;
  companyNameEnglish: string;
  stockType: string;
  listingDate: string;
};

export type SseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  normalizedTicker: string;
  status: "matched" | "unmatched" | "ambiguous";
  sourceTicker: string | null;
  companyName: string | null;
  listingDate: string | null;
  catalogMigrationHint: "SZSE" | null;
  events: SecurityEvent[];
  warnings: string[];
};

function compactDate(value: string): string | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return date.getUTCFullYear() === Number(year) && date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day)
    ? `${year}-${month}-${day}`
    : null;
}

export function normalizeSseCatalogTicker(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/\.SS$/i, "");
}

export function parseSseSecurityList(payload: unknown): SseSecurityListRow[] {
  if (!payload || typeof payload !== "object") throw new Error("SSE security-list payload must be an object");
  const data = payload as { result?: unknown; pageHelp?: { data?: unknown } };
  const rawRows = Array.isArray(data.result) ? data.result : Array.isArray(data.pageHelp?.data) ? data.pageHelp?.data : null;
  if (!rawRows) throw new Error("SSE security-list payload is missing result/pageHelp.data");
  return rawRows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const stockType = String(row.STOCK_TYPE ?? "").trim();
    const ticker = String(stockType === "2" ? row.B_STOCK_CODE : row.A_STOCK_CODE ?? "").trim().toUpperCase();
    const listingDate = compactDate(String(row.LIST_DATE ?? ""));
    if (!ticker || ticker === "-" || !listingDate) return [];
    return [{
      ticker,
      companyCode: String(row.COMPANY_CODE ?? "").trim(),
      companyName: String(row.FULL_NAME ?? row.SEC_NAME_CN ?? "").trim(),
      companyNameEnglish: String(row.FULL_NAME_IN_ENGLISH ?? "").trim(),
      stockType,
      listingDate,
    }];
  });
}

export function matchSseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly SseSecurityListRow[],
  retrievedAt: string,
): SseOfficialDateRecord[] {
  const byTicker = new Map<string, SseSecurityListRow[]>();
  for (const row of rows) {
    const current = byTicker.get(row.ticker) ?? [];
    if (!current.some((item) => item.listingDate === row.listingDate && item.companyCode === row.companyCode)) current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "SSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const normalizedTicker = normalizeSseCatalogTicker(ticker);
      const securityId = securityIdOf("SSE", ticker);
      const matches = byTicker.get(normalizedTicker) ?? [];
      if (matches.length !== 1) {
        const catalogMigrationHint = /^00|^30/.test(normalizedTicker) ? "SZSE" as const : null;
        return {
          securityId,
          ticker,
          normalizedTicker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceTicker: null,
          companyName: stock.name || null,
          listingDate: null,
          catalogMigrationHint,
          events: [],
          warnings: [
            matches.length === 0 ? "ไม่พบ ticker ใน SSE official current list" : `พบ ${matches.length} SSE rows ที่ขัดกัน`,
            ...(catalogMigrationHint ? ["ticker prefix ชี้ไป SZSE; ต้อง migrate catalog ก่อนผูก event"] : []),
          ],
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
        exchange: "SSE",
        venueCity: "Shanghai",
        venueCountry: "CN",
        evidence: {
          authority: "exchange",
          sourceName: "Shanghai Stock Exchange — Stocks and Depository Receipts",
          sourceUrl: SSE_SECURITY_LIST_PAGE_URL,
          retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `SSE official LIST_DATE; stock type ${row.stockType}; exact first-trade time is not stated.`,
      };
      return {
        securityId,
        ticker,
        normalizedTicker,
        status: "matched" as const,
        sourceTicker: row.ticker,
        companyName: row.companyNameEnglish || row.companyName || stock.name || null,
        listingDate: row.listingDate,
        catalogMigrationHint: null,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
