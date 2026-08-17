import { describe, expect, it } from "vitest";
import { materializeIssuerFundamentalsAlias, normalizeFundamentals } from "../src/lib/market/fundamentals";

describe("issuer-level fundamentals aliases", () => {
  it("labels preferred-security aliases as issuer scope and preserves provenance", () => {
    const issuer = normalizeFundamentals({ returnOnEquity: 0.2, profitMargins: 0.1 });
    const alias = materializeIssuerFundamentalsAlias("BA-PA", "BA", issuer);
    expect(alias).toMatchObject({
      scope: "issuer",
      issuerTicker: "BA",
      resolution: "curated_issuer_alias",
      roe: 20,
      profitMargin: 10,
    });
    expect(alias?.source?.sourceRef).toBe("issuer:BA;alias:BA-PA");
  });
});
