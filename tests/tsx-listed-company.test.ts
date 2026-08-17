import { describe, expect, it } from "vitest";
import {
  matchTsxOfficialDates,
  hasTsxIssuerIdentityOverlap,
  normalizeTsxCatalogTicker,
  parseTsxListedCompanyPayload,
  parseTsxListingDate,
  tsxCompanyDirectorySearchUrl,
  type TsxListedCompanyRow,
} from "../src/lib/research/tsx-listed-company";

const RETRIEVED_AT = "2026-08-09T03:00:00.000Z";

function row(overrides: Partial<TsxListedCompanyRow> = {}): TsxListedCompanyRow {
  return {
    issuerId: "BMO0001",
    rootTicker: "BMO",
    issuerName: "Bank of Montreal",
    listingType: "Other",
    listingDate: "1907-01-02",
    rootInstrumentConfirmed: true,
    currentDirectoryIssuerName: "Bank of Montreal",
    currentInstrumentName: "Bank of Montreal",
    xlsxSourceUrl: "https://www.tsx.com/en/resource/571",
    xlsxSourceHash: "a".repeat(64),
    directorySourceUrl: "https://www.tsx.com/en/listings/listing-with-us/listed-company-directory",
    directorySnapshotHash: "b".repeat(64),
    retrievedAt: RETRIEVED_AT,
    ...overrides,
  };
}

function payload(records: TsxListedCompanyRow[]) {
  return parseTsxListedCompanyPayload({
    retrievedAt: RETRIEVED_AT,
    sourceRowCount: 2_258,
    directoryIssuerCount: 2_200,
    records,
  });
}

describe("TSX current listed-company dates", () => {
  it("parses compact official dates and normalizes only the Yahoo venue suffix", () => {
    expect(parseTsxListingDate("20231221")).toBe("2023-12-21");
    expect(parseTsxListingDate("2024-02-29")).toBe("2024-02-29");
    expect(parseTsxListingDate("2023-02-29")).toBeNull();
    expect(normalizeTsxCatalogTicker("BMO.TO")).toBe("BMO");
    expect(normalizeTsxCatalogTicker("GIB.A.TO")).toBe("GIB.A");
  });

  it("uses a constrained official directory query URL", () => {
    expect(tsxCompanyDirectorySearchUrl("A")).toBe("https://www.tsx.com/json/company-directory/search/tsx/A");
    expect(tsxCompanyDirectorySearchUrl("0-9")).toBe("https://www.tsx.com/json/company-directory/search/tsx/0-9");
    expect(() => tsxCompanyDirectorySearchUrl("../tsxv/A")).toThrow();
  });

  it("requires at least one issuer identity token after exact ticker confirmation", () => {
    expect(hasTsxIssuerIdentityOverlap("AtkinsRéalis", "AtkinsRealis Group Inc.")).toBe(true);
    expect(hasTsxIssuerIdentityOverlap("OpenText", "Open Text Corporation")).toBe(true);
    expect(hasTsxIssuerIdentityOverlap("Barrick Gold", "GoldMining Inc.")).toBe(false);
  });

  it("promotes an issuer-level date only for an exact current tradable root", () => {
    const result = matchTsxOfficialDates(
      [{ ticker: "BMO.TO", market: "TSX", name: "Bank of Montreal" }],
      payload([row()]),
    )[0];
    expect(result.status).toBe("matched");
    expect(result.listingDate).toBe("1907-01-02");
    expect(result.events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1907-01-02",
      localTime: null,
      timeZone: "America/Toronto",
      evidence: { authority: "exchange", verification: "verified", displayRights: "unknown" },
    });
    expect(result.events[0].note).toContain("issuer-level");
  });

  it("accepts a narrowly reviewed current brand-to-legal-name alias", () => {
    const result = matchTsxOfficialDates(
      [{ ticker: "BNS.TO", market: "TSX", name: "Scotiabank" }],
      payload([row({
        issuerId: "BAN0006",
        rootTicker: "BNS",
        issuerName: "Bank of Nova Scotia (The)",
        currentDirectoryIssuerName: "Bank of Nova Scotia (The)",
        currentInstrumentName: "Bank of Nova Scotia",
      })]),
    )[0];
    expect(result.status).toBe("matched");
  });

  it("does not lend an issuer-root date to a non-tradable root or share class", () => {
    const rootResult = matchTsxOfficialDates(
      [{ ticker: "TECK", market: "TSX", name: "Teck Resources" }],
      payload([row({
        issuerId: "TEC0001",
        rootTicker: "TECK",
        issuerName: "Teck Resources Limited",
        rootInstrumentConfirmed: false,
        currentDirectoryIssuerName: "Teck Resources Limited",
        currentInstrumentName: null,
      })]),
    )[0];
    expect(rootResult.status).toBe("unmatched");
    expect(rootResult.events).toHaveLength(0);
    expect(rootResult.warnings[0]).toContain("not itself a current tradable instrument");

    const classResult = matchTsxOfficialDates(
      [{ ticker: "GIB.A.TO", market: "TSX", name: "CGI Inc." }],
      payload([row({ rootTicker: "GIB", issuerId: "CGI0001", issuerName: "CGI Inc." })]),
    )[0];
    expect(classResult.status).toBe("unmatched");
    expect(classResult.events).toHaveLength(0);
  });

  it("rejects a catalog venue error even when another current TSX issuer owns the ticker", () => {
    const result = matchTsxOfficialDates(
      [{ ticker: "GOLD", market: "TSX", name: "Barrick Gold" }],
      payload([row({
        issuerId: "GOL0001",
        rootTicker: "GOLD",
        issuerName: "GoldMining Inc.",
        currentDirectoryIssuerName: "GoldMining Inc.",
        currentInstrumentName: "GoldMining Inc.",
      })]),
    )[0];
    expect(result.status).toBe("unmatched");
    expect(result.events).toHaveLength(0);
    expect(result.warnings[0]).toContain("share no identity token");
  });

  it("rejects unofficial provenance and ambiguous issuer roots", () => {
    expect(() => parseTsxListedCompanyPayload({
      retrievedAt: RETRIEVED_AT,
      records: [row({ xlsxSourceUrl: "https://example.com/tsx.xlsx" })],
    })).toThrow("no valid");

    const result = matchTsxOfficialDates(
      [{ ticker: "BMO.TO", market: "TSX", name: "Bank of Montreal" }],
      payload([row(), row({ issuerId: "BMO0002", listingDate: "2000-01-01" })]),
    )[0];
    expect(result.status).toBe("ambiguous");
    expect(result.events).toHaveLength(0);
  });
});
