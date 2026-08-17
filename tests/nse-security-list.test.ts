import { describe, expect, it } from "vitest";
import {
  matchNseOfficialDates,
  normalizeNseCatalogTicker,
  parseNseListingDate,
  parseNseOfficialDateSupplements,
  parseNseSecurityList,
} from "../src/lib/research/nse-security-list";

describe("NSE official security lists", () => {
  const url = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
  const rows = parseNseSecurityList(
    [
      "SYMBOL,NAME OF COMPANY,SERIES,DATE OF LISTING,PAID UP VALUE,MARKET LOT,ISIN NUMBER,FACE VALUE",
      "RELIANCE,Reliance Industries Limited,EQ,29-NOV-1995,10,1,INE002A01018,10",
      'BAJAJ-AUTO,"Bajaj Auto, Limited",EQ,26-MAY-2008,10,1,INE917I01010,10',
      "MINDSPACE,Mindspace Business Parks REIT,RR,7-Aug-20,275,200,INE0CCU25019,275",
    ].join("\r\n"),
    "NSE official test list",
    url,
  );

  it("parses four- and two-digit years without relying on Date.parse", () => {
    expect(parseNseListingDate("06-OCT-2008")).toBe("2008-10-06");
    expect(parseNseListingDate("7-Aug-20")).toBe("2020-08-07");
    expect(parseNseListingDate("31-FEB-2020")).toBeNull();
    expect(rows[1].companyName).toBe("Bajaj Auto, Limited");
  });

  it("normalizes only known catalog suffixes and underscore notation", () => {
    expect(normalizeNseCatalogTicker("RELIANCE.NS")).toBe("RELIANCE");
    expect(normalizeNseCatalogTicker("MINDSPACE.RR")).toBe("MINDSPACE");
    expect(normalizeNseCatalogTicker("BAJAJ_AUTO")).toBe("BAJAJ-AUTO");
  });

  it("matches controlled aliases and never invents a time", () => {
    const records = matchNseOfficialDates([
      { ticker: "RELIANCE.NS", market: "NSE", name: "Reliance" },
      { ticker: "BAJAJ_AUTO", market: "NSE", name: "Bajaj Auto" },
      { ticker: "MINDSPACE.RR", market: "NSE", name: "Mindspace" },
      { ticker: "MISSING.NS", market: "NSE", name: "Missing" },
    ], rows, "2026-08-08T00:00:00.000Z");
    expect(records.filter((record) => record.status === "matched")).toHaveLength(3);
    expect(records.find((record) => record.ticker === "RELIANCE.NS")?.listingDate).toBe("1995-11-29");
    expect(records.find((record) => record.ticker === "MINDSPACE.RR")?.listingDate).toBe("2020-08-07");
    expect(records.find((record) => record.ticker === "MISSING.NS")?.status).toBe("unmatched");
    for (const event of records.flatMap((record) => record.events)) expect(event.localTime).toBeNull();
  });

  it("accepts only day-precision supplements hosted by NSE", () => {
    const supplements = parseNseOfficialDateSupplements({ records: [
      {
        symbol: "KRT",
        companyName: "Knowledge Realty Trust",
        series: "RR",
        listingDate: "2025-08-18",
        isin: "INE1JAR25012",
        sourceName: "NSE-hosted annual report",
        sourceUrl: "https://nsearchives.nseindia.com/corporate/KRT_report.pdf",
      },
      {
        symbol: "BAD",
        companyName: "Unofficial",
        series: "EQ",
        listingDate: "2025-01-01",
        isin: "INE1JAR25012",
        sourceName: "Blog",
        sourceUrl: "https://example.com/bad.pdf",
      },
    ] });
    expect(supplements).toHaveLength(1);
    expect(matchNseOfficialDates(
      [{ ticker: "KRT.RR", market: "NSE", name: "Knowledge Realty Trust" }],
      supplements,
      "2026-08-10T00:00:00.000Z",
    )[0]).toMatchObject({ status: "matched", listingDate: "2025-08-18" });
  });
});
