import { describe, expect, it } from "vitest";
import {
  PSX_CURRENT_LISTINGS_URL,
  PSX_LISTING_HISTORY_ARCHIVE_URLS,
  matchPsxOfficialDates,
  normalizePsxCompanyName,
  parsePsxCompanyProfileListingEvidence,
  parsePsxCurrentListingsHtml,
  parsePsxListingDate,
  parsePsxListingDatePayload,
  psxCompanyProfileUrl,
} from "../src/lib/research/psx-listing-history";

const HASH = "a".repeat(64);
const RETRIEVED_AT = "2026-08-09T06:00:00.000Z";

function historyRow(
  year: number,
  companyName: string,
  listingDate: string,
  symbol: string | null = null,
) {
  return {
    sourceType: "annual_listing_history" as const,
    year,
    companyName,
    symbol,
    listingDate,
    evidenceExcerpt: null,
    sourceUrl: PSX_LISTING_HISTORY_ARCHIVE_URLS[year],
    sourceHash: HASH,
    retrievedAt: RETRIEVED_AT,
  };
}

function payload() {
  return parsePsxListingDatePayload({
    retrievedAt: RETRIEVED_AT,
    sourceRowCount: 6,
    directorySourceUrl: PSX_CURRENT_LISTINGS_URL,
    directorySourceHash: HASH,
    directoryRows: [
      { symbol: "AGP", name: "AGP Limited", sector: "PHARMACEUTICALS" },
      { symbol: "OGDC", name: "Oil & Gas Development Company Limited", sector: "OIL & GAS" },
      { symbol: "AHCL", name: "Arif Habib Corporation Limited", sector: "FERTILIZER" },
      { symbol: "TEST", name: "Test Industries Limited", sector: "ENGINEERING" },
      { symbol: "IMS", name: "Intermarket Securities Limited", sector: "INV. BANKS" },
    ],
    records: [
      historyRow(2018, "AGP Limited", "2018-03-05", "AGP"),
      historyRow(2004, "Oil and Gas Development Co. Ltd.", "2004-01-19"),
      historyRow(2007, "Arif Habib Limited", "2007-01-31"),
      historyRow(2008, "Test Industry Limited", "2008-01-01"),
      historyRow(2009, "Test Industries Ltd", "2009-01-01"),
      {
        sourceType: "company_profile",
        year: 2008,
        companyName: "Intermarket Securities Limited",
        symbol: "IMS",
        listingDate: "2008-03-20",
        evidenceExcerpt: "Effective from March 20, 2008 the Company was listed on the Pakistan Stock Exchange Limited.",
        sourceUrl: psxCompanyProfileUrl("IMS"),
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  });
}

describe("Pakistan Stock Exchange listing history", () => {
  it("parses official date formats without inventing time", () => {
    expect(parsePsxListingDate("05/03/2018")).toBe("2018-03-05");
    expect(parsePsxListingDate("19-Jan-04")).toBe("2004-01-19");
    expect(parsePsxListingDate("March 20, 2008")).toBe("2008-03-20");
    expect(parsePsxListingDate("27 June 1970")).toBe("1970-06-27");
    expect(parsePsxListingDate("31/02/2024")).toBeNull();
  });

  it("extracts only explicit day-precision profile listing statements", () => {
    const page = (symbol: string, description: string) =>
      `<title>${symbol} - Stock quote for Test - Pakistan Stock Exchange (PSX)</title><h3>BUSINESS DESCRIPTION</h3><div><p>${description}</p></div>`;
    expect(parsePsxCompanyProfileListingEvidence(page(
      "IMS",
      "Effective from March 20, 2008 the Company was listed on the Pakistan Stock Exchange Limited.",
    ), "IMS")).toMatchObject({ symbol: "IMS", listingDate: "2008-03-20" });
    expect(parsePsxCompanyProfileListingEvidence(page(
      "SRVI",
      "The Company was converted into a public limited Company and got listed on 27 June 1970.",
    ), "SRVI")).toMatchObject({ symbol: "SRVI", listingDate: "1970-06-27" });
    expect(parsePsxCompanyProfileListingEvidence(page(
      "HALEON",
      "The Company was incorporated as a public listed company under the Companies Ordinance on 31 March 2015.",
    ), "HALEON")).toBeNull();
    expect(parsePsxCompanyProfileListingEvidence(page(
      "HINOON",
      "Its shares are quoted on Pakistan Stock Exchange since November 1994.",
    ), "HINOON")).toBeNull();
  });

  it("parses exact identities from the current official listing table", () => {
    const html = '<table><tr><td><a class="tbl__symbol" href="/company/OGDC" data-title="Oil &amp; Gas Development Company Limited"><strong>OGDC</strong></a></td><td>Oil &amp; Gas Development Company Limited</td><td data-code="0820">OIL &amp; GAS EXPLORATION</td></tr></table>';
    expect(parsePsxCurrentListingsHtml(html)).toEqual([{
      symbol: "OGDC",
      name: "Oil & Gas Development Company Limited",
      sector: "OIL & GAS EXPLORATION",
    }]);
  });

  it("uses explicit symbols first and exact official names only when unique", () => {
    const records = matchPsxOfficialDates([
      { ticker: "AGP", market: "KSE", name: "AGP" },
      { ticker: "OGDC", market: "KSE", name: "OGDC" },
      { ticker: "AHCL", market: "KSE", name: "Arif Habib" },
      { ticker: "TEST", market: "KSE", name: "Test" },
      { ticker: "IMS", market: "KSE", name: "Intermarket Securities" },
    ], payload());
    expect(records.find((record) => record.ticker === "AGP")).toMatchObject({
      status: "matched",
      matchMethod: "explicit_symbol",
      listingDate: "2018-03-05",
    });
    expect(records.find((record) => record.ticker === "OGDC")).toMatchObject({
      status: "matched",
      matchMethod: "exact_official_name",
      listingDate: "2004-01-19",
    });
    expect(records.find((record) => record.ticker === "AGP")?.events[0]).toMatchObject({
      kind: "exchange_admission",
      localTime: null,
      timePrecision: "unknown",
      timeZone: "Asia/Karachi",
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
    expect(records.find((record) => record.ticker === "AHCL")?.status).toBe("unmatched");
    expect(records.find((record) => record.ticker === "TEST")?.status).toBe("ambiguous");
    expect(records.find((record) => record.ticker === "IMS")).toMatchObject({
      status: "matched",
      matchMethod: "official_profile",
      listingDate: "2008-03-20",
    });
    expect(records.find((record) => record.ticker === "IMS")?.events[0]).toMatchObject({
      evidence: { sourceName: "Pakistan Stock Exchange Company Profile" },
    });
  });

  it("keeps substantive successor words and rejects invalid provenance", () => {
    expect(normalizePsxCompanyName("Arif Habib Corporation Limited"))
      .not.toBe(normalizePsxCompanyName("Arif Habib Limited"));
    expect(() => parsePsxListingDatePayload({
      retrievedAt: RETRIEVED_AT,
      sourceRowCount: 1,
      directorySourceUrl: "https://example.com/listings",
      directorySourceHash: HASH,
      directoryRows: [{ symbol: "AGP", name: "AGP Limited", sector: "PHARMACEUTICALS" }],
      records: [historyRow(2018, "AGP Limited", "2018-03-05", "AGP")],
    })).toThrow(/provenance/);
  });
});
