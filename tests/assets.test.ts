import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { getAssetVerdicts, getPortfolioAllocation } from "../src/lib/chat/tools";
import { detectIntent } from "../src/lib/chat/intents";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("สินทรัพย์นอกหุ้น × ดวง (ทอง/BTC/ที่ดิน...)", () => {
  it("getAssetVerdicts — 143 ตัว + verdict deterministic", () => {
    const r = getAssetVerdicts(state, {});
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.data as { count: number; assets: Array<{ verdict: string; score: number; ticker: string }> };
      expect(d.count).toBe(143);
      expect(["very-good", "good", "neutral", "avoid"]).toContain(d.assets[0].verdict);
      // เรียงคะแนนจากมากไปน้อย
      expect(d.assets[0].score).toBeGreaterThanOrEqual(d.assets[1].score);
    }
  });

  it("getAssetVerdicts — กรอง type (crypto มี BTC/ETH)", () => {
    const r = getAssetVerdicts(state, { type: "crypto" });
    if (r.ok) {
      const d = r.data as { assets: Array<{ ticker: string }> };
      expect(d.assets.some((a) => a.ticker === "BTC-USD")).toBe(true);
      expect(d.assets.some((a) => a.ticker === "ETH-USD")).toBe(true);
    }
  });

  it("getPortfolioAllocation — ผลรวม 100 + มีกันชนน้ำ", () => {
    const r = getPortfolioAllocation(state);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.data as { rows: Array<{ element: string; pct: number; assets: string[] }>; total: number };
      expect(d.total).toBe(100);
      expect(d.rows.some((x) => x.element === "น้ำ")).toBe(true);
      expect(d.rows.reduce((a, x) => a + x.pct, 0)).toBe(100);
    }
  });

  it("intent — ถามทอง/จัดสรรพอร์ต → assets", () => {
    expect(detectIntent("ทองดีไหมตอนนี้").intent).toBe("assets");
    expect(detectIntent("จัดสรรพอร์ตให้หน่อย").intent).toBe("assets");
    expect(detectIntent("สลากออมสินน่าสนใจไหม").intent).toBe("assets");
  });
});
