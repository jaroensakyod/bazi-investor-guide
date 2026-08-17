import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const TWSE_COMPANY_BASIC_URL = "https://openapi.twse.com.tw/v1/opendata/t187ap03_L";
export const TWSE_ISIN_QUERY_URL = "https://isin.twse.com.tw/isin/e_class_i.jsp?kind=1";

export type TwseCompanyBasicRow = {
  ticker: string;
  companyName: string;
  shortName: string;
  establishmentRaw: string;
  listingRaw: string;
  foreignRegistration: string;
  isin?: string;
  sourceName?: string;
  sourceUrl?: string;
};

export type TwseOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "invalid";
  companyName: string | null;
  establishmentDate: string | null;
  listingDate: string | null;
  foreignRegistration: string | null;
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

function isoDate(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return match ? compactDate(`${match[1]}${match[2]}${match[3]}`) : null;
}

/**
 * Small, reviewed exact-security rows for instruments omitted by company-level
 * OpenAPI data (for example a listed preferred share). Only TWSE-owned HTTPS
 * evidence is accepted; this is never a provider-date import path.
 */
export function parseTwseOfficialDateSupplements(payload: unknown): TwseCompanyBasicRow[] {
  if (!Array.isArray(payload)) throw new Error("TWSE official date supplements must be an array");
  return payload.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`TWSE supplement row ${index} must be an object`);
    const row = value as Record<string, unknown>;
    const ticker = String(row.ticker ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").trim();
    const isin = String(row.isin ?? "").trim().toUpperCase();
    const listingDate = isoDate(String(row.listingDate ?? ""));
    const sourceName = String(row.sourceName ?? "").trim();
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(sourceUrl);
    } catch {
      throw new Error(`TWSE supplement row ${index} has an invalid sourceUrl`);
    }
    if (
      !/^[0-9A-Z.]{1,16}$/.test(ticker)
      || !companyName
      || !/^TW[A-Z0-9]{10}$/.test(isin)
      || !listingDate
      || !sourceName
      || parsedUrl.protocol !== "https:"
      || !["isin.twse.com.tw", "www.twse.com.tw"].includes(parsedUrl.hostname.toLowerCase())
    ) {
      throw new Error(`TWSE supplement row ${index} is invalid or not backed by an official TWSE HTTPS source`);
    }
    return {
      ticker,
      companyName,
      shortName: companyName,
      establishmentRaw: "",
      listingRaw: listingDate.replaceAll("-", ""),
      foreignRegistration: "",
      isin,
      sourceName,
      sourceUrl: parsedUrl.toString(),
    };
  });
}

export function parseTwseCompanyBasic(payload: unknown): TwseCompanyBasicRow[] {
  if (!Array.isArray(payload)) throw new Error("TWSE company-basic payload must be an array");
  return payload.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const ticker = String(row["公司代號"] ?? "").trim().toUpperCase();
    if (!ticker) return [];
    return [{
      ticker,
      companyName: String(row["公司名稱"] ?? "").trim(),
      shortName: String(row["公司簡稱"] ?? "").trim(),
      establishmentRaw: String(row["成立日期"] ?? "").trim(),
      listingRaw: String(row["上市日期"] ?? "").trim(),
      foreignRegistration: String(row["外國企業註冊地國"] ?? "").trim(),
    }];
  });
}

function incorporationVenue(registration: string): { timeZone: string; country: string } | null {
  const normalized = registration.replace(/\s+/g, "").toUpperCase();
  if (!normalized || normalized === "－" || normalized === "-") return { timeZone: "Asia/Taipei", country: "TW" };
  if (normalized.includes("KY") || normalized.includes("開曼")) return { timeZone: "America/Cayman", country: "KY" };
  return null;
}

export function matchTwseOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  rows: readonly TwseCompanyBasicRow[],
  retrievedAt: string,
): TwseOfficialDateRecord[] {
  const byTicker = new Map<string, TwseCompanyBasicRow[]>();
  for (const row of rows) {
    const current = byTicker.get(row.ticker) ?? [];
    current.push(row);
    byTicker.set(row.ticker, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "TWSE")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const securityId = securityIdOf("TWSE", ticker);
      const matches = byTicker.get(ticker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "invalid" as const,
          companyName: null,
          establishmentDate: null,
          listingDate: null,
          foreignRegistration: null,
          events: [],
          warnings: [matches.length === 0 ? "ไม่พบ ticker ใน TWSE company-basic" : "TWSE คืน ticker ซ้ำ ต้องตรวจด้วยมือ"],
        };
      }

      const row = matches[0];
      const listingDate = compactDate(row.listingRaw);
      const establishmentDate = compactDate(row.establishmentRaw);
      const warnings: string[] = [];
      const events: SecurityEvent[] = [];
      const evidenceSourceName = row.sourceName || "TWSE OpenAPI — Listed Company Basic Information";
      const evidenceSourceUrl = row.sourceUrl || TWSE_COMPANY_BASIC_URL;

      if (listingDate) {
        events.push({
          schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
          securityId,
          kind: "exchange_admission",
          localDate: listingDate,
          localTime: null,
          timePrecision: "unknown",
          timeZone: "Asia/Taipei",
          exchange: "TWSE",
          venueCity: "Taipei",
          venueCountry: "TW",
          evidence: {
            authority: "exchange",
            sourceName: evidenceSourceName,
            sourceUrl: evidenceSourceUrl,
            retrievedAt,
            verification: "verified",
            displayRights: "unknown",
          },
          note: row.isin
            ? `TWSE exact-security ISIN record ${row.isin}; exact first-trade time is not stated.`
            : "TWSE field 上市日期 (listing date); exact first-trade time is not stated.",
        });
      } else {
        warnings.push(`วันที่上市ไม่ถูกต้อง: ${row.listingRaw || "<missing>"}`);
      }

      const originVenue = incorporationVenue(row.foreignRegistration);
      if (establishmentDate && originVenue) {
        events.push({
          schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
          securityId,
          kind: "incorporation",
          localDate: establishmentDate,
          localTime: null,
          timePrecision: "unknown",
          timeZone: originVenue.timeZone,
          venueCountry: originVenue.country,
          evidence: {
            authority: "exchange",
            sourceName: evidenceSourceName,
            sourceUrl: evidenceSourceUrl,
            retrievedAt,
            verification: "verified",
            displayRights: "unknown",
          },
          note: "TWSE field 成立日期 (establishment date); company context only, not the security listing event.",
        });
      } else if (!establishmentDate && row.establishmentRaw) {
        warnings.push(`วันที่ก่อตั้งไม่ถูกต้อง: ${row.establishmentRaw || "<missing>"}`);
      } else {
        warnings.push(`ยังไม่มี timezone mapping สำหรับประเทศจดทะเบียน: ${row.foreignRegistration}`);
      }

      return {
        securityId,
        ticker,
        status: listingDate ? "matched" as const : "invalid" as const,
        companyName: row.companyName || row.shortName || stock.name || null,
        establishmentDate,
        listingDate,
        foreignRegistration: row.foreignRegistration || null,
        events,
        warnings,
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
