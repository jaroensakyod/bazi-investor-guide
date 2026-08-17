import { describe, expect, it } from "vitest";
import {
  matchAsxOfficialDates,
  normalizeAsxCatalogTicker,
  parseAsxCompanyDirectory,
  parseAsxListingDate,
} from "../src/lib/research/asx-company-directory";

const CSV = [
  '"ASX code","Company name","GICs industry group","Listing date","Market Cap"',
  '"BHP","BHP GROUP LIMITED","Materials","10/08/1885",200000000000',
  '"A2M","THE A2 MILK COMPANY LIMITED","Food, Beverage & Tobacco","30/03/2015",5000000000',
  '"BAD","INVALID DATE LIMITED","Materials","31/02/2024",1',
].join("\r\n");

describe("ASX Company Directory CSV", () => {
  it("parses official listing dates without retaining market-cap data", () => {
    const rows = parseAsxCompanyDirectory(CSV);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      code: "BHP",
      companyName: "BHP GROUP LIMITED",
      industryGroup: "Materials",
      listingDate: "1885-08-10",
    });
    expect(parseAsxListingDate("29/02/2024")).toBe("2024-02-29");
    expect(parseAsxListingDate("29/02/2023")).toBeNull();
  });

  it("normalizes only the known Yahoo venue suffix", () => {
    expect(normalizeAsxCatalogTicker("A2M.AX")).toBe("A2M");
    expect(normalizeAsxCatalogTicker("BHP")).toBe("BHP");
  });

  it("matches exact codes and creates date-only licensed-data events", () => {
    const records = matchAsxOfficialDates([
      { ticker: "BHP", market: "ASX", name: "BHP" },
      { ticker: "A2M.AX", market: "ASX", name: "A2 Milk" },
      { ticker: "ZZZ.AX", market: "ASX", name: "Missing" },
    ], parseAsxCompanyDirectory(CSV), "2026-08-08T00:00:00.000Z");
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2015-03-30",
      localTime: null,
      timeZone: "Australia/Sydney",
      evidence: { authority: "licensed_market_data" },
    });
    expect(records[2].status).toBe("unmatched");
  });
});
