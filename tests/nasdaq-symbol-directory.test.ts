import { describe, expect, it } from "vitest";
import {
  currentVenueResolutionsFromSnapshot,
  matchUsCatalogToNasdaqDirectory,
  parseNasdaqListedDirectory,
  parseOtherListedDirectory,
  parseUsCurrentVenueIdentityAliases,
} from "../src/lib/research/nasdaq-symbol-directory";

const NASDAQ = `Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares
AAPL|Apple Inc. - Common Stock|Q|N|N|100|N|N
ZTEST|Nasdaq Test Issue|Q|Y|N|100|N|N
File Creation Time: 0810202603:02|||||||
`;

const OTHER = `ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol
A|Agilent Technologies, Inc. Common Stock|N|A|N|100|N|A
BRK.B|Berkshire Hathaway Inc. New Common Stock|N|BRK.B|N|40|N|BRK.B
BAC$K|Bank of America Corporation Depositary Shares Series HH|N|BACpK|N|100|N|BAC-K
PLTR|Palantir Technologies Inc. Class A Common Stock|N|PLTR|N|100|N|PLTR
CBOE|Cboe Global Markets, Inc. Common Stock|Z|CBOE|N|40|N|CBOE
SLB|SLB Limited Common Shares|N|SLB|N|100|N|SLB
WAB|Westinghouse Air Brake Technologies Corporation Common Stock|N|WAB|N|100|N|WAB
ZXIET|IEX Test Company|V|ZXIET|N|100|Y|ZXIET
File Creation Time: 0810202603:02||||||
`;

describe("Nasdaq Trader current Symbol Directory", () => {
  const rows = [...parseNasdaqListedDirectory(NASDAQ), ...parseOtherListedDirectory(OTHER)];

  it("parses current non-test Nasdaq and other-exchange issues", () => {
    expect(rows.map((row) => row.symbol)).toEqual(["AAPL", "A", "BRK-B", "BAC-PK", "PLTR", "CBOE", "SLB", "WAB"]);
    expect(rows.find((row) => row.symbol === "AAPL")?.canonicalMarket).toBe("NASDAQ");
    expect(rows.find((row) => row.symbol === "A")?.canonicalMarket).toBe("NYSE");
  });

  it("resolves a legacy combined venue only after ticker and issuer identity match", () => {
    const records = matchUsCatalogToNasdaqDirectory([
      { ticker: "AAPL", market: "NYSE/NASDAQ", name: "Apple Inc." },
      { ticker: "BRK.B", market: "NYSE/NASDAQ", name: "Berkshire Hathaway" },
      { ticker: "BAC/PK", market: "NYSE/NASDAQ", name: "Bank of America preferred" },
      { ticker: "A", market: "NYSE/NASDAQ", name: "Different Reused Issuer" },
    ], rows);
    expect(records.find((record) => record.catalogTicker === "AAPL")).toMatchObject({
      status: "matched", venueResolved: true, canonicalMarket: "NASDAQ",
    });
    expect(records.find((record) => record.catalogTicker === "BRK.B")).toMatchObject({
      status: "matched", venueResolved: true, canonicalMarket: "NYSE",
    });
    expect(records.find((record) => record.catalogTicker === "BAC/PK")).toMatchObject({
      status: "matched", venueResolved: true, canonicalMarket: "NYSE",
    });
    expect(records.find((record) => record.catalogTicker === "A")).toMatchObject({
      status: "identity_mismatch", venueResolved: false,
    });
  });

  it("surfaces a stale explicit catalog exchange", () => {
    const [record] = matchUsCatalogToNasdaqDirectory(
      [{ ticker: "PLTR", market: "NASDAQ", name: "Palantir Technologies" }],
      rows,
    );
    expect(record).toMatchObject({ status: "exchange_mismatch", canonicalMarket: "NYSE", venueResolved: true });
  });

  it("uses strict issuer evidence for reviewed name changes and still surfaces unsupported date policies", () => {
    const aliases = parseUsCurrentVenueIdentityAliases({
      schemaVersion: 1,
      records: [
        {
          catalogSecurityId: "NYSE/NASDAQ:SLB",
          catalogTicker: "SLB",
          catalogMarket: "NYSE/NASDAQ",
          catalogName: "Schlumberger",
          officialSecurityName: "SLB Limited Common Shares",
          identityEvidenceSource: "SLB Investor FAQs",
          identityEvidenceUrl: "https://investorcenter.slb.com/investor-resources/investor-faqs/",
        },
        {
          catalogSecurityId: "NYSE/NASDAQ:WAB",
          catalogTicker: "WAB",
          catalogMarket: "NYSE/NASDAQ",
          catalogName: "Wabtec",
          officialSecurityName: "Westinghouse Air Brake Technologies Corporation Common Stock",
          identityEvidenceSource: "Wabtec issuer filing",
          identityEvidenceUrl: "https://ir.wabteccorp.com/static-files/example",
        },
      ],
    });
    const records = matchUsCatalogToNasdaqDirectory([
      { ticker: "SLB", market: "NYSE/NASDAQ", name: "Schlumberger" },
      { ticker: "WAB", market: "NYSE/NASDAQ", name: "Wabtec" },
      { ticker: "CBOE", market: "NYSE/NASDAQ", name: "Cboe Global Markets" },
    ], rows, aliases);
    expect(records.find((record) => record.catalogTicker === "SLB")).toMatchObject({
      status: "matched",
      venueResolved: true,
      canonicalMarket: "NYSE",
      identityEvidenceSource: "SLB Investor FAQs",
    });
    expect(records.find((record) => record.catalogTicker === "WAB")).toMatchObject({
      status: "matched",
      venueResolved: true,
      canonicalMarket: "NYSE",
      identityEvidenceSource: "Wabtec issuer filing",
    });
    expect(records.find((record) => record.catalogTicker === "CBOE")).toMatchObject({
      status: "unsupported_venue",
      venueResolved: true,
      canonicalMarket: "CBOE",
    });

    const resolutions = currentVenueResolutionsFromSnapshot({ schemaVersion: 1, records });
    expect(resolutions.get("NYSE/NASDAQ:CBOE")).toMatchObject({ canonicalMarket: "CBOE", currentExchange: "Cboe BZX" });
  });

  it("rejects identity supplements from non-issuer hosts", () => {
    expect(() => parseUsCurrentVenueIdentityAliases({
      schemaVersion: 1,
      records: [{
        catalogSecurityId: "NYSE/NASDAQ:SLB",
        catalogTicker: "SLB",
        catalogMarket: "NYSE/NASDAQ",
        catalogName: "Schlumberger",
        officialSecurityName: "SLB Limited Common Shares",
        identityEvidenceSource: "Untrusted mirror",
        identityEvidenceUrl: "https://example.com/slb",
      }],
    })).toThrow(/approved issuer host/);
  });
});
