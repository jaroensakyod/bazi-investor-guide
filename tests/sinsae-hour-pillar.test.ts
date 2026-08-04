/**
 * ตรึง "ตารางยามซินแส" (ตารางตั้งคงใหม่ — ใช้ระบบ Fix) ไว้ในเทสต์
 *
 * ซินแสกำหนด: hour stem คำนวณจาก day stem ของ "วันปัจจุบัน" เสมอ (กฎ 五鼠遁)
 * → 23:00-23:59 ยังเป็นวันเดิม (เช่น วัน 甲 → ยาม 甲子 ไม่ใช่ 丙子 ของวันถัดไป)
 *
 * ตารางอ้างอิง (วัน stem 甲 — ดวง 1988-06-08 = วัน 甲午):
 *   0:00-0:59 甲子 | 1:00-2:59 乙丑 | 3:00-4:59 丙寅 | 5:00-6:59 丁卯
 *   7:00-8:59 戊辰 | 9:00-10:59 己巳 | 11:00-12:59 庚午 | 13:00-14:59 辛未
 *   15:00-16:59 壬申 | 17:00-18:59 癸酉 | 19:00-20:59 甲戌 | 21:00-22:59 乙亥
 *   23:00-23:59 甲子
 */
import { describe, it, expect } from "vitest";
import { resolveSinsaeHourGanzhi } from "@/lib/bazi/symbolic-engine.birth";

describe("ตารางยามซินแส (resolveSinsaeHourGanzhi)", () => {
  // [hourBranch ดิบจาก lunar, hourBranch จริง, dayStem, ค่าที่คาดหวัง]
  // ใช้ rawHourGanzhi = stem ใดก็ได้ (ฟังก์ชันอ่านแค่ branch) แต่ให้สมจริง: ใช้ค่าที่ lunar-javascript ให้ตอนนั้น
  const CASES: Array<[string, string, string]> = [
    // [rawHourGanzhi (lunar ให้ stem วันถัดไปตอน 23:00), dayStem, expected]
    ["甲子", "甲", "甲子"], // 0:00-0:59
    ["乙丑", "甲", "乙丑"], // 1:00-2:59
    ["丙寅", "甲", "丙寅"], // 3:00-4:59
    ["丁卯", "甲", "丁卯"], // 5:00-6:59
    ["戊辰", "甲", "戊辰"], // 7:00-8:59
    ["己巳", "甲", "己巳"], // 9:00-10:59
    ["庚午", "甲", "庚午"], // 11:00-12:59
    ["辛未", "甲", "辛未"], // 13:00-14:59
    ["壬申", "甲", "壬申"], // 15:00-16:59
    ["癸酉", "甲", "癸酉"], // 17:00-18:59
    ["甲戌", "甲", "甲戌"], // 19:00-20:59
    ["乙亥", "甲", "乙亥"], // 21:00-22:59
    ["丙子", "甲", "甲子"], // ★ 23:00-23:59: lunar ให้ 丙子 (stem วันถัดไป) แต่ซินแสให้ 甲子 (วันเดิม)
  ];

  it.each(CASES)("raw=%s dayStem=%s → %s", (raw, dayStem, expected) => {
    expect(resolveSinsaeHourGanzhi(dayStem, raw)).toBe(expected);
  });

  it("วัน stem อื่น ๆ ใช้กฎ 五鼠遁 ถูกต้อง (子時)", () => {
    expect(resolveSinsaeHourGanzhi("乙", "丙子")).toBe("丙子"); // 乙/庚 → 子時 = 丙子
    expect(resolveSinsaeHourGanzhi("丙", "戊子")).toBe("戊子"); // 丙/辛 → 子時 = 戊子
    expect(resolveSinsaeHourGanzhi("丁", "庚子")).toBe("庚子"); // 丁/壬 → 子時 = 庚子
    expect(resolveSinsaeHourGanzhi("戊", "壬子")).toBe("壬子"); // 戊/癸 → 子時 = 壬子
    expect(resolveSinsaeHourGanzhi("己", "甲子")).toBe("甲子"); // 甲/己 → 子時 = 甲子
  });

  it("23:00 ของวัน 乙 → 丙子 (ไม่เปลี่ยนเป็น stem วันถัดไป)", () => {
    // lunar-javascript ให้ raw = 戊子 (ของวัน 丙 ถัดไป) แต่ซินแสให้ 丙子 (วัน 乙 เดิม)
    expect(resolveSinsaeHourGanzhi("乙", "戊子")).toBe("丙子");
  });

  it("fallback: dayStem/กิ่งไม่รู้จัก → คืนค่าดิบ", () => {
    expect(resolveSinsaeHourGanzhi("?", "甲子")).toBe("甲子");
    expect(resolveSinsaeHourGanzhi("甲", "??")).toBe("??");
  });
});
