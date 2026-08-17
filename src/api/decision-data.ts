import { z } from "zod";
import {
  assessDecisionProfileReadiness,
  createDecisionProfile,
  decisionProfileSchema,
  type DecisionProfile,
} from "../lib/profile/decision-profile";
import {
  loadDecisionProfile,
  saveDecisionProfile,
} from "../lib/profile/decision-profile-store";
import {
  createPortfolioLedger,
  portfolioAccountSchema,
  portfolioTransactionSchema,
  reconcilePortfolioLedger,
} from "../lib/portfolio/portfolio-ledger";
import {
  loadPortfolioLedger,
  savePortfolioLedger,
} from "../lib/portfolio/portfolio-ledger-store";
import { stableSha256 } from "../lib/research/canonical-json";
import { appendAuditEvent } from "../lib/trust/audit-log";
import { err, ok, type ApiResponse } from "./types";

export const CONSENT_POLICY_VERSION = "consent-policy-v1" as const;

const subjectSchema = z.string().regex(/^anon_[a-f0-9]{32}$/);
const consentChoiceSchema = z.enum(["granted", "denied", "withdrawn"]);
const financialInputSchema = decisionProfileSchema.shape.financial
  .omit({ source: true, verifiedAt: true })
  .strict();

export const decisionProfileInputSchema = z.object({
  locale: decisionProfileSchema.shape.locale,
  timezone: decisionProfileSchema.shape.timezone,
  baseCurrency: decisionProfileSchema.shape.baseCurrency,
  chartHash: decisionProfileSchema.shape.chartRef.unwrap().shape.chartHash.nullable(),
  financial: financialInputSchema,
  goals: decisionProfileSchema.shape.goals,
  risk: decisionProfileSchema.shape.risk,
  constraints: decisionProfileSchema.shape.constraints,
  currentAllocation: decisionProfileSchema.shape.currentAllocation,
  consents: z.object({
    terms: consentChoiceSchema,
    privacy: consentChoiceSchema,
    investmentResearch: consentChoiceSchema,
    aiProcessing: consentChoiceSchema,
    baziPersonalLens: consentChoiceSchema,
  }).strict(),
}).strict();

export const portfolioLedgerInputSchema = z.object({
  asOf: decisionProfileSchema.shape.currentAllocation.shape.asOf,
  accounts: z.array(portfolioAccountSchema).min(1).max(100),
  transactions: z.array(portfolioTransactionSchema).max(10_000),
}).strict();

export type PrivateDataContext = {
  subjectId: string;
  environment?: "development" | "production";
  now?: string;
  profileRoot?: string;
  portfolioRoot?: string;
  auditRoot?: string;
};

function contextValues(context: PrivateDataContext): {
  subjectId: string;
  profileId: string;
  now: string;
  environment: "development" | "production";
} {
  const subjectId = subjectSchema.parse(context.subjectId);
  const now = context.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) throw new Error("context now ไม่ถูกต้อง");
  return {
    subjectId,
    profileId: `profile_${stableSha256({ namespace: "decision-profile-owner-v1", subjectId }).slice(0, 24)}`,
    now,
    environment: context.environment ?? (process.env.NODE_ENV === "production" ? "production" : "development"),
  };
}

function parseError(error: z.ZodError): string {
  const issue = error.issues[0];
  return `ข้อมูลไม่ถูกต้องที่ ${issue?.path.join(".") || "root"}: ${issue?.message ?? "validation failed"}`;
}

function privatePersistenceAllowed(environment: "development" | "production"): boolean {
  return environment !== "production";
}

function profileDto(profile: DecisionProfile) {
  return {
    profile,
    readiness: assessDecisionProfileReadiness(profile),
    privacy: {
      storesRawBirthData: false,
      chartReferenceOnly: Boolean(profile.chartRef),
      ownerScoped: true,
    },
  };
}

export function handleGetDecisionProfile(context: PrivateDataContext): ApiResponse<unknown> {
  try {
    const { profileId, environment } = contextValues(context);
    if (!privatePersistenceAllowed(environment)) {
      return err("production profile read ถูกปิดจนกว่าจะเชื่อม encrypted transactional database");
    }
    const profile = loadDecisionProfile(profileId, context.profileRoot);
    if (!profile) return err("ยังไม่มี Decision Profile สำหรับ session นี้");
    return ok(profileDto(profile));
  } catch (error) {
    return err(`decision profile error: ${(error as Error).message}`);
  }
}

