import { describe, expect, it } from "vitest";
import { extractSetFactsheet, parseSetFactsheetDate } from "../src/lib/research/set-factsheet";

describe("SET factsheet evidence parser", () => {
  it("parses exact establishment and listing dates without inventing a time", () => {
    const html = `
      <div><label>Establish Date</label> <span>20/07/1984</span></div>
      <div><label>Listed Date</label> <span>30 Sep 1992</span></div>
    `;
    const result = extractSetFactsheet({
      ticker: "AP",
      market: "SET",
      html,
      sourceUrl: "https://www.set.or.th/en/market/product/stock/quote/AP/factsheet",
      retrievedAt: "2026-08-08T00:00:00.000Z",
      catalogFoundedYear: 1984,
    });

    expect(result.establishment).toMatchObject({ precision: "day", isoDate: "1984-07-20" });
    expect(result.listing).toMatchObject({ precision: "day", isoDate: "1992-09-30" });
    expect(result.events).toHaveLength(2);
    expect(result.events.every((event) => event.localTime === null)).toBe(true);
    expect(result.events.every((event) => event.evidence.authority === "exchange")).toBe(true);
    expect(result.events.every((event) => event.evidence.displayRights === "unknown")).toBe(true);
  });

  it("keeps a year-only establishment date as partial evidence", () => {
    const html = `
      <div><label>Establish Date</label><span>1982</span></div>
      <div><label>Listed Date</label><span>19 Oct 2010</span></div>
    `;
    const result = extractSetFactsheet({
      ticker: "GUNKUL",
      market: "SET",
      html,
      sourceUrl: "https://www.set.or.th/en/market/product/stock/quote/GUNKUL/factsheet",
      retrievedAt: "2026-08-08T00:00:00.000Z",
    });

    expect(result.establishment).toEqual({ precision: "year", raw: "1982", year: 1982 });
    expect(result.events.map((event) => event.kind)).toEqual(["exchange_admission"]);
    expect(result.warnings.join(" ")).toContain("ไม่สร้างวันที่สมมติ");
  });

  it("flags possible successor lineage for same-day establishment and listing", () => {
    const html = `
      <label>Establish Date</label><span>01/04/2025</span>
      <label>Listed Date</label><span>01 Apr 2025</span>
    `;
    const result = extractSetFactsheet({
      ticker: "GULF",
      market: "SET",
      html,
      sourceUrl: "https://www.set.or.th/en/market/product/stock/quote/GULF/factsheet",
      retrievedAt: "2026-08-08T00:00:00.000Z",
    });

    expect(result.lineageReviewReasons).toHaveLength(1);
  });

  it("rejects impossible dates and accepts supported English month forms", () => {
    expect(parseSetFactsheetDate("31/02/2024")).toEqual({ precision: "invalid", raw: "31/02/2024" });
    expect(parseSetFactsheetDate("5 November 1991")).toMatchObject({ precision: "day", isoDate: "1991-11-05" });
    expect(parseSetFactsheetDate("-")).toEqual({ precision: "missing", raw: "-" });
  });
});
