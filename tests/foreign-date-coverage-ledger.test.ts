import { describe, expect, it } from "vitest";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import { buildForeignDateCoverageLedger } from "../src/lib/research/foreign-date-coverage-ledger";
import { SECURITY_EVENT_SCHEMA_VERSION, type SecurityEvent } from "../src/lib/research/security-birth";

const GENERATED_AT = "2026-08-09T00:00:00.000Z";

function event(securityId: string): SecurityEvent {
  return {
    schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
    securityId,
    kind: "first_trading_day",
    localDate: "2008-02-25",
    localTime: null,
    timePrecision: "unknown",
    timeZone: "Europe/Berlin",
    evidence: {
      authority: "exchange",
      sourceName: "Official exchange reference",
      sourceUrl: "https://example-exchange.test/reference",
      verification: "verified",
      displayRights: "unknown",
    },
  };
}

describe("foreign date evidence coverage ledger", () => {
  it("assigns one honest terminal evidence status to every current foreign catalog security", () => {
    const stocks = getGlobalStocks().filter(isResearchableStock);
    const ledger = buildForeignDateCoverageLedger(stocks, [], new Set(), GENERATED_AT);
    expect(ledger.total).toBe(stocks.length);
    expect(ledger.classified).toBe(stocks.length);
    expect(ledger.classifiedPct).toBe(100);
    expect(ledger.unclassified).toBe(0);
    expect(ledger.records.every((record) => record.status !== "unclassified")).toBe(true);
  });

  it("separates available dates, licence gaps, identity gaps, adapter gaps and quarantined candidates", () => {
    const stocks = [
      { ticker: "SIE", name: "Siemens AG", market: "XETR" },
      { ticker: "AMD", name: "Advanced Micro Devices", market: "BMV" },
      { ticker: "AAPL", name: "Apple Inc.", market: "NYSE/NASDAQ" },
      { ticker: "1155", name: "Malayan Banking Berhad", market: "BURSA" },
      { ticker: "ZZZ", name: "Missing ASX example", market: "ASX" },
      { ticker: "BBD.PR.B", name: "Bombardier preferred", market: "TSX" },
      { ticker: "000105", name: "Korean preferred", market: "KRX" },
    ];
    const ledger = buildForeignDateCoverageLedger(
      stocks,
      [event("XETR:SIE")],
      new Set(["ASX:ZZZ"]),
      GENERATED_AT,
    );
    expect(Object.fromEntries(ledger.records.map((record) => [record.securityId, record.status]))).toEqual({
      "ASX:ZZZ": "provider_candidate_requires_official_verification",
      "BMV:AMD": "licensed_source_required",
      "BURSA:1155": "official_adapter_no_match",
      "KRX:000105": "manual_official_research_required",
      "NYSE/NASDAQ:AAPL": "catalog_venue_resolution_required",
      "TSX:BBD.PR.B": "licensed_source_required",
      "XETR:SIE": "official_date_available",
    });
    expect(ledger.records.find((record) => record.securityId === "XETR:SIE")).toMatchObject({
      officialDate: "2008-02-25",
      exactFirstTradeTimeAvailable: false,
      commercialReadiness: "rights_review_required",
    });
    expect(ledger.classifiedPct).toBe(100);
  });

  it("surfaces a missing market policy instead of silently claiming completion", () => {
    const ledger = buildForeignDateCoverageLedger(
      [{ ticker: "TEST", name: "Test security", market: "UNKNOWN" }],
      [],
      new Set(),
      GENERATED_AT,
    );
    expect(ledger.classified).toBe(0);
    expect(ledger.unclassified).toBe(1);
    expect(ledger.records[0].status).toBe("unclassified");
  });

  it("uses an official current US venue to choose the honest next evidence route without claiming a date", () => {
    const ledger = buildForeignDateCoverageLedger(
      [{ ticker: "AAPL", name: "Apple Inc.", market: "NYSE/NASDAQ" }],
      [],
      new Set(),
      GENERATED_AT,
      new Map([["NYSE/NASDAQ:AAPL", {
        canonicalMarket: "NASDAQ",
        currentExchange: "Nasdaq Stock Market",
        sourceName: "Nasdaq Trader Symbol Directory",
        sourceUrl: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
      }]]),
    );
    expect(ledger.records[0]).toMatchObject({
      status: "licensed_source_required",
      officialDate: null,
      resolvedCurrentMarket: "NASDAQ",
      currentVenueName: "Nasdaq Stock Market",
      currentVenueEvidenceSource: "Nasdaq Trader Symbol Directory",
    });
    expect(ledger.records[0].reason).toContain("does not provide a first-trading date");
  });

  it("keeps a resolved Cboe venue classified while requiring issuer or exchange date research", () => {
    const ledger = buildForeignDateCoverageLedger(
      [{ ticker: "CBOE", name: "Cboe Global Markets", market: "NYSE/NASDAQ" }],
      [],
      new Set(),
      GENERATED_AT,
      new Map([["NYSE/NASDAQ:CBOE", {
        canonicalMarket: "CBOE",
        currentExchange: "Cboe BZX",
        sourceName: "Nasdaq Trader Symbol Directory",
        sourceUrl: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
      }]]),
    );
    expect(ledger.records[0]).toMatchObject({
      status: "issuer_or_exchange_research_required",
      sourcePolicyStatus: "current_identity_only",
      resolvedCurrentMarket: "CBOE",
      currentVenueName: "Cboe BZX",
      officialDate: null,
    });
  });
});
