import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  handleGetDecisionProfile,
  handleGetPortfolioLedger,
  handleUpsertDecisionProfile,
  handleUpsertPortfolioLedger,
  type PrivateDataContext,
} from "../src/api/decision-data";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function context(root: string, subjectId = "anon_0123456789abcdef0123456789abcdef"): PrivateDataContext {
  return {
    subjectId,
    now: "2026-08-09T00:00:00.000Z",
    profileRoot: path.join(root, "profiles"),
    portfolioRoot: path.join(root, "portfolios"),
    auditRoot: path.join(root, "audit"),
  };
}

function profileInput(): Record<string, unknown> {
  return {
    locale: "th",
    timezone: "Asia/Bangkok",
    baseCurrency: "THB",
    chartHash: "0123456789abcdef",
    financial: {
      monthlyIncome: 80_000,
      monthlyEssentialExpense: 30_000,
      monthlyDiscretionaryExpense: 10_000,
      liquidCash: 240_000,
      investmentAssets: 600_000,
      debtBalance: 0,
      highestDebtAprPct: 0,
      intendedMonthlyContribution: 20_000,
    },
    goals: [{
      id: "retirement",
      name: "อิสระทางการเงิน",
      targetAmount: 5_000_000,
      currentAmount: 600_000,
      targetDate: "2036-08-09T00:00:00.000Z",
      priority: 1,
      essential: true,
    }],
    risk: {
      willingnessMaxDrawdownPct: 25,
      knowledgeLevel: "intermediate",
      lossReaction: "hold_rule",
    },
    constraints: {
      emergencyTargetMonths: 6,
      requiredLiquidity: 120_000,
      prohibitedAssetClasses: [],
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
      terms: "granted",
      privacy: "granted",
      investmentResearch: "granted",
      aiProcessing: "denied",
      baziPersonalLens: "granted",
    },
  };
}

function portfolioInput(): Record<string, unknown> {
  return {
    asOf: "2026-08-09T00:00:00.000Z",
    accounts: [{
      id: "broker_main",
      name: "Main Brokerage",
      type: "brokerage",
      baseCurrency: "USD",
      country: "US",
      allowNegativeCash: false,
    }],
    transactions: [{
      id: "opening_cash_1",
      accountId: "broker_main",
      occurredAt: "2026-08-01T00:00:00.000Z",
      type: "opening_cash",
      securityId: null,
      currency: "USD",
      quantity: null,
      unitPrice: null,
      amount: 10_000,
      splitRatio: null,
      fees: 0,
      taxes: 0,
      source: "user",
      externalRef: null,
      note: null,
      createdAt: "2026-08-09T00:00:00.000Z",
    }],
  };
}

describe("owner-scoped decision data API", () => {
  it("สร้าง profile จาก consent ที่ชัดเจนและไม่รับ server-owned fields", () => {
    const root = mkdtempSync(path.join(tmpdir(), "decision-data-api-"));
    temporaryRoots.push(root);
    const created = handleUpsertDecisionProfile(profileInput(), context(root));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(JSON.stringify(created.data)).not.toContain("birthDate");
    expect(created.data).toMatchObject({
      readiness: { researchReady: true, paidReportReady: false, aiProcessingAllowed: false },
      privacy: { storesRawBirthData: false, ownerScoped: true },
    });

    expect(handleUpsertDecisionProfile({ ...profileInput(), profileId: "attacker_choice" }, context(root)).ok).toBe(false);
  });

  it("subject อื่นอ่าน profile และ portfolio ของเจ้าของไม่ได้", () => {
    const root = mkdtempSync(path.join(tmpdir(), "decision-data-owner-"));
    temporaryRoots.push(root);
    const owner = context(root);
    const stranger = context(root, "anon_abcdefabcdefabcdefabcdefabcdefab");
    expect(handleUpsertDecisionProfile(profileInput(), owner).ok).toBe(true);
    expect(handleGetDecisionProfile(owner).ok).toBe(true);
    expect(handleGetDecisionProfile(stranger).ok).toBe(false);
    expect(handleGetPortfolioLedger(stranger).ok).toBe(false);
  });

  it("บันทึก canonical ledger หลัง profile พร้อม และผูก profileId ฝั่ง server", () => {
    const root = mkdtempSync(path.join(tmpdir(), "decision-data-ledger-"));
    temporaryRoots.push(root);
    const owner = context(root);
    expect(handleUpsertDecisionProfile(profileInput(), owner).ok).toBe(true);
    const saved = handleUpsertPortfolioLedger(portfolioInput(), owner);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.data).toMatchObject({
      ownerScoped: true,
      reconciliation: { cash: [{ amount: 10_000 }] },
    });
    expect(handleGetPortfolioLedger(owner).ok).toBe(true);
    expect(handleUpsertPortfolioLedger({ ...portfolioInput(), profileId: "attacker_choice" }, owner).ok).toBe(false);
  });

  it("production private writes fail closed จนกว่าจะมีฐานข้อมูลที่เหมาะสม", () => {
    const root = mkdtempSync(path.join(tmpdir(), "decision-data-prod-"));
    temporaryRoots.push(root);
    const production = { ...context(root), environment: "production" as const };
    expect(handleUpsertDecisionProfile(profileInput(), production).ok).toBe(false);
    expect(handleGetDecisionProfile(production).ok).toBe(false);
    expect(handleGetPortfolioLedger(production).ok).toBe(false);
  });
});
