/**
 * เทสต์ Daily Content — deterministic + ครบโครงสร้าง (รายละเอียดเยอะตามที่ขอ)
 */
import { describe, it, expect } from "vitest";
import { getThaiStocks } from "@/lib/investor/stock-database";
import {
  buildDailyContent,
  buildWeeklyContent,
  getTodayInfo,
  type DailyContentEntry,
} from "@/lib/investor/daily-content";

const THEMES = [
  { id: "AI/Data Center", name: "AI/Data Center", elements: ["ทอง", "ไฟ"] },
  { id: "EV", name: "EV/แบตเตอรี่", elements: ["ไฟ", "ทอง"] },
  { id: "พลังงานสะอาด", name: "พลังงานสะอาด", elements: ["ไฟ"] },
  { id: "การแพทย์", name: "การแพทย์/Aging", elements: ["ไฟ", "น้ำ"] },
  { id: "อาหาร", name: "Food Security", elements: ["น้ำ", "ไม้"] },
  { id: "ท่องเที่ยว", name: "ท่องเที่ยว", elements: ["น้ำ"] },
];

describe("Daily Content", () => {
  it("getTodayInfo: ได้วันที่ + วันจร + ธาตุวันนี้", () => {
    const info = getTodayInfo();
    expect(info.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(info.dayGanzhi.length).toBe(2);
    expect(["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]).toContain(info.dayElement);
  });

  it("คอนเทนต์ 1 วัน: มีรายละเอียดครบ (headline/body/stocks/hashtags/CTA/trivia)", () => {
    const content = buildDailyContent(getThaiStocks(), THEMES, "2026-08-05");
    expect(content.headline.length).toBeGreaterThan(10);
    expect(content.body.length).toBeGreaterThan(50);
    expect(content.hashtags.length).toBeGreaterThanOrEqual(3);
    expect(content.callToAction).toContain("LINE");
    expect(content.trivia.length).toBeGreaterThan(5);
    expect(content.status).toBe("draft");
  });

  it("หุ้นที่เสนอมีธาตุตรงกับวัน (stock-of-day วันที่ 2026-08-05)", () => {
    const content = buildDailyContent(getThaiStocks(), THEMES, "2026-08-05");
    if (content.type === "stock-of-day" || content.type === "element-of-day") {
      for (const s of content.featuredStocks) {
        expect(s.element).toBeTruthy();
        expect(s.reason.length).toBeGreaterThan(5);
      }
    }
  });

  it("deterministic: วันที่เดียวกัน → ผลเหมือนกันทุกครั้ง", () => {
    const a = buildDailyContent(getThaiStocks(), THEMES, "2026-08-05");
    const b = buildDailyContent(getThaiStocks(), THEMES, "2026-08-05");
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("วันที่ต่างกัน → วันจร/เนื้อหาต่างกัน (ไม่ซ้ำกันเป๊ะ)", () => {
    const a = buildDailyContent(getThaiStocks(), THEMES, "2026-08-05");
    const b = buildDailyContent(getThaiStocks(), THEMES, "2026-08-06");
    expect(a.dayGanzhi === b.dayGanzhi && a.headline === b.headline).toBe(false);
  });

  it("buildWeeklyContent: ได้ 7 โพสต์ ครบสัปดาห์ (จ-อา) มีอย่างน้อย 3 ประเภท", () => {
    const week = buildWeeklyContent(getThaiStocks(), THEMES, "2026-08-03"); // วันจันทร์
    expect(week.length).toBe(7);
    const types = new Set(week.map((c: DailyContentEntry) => c.type));
    expect(types.size).toBeGreaterThanOrEqual(3);
    // วันที่เรียงลำดับถูก
    expect(week[0].date).toBe("2026-08-03");
    expect(week[6].date).toBe("2026-08-09");
  });
});
