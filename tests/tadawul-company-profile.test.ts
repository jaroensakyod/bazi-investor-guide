import { describe, expect, it } from "vitest";
import {
  matchTadawulOfficialDates,
  parseTadawulCompanyDatePayload,
  parseTadawulProfileDate,
  tadawulCompanyProfileUrl,
} from "../src/lib/research/tadawul-company-profile";

const PAYLOAD = {
  schemaVersion: 1,
  retrievedAt: "2026-08-08T12:19:59.394Z",
  records: [
    { symbol: "2222", name: "SAUDI ARAMCO", listingDate: "2019/12/11", establishedDate: "1988/11/13", isin: "SA14TG012N13" },
    { symbol: "1010", name: "RIBL", listingDate: null, establishedDate: "1957/11/23", isin: "SA0007879048" },
  ],
};

describe("Saudi Exchange company profiles", () => {
  it("normalizes validated profile dates and preserves null official dates", () => {
    const parsed = parseTadawulCompanyDatePayload(PAYLOAD);
    expect(parsed.records[0].listingDate).toBe("2019-12-11");
    expect(parsed.records[1].listingDate).toBeNull();
    expect(parseTadawulProfileDate("2024/02/29")).toBe("2024-02-29");
    expect(parseTadawulProfileDate("2023/02/29")).toBeNull();
  });

  it("matches exact symbols and emits separate listing and company-origin events", () => {
    const records = matchTadawulOfficialDates([
      { ticker: "2222", market: "TADAWUL", name: "Saudi Aramco" },
      { ticker: "1010", market: "TADAWUL", name: "Riyad Bank" },
      { ticker: "9999", market: "TADAWUL", name: "Missing" },
    ], parseTadawulCompanyDatePayload(PAYLOAD));
    expect(records[0].events.map((event) => event.kind)).toEqual(["incorporation"]);
    expect(records[0].status).toBe("invalid");
    expect(records[1].events).toHaveLength(2);
    expect(records[1].events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "2019-12-11",
      localTime: null,
      timeZone: "Asia/Riyadh",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records[1].events[1]).toMatchObject({ kind: "incorporation", localDate: "1988-11-13" });
    expect(records[2].status).toBe("unmatched");
  });

  it("builds a directly attributable official profile URL", () => {
    expect(tadawulCompanyProfileUrl("2222")).toContain("companySymbol=2222");
  });
});
