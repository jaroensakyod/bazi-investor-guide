import { describe, expect, it } from "vitest";
import {
  matchIdxOfficialDates,
  normalizeIdxCatalogTicker,
  parseIdxCompanyDatePayload,
  parseIdxListingDate,
  parseIdxOfficialDateSupplements,
} from "../src/lib/research/idx-company-profile";

const PAYLOAD = {
  schemaVersion: 1,
  retrievedAt: "2026-08-08T12:31:55.403Z",
  sourceRowCount: 962,
  records: [
    { symbol: "BBCA", listingDate: "2000-05-31" },
    { symbol: "TLKM", listingDate: "1995-11-14" },
    { symbol: "BAD", listingDate: "2023-02-29" },
  ],
};

describe("IDX Listed Company Profiles", () => {
  it("normalizes only valid ISO dates and known Yahoo suffixes", () => {
    const parsed = parseIdxCompanyDatePayload(PAYLOAD);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.sourceRowCount).toBe(962);
    expect(parseIdxListingDate("2024-02-29")).toBe("2024-02-29");
    expect(parseIdxListingDate("2023-02-29")).toBeNull();
    expect(normalizeIdxCatalogTicker("bbca.jk")).toBe("BBCA");
  });

  it("matches exact symbols and emits date-only exchange events", () => {
    const records = matchIdxOfficialDates([
      { ticker: "BBCA", market: "IDX", name: "Bank Central Asia" },
      { ticker: "TLKM.JK", market: "IDX", name: "Telkom Indonesia" },
      { ticker: "XSPI", market: "IDX", name: "Missing" },
    ], parseIdxCompanyDatePayload(PAYLOAD));
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "BBCA")?.events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2000-05-31",
      localTime: null,
      timeZone: "Asia/Jakarta",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "XSPI")?.status).toBe("unmatched");
  });

  it("accepts only exact official IDX/KSEI supplements and preserves provenance", () => {
    const supplements = parseIdxOfficialDateSupplements({
      records: [
        {
          symbol: "XSPI",
          listingDate: "2019-07-04",
          isin: "IDX000000600",
          sourceName: "KSEI registration notice KSEI-5906/DIR/0619",
          sourceUrl: "https://web.ksei.co.id/Announcement/Files/xspi.pdf",
        },
        {
          symbol: "BAD",
          listingDate: "2023-02-29",
          isin: "IDX000000600",
          sourceName: "Invalid date",
          sourceUrl: "https://web.ksei.co.id/Announcement/Files/bad.pdf",
        },
        {
          symbol: "NEWS",
          listingDate: "2019-07-04",
          isin: "IDX000000600",
          sourceName: "Secondary source",
          sourceUrl: "https://example.com/news",
        },
      ],
    });
    expect(supplements).toHaveLength(1);

    const payload = parseIdxCompanyDatePayload(PAYLOAD);
    const records = matchIdxOfficialDates([
      { ticker: "XSPI", market: "IDX", name: "DIRE Simas Plaza Indonesia" },
    ], { ...payload, records: [...payload.records, ...supplements] });
    expect(records[0]).toMatchObject({ status: "matched", listingDate: "2019-07-04" });
    expect(records[0].events[0]).toMatchObject({
      localDate: "2019-07-04",
      evidence: {
        sourceName: "KSEI registration notice KSEI-5906/DIR/0619",
        sourceUrl: "https://web.ksei.co.id/Announcement/Files/xspi.pdf",
      },
    });
    expect(records[0].events[0].note).toContain("ISIN IDX000000600");
  });
});
