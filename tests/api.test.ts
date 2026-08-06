import { describe, it, expect, beforeAll } from "vitest";
import { handleProfile, handleChat } from "../src/api/chat";
import { handleMovers, handleIpo, handleNews, handleAlmanac, handleFortune, handleReport } from "../src/api/market";
import { handleDashboard } from "../src/api/dashboard";
import { usageSummary } from "../src/api/usage";

const UID = `apitest_${Date.now()}`;

describe("API layer — backend ที่ทดสอบได้ (web/LINE เรียกใช้)", () => {
  beforeAll(() => {
    const r = handleProfile({ userId: UID, birthDate: "1993-11-24", birthTime: "15:12", gender: "male", province: "Bangkok" });
    expect(r.ok).toBe(true);
  });

  it("POST /api/profile — ลงทะเบียน + chartHash", () => {
    const r = handleProfile({ userId: UID, birthDate: "1993-11-24", birthTime: "15:12", gender: "male" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.chartHash).toHaveLength(16);
      expect(r.data.birthDate).toBe("1993-11-24");
    }
  });

  it("POST /api/profile — ข้อมูลผิด → error", () => {
    const r = handleProfile({ userId: "x", birthDate: "24/11/2536", birthTime: "15:12", gender: "male" });
    expect(r.ok).toBe(false);
  });

  it("POST /api/chat — ไม่มี profile → บอกให้ลงทะเบียน", async () => {
    const r = await handleChat({ userId: "nobody_999", message: "สวัสดี" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("โปรไฟล์");
  });

  it("POST /api/chat — ตอบจริง (template — ไม่ต้อง LLM)", async () => {
    const r = await handleChat({ userId: UID, message: "หุ้นวันนี้ตัวไหนเด่น", useLlm: false });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.intent).toBe("today_movers");
      expect(r.data.reply).toContain("หุ้นเด่น");
      expect(r.data.disclaimer).toContain("ไม่ใช่คำแนะนำ");
    }
  });

  it("POST /api/chat — ขอคำแนะนำ → compliance", async () => {
    const r = await handleChat({ userId: UID, message: "ควรซื้อ KBANK ไหม", useLlm: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.reply).toContain("ไม่ใช่คำแนะนำการลงทุน");
  });

  it("GET /api/movers — ข้อมูลจริง", () => {
    const r = handleMovers({ market: "TH", limit: "5" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/ipo — IPO จริง", () => {
    const r = handleIpo({ limit: "5" });
    expect(r.ok).toBe(true);
  });

  it("GET /api/news — ข่าวจริง", () => {
    const r = handleNews({ query: "ทอง", limit: "3" });
    expect(r.ok).toBe(true);
  });

  it("GET /api/almanac — ปฏิทินวันนี้", () => {
    const r = handleAlmanac({ date: "2026-08-06" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.data as { weekday?: string }).weekday).toBeTruthy();
  });

  it("GET /api/fortune — week ต้องมี profile", async () => {
    const bad = await handleFortune({ userId: "nobody", scope: "week" });
    expect(bad.ok).toBe(false);
    const good = await handleFortune({ userId: UID, scope: "month" });
    expect(good.ok).toBe(true);
    if (good.ok) expect((good.data as { scope?: string }).scope).toBe("month");
  });

  it("GET /api/report — KBANK", async () => {
    const r = await handleReport({ ticker: "KBANK", userId: UID });
    expect(r.ok).toBe(true);
  });

  it("GET /api/dashboard — ผู้ใช้ + usage", () => {
    const r = handleDashboard();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.isArray(r.data.users)).toBe(true);
      expect(r.data.users.some((u) => u.userId === UID)).toBe(true);
      expect(r.data.usage.totalEvents).toBeGreaterThanOrEqual(0);
    }
  });

  it("usageSummary — นับได้ (มี chat event จากเทสต์)", () => {
    const s = usageSummary();
    expect(s.uniqueUsers).toBeGreaterThanOrEqual(1);
    expect(typeof s.byIntent).toBe("object");
  });
});
