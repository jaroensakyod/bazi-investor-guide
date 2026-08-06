import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";
import { chatWithAssistant, fallbackAnswer, runTool, TOOL_NAMES } from "../src/lib/chat/assistant";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "female", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("assistant — LLM + tool calling (Phase 1.5)", () => {
  it("TOOL_DEFS มีครบ 7 tools", () => {
    expect(TOOL_NAMES).toEqual(["getTodayMovers", "getUpcomingIPOs", "getBaziVerdict", "getFundamentals", "getNewsImpact", "searchStocks", "generateReport"]);
  });

  it("runTool — dispatch ถูก + tool ไม่รู้จัก → ok:false", () => {
    const r = runTool("getTodayMovers", {}, state);
    expect(r.ok).toBe(true);
    expect((r.data as unknown[]).length).toBeGreaterThan(0);
    const bad = runTool("noSuchTool", {}, state);
    expect(bad.ok).toBe(false);
  });

  it("fallbackAnswer — LLM ล่ม → ตอบ template จาก tools (ไม่ตาย)", () => {
    const r = fallbackAnswer("หุ้นวันนี้ตัวไหนเด่น", state);
    expect(r.text).toContain("หุ้นเด่นวันนี้");
    expect(r.text).toContain("ไม่ใช่คำแนะนำ");
    const verdict = fallbackAnswer("KBANK กับดวงเราเป็นยังไง", state);
    expect(verdict.text).toContain("ดวงคุณ");
  });

  it("chatWithAssistant — mock LLM: เรียก tool แล้วตอบสรุป (usedLlm=true)", async () => {
    let calls = 0;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls++;
      const body = JSON.parse(String(init?.body));
      const lastMsg = body.messages[body.messages.length - 1];
      if (calls === 1) {
        // รอบแรก: ขอเรียก tool getTodayMovers
        return new Response(
          JSON.stringify({ choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "getTodayMovers", arguments: "{}" } }] } }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      // รอบสอง: สรุปผล
      expect(lastMsg.role).toBe("tool"); // LLM เห็นผล tool ก่อนสรุป
      return new Response(
        JSON.stringify({ choices: [{ message: { content: "📈 วันนี้หุ้นเด่นคือ PLTR +29%" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as typeof fetch;

    const r = await chatWithAssistant("หุ้นวันนี้ตัวไหนเด่น", state, { apiKey: "test-key" });
    expect(r.usedLlm).toBe(true);
    expect(r.rounds).toBe(1);
    expect(r.text).toContain("PLTR");
  });

  it("chatWithAssistant — network error → fallback template (usedLlm=false)", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as typeof fetch;
    const r = await chatWithAssistant("หุ้นวันนี้ตัวไหนเด่น", state, { apiKey: "test-key" });
    expect(r.usedLlm).toBe(false);
    expect(r.error).toContain("network");
    expect(r.text).toContain("ไม่ใช่คำแนะนำ");
  });
});
