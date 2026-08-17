import { describe, expect, it } from "vitest";
import {
  combineXetraDateRecords,
  extractXetraInstrumentCsvUrl,
  isOfficialXetraInstrumentCsvUrl,
  matchXetraInstrumentDates,
  parseXetraInstrumentReferencePayload,
  type XetraInstrumentDateRecord,
  type XetraInstrumentReferenceRow,
} from "../src/lib/research/xetra-instrument-reference";
import type { XetraOfficialDateRecord } from "../src/lib/research/xetra-primary-market";

const RETRIEVED_AT = "2026-08-09T00:00:00.000Z";
const SOURCE_URL =
  "https://www.cashmarket.deutsche-boerse.com/resource/blob/1528/a31c10e3183f4c5dd721f9c7f9eaaaea/data/t7-xetr-allTradableInstruments.csv";

function row(overrides: Partial<XetraInstrumentReferenceRow> = {}): XetraInstrumentReferenceRow {
  return {
    symbol: "SIE",
    isin: "DE0007236101",
    instrumentName: "SIEMENS AG NA O.N.",
    instrumentType: "CS",
    micCode: "XETR",
    primaryMarketMicCode: "XETR",
    currency: "EUR",
    firstTradingDate: "2008-02-25",
    sourceUrl: SOURCE_URL,
    sourceHash: "a".repeat(64),
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function payload(records: XetraInstrumentReferenceRow[]) {
  return parseXetraInstrumentReferencePayload({
    retrievedAt: RETRIEVED_AT,
    sourceRowCount: 5_101,
    records,
  });
}

function primaryRecord(overrides: Partial<XetraOfficialDateRecord> = {}): XetraOfficialDateRecord {
  return {
    securityId: "XETR:DB1",
    ticker: "DB1",
    status: "matched",
    sourceSymbol: "DB1",
    isin: "DE0005810055",
    companyName: "Deutsche Börse AG",
    firstTradingDate: "2001-02-05",
    transactionTypes: ["NI"],
    sourceUrl: "https://www.cashmarket.deutsche-boerse.com/resource/blob/1/aaaaaaaaaaaaaaaa/data/PM_Statistik_EN.csv",
    events: [],
    warnings: [],
    ...overrides,
  };
}

function instrumentRecord(overrides: Partial<XetraInstrumentDateRecord> = {}): XetraInstrumentDateRecord {
  return {
    securityId: "XETR:DB1",
    ticker: "DB1",
    status: "matched",
    sourceSymbol: "DB1",
    isin: "DE0005810055",
    instrumentName: "DEUTSCHE BOERSE NA O.N.",
    firstTradingDate: "2008-02-25",
    sourceUrl: SOURCE_URL,
    events: [],
    warnings: [],
    ...overrides,
  };
}

describe("Xetra current instrument reference", () => {
  it("accepts only the official All Tradable Instruments CSV URL", () => {
    expect(isOfficialXetraInstrumentCsvUrl(SOURCE_URL)).toBe(true);
    expect(isOfficialXetraInstrumentCsvUrl("https://example.com/t7-xetr-allTradableInstruments.csv")).toBe(false);
    expect(extractXetraInstrumentCsvUrl(`<a href="${SOURCE_URL}">CSV</a>`)).toBe(SOURCE_URL);
  });

  it("matches one active current instrument by exact Xetra symbol without inventing a time", () => {
    const result = matchXetraInstrumentDates(
      [{ ticker: "SIE", market: "XETR", name: "Siemens AG" }],
      payload([row()]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.isin).toBe("DE0007236101");
    expect(result.events[0]).toMatchObject({
      kind: "first_trading_day",
      localDate: "2008-02-25",
      localTime: null,
      timeZone: "Europe/Berlin",
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
    expect(result.events[0].note).toContain("not claimed as the issuer's incorporation date");
  });

  it("keeps multiple current ISIN/date identities ambiguous", () => {
    const result = matchXetraInstrumentDates(
      [{ ticker: "SIE", market: "XETR", name: "Siemens AG" }],
      payload([row(), row({ isin: "DE0000000001", firstTradingDate: "2020-01-02" })]),
    )[0];
    expect(result.status).toBe("ambiguous");
    expect(result.events).toHaveLength(0);
  });

  it("rejects compact records whose provenance is not the official exchange file", () => {
    expect(() => payload([row({ sourceUrl: "https://example.com/file.csv" })])).toThrow("no valid records");
  });

  it("retains Primary Market history when the current venue-instrument date differs", () => {
    const result = combineXetraDateRecords(
      [{ ticker: "DB1", market: "XETR", name: "Deutsche Börse AG" }],
      [primaryRecord()],
      [instrumentRecord()],
    )[0];
    expect(result.status).toBe("matched");
    expect(result.sourceType).toBe("primary_market_history");
    expect(result.firstTradingDate).toBe("2001-02-05");
    expect(result.comparison).toEqual({
      primaryMarketDate: "2001-02-05",
      instrumentReferenceDate: "2008-02-25",
      sourcesAgree: false,
    });
    expect(result.warnings.at(-1)).toContain("retained Primary Market history");
  });

  it("uses current instrument reference only when no conservative history match exists", () => {
    const result = combineXetraDateRecords(
      [{ ticker: "SIE", market: "XETR", name: "Siemens AG" }],
      [primaryRecord({
        securityId: "XETR:SIE",
        ticker: "SIE",
        status: "unmatched",
        sourceSymbol: "SIE",
        isin: null,
        companyName: "Siemens AG",
        firstTradingDate: null,
        transactionTypes: [],
        sourceUrl: null,
      })],
      [instrumentRecord({
        securityId: "XETR:SIE",
        ticker: "SIE",
        sourceSymbol: "SIE",
        isin: "DE0007236101",
        instrumentName: "SIEMENS AG NA O.N.",
      })],
    )[0];
    expect(result.status).toBe("matched");
    expect(result.sourceType).toBe("current_instrument_reference");
    expect(result.firstTradingDate).toBe("2008-02-25");
    expect(result.warnings.at(-1)).toContain("current active venue-instrument reference");
  });
});
