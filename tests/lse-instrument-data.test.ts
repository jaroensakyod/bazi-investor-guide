import { describe, expect, it } from "vitest";
import {
  hasLseIssuerIdentityOverlap,
  lseOfficialTidmCandidates,
  lseInstrumentDataUrl,
  matchLseOfficialDates,
  parseLseInstrumentResponse,
} from "../src/lib/research/lse-instrument-data";

const HSBA = {
  description: "HSBC HLDGS PLC ORD $0.50 (UK REG)",
  name: "ORD $0.50 (UK REG)",
  tidm: "HSBA",
  isin: "GB0005405286",
  country: "GB",
  market: "MAINMARKET",
  segment: "SET1",
  issuercode: "HSGA",
  issuername: "HSBC HOLDINGS PLC",
  instrumenttype: "STOCK",
  listingadmissiondate: "2006-01-13",
};

describe("LSE instrument reference data", () => {
  it("parses the official admission date and validates the returned TIDM", () => {
    expect(parseLseInstrumentResponse(HSBA, "HSBA")).toMatchObject({
      sourceTicker: "HSBA",
      isin: "GB0005405286",
      issuerName: "HSBC HOLDINGS PLC",
      listingAdmissionDate: "2006-01-13",
      warnings: [],
    });
    expect(parseLseInstrumentResponse({ ...HSBA, listingadmissiondate: "2024-02-30" }, "HSBA"))
      .toMatchObject({ listingAdmissionDate: null });
  });

  it("keeps a full stop that is part of the official TIDM", () => {
    expect(lseInstrumentDataUrl("RR.")).toBe(
      "https://api.londonstockexchange.com/api/gw/lse/instruments/alldata/RR.",
    );
    expect(lseOfficialTidmCandidates("RR")).toEqual(["RR", "RR."]);
    expect(lseOfficialTidmCandidates("RR.")).toEqual(["RR."]);
    expect(hasLseIssuerIdentityOverlap("Rolls-Royce Holdings plc", "ROLLS-ROYCE HOLDINGS PLC"))
      .toBe(true);
  });

  it("accepts a trailing-dot TIDM only when issuer identity also matches", () => {
    const row = {
      ticker: "AV",
      sourceTicker: "AV.",
      description: "AVIVA PLC ORD SHS",
      instrumentName: "ORD SHS",
      isin: "GB00BPQY8M80",
      country: "GB",
      market: "MAINMARKET",
      segment: "SET1",
      issuerCode: "AV.",
      issuerName: "AVIVA PLC",
      instrumentType: "STOCK",
      listingAdmissionDate: "2022-05-16",
    };
    expect(matchLseOfficialDates([
      { ticker: "AV", market: "LSE", name: "Aviva plc" },
    ], [row], "2026-08-10T00:00:00.000Z")[0]).toMatchObject({
      status: "matched",
      sourceTicker: "AV.",
      listingDate: "2022-05-16",
    });
    expect(matchLseOfficialDates([
      { ticker: "AV", market: "LSE", name: "Unrelated Company" },
    ], [row], "2026-08-10T00:00:00.000Z")[0]).toMatchObject({
      status: "unmatched",
      listingDate: null,
    });
  });

  it("matches only the exact TIDM and never invents a trading time", () => {
    const records = matchLseOfficialDates([
      { ticker: "HSBA", market: "LSE", name: "HSBC" },
      { ticker: "MISSING", market: "LSE", name: "Missing" },
    ], [{
      ticker: "HSBA",
      sourceTicker: "HSBA",
      description: HSBA.description,
      instrumentName: HSBA.name,
      isin: HSBA.isin,
      country: HSBA.country,
      market: HSBA.market,
      segment: HSBA.segment,
      issuerCode: HSBA.issuercode,
      issuerName: HSBA.issuername,
      instrumentType: HSBA.instrumenttype,
      listingAdmissionDate: HSBA.listingadmissiondate,
    }], "2026-08-08T00:00:00.000Z");
    expect(records[0]).toMatchObject({ status: "matched", listingDate: "2006-01-13" });
    expect(records[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2006-01-13",
      localTime: null,
      timeZone: "Europe/London",
    });
    expect(records[1].status).toBe("unmatched");
  });
});
