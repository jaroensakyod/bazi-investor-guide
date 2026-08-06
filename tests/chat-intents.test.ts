import { describe, it, expect } from "vitest";
import { detectIntent } from "../src/lib/chat/intents";

describe("detectIntent — เข้าใจคำถามไทย (Phase 1.1)", () => {
  it("หุ้นวันนี้ → today_movers", () => {
    const r = detectIntent("วันนี้มีหุ้นอะไรน่าสนใจบ้าง");
    expect(r.intent).toBe("today_movers");
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it("หุ้นไทยวันนี้ → today_movers + market TH", () => {
    const r = detectIntent("หุ้นไทยวันนี้ตัวไหนเด่น");
    expect(r.intent).toBe("today_movers");
    expect(r.market).toBe("TH");
  });

  it("วิเคราะห์ KBANK → stock_analysis + ticker", () => {
    const r = detectIntent("วิเคราะห์ KBANK ให้หน่อย");
    expect(r.intent).toBe("stock_analysis");
    expect(r.ticker).toBe("KBANK");
  });

  it("KBANK กับดวงเรา → stock_verdict (เจาะจงกว่า analysis)", () => {
    const r = detectIntent("KBANK กับดวงเราเป็นยังไง");
    expect(r.intent).toBe("stock_verdict");
    expect(r.ticker).toBe("KBANK");
  });

  it("ทรัมป์ประกาศภาษี → news_impact", () => {
    const r = detectIntent("ทรัมป์ประกาศภาษีมีผลยังไง");
    expect(r.intent).toBe("news_impact");
  });

  it("ข่าวทองวันนี้ → news_impact (ไม่ใช่ movers)", () => {
    const r = detectIntent("ข่าวทองวันนี้กระทบหุ้นยังไง");
    expect(r.intent).toBe("news_impact");
  });

  it("IPO → upcoming_ipo", () => {
    const r = detectIntent("มี IPO ใหม่ที่จะเข้าตลาดไหม");
    expect(r.intent).toBe("upcoming_ipo");
  });

  it("รายงานวอร์เรน → report", () => {
    const r = detectIntent("สรุปรายงานแบบวอร์เรน บัฟเฟตต์ให้หน่อย");
    expect(r.intent).toBe("report");
  });

  it("สวัสดี → smalltalk", () => {
    const r = detectIntent("สวัสดีครับ");
    expect(r.intent).toBe("smalltalk");
  });

  it("ชื่อไทย → หา ticker ได้ (ธนาคารกรุงเทพ = BBL)", () => {
    const r = detectIntent("วิเคราะห์ธนาคารกรุงเทพให้หน่อย");
    expect(r.intent).toBe("stock_analysis");
    expect(r.ticker).toBe("BBL");
  });

  it("ชื่อไทย → กสิกรไทย = KBANK", () => {
    const r = detectIntent("กสิกรไทยกับดวงเราเป็นยังไง");
    expect(r.intent).toBe("stock_verdict");
    expect(r.ticker).toBe("KBANK");
  });

  it("ไม่รู้จัก → smalltalk confidence ต่ำ (ให้ถามยืนยัน)", () => {
    const r = detectIntent("อากาศวันนี้ดีจัง");
    expect(r.intent).toBe("smalltalk");
    expect(r.confidence).toBeLessThan(0.5);
  });

  it("วันนี้ดวง/สีมงคล → daily_fortune (ใหม่ — almanac)", () => {
    expect(detectIntent("วันนี้ดวงเราเป็นยังไง").intent).toBe("daily_fortune");
    expect(detectIntent("สีมงคลวันนี้คืออะไร").intent).toBe("daily_fortune");
    expect(detectIntent("ฤกษ์ยามวันนี้เหมาะทำอะไร").intent).toBe("daily_fortune");
  });
});
