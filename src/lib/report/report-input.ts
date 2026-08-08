import { FINANCIAL_PRESETS, type FinancialInputs } from "./financial-system";
import { normalizeReportTier, type ReportTier } from "./product-system";

export type ReportParamReader = (key: string) => string | null;
export type FinancialPresetName = keyof typeof FINANCIAL_PRESETS;

const BASIC_FIELDS = [
  "monthlyIncome",
  "monthlyExpense",
  "emergencySavings",
  "debtBalance",
  "debtApr",
  "horizonYears",
  "maxDrawdown",
] as const;

const FULL_FIELDS = [
  "capital",
  "monthly",
  "emergencyMonths",
  "goalAmount",
  "currentGoalSavings",
  "goalYears",
  "currentEquityPct",
  "currentBondPct",
  "currentCashPct",
] as const;

export const REPORT_FINANCIAL_PARAM_KEYS = [
  "financePreset",
  "profileMode",
  "goal",
  ...BASIC_FIELDS,
  ...FULL_FIELDS,
] as const;

export type FinancialResolution = {
  inputs: FinancialInputs;
  tier: ReportTier;
  presetName: FinancialPresetName;
  requiredFields: string[];
  missingFields: string[];
  deliverable: boolean;
};

function numberValue(reader: ReportParamReader, key: string, fallback: number): number {
  const raw = reader(key);
  if (raw == null || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function presetNameOf(raw: string | null): FinancialPresetName {
  return raw === "starter" || raw === "established" ? raw : "builder";
}

export function requiredFinancialFieldsForTier(tierValue?: string | null): string[] {
  const tier = normalizeReportTier(tierValue);
  if (tier === "free") return [];
  if (tier === "99") return [...BASIC_FIELDS];
  return [...BASIC_FIELDS, ...FULL_FIELDS];
}

export function resolveFinancialInputs(reader: ReportParamReader, options?: { allowDemo?: boolean }): FinancialResolution {
  const tier = normalizeReportTier(reader("tier"));
  const presetName = presetNameOf(reader("financePreset"));
  const preset = FINANCIAL_PRESETS[presetName];
  const requiredFields = requiredFinancialFieldsForTier(tier);
  const missingFields = requiredFields.filter((key) => {
    const value = reader(key);
    return value == null || value.trim() === "";
  });
  const explicitlyReal = reader("profileMode") === "real";
  const hasVerifiedFinancialInput = explicitlyReal && missingFields.length === 0 && requiredFields.length > 0;
  const deliverable = tier === "free" || hasVerifiedFinancialInput;
  const allowDemo = options?.allowDemo ?? true;

  if (!deliverable && !allowDemo) {
    throw new Error(`ข้อมูลการเงินไม่ครบสำหรับแพ็กเกจ ${tier}: ${missingFields.join(", ") || "profileMode"}`);
  }

  const isDemo = !hasVerifiedFinancialInput;
  return {
    tier,
    presetName,
    requiredFields,
    missingFields,
    deliverable,
    inputs: {
      ...preset,
      capital: numberValue(reader, "capital", preset.capital),
      monthlyIncome: numberValue(reader, "monthlyIncome", preset.monthlyIncome),
      monthlyExpense: numberValue(reader, "monthlyExpense", preset.monthlyExpense),
      emergencySavings: numberValue(reader, "emergencySavings", preset.emergencySavings),
      emergencyMonths: numberValue(reader, "emergencyMonths", preset.emergencyMonths),
      debtBalance: numberValue(reader, "debtBalance", preset.debtBalance),
      debtApr: numberValue(reader, "debtApr", preset.debtApr),
      monthly: numberValue(reader, "monthly", preset.monthly),
      horizonYears: numberValue(reader, "horizonYears", preset.horizonYears),
      maxDrawdown: numberValue(reader, "maxDrawdown", preset.maxDrawdown),
      goal: reader("goal") || preset.goal,
      goalAmount: numberValue(reader, "goalAmount", preset.goalAmount),
      currentGoalSavings: numberValue(reader, "currentGoalSavings", preset.currentGoalSavings),
      goalYears: numberValue(reader, "goalYears", preset.goalYears),
      currentEquityPct: numberValue(reader, "currentEquityPct", preset.currentEquityPct),
      currentBondPct: numberValue(reader, "currentBondPct", preset.currentBondPct),
      currentCashPct: numberValue(reader, "currentCashPct", preset.currentCashPct),
      source: isDemo ? "demo" : "provided",
      isDemo,
    },
  };
}

export function readerFromRecord(record: Record<string, unknown>): ReportParamReader {
  return (key) => {
    const value = record[key];
    if (Array.isArray(value)) return value.length ? String(value[0]) : null;
    return value == null ? null : String(value);
  };
}
