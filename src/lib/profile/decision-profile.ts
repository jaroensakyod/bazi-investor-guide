import { z } from "zod";
import { buildFinancialSnapshot, type FinancialInputs, type FinancialSnapshot } from "../report/financial-system";
import { stableSha256 } from "../research/canonical-json";

export const DECISION_PROFILE_SCHEMA_VERSION = 1 as const;

const nonEmptyText = z.string().trim().min(1).max(2_000);
const identifier = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const timestamp = z.string().refine((value) => Number.isFinite(Date.parse(value)), "ต้องเป็นวันที่ที่อ่านได้");
const currency = z.string().regex(/^[A-Z]{3}$/);
const money = z.number().finite().min(0).max(1_000_000_000_000);
const percentage = z.number().finite().min(0).max(100);

export const consentRecordSchema = z.object({
  status: z.enum(["granted", "denied", "withdrawn"]),
  policyVersion: nonEmptyText,
  recordedAt: timestamp,
});

export const decisionGoalSchema = z.object({
  id: identifier,
  name: nonEmptyText,
  targetAmount: money,
  currentAmount: money,
  targetDate: timestamp,
  priority: z.number().int().min(1).max(10),
  essential: z.boolean(),
});

export const decisionProfileSchema = z.object({
  schemaVersion: z.literal(DECISION_PROFILE_SCHEMA_VERSION),
  profileId: identifier,
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  locale: z.enum(["th", "en", "zh"]),
  timezone: nonEmptyText,
  baseCurrency: currency,
  chartRef: z.object({
    chartHash: z.string().regex(/^[a-f0-9]{16,64}$/),
    verifiedAt: timestamp.nullable(),
  }).nullable(),
  financial: z.object({
    source: z.enum(["user_provided", "document_verified"]),
    verifiedAt: timestamp.nullable(),
    monthlyIncome: money,
    monthlyEssentialExpense: money,
    monthlyDiscretionaryExpense: money,
    liquidCash: money,
    investmentAssets: money,
    debtBalance: money,
    highestDebtAprPct: percentage,
    intendedMonthlyContribution: money,
  }),
  goals: z.array(decisionGoalSchema).min(1).max(20),
  risk: z.object({
    willingnessMaxDrawdownPct: percentage,
    knowledgeLevel: z.enum(["beginner", "intermediate", "advanced"]),
    lossReaction: z.enum(["exit_all", "reduce", "hold_rule", "add_by_rule", "unknown"]),
  }),
  constraints: z.object({
    emergencyTargetMonths: z.number().int().min(1).max(36),
    requiredLiquidity: money,
    prohibitedAssetClasses: z.array(nonEmptyText).max(30),
    notes: z.array(nonEmptyText).max(30),
  }),
  currentAllocation: z.object({
    asOf: timestamp,
    equityPct: percentage,
    fixedIncomePct: percentage,
    cashPct: percentage,
    realAssetPct: percentage,
    alternativesPct: percentage,
  }),
  consents: z.object({
    terms: consentRecordSchema,
    privacy: consentRecordSchema,
    investmentResearch: consentRecordSchema,
    aiProcessing: consentRecordSchema,
    baziPersonalLens: consentRecordSchema,
  }),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export type DecisionProfile = z.infer<typeof decisionProfileSchema>;
export type DecisionProfileDraft = Omit<DecisionProfile, "schemaVersion" | "contentHash" | "createdAt" | "updatedAt">;

function identityPayload(profile: DecisionProfile | DecisionProfileDraft): unknown {
  return {
    profileId: profile.profileId,
    locale: profile.locale,
    timezone: profile.timezone,
    baseCurrency: profile.baseCurrency,
    chartRef: profile.chartRef,
    financial: profile.financial,
    goals: profile.goals,
    risk: profile.risk,
    constraints: profile.constraints,
    currentAllocation: profile.currentAllocation,
    consents: profile.consents,
  };
}

export function decisionProfileContentHash(profile: DecisionProfile | DecisionProfileDraft): string {
  return stableSha256(identityPayload(profile));
}

export function createDecisionProfile(
  draft: DecisionProfileDraft,
  now = new Date().toISOString(),
  createdAt = now,
): DecisionProfile {
  const profile: DecisionProfile = {
    ...draft,
    schemaVersion: DECISION_PROFILE_SCHEMA_VERSION,
    contentHash: decisionProfileContentHash(draft),
    createdAt,
    updatedAt: now,
  };
  const problems = validateDecisionProfile(profile);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return profile;
}

function duplicateIds(items: Array<{ id: string }>): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) duplicates.add(item.id);
    seen.add(item.id);
  }
  return [...duplicates];
}