export function handleUpsertDecisionProfile(
  input: Record<string, unknown>,
  context: PrivateDataContext,
): ApiResponse<unknown> {
  try {
    const values = contextValues(context);
    if (!privatePersistenceAllowed(values.environment)) {
      return err("production profile write ถูกปิดจนกว่าจะเชื่อม encrypted transactional database");
    }
    const parsed = decisionProfileInputSchema.safeParse(input);
    if (!parsed.success) return err(parseError(parsed.error));
    if (parsed.data.consents.terms !== "granted" || parsed.data.consents.privacy !== "granted") {
      return err("ต้องยอมรับ terms และ privacy ก่อนบันทึกโปรไฟล์");
    }
    if (parsed.data.consents.baziPersonalLens === "granted" && !parsed.data.chartHash) {
      return err("การเปิด BaZi personal lens ต้องมี chartHash");
    }
    const existing = loadDecisionProfile(values.profileId, context.profileRoot);
    const consentRecord = (status: "granted" | "denied" | "withdrawn") => ({
      status,
      policyVersion: CONSENT_POLICY_VERSION,
      recordedAt: values.now,
    });
    const profile = createDecisionProfile(
      {
        profileId: values.profileId,
        locale: parsed.data.locale,
        timezone: parsed.data.timezone,
        baseCurrency: parsed.data.baseCurrency,
        chartRef: parsed.data.chartHash
          ? {
              chartHash: parsed.data.chartHash,
              verifiedAt: existing?.chartRef?.chartHash === parsed.data.chartHash
                ? existing.chartRef.verifiedAt
                : null,
            }
          : null,
        financial: {
          source: "user_provided",
          verifiedAt: null,
          ...parsed.data.financial,
        },
        goals: parsed.data.goals,
        risk: parsed.data.risk,
        constraints: parsed.data.constraints,
        currentAllocation: parsed.data.currentAllocation,
        consents: {
          terms: consentRecord(parsed.data.consents.terms),
          privacy: consentRecord(parsed.data.consents.privacy),
          investmentResearch: consentRecord(parsed.data.consents.investmentResearch),
          aiProcessing: consentRecord(parsed.data.consents.aiProcessing),
          baziPersonalLens: consentRecord(parsed.data.consents.baziPersonalLens),
        },
      },
      values.now,
      existing?.createdAt ?? values.now,
    );
    saveDecisionProfile(profile, context.profileRoot);
    appendAuditEvent(
      `profile-${values.profileId}`,
      {
        occurredAt: values.now,
        actor: "user",
        scope: "profile",
        action: existing ? "update_decision_profile" : "create_decision_profile",
        resourceId: values.profileId,
        versions: [
          { component: "decisionProfileSchema", version: String(profile.schemaVersion) },
          { component: "consentPolicy", version: CONSENT_POLICY_VERSION },
        ],
        inputHash: stableSha256(parsed.data),
        outputHash: profile.contentHash,
        evidenceIds: [],
        outcome: "success",
        reasons: [],
        metadata: {
          locale: profile.locale,
          researchConsent: profile.consents.investmentResearch.status,
          aiConsent: profile.consents.aiProcessing.status,
          personalLensConsent: profile.consents.baziPersonalLens.status,
        },
      },
      context.auditRoot,
    );
    return ok(profileDto(profile));
  } catch (error) {
    return err(`decision profile error: ${(error as Error).message}`);
  }
}

export function handleGetPortfolioLedger(context: PrivateDataContext): ApiResponse<unknown> {
  try {
    const { profileId, environment } = contextValues(context);
    if (!privatePersistenceAllowed(environment)) {
      return err("production portfolio read ถูกปิดจนกว่าจะเชื่อม encrypted transactional database");
    }
    const ledger = loadPortfolioLedger(profileId, context.portfolioRoot);
    if (!ledger) return err("ยังไม่มี Portfolio Ledger สำหรับ session นี้");
    return ok({ ledger, reconciliation: reconcilePortfolioLedger(ledger), ownerScoped: true });
  } catch (error) {
    return err(`portfolio ledger error: ${(error as Error).message}`);
  }
}

export function handleUpsertPortfolioLedger(
  input: Record<string, unknown>,
  context: PrivateDataContext,
): ApiResponse<unknown> {
  try {
    const values = contextValues(context);
    if (!privatePersistenceAllowed(values.environment)) {
      return err("production portfolio write ถูกปิดจนกว่าจะเชื่อม encrypted transactional database");
    }
    const profile = loadDecisionProfile(values.profileId, context.profileRoot);
    if (!profile) return err("ต้องสร้าง Decision Profile ก่อนบันทึกพอร์ต");
    const readiness = assessDecisionProfileReadiness(profile);
    if (!readiness.researchReady) return err("Decision Profile ยังไม่พร้อม: " + readiness.missing.join("; "));
    const parsed = portfolioLedgerInputSchema.safeParse(input);
    if (!parsed.success) return err(parseError(parsed.error));
    const ledger = createPortfolioLedger(
      { profileId: values.profileId, ...parsed.data },
      values.now,
    );
    const reconciliation = reconcilePortfolioLedger(ledger);
    savePortfolioLedger(ledger, context.portfolioRoot);
    appendAuditEvent(
      `portfolio-${values.profileId}`,
      {
        occurredAt: values.now,
        actor: "user",
        scope: "portfolio",
        action: "replace_portfolio_ledger",
        resourceId: ledger.ledgerId,
        versions: [{ component: "portfolioLedgerSchema", version: String(ledger.schemaVersion) }],
        inputHash: stableSha256(parsed.data),
        outputHash: ledger.contentHash,
        evidenceIds: [...new Set(ledger.transactions.flatMap((item) => item.securityId ? [item.securityId] : []))],
        outcome: "success",
        reasons: [],
        metadata: {
          accountCount: ledger.accounts.length,
          transactionCount: ledger.transactions.length,
          warningCount: reconciliation.warnings.length,
        },
      },
      context.auditRoot,
    );
    return ok({ ledger, reconciliation, ownerScoped: true });
  } catch (error) {
    return err(`portfolio ledger error: ${(error as Error).message}`);
  }
}
