import { describe, expect, it } from "vitest";
import { buildGenericResearchScreen } from "../src/lib/research/research-screen";

describe("generic research screen", () => {
  it("จัดคิววิจัยจากเกณฑ์ตลาดเดียวกันทุกคนและไม่มี BaZi", () => {
    const result = buildGenericResearchScreen({ markets: ["NYSE", "NASDAQ", "NYSE/NASDAQ"], limit: 10 });
    expect(result.universeCount).toBeGreaterThan(0);
    expect(result.assessedCount).toBeGreaterThan(0);
    expect(result.returnedCount).toBeGreaterThan(0);
    expect(result.productionDataAllowed).toBe(false);
    expect(result.releasePolicy.capability).toBe("generic_screen");
    expect(result.candidates.every((candidate) => !("baziCompatibility" in candidate))).toBe(true);
    const scores = result.candidates.map((candidate) => candidate.screenScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

