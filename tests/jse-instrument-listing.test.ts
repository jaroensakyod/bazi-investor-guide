import { describe, expect, it } from "vitest";
import {
  JSE_INSTRUMENTS_SERVICE_URL,
  jseIssuerProfileUrl,
  matchJseOfficialDates,
  normalizeJseCompanyName,
  parseJseInstrumentListingPayload,
  parseJseListingDate,
  type JseInstrumentListingRow,
} from "../src/lib/research/jse-instrument-listing";

const HASH = "d".repeat(64);
const RETRIEVED_AT = "2026-08-09T04:00:00.000Z";

function row(overrides: Partial<JseInstrumentListingRow> = {}): JseInstrumentListingRow {
  return {
    symbol: "WHL",
    isin: "ZAE000063863",
    companyName: "WOOLWORTHS HOLDINGS LIMITED",
    instrumentName: "Woolworths Holdings Ltd",
    instrumentType: "Ordinary Share",
    board: "Main Board",
    listingDate: "1997-10-20",
    issuerMasterId: 1944,
    instrumentMasterId: 2198,
    sourceUrl: jseIssuerProfileUrl(1944),
    sourceApiUrl: JSE_INSTRUMENTS_SERVICE_URL,
    sourceHash: HASH,
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function payload(records: JseInstrumentListingRow[]) {
  return parseJseInstrumentListingPayload({ retrievedAt: RETRIEVED_AT, sourceRowCount: records.length, records });
}

describe("JSE instrument listing dates", () => {
  it("converts the official .NET timestamp to the Johannesburg calendar date", () => {
    expect(parseJseListingDate("/Date(877298400000)/")).toBe("1997-10-20");
    expect(parseJseListingDate("/Date(-2356912800000)/")).toBe("1895-04-25");
    expect(parseJseListingDate("20.10.1997")).toBe("1997-10-20");
    expect(parseJseListingDate("31.02.2024")).toBeNull();
  });

  it("normalizes legal endings, share classes and equivalent company abbreviations", () => {
    expect(normalizeJseCompanyName("Naspers Limited Class N")).toBe(normalizeJseCompanyName("NASPERS LIMITED"));
    expect(normalizeJseCompanyName("Harmony Gold Mining Co. Ltd."))
      .toBe(normalizeJseCompanyName("HARMONY GOLD MINING COMPANY LIMITED"));
    expect(normalizeJseCompanyName("NEPI Rockcastle N.V.")).toBe("NEPI ROCKCASTLE");
  });

  it("promotes an exact alpha code, issuer identity and ISIN as date-only admission", () => {
    const result = matchJseOfficialDates(
      [{ ticker: "WHL", market: "JSE", name: "Woolworths Holdings Limited" }],
      payload([row()]),
    )[0];
    expect(result).toMatchObject({ status: "matched", isin: "ZAE000063863", listingDate: "1997-10-20" });
    expect(result.events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1997-10-20",
      localTime: null,
      timeZone: "Africa/Johannesburg",
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
  });

  it("rejects a reused ticker when the official issuer identity differs", () => {
    const result = matchJseOfficialDates(
      [{ ticker: "WHL", market: "JSE", name: "Unrelated Holdings Limited" }],
      payload([row()]),
    )[0];
    expect(result.status).toBe("unmatched");
    expect(result.events).toHaveLength(0);
  });

  it("keeps multiple ISIN/date combinations ambiguous", () => {
    const result = matchJseOfficialDates(
      [{ ticker: "WHL", market: "JSE", name: "Woolworths Holdings Limited" }],
      payload([row(), row({ isin: "ZAE000000001", listingDate: "2020-01-02" })]),
    )[0];
    expect(result.status).toBe("ambiguous");
    expect(result.events).toHaveLength(0);
  });

  it("drops records with an unapproved provenance URL", () => {
    expect(() => parseJseInstrumentListingPayload({
      retrievedAt: RETRIEVED_AT,
      records: [row({ sourceApiUrl: "https://example.com/api" })],
    })).toThrow("no valid");
  });
});
