import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { buildMonthlyPicks } from "../src/lib/picks/monthly-picks";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";

let state: CalculatedStateValue;

beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("พอร์ตเด่นรายเดือน (ProPicks style)", () => {
  it("TH10 — 10 ตัว เรียงคะแนน + เหตุผล + benchmark", () => {
    const r = buildMonthlyPicks(state, "TH");
    expect(r.picks.length).toBe(10);
    expect(r.benchmark.symbol).toBe("^SET.BK");
    for (const p of r.picks) {
      expect(p.reasons.length).toBeGreaterThan(0);
      expect(p.ticker).toBeTruthy();
      expect(typeof p.score).toBe("number");
    }
    // เรียงคะแนนมาก→น้อย
    const scores = r.picks.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    expect(r.disclaimer).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("US10 — benchmark S&P 500 + เหตุผลครบ", () => {
    const r = buildMonthlyPicks(state, "US");
    expect(r.picks.length).toBe(10);
    expect(r.benchmark.symbol).toBe("^GSPC");
    for (const p of r.picks) expect(p.reasons.length).toBeGreaterThan(0);
  });

  it("MID10 — เฉพาะ mid/small ไทย (SET/mai)", () => {
    const r = buildMonthlyPicks(state, "MID");
    expect(r.picks.length).toBe(10);
    for (const p of r.picks) {
      expect(p.market === "SET" || p.market === "mai").toBe(true);
      expect(["mid", "small", "mai"].includes(p.tier)).toBe(true);
    }
  });

  it("deterministic — คำนวณซ้ำได้ผลเหมือนเดิม", () => {
    const a = buildMonthlyPicks(state, "TH");
    const b = buildMonthlyPicks(state, "TH");
    expect(a.picks.map((p) => p.ticker)).toEqual(b.picks.map((p) => p.ticker));
  });
});
