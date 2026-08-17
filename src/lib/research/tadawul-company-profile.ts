import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const TADAWUL_ISSUER_DIRECTORY_URL = "https://www.saudiexchange.sa/wps/portal/saudiexchange/trading/participants-directory/issuer-directory?locale=en";
export const TADAWUL_COMPANY_PROFILE_BASE_URL = "https://www.saudiexchange.sa/wps/portal/saudiexchange/hidden/company-profile-main/!ut/p/z1/04_Sj9CPykssy0xPLMnMz0vMAfIjo8ziTR3NDIw8LAz83d2MXA0C3SydAl1c3Q0NvE30I4EKzBEKDMKcTQzMDPxN3H19LAzdTU31w8syU8v1wwkpK8hOMgUA-oskdg!!/";

export type TadawulCompanyDateRow = {
  symbol: string;
  name: string;
  listingDate: string | null;
  establishedDate: string | null;
  isin: string;
};

export type TadawulCompanyDatePayload = {
  retrievedAt: string;
  records: TadawulCompanyDateRow[];
};

export type TadawulOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceSymbol: string | null;
  companyName: string | null;
  isin: string | null;
  listingDate: string | null;
  establishedDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function tadawulCompanyProfileUrl(symbol: string): string {
  const query = new URLSearchParams({ companySymbol: symbol.trim() });
  return `${TADAWUL_COMPANY_PROFILE_BASE_URL}?${query.toString()}`;
}

export function parseTadawulProfileDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})\/(\d{2})\/(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

export function parseTadawulCompanyDatePayload(payload: unknown): TadawulCompanyDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("Saudi Exchange profile payload must be an object");
  const input = payload as { retrievedAt?: unknown; records?: unknown };
  if (typeof input.retrievedAt !== "string" || !Number.isFinite(Date.parse(input.retrievedAt))) {
    throw new Error("Saudi Exchange profile payload has an invalid retrievedAt");
  }
  if (!Array.isArray(input.records)) throw new Error("Saudi Exchange profile payload is missing records");
  const records = input.records.flatMap((value): TadawulCompanyDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = String(row.symbol ?? "").trim().toUpperCase();
    const isin = String(row.isin ?? "").trim().toUpperCase();
    if (!/^\d{4}$/.test(symbol) || !/^[A-Z0-9]{12}$/.test(isin)) return [];
    return [{
      symbol,
      name: String(row.name ?? "").trim(),
      listingDate: parseTadawulProfileDate(row.listingDate),
      establishedDate: parseTadawulProfileDate(row.establishedDate),
      isin,
    }];
  });
  if (records.length === 0) throw new Error("Saudi Exchange profile payload contains no valid records");
  return { retrievedAt: new Date(input.retrievedAt).toISOString(), records };
}

export function matchTadawulOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: TadawulCompanyDatePayload,
): TadawulOfficialDateRecord[] {
  const bySymbol = new Map<string, TadawulCompanyDateRow[]>();
  for (const row of payload.records) {
    const current = bySymbol.get(row.symbol) ?? [];
    if (!current.some((item) => item.isin === row.isin && item.listingDate === row.listingDate)) current.push(row);
    bySymbol.set(row.symbol, current);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "TADAWUL")
    .map((stock) => {
      const ticker = stock.ticker.trim().toUpperCase();
      const securityId = securityIdOf("TADAWUL", ticker);
      const matches = bySymbol.get(ticker) ?? [];
      if (matches.length !== 1) {
        return {
          securityId,
          ticker,
          status: matches.length === 0 ? "unmatched" as const : "ambiguous" as const,
          sourceSymbol: null,
          companyName: stock.name || null,
          isin: null,
          listingDate: null,
          establishedDate: null,
          events: [],
          warnings: [matches.length === 0
            ? "Symbol not found in the Saudi Exchange profile snapshot"
            : `Found ${matches.length} conflicting Saudi Exchange profile rows`],
        };
      }

      const row = matches[0];
      const evidence = {
        authority: "exchange" as const,
        sourceName: "Saudi Exchange Company Profile",
        sourceUrl: tadawulCompanyProfileUrl(row.symbol),
        retrievedAt: payload.retrievedAt,
        verification: "verified" as const,
        displayRights: "unknown" as const,
      };
      const events: SecurityEvent[] = [];
      if (row.listingDate) {
        events.push({
          schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
          securityId,
          kind: "exchange_admission",
          localDate: row.listingDate,
          localTime: null,
          timePrecision: "unknown",
          timeZone: "Asia/Riyadh",
          exchange: "TADAWUL",
          venueCity: "Riyadh",
          venueCountry: "SA",
          evidence,
          note: "Saudi Exchange official Listing Date; exact first-trade time is not stated.",
        });
      }
      if (row.establishedDate) {
        events.push({
          schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
          securityId,
          kind: "incorporation",
          localDate: row.establishedDate,
          localTime: null,
          timePrecision: "unknown",
          timeZone: "Asia/Riyadh",
          venueCountry: "SA",
          evidence,
          note: "Saudi Exchange official Date Established; company context only, not the security listing event.",
        });
      }
      return {
        securityId,
        ticker,
        status: row.listingDate ? "matched" as const : "invalid" as const,
        sourceSymbol: row.symbol,
        companyName: row.name || stock.name || null,
        isin: row.isin,
        listingDate: row.listingDate,
        establishedDate: row.establishedDate,
        events,
        warnings: row.listingDate ? [] : ["Saudi Exchange profile displays no usable Listing Date"],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
