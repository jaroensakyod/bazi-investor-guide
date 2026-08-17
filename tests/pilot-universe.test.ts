import { describe, expect, it } from "vitest";
import { TH10_RESEARCH_PILOT, US10_RESEARCH_PILOT } from "../src/lib/research/pilot-universe";

describe("research pilot universe", () => {
  it("มี security ID ไม่ซ้ำและล็อก lineage ของ NewCo", () => {
    expect(TH10_RESEARCH_PILOT.securities).toHaveLength(10);
    expect(new Set(TH10_RESEARCH_PILOT.securities.map((item) => item.securityId)).size).toBe(10);
    expect(TH10_RESEARCH_PILOT.securities.find((item) => item.ticker === "BANPU")?.historyFrom).toBe("2026-08-04");
  });

  it("keeps the official-date US pilot venue-specific", () => {
    expect(US10_RESEARCH_PILOT.securities).toHaveLength(10);
    expect(new Set(US10_RESEARCH_PILOT.securities.map((item) => item.securityId)).size).toBe(10);
    expect(US10_RESEARCH_PILOT.securities.every((item) => item.securityId === `${item.market}:${item.ticker}`)).toBe(true);
  });
});
