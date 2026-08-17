import { describe, expect, it } from "vitest";
import {
  getResearchableThaiStocks,
  getThaiStocks,
  isResearchableStock,
  validateStocks,
} from "../src/lib/investor/stock-database";

describe("Thai security lifecycle", () => {
  it("keeps historical aliases searchable but excludes them from current research", () => {
    const all = getThaiStocks();
    const current = getResearchableThaiStocks();
    expect(all).toHaveLength(271);
    expect(current).toHaveLength(265);
    expect(validateStocks(all)).toEqual([]);

    const expected = new Map([
      ["BPP", "BANPU"],
      ["BSRC", "BCP"],
      ["INTUCH", "GULF"],
      ["MAKRO", "CPAXT"],
      ["STEC", "STECON"],
      ["TICON", "FPT"],
    ]);
    for (const [ticker, successor] of expected) {
      const stock = all.find((item) => item.ticker === ticker);
      expect(stock, ticker).toBeDefined();
      expect(isResearchableStock(stock!), ticker).toBe(false);
      expect(stock?.successorTicker, ticker).toBe(successor);
      expect(stock?.statusEvidence?.url, ticker).toMatch(/^https:\/\//);
    }
  });
});
