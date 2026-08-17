import { describe, it, expect, beforeAll } from "vitest";
import { t, dictionaryCompleteness, LOCALES } from "../src/lib/i18n/dictionary";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { fallbackAnswer } from "../src/lib/chat/assistant";
import type { CalculatedStateValue } from "../src/lib/bazi/schema-types";

let state: CalculatedStateValue;
beforeAll(async () => {
  state = await calculateBaziChart(
    { birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
});

describe("i18n dictionary — th/zh/en (Task 1.7)", () => {
  it("ทุกภาษา key ครบ (completeness)", () => {
    const c = dictionaryCompleteness();
    for (const loc of LOCALES) {
      expect(c[loc].missing, `${loc} missing keys`).toEqual([]);
    }
  });

  it("ธาตุ 3 ภาษา — ไม้/火/Wood", () => {
    expect(t("th", "el.wood")).toBe("ไม้");
    expect(t("zh", "el.wood")).toBe("木");
    expect(t("en", "el.wood")).toBe("Wood");
    expect(t("zh", "el.fire")).toBe("火");
    expect(t("en", "el.metal")).toBe("Metal");
  });

  it("disclaimer 3 ภาษา (compliance ข้อความหลัก)", () => {
    expect(t("th", "disclaimer")).toContain("ไม่ใช่คำแนะนำการลงทุน");
    expect(t("zh", "disclaimer")).toContain("不构成投资建议");
    expect(t("en", "disclaimer")).toContain("not investment advice");
  });

  it("template vars แทนที่ได้", () => {
    expect(t("en", "tpl.verdict", { name: "KBANK", el: "Water", verdict: "Good", score: 3, invest: "Fire, Earth", avoid: "Wood" })).toContain("KBANK");
    expect(t("zh", "tpl.fortune.month", { monthEl: "木", dir: "东", days: "1-3" })).toContain("木");
  });

  it("fallback movers — 3 ภาษาจาก tools จริง", () => {
    const th = fallbackAnswer("หุ้นวันนี้ตัวไหนเด่น", state, "th");
    const zh = fallbackAnswer("หุ้นวันนี้ตัวไหนเด่น", state, "zh");
    const en = fallbackAnswer("หุ้นวันนี้ตัวไหนเด่น", state, "en");
    expect(th.text).toContain("หุ้นเด่นวันนี้");
    expect(zh.text).toContain("今日热门股票");
    expect(en.text).toContain("Today's movers");
    expect(zh.text).toContain("不构成投资建议");
    expect(en.text).toContain("not investment advice");
  });

  it("fallback advice_request — compliance 3 ภาษา", () => {
    const en = fallbackAnswer("should I buy KBANK", state, "en");
    expect(en.text).toContain("not investment advice");
    const zh = fallbackAnswer("KBANK 该买吗", state, "zh");
    expect(zh.text).toContain("不构成投资建议");
  });
});
