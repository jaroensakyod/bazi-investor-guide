import { describe, expect, it } from "vitest";
import {
  isAcceptableSecUserAgent,
  matchUsCatalogToSec,
  normalizeUsTicker,
  parseSecTickerExchange,
} from "../src/lib/research/sec-security-master";

describe("isAcceptableSecUserAgent", () => {
  it("requires an organization and rejects documentation placeholders", () => {
    expect(isAcceptableSecUserAgent("Bazi Investor Guide data@bazi.example.th")).toBe(true);
    expect(isAcceptableSecUserAgent("data@bazi.example.th")).toBe(false);
    expect(isAcceptableSecUserAgent("Bazi Investor Guide contact@example.com")).toBe(false);
    expect(isAcceptableSecUserAgent("Bazi Investor Guide")).toBe(false);
  });
});

describe("SEC US security master", () => {
  const rows = parseSecTickerExchange({
    fields: ["cik", "name", "ticker", "exchange"],
    data: [
      [320193, "Apple Inc.", "AAPL", "Nasdaq"],
      [1067983, "Berkshire Hathaway Inc.", "BRK-B", "NYSE"],
      [1321655, "Palantir Technologies Inc.", "PLTR", "Nasdaq"],
    ],
  });

  it("parses the official field-indexed payload", () => {
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ cik: 320193, issuerName: "Apple Inc.", ticker: "AAPL", exchange: "Nasdaq" });
  });

  it("normalizes US class-share notation without merging venues", () => {
    expect(normalizeUsTicker("brk.b")).toBe("BRK-B");
    const [record] = matchUsCatalogToSec([{ ticker: "BRK.B", market: "NYSE/NASDAQ", name: "Berkshire" }], rows);
    expect(record.matchStatus).toBe("normalized");
    expect(record.canonicalSecurityId).toBe("NYSE:BRK-B");
    expect(record.catalogMigrationNeeded).toBe(true);
  });

  it("surfaces a stale explicit venue instead of silently rewriting it", () => {
    const [record] = matchUsCatalogToSec([{ ticker: "PLTR", market: "NYSE", name: "Palantir" }], rows);
    expect(record.matchStatus).toBe("exchange_mismatch");
    expect(record.canonicalSecurityId).toBe("NASDAQ:PLTR");
  });
});
