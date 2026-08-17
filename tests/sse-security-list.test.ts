import { describe, expect, it } from "vitest";
import {
  matchSseOfficialDates,
  normalizeSseCatalogTicker,
  parseSseSecurityList,
  sseSecurityListApiUrl,
} from "../src/lib/research/sse-security-list";

describe("SSE official security list", () => {
  const rows = [
    ...parseSseSecurityList({ result: [{
      STOCK_TYPE: "1",
      A_STOCK_CODE: "600519",
      COMPANY_CODE: "600519",
      FULL_NAME: "贵州茅台酒股份有限公司",
      FULL_NAME_IN_ENGLISH: "Kweichow Moutai Co.,Ltd.",
      LIST_DATE: "20010827",
    }] }),
    ...parseSseSecurityList({ result: [{
      STOCK_TYPE: "2",
      B_STOCK_CODE: "900945",
      COMPANY_CODE: "600221",
      FULL_NAME: "海南航空控股股份有限公司",
      LIST_DATE: "19971120",
    }] }),
  ];

  it("parses A- and B-share codes with official compact dates", () => {
    expect(rows).toMatchObject([
      { ticker: "600519", listingDate: "2001-08-27" },
      { ticker: "900945", listingDate: "1997-11-20" },
    ]);
    expect(normalizeSseCatalogTicker("600519.SS")).toBe("600519");
    expect(sseSecurityListApiUrl("8")).toContain("STOCK_TYPE=8");
  });

  it("matches exact SSE securities and flags a Shenzhen prefix for migration", () => {
    const records = matchSseOfficialDates([
      { ticker: "600519.SS", market: "SSE", name: "Moutai" },
      { ticker: "900945", market: "SSE", name: "Hainan Airlines B" },
      { ticker: "300750", market: "SSE", name: "CATL" },
    ], rows, "2026-08-08T00:00:00.000Z");
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "600519.SS")?.events[0]).toMatchObject({
      localDate: "2001-08-27",
      localTime: null,
      timeZone: "Asia/Shanghai",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "300750")).toMatchObject({
      status: "unmatched",
      catalogMigrationHint: "SZSE",
    });
  });
});
