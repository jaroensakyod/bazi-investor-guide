import { describe, expect, it } from "vitest";
import {
  matchSgxOfficialDates,
  normalizeSgxCatalogTicker,
  parseSgxCorporateDatePayload,
  parseSgxListingDate,
} from "../src/lib/research/sgx-corporate-information";

const PAYLOAD = {
  schemaVersion: 1,
  retrievedAt: "2026-08-08T13:05:00.000Z",
  sourceRowCount: 708,
  records: [
    {
      ticker: "D05",
      companyName: "DBS GROUP HOLDINGS LTD",
      listingDate: "1999-09-20",
      listingDates: ["1999-09-20"],
      listingBoard: "MAINBOARD",
      sourceUrl: "https://links.sgx.com/1.0.0/corporate-information/991",
    },
    {
      ticker: "AGS",
      companyName: "THE HOUR GLASS LIMITED",
      listingDate: "1988-10-03",
      listingDates: ["1992-10-07", "1988-10-03"],
      listingBoard: "MAINBOARD",
      sourceUrl: "https://links.sgx.com/1.0.0/corporate-information/2608",
    },
    {
      ticker: "BAD",
      companyName: "Bad Date",
      listingDate: "2023-02-29",
      listingDates: ["2023-02-29"],
      listingBoard: "MAINBOARD",
      sourceUrl: "https://links.sgx.com/1.0.0/corporate-information/9999",
    },
  ],
};

describe("SGX Corporate Information", () => {
  it("keeps only verified official rows and sorts listing history", () => {
    const parsed = parseSgxCorporateDatePayload(PAYLOAD);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.records.find((row) => row.ticker === "AGS")?.listingDates).toEqual(["1988-10-03", "1992-10-07"]);
    expect(parseSgxListingDate("2024-02-29")).toBe("2024-02-29");
    expect(parseSgxListingDate("2023-02-29")).toBeNull();
    expect(normalizeSgxCatalogTicker(" d05 ")).toBe("D05");
  });

  it("emits issuer-level date-only exchange events and leaves absent tickers unresolved", () => {
    const records = matchSgxOfficialDates([
      { ticker: "D05", market: "SGX", name: "DBS Group" },
      { ticker: "AGS", market: "SGX", name: "The Hour Glass" },
      { ticker: "Z77", market: "SGX", name: "Legacy alias" },
    ], parseSgxCorporateDatePayload(PAYLOAD));
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "D05")?.events[0]).toMatchObject({
      exchange: "SGX",
      localDate: "1999-09-20",
      localTime: null,
      timeZone: "Asia/Singapore",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "Z77")?.status).toBe("unmatched");
  });

  it("does not pick a date when one ticker has conflicting official records", () => {
    const payload = parseSgxCorporateDatePayload({
      ...PAYLOAD,
      records: [
        PAYLOAD.records[0],
        { ...PAYLOAD.records[0], listingDate: "2000-01-01", listingDates: ["2000-01-01"] },
      ],
    });
    const [record] = matchSgxOfficialDates([{ ticker: "D05", market: "SGX", name: "DBS" }], payload);
    expect(record.status).toBe("ambiguous");
    expect(record.events).toHaveLength(0);
  });
});
