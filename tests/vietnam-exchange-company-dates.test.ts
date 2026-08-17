import { describe, expect, it } from "vitest";
import {
  matchVietnamOfficialDates,
  normalizeVietnamCatalogTicker,
  parseVietnamCompanyDatePayload,
  parseVietnamListingDate,
} from "../src/lib/research/vietnam-exchange-company-dates";

const PAYLOAD = {
  schemaVersion: 1,
  retrievedAt: "2026-08-08T12:49:55.484Z",
  sourceRowCount: { hose: 404, hnx: 299 },
  records: [
    { symbol: "VCB", exchange: "HOSE", listingDate: "2009-06-30", isin: "VN000000VCB4", figi: "BBG000QW7VC1" },
    { symbol: "PVS", exchange: "HNX", listingDate: "2007-09-20", isin: null, figi: null },
    { symbol: "BAD", exchange: "HNX", listingDate: "2023-02-29", isin: null, figi: null },
  ],
};

describe("Vietnam official listed-stock directories", () => {
  it("validates dates, identifiers and compact source counts", () => {
    const parsed = parseVietnamCompanyDatePayload(PAYLOAD);
    expect(parsed.records).toHaveLength(2);
    expect(parsed.sourceRowCount).toEqual({ hose: 404, hnx: 299 });
    expect(parseVietnamListingDate("2024-02-29")).toBe("2024-02-29");
    expect(parseVietnamListingDate("2023-02-29")).toBeNull();
    expect(normalizeVietnamCatalogTicker(" vcb ")).toBe("VCB");
  });

  it("preserves the actual HOSE or HNX venue behind the legacy HOSE catalog bucket", () => {
    const records = matchVietnamOfficialDates([
      { ticker: "VCB", market: "HOSE", name: "Vietcombank" },
      { ticker: "PVS", market: "HOSE", name: "PetroVietnam Technical Services" },
      { ticker: "MISS", market: "HOSE", name: "Missing" },
    ], parseVietnamCompanyDatePayload(PAYLOAD));
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "VCB")?.events[0]).toMatchObject({
      exchange: "HOSE",
      localDate: "2009-06-30",
      localTime: null,
      venueCity: "Ho Chi Minh City",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "PVS")?.events[0]).toMatchObject({
      exchange: "HNX",
      localDate: "2007-09-20",
      venueCity: "Hanoi",
    });
    expect(records.find((record) => record.ticker === "MISS")?.status).toBe("unmatched");
  });

  it("refuses to choose when the same symbol has conflicting official venue rows", () => {
    const payload = parseVietnamCompanyDatePayload({
      ...PAYLOAD,
      records: [
        PAYLOAD.records[0],
        { ...PAYLOAD.records[0], exchange: "HNX", listingDate: "2020-01-01", isin: null, figi: null },
      ],
    });
    const [record] = matchVietnamOfficialDates([
      { ticker: "VCB", market: "HOSE", name: "Vietcombank" },
    ], payload);
    expect(record.status).toBe("ambiguous");
    expect(record.events).toHaveLength(0);
  });
});
