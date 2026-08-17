import { describe, expect, it } from "vitest";
import {
  matchSzseOfficialDates,
  normalizeSzseCatalogTicker,
  parseSzseSecurityList,
  szseSecurityListApiUrl,
} from "../src/lib/research/szse-security-list";

describe("SZSE official security list", () => {
  const rawPage = [{
    metadata: { tabkey: "tab1", pageno: 1, pagecount: 145 },
    data: [
      { bk: "主板", agdm: "000333", agjc: "<a><u>美的集团</u></a>", agssrq: "2013-09-18" },
      { bk: "创业板", agdm: "300750", agjc: "<a><u>宁德时代</u></a>", agssrq: "2018-06-11" },
    ],
  }];
  const rawBSharePage = [{
    metadata: { tabkey: "tab2", pageno: 1, pagecount: 2 },
    data: [
      { bk: "主板", bgdm: "200429", bgjc: "<a><u>粤高速Ｂ</u></a>", bgssrq: "1996-08-15" },
    ],
  }];

  it("parses a paginated ShowReport response and normalized XLSX bridge", () => {
    expect(parseSzseSecurityList({ pages: [rawPage] })).toMatchObject([
      { ticker: "000333", listingDate: "2013-09-18", board: "主板", shortName: "美的集团" },
      { ticker: "300750", listingDate: "2018-06-11", board: "创业板", shortName: "宁德时代" },
    ]);
    expect(parseSzseSecurityList({ rows: [{
      ticker: "002594",
      listingDate: "2011-06-30",
      board: "主板",
      shortName: "比亚迪",
      securityType: "A",
    }] })).toHaveLength(1);
    expect(normalizeSzseCatalogTicker("000333.SZ")).toBe("000333");
    expect(szseSecurityListApiUrl(2)).toContain("PAGENO=2");
    expect(szseSecurityListApiUrl(1, "tab2")).toContain("TABKEY=tab2");
    expect(parseSzseSecurityList({ pages: [rawBSharePage] })).toEqual([
      expect.objectContaining({
        ticker: "200429",
        listingDate: "1996-08-15",
        shortName: "粤高速Ｂ",
        securityType: "B",
      }),
    ]);
  });

  it("creates only date-level official events for exact ticker matches", () => {
    const records = matchSzseOfficialDates([
      { ticker: "000333.SZ", market: "SZSE", name: "Midea" },
      { ticker: "300750.SZ", market: "SZSE", name: "CATL" },
      { ticker: "999999.SZ", market: "SZSE", name: "Missing" },
    ], parseSzseSecurityList(rawPage), "2026-08-08T00:00:00.000Z");
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localTime: null,
      timePrecision: "unknown",
      timeZone: "Asia/Shanghai",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "999999.SZ")?.status).toBe("unmatched");
  });

  it("matches B-share records from the separate official tab2 feed", () => {
    const [record] = matchSzseOfficialDates([
      { ticker: "200429", market: "SZSE", name: "Guangdong Provincial Expressway Development Class B" },
    ], parseSzseSecurityList(rawBSharePage), "2026-08-09T00:00:00.000Z");
    expect(record).toMatchObject({
      status: "matched",
      listingDate: "1996-08-15",
      events: [{ evidence: { sourceName: "Shenzhen Stock Exchange — B-share List" } }],
    });
  });
});
