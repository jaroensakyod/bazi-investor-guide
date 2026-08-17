import { describe, expect, it } from "vitest";
import {
  BIST_FIRST_TRADING_DATES_ZIP_URL,
  bistCompanyNamesShareIdentity,
  matchBistOfficialDates,
  normalizeBistCompanyName,
  normalizeBistCurrentCode,
  parseBistDate,
  parseBistFirstTradingDatePayload,
  type BistFirstTradingDateRow,
} from "../src/lib/research/bist-first-trading-date";

const HASH = "b".repeat(64);
const RETRIEVED_AT = "2026-08-09T04:00:00.000Z";

function row(overrides: Partial<BistFirstTradingDateRow> = {}): BistFirstTradingDateRow {
  return {
    firstCode: "THYAO.E",
    currentCode: "THYAO.E",
    symbol: "THYAO",
    companyName: "TURK HAVA YOLLARI A.O.",
    listingDate: "1990-12-20",
    firstTradingDate: "1990-12-30",
    sourceUrl: BIST_FIRST_TRADING_DATES_ZIP_URL,
    sourceHash: HASH,
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function payload(records: BistFirstTradingDateRow[]) {
  return parseBistFirstTradingDatePayload({ retrievedAt: RETRIEVED_AT, sourceRowCount: 925, records });
}

describe("Borsa Istanbul first-trading dates", () => {
  it("parses official day/month/year dates without inventing a time", () => {
    expect(parseBistDate("06.08.2026")).toBe("2026-08-06");
    expect(parseBistDate("2026-08-06")).toBe("2026-08-06");
    expect(parseBistDate("31.02.2026")).toBeNull();
  });

  it("accepts exact .E equity and .G certificate current codes only", () => {
    expect(normalizeBistCurrentCode("thyao.e")).toBe("THYAO.E");
    expect(normalizeBistCurrentCode("DMLKT.G")).toBe("DMLKT.G");
    expect(normalizeBistCurrentCode("HPCLI.F2")).toBe("");
  });

  it("normalizes legal endings and checks conservative issuer identity", () => {
    expect(normalizeBistCompanyName("Turkiye Is Bankasi Anonim Sirketi Class C"))
      .toBe(normalizeBistCompanyName("TURKIYE IS BANKASI A.S."));
    expect(bistCompanyNamesShareIdentity("Kardemir Karabiik Demir Celik AS", "KARDEMIR KARABUK DEMIR CELIK A.S."))
      .toBe(true);
    expect(bistCompanyNamesShareIdentity("Turkiye Sigorta A.S.", "GUNES SIGORTA A.S.")).toBe(false);
  });

  it("creates first-trading and distinct admission events for an exact current code", () => {
    const result = matchBistOfficialDates(
      [{ ticker: "THYAO", market: "BIST", name: "Turk Hava Yollari A.O." }],
      payload([row()]),
    )[0];
    expect(result).toMatchObject({
      status: "matched",
      sourceCode: "THYAO.E",
      listingDate: "1990-12-20",
      firstTradingDate: "1990-12-30",
      nameIdentityConfirmed: true,
    });
    expect(result.events).toHaveLength(2);
    expect(result.events[0]).toMatchObject({
      kind: "first_trading_day",
      localDate: "1990-12-30",
      localTime: null,
      timeZone: "Europe/Istanbul",
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
    expect(result.events[1]).toMatchObject({ kind: "exchange_admission", localDate: "1990-12-20" });
  });

  it("preserves a certificate suffix instead of presenting it as a common share", () => {
    const result = matchBistOfficialDates(
      [{ ticker: "DMLKT", market: "BIST", name: "Emlak Konut Gayrimenkul Certificates" }],
      payload([row({
        firstCode: "DMLKT.G",
        currentCode: "DMLKT.G",
        symbol: "DMLKT",
        companyName: "EMLAK KONUT GAYRIMENKUL YATIRIM ORTAKLIGI A.S.",
        listingDate: "2025-08-15",
        firstTradingDate: "2025-08-15",
      })]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.sourceCode).toBe("DMLKT.G");
    expect(result.warnings.join(" ")).toContain("certificate-class .G");
  });

  it("keeps an exact current-code match but warns when issuer names imply a rename", () => {
    const result = matchBistOfficialDates(
      [{ ticker: "TURSG", market: "BIST", name: "Turkiye Sigorta A.S." }],
      payload([row({
        firstCode: "GUSGR.E",
        currentCode: "TURSG.E",
        symbol: "TURSG",
        companyName: "GUNES SIGORTA A.S.",
      })]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.nameIdentityConfirmed).toBe(false);
    expect(result.warnings.join(" ")).toContain("rename/successor");
  });

  it("rejects ambiguous current-code/date combinations", () => {
    const result = matchBistOfficialDates(
      [{ ticker: "THYAO", market: "BIST", name: "Turk Hava Yollari" }],
      payload([row(), row({ currentCode: "THYAO.G", firstTradingDate: "2020-01-02" })]),
    )[0];
    expect(result.status).toBe("ambiguous");
    expect(result.events).toHaveLength(0);
  });

  it("drops records that do not point to the exact official archive", () => {
    expect(() => parseBistFirstTradingDatePayload({
      retrievedAt: RETRIEVED_AT,
      records: [row({ sourceUrl: "https://example.com/ilkislem.zip" })],
    })).toThrow("no valid");
  });
});
