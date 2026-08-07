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
  it("TH30 — 30 ตัว เรียงคะแนน + เหตุผล + benchmark + เคารพสมดุล (top ไม่ใช่น้ำ)", () => {
    const r = buildMonthlyPicks(state, "TH");
    expect(r.picks.length).toBe(30);
    expect(r.benchmark.symbol).toBe("^SET.BK");
    for (const p of r.picks) {
      expect(p.reasons.length).toBeGreaterThan(0);
      expect(p.ticker).toBeTruthy();
      expect(typeof p.score).toBe("number");
    }
    // เรียงคะแนนมาก→น้อย
    const scores = r.picks.map((p) => p.score);
    expect([...scores].sort((a, b) => b - a)).toEqual(scores);
    // ดิถีอ่อน+น้ำเกิน: top 3 ต้องไม่เป็นธาตุน้ำ (身弱财旺 — อย่าไล่ลาภ)
    for (const p of r.picks.slice(0, 3)) expect(p.element).not.toBe("น้ำ");
    expect(r.disclaimer).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("US30 — benchmark S&P 500 + เหตุผลครบ", () => {
    const r = buildMonthlyPicks(state, "US", 30, "premium");
    expect(r.picks.length).toBe(30);
    expect(r.benchmark.symbol).toBe("^GSPC");
    for (const p of r.picks) expect(p.reasons.length).toBeGreaterThan(0);
  });

  it("MID30 — เฉพาะ mid/small ไทย (SET/mai)", () => {
    const r = buildMonthlyPicks(state, "MID");
    expect(r.picks.length).toBe(30);
    for (const p of r.picks) {
      expect(p.market === "SET" || p.market === "mai").toBe(true);
    }
  });

  it("unlock filter (Hormozi): ฟรีเห็นเฉพาะ bronze/base · premium เห็นครบ + badge", () => {
    const free = buildMonthlyPicks(state, "TH", 50, "free");
    expect(free.picks.every((p) => p.stockTier === "bronze" || p.stockTier === "base")).toBe(true);
    const prem = buildMonthlyPicks(state, "TH", 50, "premium");
    const tiers = new Set(prem.picks.map((p) => p.stockTier));
    expect(prem.unlock).toBe("premium");
    // premium เห็น gold ถ้ามี + ทุกตัวมี unlock ตาม tier
    for (const p of prem.picks) {
      expect(p.unlock).toBe(p.stockTier === "gold" ? "premium" : p.stockTier === "silver" ? "pro" : "free");
    }
    if (tiers.has("gold")) {
      const gold = prem.picks.find((p) => p.stockTier === "gold");
      expect(gold).toBeTruthy();
    }
  });

  it("deterministic — คำนวณซ้ำได้ผลเหมือนเดิม", () => {
    const a = buildMonthlyPicks(state, "TH");
    const b = buildMonthlyPicks(state, "TH");
    expect(a.picks.map((p) => p.ticker)).toEqual(b.picks.map((p) => p.ticker));
    expect(a.picks.map((p) => p.score)).toEqual(b.picks.map((p) => p.score));
  });
});
