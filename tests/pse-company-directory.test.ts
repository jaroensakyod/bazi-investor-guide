import { describe, expect, it } from "vitest";
import {
  matchPseOfficialDates,
  normalizePseCatalogTicker,
  parsePseCompanyDirectory,
  parsePseDirectoryPageCount,
  parsePseListingDate,
  parsePseStockDataPage,
  parsePseStockDataSecurityOptions,
  pseCompanyDirectorySearchUrl,
  pseStockDataUrl,
} from "../src/lib/research/pse-company-directory";

const HTML = `
<span class="count">[1 / 6] [Total 282]</span>
<table><tbody>
<tr>
  <td><a onclick="cmDetail('180','293');return false;">Ayala Land, Inc.</a></td>
  <td class="alignC">ALI</td><td>Property</td><td>Property</td><td class="alignC">Jul 05, 1991</td>
</tr>
<tr>
  <td><a onclick="cmDetail('57','180');return false;">Ayala Corporation</a></td>
  <td class="alignC">AC</td><td>Holding Firms</td><td>Holding Firms</td><td class="alignC">Nov 08, 1976</td>
</tr>
</tbody></table>`;

describe("PSE EDGE Company List", () => {
  it("parses page metadata, rows and validated listing dates", () => {
    expect(parsePseDirectoryPageCount(HTML)).toBe(6);
    expect(parsePseListingDate("Feb 29, 2024")).toBe("2024-02-29");
    expect(parsePseListingDate("Feb 29, 2023")).toBeNull();
    expect(parsePseCompanyDirectory({ pages: [HTML] })).toEqual([
      {
        companyId: "180",
        securityId: "293",
        companyName: "Ayala Land, Inc.",
        symbol: "ALI",
        sector: "Property",
        subsector: "Property",
        listingDate: "1991-07-05",
        sourceUrl: "https://edge.pse.com.ph/companyDirectory/form.do",
      },
      {
        companyId: "57",
        securityId: "180",
        companyName: "Ayala Corporation",
        symbol: "AC",
        sector: "Holding Firms",
        subsector: "Holding Firms",
        listingDate: "1976-11-08",
        sourceUrl: "https://edge.pse.com.ph/companyDirectory/form.do",
      },
    ]);
  });

  it("uses controlled ticker normalization and stable page URLs", () => {
    expect(normalizePseCatalogTicker("ali.ps")).toBe("ALI");
    expect(pseCompanyDirectorySearchUrl(2)).toContain("pageNo=2");
    expect(pseCompanyDirectorySearchUrl(2)).toContain("sortType=symbol");
    expect(pseStockDataUrl("154", "734")).toBe(
      "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=154&security_id=734",
    );
    expect(() => pseStockDataUrl("../154", "734")).toThrow();
  });

  it("discovers and parses exact security-level Stock Data pages", () => {
    const stockDataHtml = `
      <script>sendData.security_id = "734";</script>
      <div class="compInfo"><p>San Miguel Corporation</p></div>
      <form><input type="hidden" name="cmpy_id" value="154" />
        <select name="security_id">
          <option value="165">SMC</option>
          <option value="734" selected>SMC2P</option>
          <option value="747">SMC2V</option>
        </select>
      </form>
      <table><tr><th>Listing Date</th><td>Oct 24, 2025</td></tr></table>`;
    expect(parsePseStockDataSecurityOptions(stockDataHtml, "154")).toEqual([
      { companyId: "154", securityId: "165", symbol: "SMC" },
      { companyId: "154", securityId: "734", symbol: "SMC2P" },
      { companyId: "154", securityId: "747", symbol: "SMC2V" },
    ]);
    expect(parsePseStockDataPage(stockDataHtml, "154", "734")).toMatchObject({
      companyId: "154",
      securityId: "734",
      companyName: "San Miguel Corporation",
      symbol: "SMC2P",
      listingDate: "2025-10-24",
      sourceUrl: "https://edge.pse.com.ph/companyPage/stockData.do?cmpy_id=154&security_id=734",
    });
    expect(() => parsePseStockDataPage(stockDataHtml, "154", "747")).toThrow("did not select");
  });

  it("accepts a compact normalized snapshot for reproducible offline staging", () => {
    expect(parsePseCompanyDirectory({
      schemaVersion: 1,
      retrievedAt: "2026-08-08T12:35:52.034Z",
      sourceRowCount: 282,
      records: [{
        companyId: "180",
        securityId: "293",
        companyName: "Ayala Land, Inc.",
        symbol: "ALI",
        sector: "Property",
        subsector: "Property",
        listingDate: "1991-07-05",
      }],
    })).toHaveLength(1);
    expect(() => parsePseCompanyDirectory({
      records: [{
        companyId: "154",
        securityId: "734",
        companyName: "San Miguel Corporation",
        symbol: "SMC2P",
        listingDate: "2025-10-24",
        sourceUrl: "https://example.com/not-official",
      }],
    })).toThrow("no valid");
  });

  it("matches exact symbols and creates date-only exchange events", () => {
    const records = matchPseOfficialDates([
      { ticker: "ALI", market: "PSE", name: "Ayala Land" },
      { ticker: "AC.PS", market: "PSE", name: "Ayala" },
      { ticker: "ACPB4", market: "PSE", name: "Ayala preferred" },
    ], parsePseCompanyDirectory(HTML), "2026-08-08T00:00:00.000Z");
    expect(records.filter((record) => record.status === "matched")).toHaveLength(2);
    expect(records.find((record) => record.ticker === "ALI")?.events[0]).toMatchObject({
      kind: "exchange_admission",
      localDate: "1991-07-05",
      localTime: null,
      timeZone: "Asia/Manila",
      evidence: { authority: "exchange", verification: "verified" },
    });
    expect(records.find((record) => record.ticker === "ACPB4")?.status).toBe("unmatched");
  });
});
