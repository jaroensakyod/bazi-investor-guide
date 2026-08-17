import { describe, expect, it } from "vitest";
import { buildYahooDateCandidate } from "../src/lib/research/provider-date-candidate";

describe("foreign provider date quarantine", () => {
  it("converts the provider timestamp to venue-local date but never creates security-birth evidence", () => {
    const candidate = buildYahooDateCandidate(
      { ticker: "AAPL", market: "NASDAQ" },
      "AAPL",
      {
        symbol: "AAPL",
        firstTradeDateMilliseconds: 345479400000,
        exchangeTimezoneName: "America/New_York",
        exchange: "NMS",
        fullExchangeName: "NasdaqGS",
      },
      Date.UTC(2026, 7, 8),
    );
    expect(candidate.status).toBe("candidate");
    expect(candidate.candidateLocalDate).toBe("1980-12-12");
    expect(candidate.eligibleForSecurityBirth).toBe(false);
    expect(candidate.limitation).toContain("official evidence");
  });

  it("keeps missing metadata out of canonical calculations", () => {
    const candidate = buildYahooDateCandidate(
      { ticker: "7203", market: "TSE" },
      "7203.T",
      undefined,
      Date.UTC(2026, 7, 8),
    );
    expect(candidate.status).toBe("missing");
    expect(candidate.candidateLocalDate).toBeNull();
    expect(candidate.eligibleForSecurityBirth).toBe(false);
  });

  it("rejects future timestamps", () => {
    const now = Date.UTC(2026, 7, 8);
    const candidate = buildYahooDateCandidate(
      { ticker: "TEST", market: "NASDAQ" },
      "TEST",
      {
        symbol: "TEST",
        firstTradeDateMilliseconds: now + 2 * 86_400_000,
        exchangeTimezoneName: "America/New_York",
      },
      now,
    );
    expect(candidate.status).toBe("rejected");
  });
});

