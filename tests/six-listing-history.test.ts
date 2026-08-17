import { describe, expect, it } from "vitest";
import {
  SIX_BLUE_CHIP_SHARES_CSV_URL,
  SIX_DOMESTIC_SHARES_CSV_URL,
  SIX_FOREIGN_SHARES_CSV_URL,
  SIX_IPO_HISTORY_XLS_URL,
  SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
  matchSixOfficialDates,
  parseSixListingDate,
  parseSixListingDatePayload,
} from "../src/lib/research/six-listing-history";

const HASH = "c".repeat(64);
const RETRIEVED_AT = "2026-08-09T07:00:00.000Z";

function payload() {
  return parseSixListingDatePayload({
    retrievedAt: RETRIEVED_AT,
    sourceRowCount: 482,
    records: [
      {
        sourceType: "ipo_history",
        symbol: "GALD",
        isin: "CH1335392721",
        companyName: "Galderma Group AG",
        listingDate: "22.03.2024",
        tradingCurrency: null,
        sourceUrl: SIX_IPO_HISTORY_XLS_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "blue_chip_share_reference",
        symbol: "ABBN",
        isin: "CH0012221716",
        companyName: "ABB LTD N",
        listingDate: "2020-12-07",
        tradingCurrency: "CHF",
        sourceUrl: SIX_BLUE_CHIP_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "domestic_share_reference",
        symbol: "ADEN",
        isin: "CH0012138605",
        companyName: "ADECCO N",
        listingDate: "2020-12-07",
        tradingCurrency: "CHF",
        sourceUrl: SIX_DOMESTIC_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "foreign_share_reference",
        symbol: "PMI",
        isin: "US7181721090",
        companyName: "PHILIP MRRS INT-WI",
        listingDate: "2008-03-31",
        tradingCurrency: "CHF",
        sourceUrl: SIX_FOREIGN_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "sponsored_foreign_share",
        symbol: "NVDA",
        isin: "US67066G1040",
        companyName: "NVIDIA CORPORATION",
        listingDate: "20251201",
        tradingCurrency: "USD",
        sourceUrl: SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "sponsored_foreign_share",
        symbol: "BRK",
        isin: "US0846707026",
        companyName: "BERKSHIRE HATHAWAY INC",
        listingDate: "2014-10-27",
        tradingCurrency: "CHF",
        sourceUrl: SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
      {
        sourceType: "sponsored_foreign_share",
        symbol: "BRK",
        isin: "US0846707026",
        companyName: "BERKSHIRE HATHAWAY INC",
        listingDate: "2025-12-01",
        tradingCurrency: "USD",
        sourceUrl: SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      },
    ],
  });
}

describe("SIX listing history", () => {
  it("queries the full current sponsored-share table instead of recent years only", () => {
    const source = new URL(SIX_SPONSORED_FOREIGN_SHARES_CSV_URL);
    expect(source.searchParams.get("where")).toBe("ProductLine=PS*PortalSegment=EQ");
    expect(source.searchParams.get("where")).not.toContain("FirstTradingDate^");
    expect(new URL(SIX_BLUE_CHIP_SHARES_CSV_URL).searchParams.get("where"))
      .toBe("ProductLine=BC*PortalSegment=EQ");
    expect(new URL(SIX_DOMESTIC_SHARES_CSV_URL).searchParams.get("where"))
      .toBe("ProductLine=DS*PortalSegment=EQ");
    expect(new URL(SIX_FOREIGN_SHARES_CSV_URL).searchParams.get("where"))
      .toBe("ProductLine=FS*PortalSegment=EQ");
  });

  it("parses official date formats and rejects impossible dates", () => {
    expect(parseSixListingDate("22.03.2024")).toBe("2024-03-22");
    expect(parseSixListingDate("20251201")).toBe("2025-12-01");
    expect(parseSixListingDate("31.02.2024")).toBeNull();
  });

  it("matches primary and sponsored lines with the correct event semantics", () => {
    const records = matchSixOfficialDates([
      { ticker: "GALD", market: "SWX", name: "Galderma", currency: "CHF" },
      { ticker: "ABBN", market: "SWX", name: "ABB", currency: "CHF" },
      { ticker: "ADEN", market: "SWX", name: "Adecco", currency: "CHF" },
      { ticker: "PMI", market: "SWX", name: "Philip Morris", currency: "CHF" },
      { ticker: "NVDA.USD", market: "SWX", name: "NVIDIA", currency: "CHF" },
    ], payload());
    expect(records.find((record) => record.ticker === "GALD")).toMatchObject({
      status: "matched",
      sourceType: "ipo_history",
      listingDate: "2024-03-22",
    });
    expect(records.find((record) => record.ticker === "GALD")?.events[0]).toMatchObject({
      kind: "exchange_admission",
      localTime: null,
      timeZone: "Europe/Zurich",
    });
    expect(records.find((record) => record.ticker === "ABBN")).toMatchObject({
      status: "matched",
      sourceType: "blue_chip_share_reference",
      listingDate: "2020-12-07",
    });
    expect(records.find((record) => record.ticker === "ABBN")?.events[0]).toMatchObject({
      kind: "first_trading_day",
      evidence: { sourceName: "SIX Share Explorer Blue-Chip Shares" },
    });
    expect(records.find((record) => record.ticker === "ADEN")?.events[0]).toMatchObject({
      kind: "first_trading_day",
      evidence: { sourceName: "SIX Share Explorer Domestic Shares" },
    });
    expect(records.find((record) => record.ticker === "PMI")?.events[0]).toMatchObject({
      kind: "first_trading_day",
      localDate: "2008-03-31",
      evidence: { sourceName: "SIX Share Explorer Foreign Shares" },
    });
    expect(records.find((record) => record.ticker === "NVDA.USD")?.events[0]).toMatchObject({
      kind: "first_trading_day",
      localDate: "2025-12-01",
      localTime: null,
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
  });

  it("resolves CHF and USD trading lines sharing one SIX symbol by currency", () => {
    const records = matchSixOfficialDates([
      { ticker: "BRK", market: "SWX", name: "Berkshire Hathaway", currency: "CHF" },
      { ticker: "BRK.USD", market: "SWX", name: "Berkshire Hathaway USD", currency: "CHF" },
    ], payload());
    expect(records.find((record) => record.ticker === "BRK")).toMatchObject({
      status: "matched",
      listingDate: "2014-10-27",
    });
    expect(records.find((record) => record.ticker === "BRK.USD")).toMatchObject({
      status: "matched",
      listingDate: "2025-12-01",
    });
  });

  it("rejects records that do not point to the exact official source", () => {
    expect(() => parseSixListingDatePayload({
      retrievedAt: RETRIEVED_AT,
      sourceRowCount: 1,
      records: [{
        sourceType: "ipo_history",
        symbol: "GALD",
        isin: "CH1335392721",
        companyName: "Galderma Group AG",
        listingDate: "2024-03-22",
        tradingCurrency: null,
        sourceUrl: "https://example.com/ipo.xls",
        sourceHash: HASH,
        retrievedAt: RETRIEVED_AT,
      }],
    })).toThrow(/no valid/);
  });
});
