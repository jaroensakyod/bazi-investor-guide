import { describe, it, expect } from "vitest";
import path from "node:path";
import { chartHashOf, sanitizeUserId, upsertUser, loadUser, isChartStale, userFilePath } from "../src/lib/chat/user-store";

const PAYLOAD = { birthDate: "1990-05-15", birthTime: "14:30", gender: "male" as const, province: "Bangkok" };

describe("user-store — โปรไฟล์ผู้ใช้ + แคชดวง (Phase 1.2)", () => {
  it("chartHash deterministic + เปลี่ยนเมื่อข้อมูลเปลี่ยน", () => {
    expect(chartHashOf(PAYLOAD)).toBe(chartHashOf(PAYLOAD));
    expect(chartHashOf(PAYLOAD)).not.toBe(chartHashOf({ ...PAYLOAD, birthTime: "15:00" }));
  });

  it("sanitizeUserId กัน path traversal", () => {
    expect(sanitizeUserId("u123_abc-9")).toBe("u123_abc-9");
    expect(sanitizeUserId("../evil")).toBe("evil");
    expect(() => sanitizeUserId("!!!")).toThrow();
  });

  it("upsert + load + stale check (ใช้ temp userId)", () => {
    const uid = `test_${Date.now()}`;
    const p = upsertUser({ userId: uid, ...PAYLOAD });
    expect(p.chartHash).toBe(chartHashOf(PAYLOAD));

    const loaded = loadUser(uid);
    expect(loaded?.birthDate).toBe("1990-05-15");
    expect(loaded?.createdAt).toBeTruthy();

    expect(isChartStale(loaded!, PAYLOAD)).toBe(false);
    expect(isChartStale(loaded!, { ...PAYLOAD, province: "Chiang Mai" })).toBe(true);
  });

  it("loadUser ไม่มี → null · path อยู่ใน data/users (Windows backslash)", () => {
    expect(loadUser("nobody_here_123")).toBeNull();
    expect(userFilePath("u1")).toContain(path.join("data", "users"));
  });
});
