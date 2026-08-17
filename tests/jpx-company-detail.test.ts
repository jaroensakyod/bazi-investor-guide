import { describe, expect, it } from "vitest";
import {
  JPX_PREFERRED_ISSUES_URL,
  jpxManagerCode,
  matchJpxOfficialDates,
  normalizeJpxCatalogTicker,
  parseJpxCompanyDatePayload,
  parseJpxCompanyDetail,
  parseJpxPreferredIssuesHtml,
} from "../src/lib/research/jpx-company-detail";

const DETAIL_HTML = `
  <div id="body_base">
    <h3 class="fontsizeM">トヨタ自動車</h3>
    <table><tr><th>コード</th><th>ISINコード</th></tr>
      <tr><td>72030</td><td>JP3633400001</td></tr></table>
    <table>
      <tr><th colspan="2">英文商号</th><th colspan="2">株主名簿管理人</th></tr>
      <tr><td colspan="2">TOYOTA MOTOR CORPORATION</td><td colspan="2">Agent</td></tr>
      <tr><th>設立年月日</th><th>本社所在地</th><th>上場取引所</th><th>月末投資単位</th></tr>
      <tr><td>1937/08/27</td><td>愛知</td><td>東 名</td><td>272,500</td></tr>
      <tr><th>株主総会開催日（予定）</th><th>代表者役職</th><th>代表者氏名</th><th>上場年月日</th></tr>
      <tr><td>2026/06/17</td><td>取締役社長</td><td>近 健太</td><td>1949/05/16</td></tr>
    </table>
  </div><div id="body_disclosure"></div>`;

describe("JPX listed-company detail", () => {
  it("parses the official establishment and listing fields without inventing time", () => {
    expect(parseJpxCompanyDetail(DETAIL_HTML, "72030")).toMatchObject({
      managerCode: "72030",
      companyName: "トヨタ自動車",
      companyNameEnglish: "TOYOTA MOTOR CORPORATION",
      isin: "JP3633400001",
      establishmentDate: "1937-08-27",
      listingDate: "1949-05-16",
      headOffice: "愛知",
      warnings: [],
    });
    expect(normalizeJpxCatalogTicker("7203.T")).toBe("7203");
    expect(jpxManagerCode("7203.T")).toBe("72030");
    expect(jpxManagerCode("285A")).toBe("285A0");
    expect(jpxManagerCode("92015")).toBe("92015");
  });

  it("builds separate date-only listing and company-origin events", () => {
    const records = matchJpxOfficialDates([{ ticker: "7203.T", market: "TSE", name: "Toyota" }], [{
      ticker: "7203",
      managerCode: "72030",
      companyName: "トヨタ自動車",
      companyNameEnglish: "TOYOTA MOTOR CORPORATION",
      isin: "JP3633400001",
      establishmentDate: "1937-08-27",
      listingDate: "1949-05-16",
      headOffice: "愛知",
    }], "2026-08-08T00:00:00.000Z");
    expect(records[0].events).toMatchObject([
      { kind: "exchange_admission", localDate: "1949-05-16", localTime: null, timeZone: "Asia/Tokyo" },
      { kind: "incorporation", localDate: "1937-08-27", localTime: null, timeZone: "Asia/Tokyo" },
    ]);
  });

  it("parses and promotes the official issue-level preferred-share table", () => {
    const rows = parseJpxPreferredIssuesHtml(`
      <table><tr><td>Listing Date</td><td>Code</td><td>Issue Name</td><td>Market Segment</td></tr>
      <tr><td>Jun. 04, 2026</td><td>92015</td><td>Series 1 <br/> Bond-Type Class Shares of Japan Airlines Co.,Ltd.</td><td>Prime</td></tr></table>
    `);
    expect(rows).toEqual([{
      ticker: "92015",
      issueName: "Series 1 Bond-Type Class Shares of Japan Airlines Co.,Ltd.",
      listingDate: "2026-06-04",
      marketSegment: "Prime",
    }]);

    const records = matchJpxOfficialDates(
      [{ ticker: "92015", market: "TSE", name: "JAL Series 1" }],
      parseJpxCompanyDatePayload({ records: [{
        status: "matched",
        ticker: "92015",
        managerCode: "92015",
        companyName: "Series 1 Bond-Type Class Shares of Japan Airlines Co.,Ltd.",
        listingDate: "2026-06-04",
        sourceType: "preferred_issue_list",
        sourceUrl: JPX_PREFERRED_ISSUES_URL,
      }] }),
      "2026-08-10T00:00:00.000Z",
    );
    expect(records[0].events[0]).toMatchObject({
      localDate: "2026-06-04",
      evidence: { authority: "exchange", sourceUrl: JPX_PREFERRED_ISSUES_URL },
    });
  });
});
