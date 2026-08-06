import { describe, it, expect, beforeAll } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";
import { getTodayMovers, getUpcomingIPOs, getBaziVerdict, getFundamentals, getNewsImpact, searchStocks, generateReport, findStock } from "../src/lib/chat/tools";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1990-05-15", birthTime: "14:30", gender: "female", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("tools — 7 tools ตอบคำถามแชท (Phase 1.3)", () => {
  it("findStock — KBANK / ชื่อไทย / ไม่มี → undefined", () => {
    expect(findStock("KBANK")?.ticker).toBe("KBANK");
    expect(findStock("bbl")?.ticker).toBe("BBL");
    expect(findStock("ZZZZ")).toBeUndefined();
  });

  it("getTodayMovers — มีข้อมูลจริง (จาก snapshot)", () => {
    const r = getTodayMovers({ limit: 5 });
    expect(r.ok).toBe(true);
    expect(r.data!.length).toBeGreaterThan(0);
    expect(r.data![0]).toHaveProperty("ticker");
    expect(r.disclaimer).toContain("ไม่ใช่คำแนะนำ");
  });

  it("getUpcomingIPOs — จาก data/ipo.json", () => {
    const r = getUpcomingIPOs({ limit: 5 });
    expect(r.ok).toBe(true);
    if (r.data!.length > 0) expect(r.data![0]).toHaveProperty("ipoDate");
  });

  it("getBaziVerdict — KBANK × ดวงจริง", () => {
    const r = getBaziVerdict("KBANK", state);
    expect(r.ok).toBe(true);
    const d = r.data as { stock: { ticker: string }; invest: string[]; score: { verdict: string } };
    expect(d.stock.ticker).toBe("KBANK");
    expect(d.invest.length).toBeGreaterThan(0);
    expect(d.score.verdict).toBeTruthy();
  });

  it("getBaziVerdict — หุ้นไม่มีในคลัง → ok:false (ไม่เดา)", () => {
    const r = getBaziVerdict("ZZZZ", state);
    expect(r.ok).toBe(false);
    expect(r.error).toContain("ไม่พบหุ้น");
  });

  it("getFundamentals — KBANK มี cache จริง (buffett score ตัวเลข)", () => {
    const r = getFundamentals("KBANK");
    expect(r.ok).toBe(true);
    expect(r.data!.hasData).toBe(true);
    expect(r.data!.buffettScore).toBeGreaterThanOrEqual(0);
  });

  it("getNewsImpact — ข่าวจริงจาก data/news.json (query=ทอง)", () => {
    const r = getNewsImpact({ query: "ทอง", limit: 3 });
    expect(r.ok).toBe(true);
    if (r.data!.length > 0) expect(r.data![0]).toHaveProperty("title");
  });

  it("searchStocks — ค้นตามธาตุ/คำ", () => {
    const byEl = searchStocks({ element: "ทอง", limit: 5 });
    expect(byEl.ok).toBe(true);
    expect(byEl.data!.every((s) => s.primaryElement === "ทอง")).toBe(true);
    const byKw = searchStocks({ keyword: "ธนาคาร", limit: 5 });
    expect(byKw.ok).toBe(true);
  });

  it("generateReport — สรุปย่อได้ (ฉบับเต็ม Phase 3)", () => {
    const r = generateReport("PTT", state);
    expect(r.ok).toBe(true);
    expect((r.data as { stock: { ticker: string } }).stock.ticker).toBe("PTT");
  });
});
