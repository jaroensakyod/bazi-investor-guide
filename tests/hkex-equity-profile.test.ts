import { describe, expect, it } from "vitest";
import {
  hkexEquityQuotePageUrl,
  matchHkexOfficialDates,
  normalizeHkexCatalogTicker,
  parseHkexCompanyDatePayload,
  parseHkexEquityQuoteJsonp,
  parseHkexListingDate,
} from "../src/lib/research/hkex-equity-profile";

const QUOTE_JSONP = `callback_1({"data":{"responsecode":"000","quote":{"sym":"700","ric":"0700.HK","nm":"Tencent Holdings Ltd.","listing_date":"16 Jun 2004","transfer_of_listing_date":"","product_type":"EQTY","product_subtype":null,"primaryexch":"HKEX","db_updatetime":"09 Aug 2026 08:10"}}})`;

describe("HKEX equity profile", () => {
  it("parses the quote JSONP identity and day-precision dates", () => {
    expect(parseHkexEquityQuoteJsonp(QUOTE_JSONP)).toEqual({
      symbol: "700",
      ric: "0700.HK",
      companyName: "Tencent Holdings Ltd.",
      listingDate: "2004-06-16",
      transferOfListingDate: null,
      productType: "EQTY",
      productSubtype: null,
      primaryExchange: "HKEX",
      databaseUpdatedAt: "09 Aug 2026 08:10",
    });
    expect(parseHkexListingDate("29 Feb 2024")).toBe("2024-02-29");
    expect(parseHkexListingDate("29 Feb 2023")).toBeNull();
  });

  it("normalizes suffix and zero padding without accepting non-numeric aliases", () => {
    expect(normalizeHkexCatalogTicker("0700.HK")).toBe("700");
    expect(normalizeHkexCatalogTicker("00003")).toBe("3");
    expect(normalizeHkexCatalogTicker("TENCENT")).toBe("");
    expect(hkexEquityQuotePageUrl("0700.HK")).toContain("sym=700");
  });

  it("creates license-gated date-only events for exact HKEX codes", () => {
    const payload = parseHkexCompanyDatePayload({
      retrievedAt: "2026-08-09T02:00:00.000Z",
      sourceRowCount: 1,
      records: [{
        ...parseHkexEquityQuoteJsonp(QUOTE_JSONP),
        status: "matched",
        sourceUrl: hkexEquityQuotePageUrl("700"),
        sourceHash: "a".repeat(64),
        retrievedAt: "2026-08-09T02:00:00.000Z",
      }],
    });
    const records = matchHkexOfficialDates([
      { ticker: "0700.HK", market: "HKEX", name: "Tencent" },
      { ticker: "700", market: "HKEX", name: "Tencent Holdings" },
      { ticker: "5", market: "HKEX", name: "HSBC" },
    ], payload);
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2004-06-16",
      localTime: null,
      timeZone: "Asia/Hong_Kong",
      evidence: {
        authority: "licensed_market_data",
        displayRights: "unknown",
      },
    });
    expect(records[0].warnings[0]).toContain("catalog aliases");
    expect(records.find((record) => record.ticker === "5")?.status).toBe("unmatched");
  });

  it("rejects non-equity products and untrusted source URLs", () => {
    expect(() => parseHkexEquityQuoteJsonp(QUOTE_JSONP.replace('"product_type":"EQTY"', '"product_type":"BOND"')))
      .toThrow(/eligible listed equity or REIT/);
    expect(() => parseHkexCompanyDatePayload({
      retrievedAt: "2026-08-09T02:00:00.000Z",
      sourceRowCount: 1,
      records: [{
        ...parseHkexEquityQuoteJsonp(QUOTE_JSONP),
        status: "matched",
        sourceUrl: "https://example.com/700",
        sourceHash: null,
        retrievedAt: "2026-08-09T02:00:00.000Z",
      }],
    })).toThrow(/no valid matched records/);
  });
});
