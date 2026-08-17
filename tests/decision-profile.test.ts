import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assessDecisionProfileReadiness,
  createDecisionProfile,
  financialInputsFromDecisionProfile,
  validateDecisionProfile,
  type DecisionProfileDraft,
} from "../src/lib/profile/decision-profile";
import { loadDecisionProfile, saveDecisionProfile } from "../src/lib/profile/decision-profile-store";

const temporaryRoots: string[] = [];

function consent(status: "granted" | "denied" | "withdrawn" = "granted") {
  return { status, policyVersion: "2026-08-09", recordedAt: "2026-08-09T00:00:00.000Z" };
}

function draft(): DecisionProfileDraft {
  return {
    profileId: "profile_fixture",
    locale: "th",
    timezone: "Asia/Bangkok",
    baseCurrency: "THB",
    chartRef: { chartHash: "0123456789abcdef", verifiedAt: "2026-08-09T00:00:00.000Z" },
    financial: {
      source: "user_provided",
      verifiedAt: "2026-08-09T00:00:00.000Z",
      monthlyIncome: 80_000,
      monthlyEssentialExpense: 32_000,
      monthlyDiscretionaryExpense: 8_000,
      liquidCash: 240_000,
      investmentAssets: 600_000,
      debtBalance: 120_000,
      highestDebtAprPct: 6,
      intendedMonthlyContribution: 20_000,
    },
    goals: [
      {
        id: "retirement",
        name: "สร้างพอร์ตอิสระทางการเงิน",
        targetAmount: 5_000_000,
        currentAmount: 600_000,
        targetDate: "2036-08-09T00:00:00.000Z",
        priority: 1,
        essential: true,
      },
    ],
    risk: {
      willingnessMaxDrawdownPct: 25,
      knowledgeLevel: "intermediate",
      lossReaction: "hold_rule",
    },
    constraints: {
      emergencyTargetMonths: 6,
      requiredLiquidity: 120_000,
      prohibitedAssetClasses: ["leveraged_derivatives"],
      notes: [],
    },
    currentAllocation: {
      asOf: "2026-08-09T00:00:00.000Z",
      equityPct: 60,
      fixedIncomePct: 15,
      cashPct: 15,
      realAssetPct: 5,
      alternativesPct: 5,
    },
    consents: {
      terms: consent(),
      privacy: consent(),
      investmentResearch: consent(),
      aiProcessing: consent(),
      baziPersonalLens: consent(),
    },
  };
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("decision profile foundation", () => {
  it("สร้าง content identity แบบ deterministic และไม่เก็บวันเกิดดิบ", () => {
    const first = createDecisionProfile(draft(), "2026-08-09T00:00:00.000Z");
    const second = createDecisionProfile(draft(), "2026-08-10T00:00:00.000Z");
    expect(first.contentHash).toBe(second.contentHash);
    expect(validateDecisionProfile(first)).toEqual([]);
    expect(JSON.stringify(first)).not.toContain("birthDate");
    expect(first.chartRef?.chartHash).toHaveLength(16);
  });

  it("แยก willingness จาก capacity และสร้าง FinancialInputs ที่ไม่ใช่ demo", () => {
    const profile = createDecisionProfile(draft(), "2026-08-09T00:00:00.000Z");
    const adapter = financialInputsFromDecisionProfile(profile, new Date("2026-08-09T00:00:00.000Z"));
    expect(adapter.inputs.isDemo).toBe(false);
    expect(adapter.inputs.currentEquityPct).toBe(70);
    expect(adapter.snapshot.willingness).toBe("สมดุล");
    expect(adapter.snapshot.capacity).toBeTruthy();
    expect(adapter.assumptions.length).toBeGreaterThan(0);
  });

  it("consent ของ BaZi และ AI เป็น opt-in แยกจาก research readiness", () => {
    const input = draft();
    input.consents.baziPersonalLens = consent("withdrawn");
    input.consents.aiProcessing = consent("denied");
    const readiness = assessDecisionProfileReadiness(createDecisionProfile(input, "2026-08-09T00:00:00.000Z"));
    expect(readiness.researchReady).toBe(true);
    expect(readiness.paidReportReady).toBe(true);
    expect(readiness.personalLensAllowed).toBe(false);
    expect(readiness.aiProcessingAllowed).toBe(false);
  });

  it("จับ allocation ที่รวมไม่ครบและ profile ที่ถูกแก้หลังสร้าง hash", () => {
    const profile = createDecisionProfile(draft(), "2026-08-09T00:00:00.000Z");
    const tampered = {
      ...profile,
      currentAllocation: { ...profile.currentAllocation, equityPct: 50 },
    };
    const problems = validateDecisionProfile(tampered);
    expect(problems).toContain("currentAllocation ต้องรวม 100%");
    expect(problems).toContain("contentHash ไม่ตรงกับ profile");
  });

  it("บันทึกและโหลด profile แบบ atomic ในพื้นที่ที่กำหนด", () => {
    const root = mkdtempSync(path.join(tmpdir(), "decision-profile-"));
    temporaryRoots.push(root);
    const profile = createDecisionProfile(draft(), "2026-08-09T00:00:00.000Z");
    saveDecisionProfile(profile, root);
    expect(loadDecisionProfile(profile.profileId, root)).toEqual(profile);
  });
});
