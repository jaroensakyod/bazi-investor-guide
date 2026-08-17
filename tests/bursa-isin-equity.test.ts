import { describe, expect, it } from "vitest";
import {
  BURSA_ISIN_EQUITY_PDF_URL,
  matchBursaListingDates,
  parseBursaIsinEquitySnapshot,
} from "../src/lib/research/bursa-isin-equity";

const BASE_RECORD = {
  number: 1,
  stockNameLong: "MALAYAN BANKING BERHAD",
  stockNameShort: "MAYBANK",
  isin: "MYL1155OO000",
  issueDescription: "ORDINARY SHARES",
  listingDate: "1962-02-17",
  maturityDate: null,
};

function snapshot(records: unknown[] = [BASE_RECORD]) {
  return {
    schemaVersion: 1,
    generatedAt: "2026-08-09T10:00:00.000Z",
    retrievedAt: "2026-08-09T10:00:00.000Z",
    sourceAsOf: "2025-04-30",
    sourceName: "Bursa Malaysia ISIN Equity",
    sourceUrl: BURSA_ISIN_EQUITY_PDF_URL,
    pdfSha256: "a".repeat(64),
    pageCount: 66,
    records,
  };
}

describe("Bursa Malaysia ISIN Equity listing dates", () => {
  it("promotes one exact official short-name match as a date-only exchange admission", () => {
    const parsed = parseBursaIsinEquitySnapshot(snapshot());
    const matches = matchBursaListingDates(
      [{ ticker: "MAYBANK", name: "Malayan Banking Bhd.", market: "BURSA" }],
      parsed,
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      securityId: "BURSA:MAYBANK",
      status: "matched",
      isin: "MYL1155OO000",
      listingDate: "1962-02-17",
    });
    expect(matches[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1962-02-17",
      localTime: null,
      timePrecision: "unknown",
      timeZone: "Asia/Kuala_Lumpur",
      evidence: {
        authority: "exchange",
        verification: "verified",
        displayRights: "unknown",
      },
    });
  });

  it("does not promote fuzzy ticker or provider-suffix aliases", () => {
    const parsed = parseBursaIsinEquitySnapshot(snapshot());
    const matches = matchBursaListingDates(
      [
        { ticker: "MAYBANKX", name: "Near name", market: "BURSA" },
        { ticker: "MAYBANK.KL", name: "Provider suffix", market: "BURSA" },
      ],
      parsed,
    );
    expect(matches.map((match) => match.status)).toEqual(["unmatched", "unmatched"]);
    expect(matches.flatMap((match) => match.events)).toEqual([]);
  });

  it("quarantines a short name that maps to multiple official ISIN/date records", () => {
    const parsed = parseBursaIsinEquitySnapshot(snapshot([
      BASE_RECORD,
      { ...BASE_RECORD, number: 2, isin: "MYL1155OO018", listingDate: "2000-01-03" },
    ]));
    const [match] = matchBursaListingDates(
      [{ ticker: "MAYBANK", name: "Malayan Banking Bhd.", market: "BURSA" }],
      parsed,
    );
    expect(match.status).toBe("ambiguous");
    expect(match.events).toEqual([]);
  });

  it("rejects invalid dates and non-official source URLs at the snapshot boundary", () => {
    expect(() => parseBursaIsinEquitySnapshot(snapshot([
      { ...BASE_RECORD, listingDate: "2025-02-30" },
    ]))).toThrow();
    expect(() => parseBursaIsinEquitySnapshot({
      ...snapshot(),
      sourceUrl: "https://example.com/bursa.pdf",
    })).toThrow();
  });
});
