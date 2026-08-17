import { describe, expect, it } from "vitest";
import {
  matchKrxOfficialDates,
  normalizeKrxCatalogTicker,
  parseKrxKindCompanyList,
  parseKrxKindListingDate,
} from "../src/lib/research/krx-kind-company-list";

const HTML = `
<html><body><table>
  <tr><th>회사명</th><th>시장구분</th><th>종목코드</th><th>업종</th><th>주요제품</th><th>상장일</th><th>결산월</th><th>대표자명</th><th>홈페이지</th><th>지역</th></tr>
  <tr><td>삼성전자</td><td>유가증권</td><td style="mso-number-format:'@'">005930</td><td>통신 및 방송 장비 제조업</td><td>반도체</td><td>1975-06-11</td><td>12월</td><td>대표자</td><td>https://www.samsung.com</td><td>경기도</td></tr>
  <tr><td>잘못된 날짜</td><td>코스닥</td><td>999999</td><td>테스트</td><td>테스트</td><td>2024-02-30</td><td>12월</td><td>대표자</td><td></td><td>서울특별시</td></tr>
</table></body></html>`;

describe("KRX KIND listed-company file", () => {
  it("parses the official listing-date column and preserves six-character codes", () => {
    const rows = parseKrxKindCompanyList(HTML);
    expect(rows[0]).toMatchObject({
      ticker: "005930",
      companyName: "삼성전자",
      marketName: "유가증권",
      listingDate: "1975-06-11",
    });
    expect(rows[1].listingDate).toBeNull();
    expect(parseKrxKindListingDate("2024-02-29")).toBe("2024-02-29");
    expect(parseKrxKindListingDate("2023-02-29")).toBeNull();
  });

  it("normalizes only known Yahoo venue suffixes", () => {
    expect(normalizeKrxCatalogTicker("005930.KS")).toBe("005930");
    expect(normalizeKrxCatalogTicker("035720.KQ")).toBe("035720");
    expect(normalizeKrxCatalogTicker("02826K")).toBe("02826K");
  });

  it("matches the exact code and creates a date-only official event", () => {
    const records = matchKrxOfficialDates([
      { ticker: "005930.KS", market: "KRX", name: "Samsung Electronics" },
      { ticker: "MISSING", market: "KRX", name: "Missing" },
    ], parseKrxKindCompanyList(HTML), "2026-08-08T00:00:00.000Z");
    expect(records[0]).toMatchObject({ status: "matched", sourceTicker: "005930", listingDate: "1975-06-11" });
    expect(records[0].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1975-06-11",
      localTime: null,
      timeZone: "Asia/Seoul",
    });
    expect(records[1].status).toBe("unmatched");
  });
});