export function validateDecisionProfile(profile: DecisionProfile): string[] {
  const parsed = decisionProfileSchema.safeParse(profile);
  if (!parsed.success) {
    return parsed.error.issues.map((issue) => "schema:" + (issue.path.join(".") || "root") + ":" + issue.message);
  }
  const problems: string[] = [];
  const expectedHash = decisionProfileContentHash(profile);
  if (profile.contentHash !== expectedHash) problems.push("contentHash ไม่ตรงกับ profile");
  for (const duplicate of duplicateIds(profile.goals)) problems.push("goal id ซ้ำ: " + duplicate);
  const allocationTotal =
    profile.currentAllocation.equityPct +
    profile.currentAllocation.fixedIncomePct +
    profile.currentAllocation.cashPct +
    profile.currentAllocation.realAssetPct +
    profile.currentAllocation.alternativesPct;
  if (Math.abs(allocationTotal - 100) > 0.01) problems.push("currentAllocation ต้องรวม 100%");
  if (profile.financial.source === "document_verified" && !profile.financial.verifiedAt) {
    problems.push("document_verified ต้องมี verifiedAt");
  }
  if (profile.chartRef?.verifiedAt && Date.parse(profile.chartRef.verifiedAt) > Date.parse(profile.updatedAt)) {
    problems.push("chartRef verifiedAt ต้องไม่เกิน updatedAt");
  }
  if (Date.parse(profile.createdAt) > Date.parse(profile.updatedAt)) problems.push("createdAt ต้องไม่เกิน updatedAt");
  return problems;
}

export type DecisionProfileReadiness = {
  researchReady: boolean;
  paidReportReady: boolean;
  personalLensAllowed: boolean;
  aiProcessingAllowed: boolean;
  financialConfidence: "user_provided" | "document_verified";
  missing: string[];
};

export function assessDecisionProfileReadiness(profile: DecisionProfile): DecisionProfileReadiness {
  const missing = validateDecisionProfile(profile);
  for (const key of ["terms", "privacy", "investmentResearch"] as const) {
    if (profile.consents[key].status !== "granted") missing.push("consent ไม่พร้อม: " + key);
  }
  if (!profile.financial.verifiedAt) missing.push("ยังไม่ยืนยันข้อมูลการเงินล่าสุด");
  if (profile.goals.length === 0) missing.push("ยังไม่มีเป้าหมาย");
  const researchReady = missing.filter((item) => !item.includes("ยังไม่ยืนยันข้อมูลการเงินล่าสุด")).length === 0;
  return {
    researchReady,
    paidReportReady: researchReady && Boolean(profile.financial.verifiedAt),
    personalLensAllowed: profile.consents.baziPersonalLens.status === "granted" && Boolean(profile.chartRef),
    aiProcessingAllowed: profile.consents.aiProcessing.status === "granted",
    financialConfidence: profile.financial.source,
    missing: [...new Set(missing)],
  };
}

function primaryGoal(profile: DecisionProfile): DecisionProfile["goals"][number] {
  return [...profile.goals].sort((left, right) =>
    left.priority - right.priority || Date.parse(left.targetDate) - Date.parse(right.targetDate) || left.id.localeCompare(right.id)
  )[0];
}

function yearsUntil(targetDate: string, now: Date): number {
  return Math.max(1, (Date.parse(targetDate) - now.getTime()) / (365.25 * 86_400_000));
}

export type FinancialProfileAdapter = {
  inputs: FinancialInputs;
  snapshot: FinancialSnapshot;
  assumptions: string[];
};

export function financialInputsFromDecisionProfile(
  profile: DecisionProfile,
  now = new Date(profile.updatedAt),
): FinancialProfileAdapter {
  const goal = primaryGoal(profile);
  const monthlyExpense = profile.financial.monthlyEssentialExpense + profile.financial.monthlyDiscretionaryExpense;
  const riskAssets =
    profile.currentAllocation.equityPct +
    profile.currentAllocation.realAssetPct +
    profile.currentAllocation.alternativesPct;
  const inputs: FinancialInputs = {
    capital: profile.financial.investmentAssets,
    monthlyIncome: profile.financial.monthlyIncome,
    monthlyExpense,
    emergencySavings: profile.financial.liquidCash,
    emergencyMonths: profile.constraints.emergencyTargetMonths,
    debtBalance: profile.financial.debtBalance,
    debtApr: profile.financial.highestDebtAprPct,
    monthly: profile.financial.intendedMonthlyContribution,
    horizonYears: yearsUntil(goal.targetDate, now),
    maxDrawdown: profile.risk.willingnessMaxDrawdownPct,
    goal: goal.name,
    goalAmount: goal.targetAmount,
    currentGoalSavings: goal.currentAmount,
    goalYears: yearsUntil(goal.targetDate, now),
    currentEquityPct: riskAssets,
    currentBondPct: profile.currentAllocation.fixedIncomePct,
    currentCashPct: profile.currentAllocation.cashPct,
    source: profile.financial.source === "document_verified" ? "server" : "provided",
    isDemo: false,
  };
  return {
    inputs,
    snapshot: buildFinancialSnapshot(inputs),
    assumptions: [
      "real assets และ alternatives ถูกจัดเป็น risk assets ใน financial snapshot รุ่นปัจจุบัน",
      "ใช้เป้าหมาย priority สูงสุดเป็น primary goal",
      "risk capacity คำนวณจากฐานะและเวลา แยกจาก willingness ที่ผู้ใช้ระบุ",
    ],
  };
}
