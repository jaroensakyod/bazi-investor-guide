import { describe, expect, it } from "vitest";
import { getGlobalStocks } from "../src/lib/investor/stock-database";
import { FOREIGN_DATE_SOURCE_POLICIES } from "../src/lib/research/foreign-date-source-policy";

describe("foreign date source policy", () => {
  it("covers every foreign market in the catalog exactly once", () => {
    const catalogMarkets = [...new Set(getGlobalStocks().map((stock) => stock.market))].sort();
    const policyMarkets = FOREIGN_DATE_SOURCE_POLICIES.map((policy) => policy.market).sort();
    expect(policyMarkets).toEqual(catalogMarkets);
    expect(new Set(policyMarkets).size).toBe(policyMarkets.length);
  });

  it("uses valid venue time zones and keeps the legacy combined US venue unresolved", () => {
    for (const policy of FOREIGN_DATE_SOURCE_POLICIES) {
      expect(() => new Intl.DateTimeFormat("en-US", { timeZone: policy.timeZone }).format()).not.toThrow();
    }
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "NYSE/NASDAQ")?.status)
      .toBe("catalog_venue_resolution_required");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "TWSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "NSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "SSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "SZSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "TSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "LSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "KRX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "KRX")?.unresolvedAfterAdapter)
      .toBe("official_source_manual_retrieval_required");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "ASX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "PSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "TADAWUL")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "IDX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "HOSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "SGX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "HKEX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "HKEX")?.preferredAuthority)
      .toBe("licensed_market_data");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "BOVESPA")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "KSE")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "EPA")?.status)
      .toBe("licensed_feed_required");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "BMV")?.status)
      .toBe("licensed_feed_required");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "BURSA")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "SWX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "XETR")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "TSX")?.status)
      .toBe("official_adapter_ready");
    expect(FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === "TSX")?.unresolvedAfterAdapter)
      .toBe("licensed_feed_required");
  });
});
