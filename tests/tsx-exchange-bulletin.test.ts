import { describe, expect, it } from "vitest";
import {
  matchTsxBulletinOfficialDates,
  parseTsxBulletinDate,
  parseTsxExchangeBulletin,
  parseTsxExchangeBulletinPayload,
  tsxExchangeBulletinUrl,
} from "../src/lib/research/tsx-exchange-bulletin";

const RETRIEVED_AT = "2026-08-10T07:00:00.000Z";

const MULTI_CLASS_HTML = `
  <h2>Canadian Large Cap Leaders Split Corp.&nbsp;(NPS, NPS.PR.A)&nbspTo Trade On Toronto Stock Exchange</h2>
  <div class="content_wrapper">
    <table><tbody>
      <tr><td>Listing date:</td><td>February 21, 2024 (as at 5:01 pm) in anticipation of closing.</td></tr>
      <tr><td>Posted for trading date:</td><td>February 22, 2024 (at the opening).</td></tr>
    </tbody></table>
  </div>
  <div id="page-sidebar"></div>
`;

describe("TSX exact-security exchange bulletins", () => {
  it("parses constrained URLs and valid English dates", () => {
    expect(tsxExchangeBulletinUrl(1737)).toBe("https://www.tsx.com/en/news/new-company-listings?id=1737");
    expect(() => tsxExchangeBulletinUrl(0)).toThrow();
    expect(parseTsxBulletinDate("February 29, 2024 (at the opening)")).toBe("2024-02-29");
    expect(parseTsxBulletinDate("February 29, 2023")).toBeNull();
  });

  it("extracts every exact symbol while keeping listing and trading dates separate", () => {
    const rows = parseTsxExchangeBulletin(MULTI_CLASS_HTML, 1737, RETRIEVED_AT);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.symbol)).toEqual(["NPS", "NPS.PR.A"]);
    expect(rows[1]).toMatchObject({
      issuerName: "Canadian Large Cap Leaders Split Corp.",
      listingDate: "2024-02-21",
      postedForTradingDate: "2024-02-22",
      sourceUrl: "https://www.tsx.com/en/news/new-company-listings?id=1737",
    });
  });

  it("does not infer a date from a narrative-only bulletin", () => {
    const html = `
      <h2>Azarga Uranium Corp.&nbsp;(AZZ)&nbspTo Trade On Toronto Stock Exchange</h2>
      <p>The shares will be listed and posted for trading at the opening on Friday.</p>
      <div id="page-sidebar"></div>
    `;
    expect(parseTsxExchangeBulletin(html, 1, RETRIEVED_AT)).toEqual([]);
  });

  it("matches both exact symbol and issuer identity and emits exchange evidence", () => {
    const parsedRows = parseTsxExchangeBulletin(MULTI_CLASS_HTML, 1737, RETRIEVED_AT);
    const payload = parseTsxExchangeBulletinPayload({
      retrievedAt: RETRIEVED_AT,
      firstBulletinId: 1,
      lastBulletinId: 1737,
      processedBulletinCount: 1737,
      records: parsedRows,
    });
    const records = matchTsxBulletinOfficialDates([
      { ticker: "NPS.PR.A.TO", market: "TSX", name: "Canadian Large Cap Leaders Split Corp Preferred Shares" },
      { ticker: "NPS", market: "TSX", name: "Unrelated NPS Corporation" },
    ], payload);
    expect(records[0].status).toBe("unmatched");
    expect(records[1].status).toBe("matched");
    expect(records[1].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2024-02-21",
      evidence: {
        authority: "exchange",
        sourceUrl: "https://www.tsx.com/en/news/new-company-listings?id=1737",
      },
    });
    expect(records[1].events[0].note).toContain("Posted for trading date 2024-02-22");
  });

  it("rejects unofficial source URLs during payload validation", () => {
    const row = parseTsxExchangeBulletin(MULTI_CLASS_HTML, 1737, RETRIEVED_AT)[0];
    const payload = parseTsxExchangeBulletinPayload({
      retrievedAt: RETRIEVED_AT,
      firstBulletinId: 1,
      lastBulletinId: 1737,
      processedBulletinCount: 1737,
      records: [{ ...row, sourceUrl: "https://example.com/bulletin" }],
    });
    expect(payload.records).toEqual([]);
  });
});
