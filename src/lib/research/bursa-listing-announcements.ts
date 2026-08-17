import { z } from "zod";
import type { StockEntry } from "../investor/stock-database";
import {
  type BursaIsinEquitySnapshot,
  type BursaListingMatch,
  normalizeBursaTicker,
} from "./bursa-isin-equity";
import {
  SECURITY_EVENT_SCHEMA_VERSION,
  securityIdOf,
  type SecurityEvent,
} from "./security-birth";

const ANNOUNCEMENT_BASE_URL =
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details";

function isIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

function isOfficialAnnouncementUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}` === ANNOUNCEMENT_BASE_URL
      && /^\d+$/.test(url.searchParams.get("ann_id") ?? "");
  } catch {
    return false;
  }
}

const isoDateSchema = z.string().refine(isIsoDate, "Expected a real ISO calendar date");
const announcementUrlSchema = z.string().refine(isOfficialAnnouncementUrl, "Expected an official Bursa announcement URL");
const commonSchema = z.object({
  ticker: z.string().trim().min(1).max(40),
  companyName: z.string().trim().min(1),
  stockCode: z.string().regex(/^\d{4}$/),
  announcedAt: isoDateSchema,
  referenceNumber: z.string().trim().min(1),
  announcementUrl: announcementUrlSchema,
});
const directRecordSchema = commonSchema.extend({
  isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{9}\d$/),
  listingDate: isoDateSchema,
});
const aliasRecordSchema = commonSchema.extend({
  previousTicker: z.string().trim().min(1).max(40),
  previousCompanyName: z.string().trim().min(1),
  effectiveDate: isoDateSchema,
});
const snapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime({ offset: true }),
  retrievedAt: z.iso.datetime({ offset: true }),
  sourceName: z.literal("Bursa Malaysia Company Announcements"),
  records: z.array(directRecordSchema),
  tickerAliases: z.array(aliasRecordSchema),
});

export type BursaListingAnnouncementSnapshot = z.infer<typeof snapshotSchema>;

export function parseBursaListingAnnouncementSnapshot(value: unknown): BursaListingAnnouncementSnapshot {
  const parsed = snapshotSchema.parse(value);
  const tickers = [...parsed.records.map((record) => record.ticker), ...parsed.tickerAliases.map((record) => record.ticker)]
    .map(normalizeBursaTicker);
  if (tickers.some((ticker) => !ticker) || new Set(tickers).size !== tickers.length) {
    throw new Error("Bursa supplemental snapshot contains an invalid or duplicate current ticker");
  }
  return parsed;
}

function directEvent(
  record: BursaListingAnnouncementSnapshot["records"][number],
  snapshot: BursaListingAnnouncementSnapshot,
): SecurityEvent {
  const ticker = normalizeBursaTicker(record.ticker);
  return {
    schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
    securityId: securityIdOf("BURSA", ticker),
    kind: "exchange_admission",
    localDate: record.listingDate,
    localTime: null,
    timePrecision: "unknown",
    timeZone: "Asia/Kuala_Lumpur",
    exchange: "Bursa Malaysia",
    venueCity: "Kuala Lumpur",
    venueCountry: "MY",
    evidence: {
      authority: "exchange",
      sourceName: `${snapshot.sourceName} · ${record.referenceNumber}`,
      sourceUrl: record.announcementUrl,
      retrievedAt: snapshot.retrievedAt,
      verification: "verified",
      displayRights: "unknown",
    },
    note: `Official Bursa Date of Listing for exact Stock Name ${ticker}, stock code ${record.stockCode}, and ISIN ${record.isin}; date-only.`,
  };
}

export function matchBursaListingAnnouncements(
  stocks: readonly Pick<StockEntry, "ticker" | "name" | "market">[],
  announcements: BursaListingAnnouncementSnapshot,
  isinSnapshot: BursaIsinEquitySnapshot,
): BursaListingMatch[] {
  const directByTicker = new Map(
    announcements.records.map((record) => [normalizeBursaTicker(record.ticker), record]),
  );
  const aliasByTicker = new Map(
    announcements.tickerAliases.map((record) => [normalizeBursaTicker(record.ticker), record]),
  );
  const isinByTicker = new Map<string, BursaIsinEquitySnapshot["records"]>();
  for (const row of isinSnapshot.records) {
    const ticker = normalizeBursaTicker(row.stockNameShort);
    if (!ticker) continue;
    const rows = isinByTicker.get(ticker) ?? [];
    rows.push(row);
    isinByTicker.set(ticker, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "BURSA")
    .flatMap((stock): BursaListingMatch[] => {
      const ticker = normalizeBursaTicker(stock.ticker);
      if (!ticker) return [];
      const direct = directByTicker.get(ticker);
      if (direct) {
        const event = directEvent(direct, announcements);
        return [{
          securityId: event.securityId,
          ticker,
          status: "matched",
          stockNameLong: direct.companyName,
          isin: direct.isin,
          listingDate: direct.listingDate,
          events: [event],
          warnings: [],
        }];
      }
      const alias = aliasByTicker.get(ticker);
      if (!alias) return [];
      const previousTicker = normalizeBursaTicker(alias.previousTicker);
      const rows = isinByTicker.get(previousTicker) ?? [];
      if (rows.length !== 1) {
        return [{
          securityId: securityIdOf("BURSA", ticker),
          ticker,
          status: rows.length === 0 ? "unmatched" : "ambiguous",
          stockNameLong: alias.companyName,
          isin: null,
          listingDate: null,
          events: [],
          warnings: [`Ticker alias ${previousTicker} resolves to ${rows.length} Bursa ISIN rows`],
        }];
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
          sourceName: isinSnapshot.sourceName,
          sourceUrl: isinSnapshot.sourceUrl,
          retrievedAt: isinSnapshot.retrievedAt,
          verification: "verified",
          displayRights: "unknown",
          supportingSources: [{
            authority: "exchange",
            sourceName: `Bursa Malaysia Listing Circular · ${alias.referenceNumber}`,
            sourceUrl: alias.announcementUrl,
            retrievedAt: announcements.retrievedAt,
            verification: "verified",
            displayRights: "unknown",
          }],
        },
        note: `Original official Listing Date for ${previousTicker}, carried to current ticker ${ticker} only because Bursa's listing circular confirms the old and new stock short names and that stock code ${alias.stockCode} remains unchanged; effective ${alias.effectiveDate}.`,
      };
      return [{
        securityId: event.securityId,
        ticker,
        status: "matched",
        stockNameLong: alias.companyName,
        isin: row.isin,
        listingDate: row.listingDate,
        events: [event],
        warnings: [],
      }];
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
