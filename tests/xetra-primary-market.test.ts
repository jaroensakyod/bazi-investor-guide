import { describe, expect, it } from "vitest";
import {
  extractXetraPrimaryMarketCsvUrl,
  matchXetraOfficialDates,
  normalizeXetraCompanyName,
  parseXetraFirstTradingDate,
  parseXetraPrimaryMarketPayload,
  type XetraPrimaryMarketRow,
} from "../src/lib/research/xetra-primary-market";

const SOURCE_URL =
  "https://www.cashmarket.deutsche-boerse.com/resource/blob/5129544/be788aba7e560c3d910b92b3fcf0507b/data/PM_Statistik_EN.csv";
const RETRIEVED_AT = "2026-08-09T03:00:00.000Z";

function row(overrides: Partial<XetraPrimaryMarketRow> = {}): XetraPrimaryMarketRow {
  return {
    symbol: "SHL",
    isin: "DE000SHL1006",
    companyName: "Siemens Healthineers AG",
    firstTradingDate: "2018-03-16",
    transactionType: "NI",
    market: "Regulated Market",
    currentSegment: "Prime Standard",
    sourceUrl: SOURCE_URL,
    sourceHash: "a".repeat(64),
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function payload(records: XetraPrimaryMarketRow[]) {
  return parseXetraPrimaryMarketPayload({ retrievedAt: RETRIEVED_AT, sourceRowCount: 1_867, records });
}

describe("Deutsche Börse primary-market dates", () => {
  it("parses the official day/month/year date without inventing a time", () => {
    expect(parseXetraFirstTradingDate("16/03/2018")).toBe("2018-03-16");
    expect(parseXetraFirstTradingDate("2025-02-29")).toBeNull();
    expect(parseXetraFirstTradingDate("03/16/2018")).toBeNull();
  });

  it("normalizes German transliteration, legal suffixes and the registered Porsche prefix", () => {
    expect(normalizeXetraCompanyName("Deutsche Börse AG")).toBe(normalizeXetraCompanyName("Deutsche Boerse AG"));
    expect(normalizeXetraCompanyName("Hannover Rück SE")).toBe(normalizeXetraCompanyName("Hannover Rueck SE"));
    expect(normalizeXetraCompanyName("RATIONAL AG")).toBe(normalizeXetraCompanyName("Rational Aktiengesellschaft"));
    expect(normalizeXetraCompanyName("Dr. Ing. h.c. F. Porsche AG")).toBe(normalizeXetraCompanyName("Porsche AG"));
  });

  it("extracts only the approved official CSV link from the download page", () => {
    const html = `<a href="/resource/blob/5129544/be788aba7e560c3d910b92b3fcf0507b/data/PM_Statistik_EN.csv">CSV_en</a>`;
    expect(extractXetraPrimaryMarketCsvUrl(html)).toBe(SOURCE_URL);
    expect(() => extractXetraPrimaryMarketCsvUrl('<a href="https://example.com/PM_Statistik_EN.csv">CSV</a>')).toThrow();
  });

  it("rejects a reused ticker when the official issuer name is different", () => {
    const result = matchXetraOfficialDates(
      [{ ticker: "MOB", market: "XETR", name: "Monster Beverage Corporation" }],
      payload([row({ symbol: "MOB", isin: "DE0006622400", companyName: "mobilcom AG", firstTradingDate: "1997-03-10" })]),
    )[0];
    expect(result.status).toBe("unmatched");
    expect(result.events).toHaveLength(0);
    expect(result.warnings[0]).toContain("ticker may have been reused");
  });

  it("uses exact symbol plus issuer identity to disambiguate a reused ticker", () => {
    const result = matchXetraOfficialDates(
      [{ ticker: "SHL", market: "XETR", name: "Siemens Healthineers AG" }],
      payload([
        row({ isin: "DE000A0LR456", companyName: "solarhybrid AG", firstTradingDate: "2008-06-12", transactionType: "LI" }),
        row(),
      ]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.isin).toBe("DE000SHL1006");
    expect(result.firstTradingDate).toBe("2018-03-16");
    expect(result.events[0]).toMatchObject({
      kind: "first_trading_day",
      localDate: "2018-03-16",
      localTime: null,
      timeZone: "Europe/Berlin",
      evidence: { authority: "exchange", verification: "verified" },
    });
  });

  it("selects the earliest official transaction only when symbol, issuer and ISIN all agree", () => {
    const result = matchXetraOfficialDates(
      [{ ticker: "O5G", market: "XETR", name: "CPI PROPERTY GROUP S.A." }],
      payload([
        row({ symbol: "O5G", isin: "LU0251710041", companyName: "CPI PROPERTY GROUP", firstTradingDate: "2007-11-14", transactionType: "TR" }),
        row({ symbol: "O5G", isin: "LU0251710041", companyName: "CPI PROPERTY GROUP", firstTradingDate: "2006-05-19", transactionType: "LI" }),
      ]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.firstTradingDate).toBe("2006-05-19");
    expect(result.transactionTypes).toEqual(["LI", "TR"]);
    expect(result.warnings[0]).toContain("earliest of 2");
  });

  it("keeps multiple ISINs for the same normalized identity ambiguous", () => {
    const result = matchXetraOfficialDates(
      [{ ticker: "ABC", market: "XETR", name: "Example AG" }],
      payload([
        row({ symbol: "ABC", isin: "DE0000000001", companyName: "Example AG" }),
        row({ symbol: "ABC", isin: "DE0000000019", companyName: "Example SE", firstTradingDate: "2020-01-02" }),
      ]),
    )[0];
    expect(result.status).toBe("ambiguous");
    expect(result.events).toHaveLength(0);
  });

  it("drops records whose provenance URL is not the official exchange download", () => {
    expect(() => parseXetraPrimaryMarketPayload({
      retrievedAt: RETRIEVED_AT,
      records: [row({ sourceUrl: "https://example.com/PM_Statistik_EN.csv" })],
    })).toThrow("no valid");
  });
});
