import { describe, expect, it } from "vitest";
import {
  matchTwseOfficialDates,
  parseTwseCompanyBasic,
  parseTwseOfficialDateSupplements,
} from "../src/lib/research/twse-company-basic";

describe("TWSE official company-basic dates", () => {
  const rows = parseTwseCompanyBasic([
    {
      公司代號: "2330",
      公司名稱: "台灣積體電路製造股份有限公司",
      公司簡稱: "台積電",
      成立日期: "19870221",
      上市日期: "19940905",
      外國企業註冊地國: "－ ",
    },
    {
      公司代號: "3665",
      公司名稱: "貿聯控股公司",
      公司簡稱: "貿聯-KY",
      成立日期: "20000412",
      上市日期: "20110421",
      外國企業註冊地國: "KY 開曼群島",
    },
  ]);

  it("maps exact tickers and creates date-only exchange events", () => {
    const records = matchTwseOfficialDates([
      { ticker: "2330", market: "TWSE", name: "TSMC" },
      { ticker: "2002A", market: "TWSE", name: "China Steel preferred" },
    ], rows, "2026-08-08T00:00:00.000Z");
    expect(records[0].status).toBe("unmatched");
    expect(records[1].status).toBe("matched");
    expect(records[1].listingDate).toBe("1994-09-05");
    expect(records[1].events.find((event) => event.kind === "exchange_admission")).toMatchObject({
      localTime: null,
      timeZone: "Asia/Taipei",
      evidence: { authority: "exchange", verification: "verified" },
    });
  });

  it("keeps foreign company origin in its registered jurisdiction", () => {
    const [record] = matchTwseOfficialDates(
      [{ ticker: "3665", market: "TWSE", name: "BizLink" }],
      rows,
      "2026-08-08T00:00:00.000Z",
    );
    expect(record.events.find((event) => event.kind === "incorporation")).toMatchObject({
      localDate: "2000-04-12",
      timeZone: "America/Cayman",
      venueCountry: "KY",
    });
  });

  it("accepts a reviewed exact-security preferred-share row from TWSE ISIN", () => {
    const supplements = parseTwseOfficialDateSupplements([{
      ticker: "2002A",
      companyName: "China Steel Corporation Preferred Stock",
      isin: "TW0002002A04",
      listingDate: "1974-12-26",
      sourceName: "TWSE ISIN Query by Classification — Preferred Stocks",
      sourceUrl: "https://isin.twse.com.tw/isin/class_main.jsp?owncode=2002A&market=1&issuetype=A",
    }]);
    const [record] = matchTwseOfficialDates(
      [{ ticker: "2002A", market: "TWSE", name: "China Steel preferred" }],
      supplements,
      "2026-08-10T00:00:00.000Z",
    );
    expect(record).toMatchObject({ status: "matched", listingDate: "1974-12-26" });
    expect(record.events[0]).toMatchObject({
      securityId: "TWSE:2002A",
      localDate: "1974-12-26",
      evidence: {
        sourceName: "TWSE ISIN Query by Classification — Preferred Stocks",
        sourceUrl: "https://isin.twse.com.tw/isin/class_main.jsp?owncode=2002A&market=1&issuetype=A",
      },
      note: expect.stringContaining("TW0002002A04"),
    });
  });

  it("rejects unofficial or malformed preferred-share supplements", () => {
    expect(() => parseTwseOfficialDateSupplements([{
      ticker: "2002A",
      companyName: "China Steel preferred",
      isin: "TW0002002A04",
      listingDate: "1974-12-26",
      sourceName: "Unofficial mirror",
      sourceUrl: "https://example.com/2002A",
    }])).toThrow(/official TWSE HTTPS source/);
  });
});
