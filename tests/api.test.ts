import { describe, it, expect, beforeAll, vi } from "vitest";
import { handleProfile, handleChat } from "../src/api/chat";
import { handleMovers, handleIpo, handleNews, handleAlmanac, handleFortune, handleReport, handleResearch, handleResearchScreen, handleStockDetail } from "../src/api/market";
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
    if (r.ok) expect(r.data.reply).toContain("ไม่ใช่คำแนะนำ");
  });

  it("GET /api/movers — ข้อมูลจริง", () => {
    const r = handleMovers({ market: "TH", limit: "5" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.data as unknown[]).length).toBeGreaterThan(0);
  });

  it("GET /api/ipo — IPO จริง + ธาตุ", async () => {
    const r = await handleIpo({ limit: "5" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = r.data as { list: Array<{ ticker: string; element: string }> };
      expect(d.list.length).toBeGreaterThan(0);
      for (const e of d.list) expect(e.element).toBeTruthy();
    }
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

  it("GET /api/stock — คืนวันก่อตั้งและวันเข้าตลาดจากหลักฐานโดยไม่เติมเวลา", () => {
    const result = handleStockDetail({ ticker: "BH", market: "SET" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        companyFoundedDate: string;
        listedDate: string;
        securityBirth: { grade: string; timeKnown: boolean; scenarioCount: number };
      };
      expect(data.companyFoundedDate).toBe("1975-04-21");
      expect(data.listedDate).toBe("1989-12-15");
      expect(data.securityBirth).toMatchObject({ grade: "B", timeKnown: false, scenarioCount: 12 });
    }
  });

  it("GET /api/stock — resolve B3 odd-lot alias ไปหลักทรัพย์ canonical", () => {
    const result = handleStockDetail({ ticker: "PETR4F", market: "BOVESPA" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toMatchObject({
        ticker: "PETR4",
        market: "BOVESPA",
        researchable: true,
      });
    }
  });

  it("GET /api/research — แยก market assessment จาก BaZi", async () => {
    const generic = await handleResearch({ ticker: "AAPL", market: "NASDAQ" });
    expect(generic.ok).toBe(true);
    if (generic.ok) {
      const data = generic.data as {
        marketAssessment: unknown;
        baziCompatibility: unknown;
        decision: { securityId: string; lenses: { personal: { affectsMarketStatus: boolean } } };
        snapshot: { schemaVersion: number; snapshotId: string };
        releasePolicy: { publicReleaseAllowed: boolean };
        releaseGate: { use: string; allowed: boolean };
        persistence: { committed: boolean };
      };
      expect(data.marketAssessment).toBeTruthy();
      expect(data.baziCompatibility).toBeNull();
      expect(data.decision.securityId).toBe("NASDAQ:AAPL");
      expect(data.decision.lenses.personal.affectsMarketStatus).toBe(false);
      expect(data.snapshot.schemaVersion).toBe(3);
      expect(data.snapshot.snapshotId).toMatch(/^research_/);
      expect(data.releasePolicy.publicReleaseAllowed).toBe(false);
      expect(data.releaseGate).toMatchObject({ use: "internal_research", allowed: true });
      expect(data.persistence.committed).toBe(false);
    }

    const personalized = await handleResearch({ ticker: "AAPL", market: "NASDAQ", includeBazi: "1", userId: UID });
    expect(personalized.ok).toBe(true);
    if (personalized.ok) {
      const data = personalized.data as {
        baziCompatibility: { affectsMarketScore: boolean };
        evidence: Array<{ datasetId: string; category: string }>;
        releaseGate: { allowed: boolean; blockers: string[] };
      };
      expect(data.baziCompatibility.affectsMarketScore).toBe(false);
      expect(data.evidence).toContainEqual(expect.objectContaining({
        datasetId: "user-private-profile",
        category: "personal_context",
      }));
      expect(data.releaseGate.allowed).toBe(false);
      expect(data.releaseGate.blockers.some((item) => item.includes("user_consent"))).toBe(true);
    }
  });

  it("ปิด research dossier/screen ใน production โดยค่าเริ่มต้น", async () => {
    try {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ENABLE_GENERIC_RESEARCH_DOSSIER", "");
      vi.stubEnv("ENABLE_GENERIC_RESEARCH_SCREEN", "");
      expect((await handleResearch({ ticker: "AAPL", market: "NASDAQ" })).ok).toBe(false);
      expect((await handleResearchScreen({ market: "US" })).ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("ปิด legacy profile/report/chat และ personalized outputs ใน production", async () => {
    try {
      vi.stubEnv("NODE_ENV", "production");
      expect(handleProfile({ userId: UID, birthDate: "1993-11-24", birthTime: "15:12", gender: "male" }).ok).toBe(false);
      expect((await handleChat({ userId: UID, message: "สรุปให้หน่อย" })).ok).toBe(false);
      expect((await handleReport({ ticker: "KBANK", userId: UID })).ok).toBe(false);
      expect((await handleFortune({ userId: UID, scope: "month" })).ok).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
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
