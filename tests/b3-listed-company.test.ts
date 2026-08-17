import { describe, expect, it } from "vitest";
import {
  b3CompanyDetailUrl,
  b3IssuerCodeFromTicker,
  matchB3OfficialDates,
  normalizeB3CatalogTicker,
  parseB3CompanyDatePayload,
  parseB3ListingDate,
  parseB3QuotationDate,
} from "../src/lib/research/b3-listed-company";

describe("B3 Listed Companies", () => {
  it("parses B3 day formats and rejects the 9999 sentinel", () => {
    expect(parseB3ListingDate("27/08/1968")).toBe("1968-08-27");
    expect(parseB3QuotationDate("07/20/1977")).toBe("1977-07-20");
    expect(parseB3ListingDate("31/12/9999")).toBeNull();
    expect(parseB3ListingDate("31/02/2024")).toBeNull();
  });

  it("keeps exact security codes and derives only the four-character issuer code", () => {
    expect(normalizeB3CatalogTicker("PETR3.SA")).toBe("PETR3");
    expect(b3IssuerCodeFromTicker("B3SA3")).toBe("B3SA");
    expect(b3IssuerCodeFromTicker("MRSA3B")).toBe("MRSA");
  });

  it("matches confirmed share classes but excludes odd-lot aliases", () => {
    const payload = parseB3CompanyDatePayload({
      retrievedAt: "2026-08-09T03:00:00.000Z",
      sourceRowCount: 3497,
      records: [{
        status: "matched",
        issuingCompany: "PETR",
        codeCvm: "9512",
        companyName: "PETROLEO BRASILEIRO S.A. PETROBRAS",
        tradingName: "PETROBRAS",
        listingDate: "1968-08-27",
        quotationDate: "1977-07-20",
        codes: ["PETR3", "PETR4", "PETR-DEB62"],
        market: "BOVESPA NIVEL 2",
        sourceUrl: b3CompanyDetailUrl("9512", "PETR"),
        sourceHash: "b".repeat(64),
        retrievedAt: "2026-08-09T03:00:00.000Z",
      }],
    });
    const records = matchB3OfficialDates([
      { ticker: "PETR3", market: "BOVESPA", name: "Petrobras common" },
      { ticker: "PETR4", market: "BOVESPA", name: "Petrobras preferred" },
      { ticker: "PETR3F", market: "BOVESPA", name: "Petrobras odd lot" },
      { ticker: "VALE3", market: "BOVESPA", name: "Vale" },
    ], payload);
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "PETR3")?.events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1968-08-27",
      localTime: null,
      timeZone: "America/Sao_Paulo",
      evidence: { authority: "exchange", displayRights: "unknown" },
    });
    expect(records.find((record) => record.ticker === "PETR3F")?.status).toBe("invalid");
    expect(records.find((record) => record.ticker === "VALE3")?.status).toBe("unmatched");
  });

  it("rejects rows whose detail URL does not match the B3 identity", () => {
    expect(() => parseB3CompanyDatePayload({
      retrievedAt: "2026-08-09T03:00:00.000Z",
      sourceRowCount: 1,
      records: [{
        status: "matched",
        issuingCompany: "PETR",
        codeCvm: "9512",
        companyName: "PETROBRAS",
        tradingName: "PETROBRAS",
        listingDate: "1968-08-27",
        quotationDate: null,
        codes: ["PETR3"],
        market: "BOVESPA NIVEL 2",
        sourceUrl: "https://example.com/PETR",
        sourceHash: null,
        retrievedAt: "2026-08-09T03:00:00.000Z",
      }],
    })).toThrow(/no valid matched records/);
  });
});
