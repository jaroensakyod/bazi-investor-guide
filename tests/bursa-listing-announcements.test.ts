import { describe, expect, it } from "vitest";
import {
  BURSA_ISIN_EQUITY_PDF_URL,
  parseBursaIsinEquitySnapshot,
} from "../src/lib/research/bursa-isin-equity";
import {
  matchBursaListingAnnouncements,
  parseBursaListingAnnouncementSnapshot,
} from "../src/lib/research/bursa-listing-announcements";

const ANNOUNCEMENT_URL =
  "https://www.bursamalaysia.com/market_information/announcements/company_announcement/announcement_details?ann_id=1234567";

function isinSnapshot() {
  return parseBursaIsinEquitySnapshot({
    schemaVersion: 1,
    generatedAt: "2026-08-09T10:00:00.000Z",
    retrievedAt: "2026-08-09T10:00:00.000Z",
    sourceAsOf: "2025-04-30",
    sourceName: "Bursa Malaysia ISIN Equity",
    sourceUrl: BURSA_ISIN_EQUITY_PDF_URL,
    pdfSha256: "a".repeat(64),
    pageCount: 66,
    records: [{
      number: 1,
      stockNameLong: "AIRASIA X BERHAD",
      stockNameShort: "AAX",
      isin: "MYL5238OO000",
      issueDescription: "ORDINARY SHARE",
      listingDate: "2013-07-10",
      maturityDate: null,
    }],
  });
}

function announcementSnapshot() {
  return parseBursaListingAnnouncementSnapshot({
    schemaVersion: 1,
    generatedAt: "2026-08-09T11:00:00.000Z",
    retrievedAt: "2026-08-09T11:00:00.000Z",
    sourceName: "Bursa Malaysia Company Announcements",
    records: [{
      ticker: "ECOSHOP",
      companyName: "ECO-SHOP MARKETING BERHAD",
      stockCode: "5337",
      isin: "MYL5337OO000",
      listingDate: "2025-05-23",
      announcedAt: "2025-05-22",
      referenceNumber: "IO2-22052025-00001",
      announcementUrl: ANNOUNCEMENT_URL,
    }],
    tickerAliases: [{
      ticker: "AAGB",
      companyName: "AIRASIA GROUP BERHAD",
      previousTicker: "AAX",
      previousCompanyName: "AIRASIA X BERHAD",
      stockCode: "5238",
      effectiveDate: "2026-07-14",
      announcedAt: "2026-07-13",
      referenceNumber: "ILC-10072026-00001",
      announcementUrl: ANNOUNCEMENT_URL,
    }],
  });
}

describe("Bursa official listing announcements", () => {
  it("promotes a direct IPO announcement only for the exact current ticker", () => {
    const matches = matchBursaListingAnnouncements(
      [{ ticker: "ECOSHOP", name: "Eco-Shop", market: "BURSA" }],
      announcementSnapshot(),
      isinSnapshot(),
    );
    expect(matches[0]).toMatchObject({
      securityId: "BURSA:ECOSHOP",
      status: "matched",
      listingDate: "2025-05-23",
      isin: "MYL5337OO000",
    });
    expect(matches[0].events[0].evidence.sourceUrl).toBe(ANNOUNCEMENT_URL);
  });

  it("carries the original date across a ticker rename only with both official sources", () => {
    const matches = matchBursaListingAnnouncements(
      [{ ticker: "AAGB", name: "AirAsia Group", market: "BURSA" }],
      announcementSnapshot(),
      isinSnapshot(),
    );
    expect(matches[0]).toMatchObject({
      securityId: "BURSA:AAGB",
      status: "matched",
      listingDate: "2013-07-10",
      isin: "MYL5238OO000",
    });
    expect(matches[0].events[0].evidence.sourceUrl).toBe(BURSA_ISIN_EQUITY_PDF_URL);
    expect(matches[0].events[0].evidence.supportingSources).toEqual([
      expect.objectContaining({ sourceUrl: ANNOUNCEMENT_URL, authority: "exchange" }),
    ]);
  });

  it("does not carry an alias when the previous ticker is absent from the official ISIN snapshot", () => {
    const announcements = parseBursaListingAnnouncementSnapshot({
      ...announcementSnapshot(),
      tickerAliases: [{
        ...announcementSnapshot().tickerAliases[0],
        previousTicker: "MISSING",
      }],
    });
    const [match] = matchBursaListingAnnouncements(
      [{ ticker: "AAGB", name: "AirAsia Group", market: "BURSA" }],
      announcements,
      isinSnapshot(),
    );
    expect(match.status).toBe("unmatched");
    expect(match.events).toEqual([]);
  });

  it("rejects duplicate current tickers and non-Bursa announcement URLs", () => {
    expect(() => parseBursaListingAnnouncementSnapshot({
      ...announcementSnapshot(),
      tickerAliases: [{
        ...announcementSnapshot().tickerAliases[0],
        ticker: "ECOSHOP",
      }],
    })).toThrow();
    expect(() => parseBursaListingAnnouncementSnapshot({
      ...announcementSnapshot(),
      records: [{
        ...announcementSnapshot().records[0],
        announcementUrl: "https://example.com/announcement",
      }],
    })).toThrow();
  });
});
