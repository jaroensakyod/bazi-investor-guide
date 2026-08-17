import { z } from "zod";
import type { StockEntry } from "../investor/stock-database";
import {
  SECURITY_EVENT_SCHEMA_VERSION,
  securityIdOf,
  type SecurityEvent,
} from "./security-birth";

export const BURSA_ISIN_EQUITY_PDF_URL =
  "https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/assets/6814a336e6414a4b168c007b/isinequity_as_of__30_Aor_2025.pdf";

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

function isOfficialBursaIsinEquityUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const fileName = url.pathname.split("/").pop() ?? "";
    return url.protocol === "https:"
      && url.hostname === "www.bursamalaysia.com"
      && /\/sites\/[^/]+\/assets\/[^/]+\//.test(url.pathname)
      && /^isinequity.*\.pdf$/i.test(fileName);
  } catch {
    return false;
  }
}

const isoDateSchema = z.string().refine(isIsoDate, "Expected a real ISO calendar date");
const recordSchema = z.object({
  number: z.number().int().positive(),
  stockNameLong: z.string().trim().min(1),
  stockNameShort: z.string().trim().min(1).max(40),
  isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/),
  issueDescription: z.string().trim().min(1),
  listingDate: isoDateSchema,
  maturityDate: isoDateSchema.nullable(),
});

const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  retrievedAt: z.iso.datetime({ offset: true }),
  sourceAsOf: isoDateSchema,
  sourceName: z.literal("Bursa Malaysia ISIN Equity"),
  sourceUrl: z.string().refine(isOfficialBursaIsinEquityUrl, "Expected an official Bursa ISIN Equity PDF URL"),
  pdfSha256: z.string().regex(/^[a-f0-9]{64}$/),
  pageCount: z.number().int().positive(),
  records: z.array(recordSchema).min(1),
});

export type BursaIsinEquityRecord = z.infer<typeof recordSchema>;
export type BursaIsinEquitySnapshot = z.infer<typeof snapshotSchema>;
export type BursaListingMatch = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  stockNameLong: string | null;
  isin: string | null;
  listingDate: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

export function parseBursaIsinEquitySnapshot(value: unknown): BursaIsinEquitySnapshot {
  return snapshotSchema.parse(value);
}

export function normalizeBursaTicker(value: string): string {
  const ticker = value.trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9&+._/-]{0,39}$/.test(ticker) ? ticker : "";
}

function emptyMatch(
  stock: Pick<StockEntry, "ticker">,
  status: BursaListingMatch["status"],
  warning: string,
): BursaListingMatch {
  const ticker = normalizeBursaTicker(stock.ticker);
  const fallbackTicker = stock.ticker.trim().toUpperCase() || "INVALID";
  return {
    securityId: securityIdOf("BURSA", ticker || fallbackTicker),
    ticker: ticker || fallbackTicker,
    status,
    stockNameLong: null,
    isin: null,
    listingDate: null,
    events: [],
    warnings: [warning],
  };
}

export function matchBursaListingDates(
  stocks: readonly Pick<StockEntry, "ticker" | "name" | "market">[],
  snapshot: BursaIsinEquitySnapshot,
): BursaListingMatch[] {
  const rowsByTicker = new Map<string, BursaIsinEquityRecord[]>();
  for (const row of snapshot.records) {
    const ticker = normalizeBursaTicker(row.stockNameShort);
    if (!ticker) continue;
    const rows = rowsByTicker.get(ticker) ?? [];
    if (!rows.some((candidate) => candidate.isin === row.isin && candidate.listingDate === row.listingDate)) {
      rows.push(row);
    }
    rowsByTicker.set(ticker, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "BURSA")
    .map((stock): BursaListingMatch => {
      const ticker = normalizeBursaTicker(stock.ticker);
      if (!ticker) return emptyMatch(stock, "invalid", "Catalog ticker is not a supported Bursa short name");
      const rows = rowsByTicker.get(ticker) ?? [];
      if (rows.length === 0) {
        return emptyMatch(
          stock,
          "unmatched",
          "Exact catalog ticker was not found in the official Bursa Stock Name (Short) column",
        );
      }
      if (rows.length !== 1) {
        return emptyMatch(
          stock,
          "ambiguous",
          `Official Bursa PDF maps ${ticker} to ${rows.length} distinct ISIN/date records`,
        );
      }
      const row = rows[0];
      const event: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: securityIdOf("BURSA", ticker),
        kind: "exchange_admission",
        localDate: row.listingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Asia/Kuala_Lumpur",
        exchange: "Bursa Malaysia",
        venueCity: "Kuala Lumpur",
        venueCountry: "MY",
        evidence: {
          authority: "exchange",
          sourceName: snapshot.sourceName,
          sourceUrl: snapshot.sourceUrl,
          retrievedAt: snapshot.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
        },
        note: `Official Bursa Listing Date for exact Stock Name (Short) ${ticker} and ISIN ${row.isin}; date-only, not an exact first-trade time.`,
      };
      return {
        securityId: event.securityId,
        ticker,
        status: "matched",
        stockNameLong: row.stockNameLong,
        isin: row.isin,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
