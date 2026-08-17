import { z } from "zod";

export const DATA_USES = [
  "internal_research",
  "derived_metrics",
  "public_display",
  "paid_report",
  "redistribution",
] as const;

export const DATA_RIGHT_GATES = [
  "user_consent",
  "source_attribution",
  "contract_verification",
  "legal_review",
] as const;

export type DataUse = (typeof DATA_USES)[number];
export type DataRightGate = (typeof DATA_RIGHT_GATES)[number];
export type DataRightsStatus = "approved" | "restricted" | "development_only" | "unknown";

const DataUseSchema = z.enum(DATA_USES);
const DataRightGateSchema = z.enum(DATA_RIGHT_GATES);

export const DatasetRightsSchema = z.object({
  datasetId: z.string().trim().min(1),
  provider: z.string().trim().min(1),
  status: z.enum(["approved", "restricted", "development_only", "unknown"]),
  allowedUses: z.array(DataUseSchema),
  prohibitedUses: z.array(DataUseSchema),
  requiredGates: z
    .object({
      internal_research: z.array(DataRightGateSchema).optional(),
      derived_metrics: z.array(DataRightGateSchema).optional(),
      public_display: z.array(DataRightGateSchema).optional(),
      paid_report: z.array(DataRightGateSchema).optional(),
      redistribution: z.array(DataRightGateSchema).optional(),
    })
    .strict(),
  termsRef: z.string().trim().min(1).nullable(),
  contractRef: z.string().trim().min(1).nullable(),
  reviewedAt: z.iso.datetime(),
  owner: z.string().trim().min(1),
  notes: z.array(z.string().trim().min(1)),
});

export type DatasetRights = z.infer<typeof DatasetRightsSchema>;

/**
 * This registry records policy, not a claim that a third-party licence exists.
 * Entries remain blocked from paid/public use until every declared gate is met.
 */
export const DATA_RIGHTS_REGISTRY: readonly DatasetRights[] = [
  {
    datasetId: "application-owned-analysis",
    provider: "BaZi Investor Guide",
    status: "approved",
    allowedUses: ["internal_research", "derived_metrics", "public_display", "paid_report"],
    prohibitedUses: ["redistribution"],
    requiredGates: {},
    termsRef: "internal-policy:data-governance-v1",
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Product Trust",
    notes: ["ครอบคลุมเฉพาะผลวิเคราะห์ที่ระบบสร้างเองและไม่ฝังข้อมูลต้นทางที่มีข้อจำกัด"],
  },
  {
    datasetId: "curated-security-catalog",
    provider: "BaZi Investor Guide curated catalog",
    status: "restricted",
    allowedUses: ["internal_research", "derived_metrics"],
    prohibitedUses: ["public_display", "paid_report", "redistribution"],
    requiredGates: {},
    termsRef: "internal-policy:source-by-source-review-required",
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Data Governance",
    notes: ["ใช้ภายในได้เพื่อจัด identity และค้นคว้า แต่ห้ามเผยแพร่หรือขายจนกว่าจะยืนยันสิทธิ์ของ record ต้นทาง"],
  },
  {
    datasetId: "user-private-profile",
    provider: "User",
    status: "restricted",
    allowedUses: ["internal_research", "derived_metrics", "paid_report"],
    prohibitedUses: ["public_display", "redistribution"],
    requiredGates: {
      internal_research: ["user_consent"],
      derived_metrics: ["user_consent"],
      paid_report: ["user_consent"],
    },
    termsRef: "consent-policy:personalization-v1",
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Privacy",
    notes: ["รายงานแบบชำระเงินต้องส่งให้เจ้าของข้อมูลเท่านั้น", "เก็บ chartHash แทนวันเวลาเกิดดิบเมื่อทำได้"],
  },
  {
    datasetId: "official-security-events",
    provider: "Exchange or regulator",
    status: "restricted",
    allowedUses: ["internal_research", "derived_metrics", "public_display", "paid_report"],
    prohibitedUses: ["redistribution"],
    requiredGates: {
      derived_metrics: ["source_attribution"],
      public_display: ["source_attribution", "legal_review"],
      paid_report: ["source_attribution", "legal_review"],
    },
    termsRef: "source-specific:verify-before-production",
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Data Governance",
    notes: ["ต้องตรวจเงื่อนไขของตลาดหรือหน่วยงานเป็นรายแหล่ง ห้ามตีความว่า official เท่ากับใช้เชิงพาณิชย์ได้เสมอ"],
  },
  {
    datasetId: "yahoo-development-market",
    provider: "Yahoo Finance endpoints",
    status: "development_only",
    allowedUses: ["internal_research", "derived_metrics"],
    prohibitedUses: ["public_display", "paid_report", "redistribution"],
    requiredGates: {},
    termsRef: "provider-terms:verify-before-production",
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Data Governance",
    notes: ["ใช้สร้างและทดสอบระบบเท่านั้น ไม่ใช่ฐานข้อมูล production สำหรับสินค้าชำระเงิน"],
  },
  {
    datasetId: "sec-companyfacts-candidate",
    provider: "U.S. Securities and Exchange Commission",
    status: "restricted",
    allowedUses: ["internal_research", "derived_metrics"],
    prohibitedUses: ["public_display", "paid_report", "redistribution"],
    requiredGates: {
      derived_metrics: ["source_attribution"],
    },
    termsRef: "https://www.sec.gov/search-filings/edgar-application-programming-interfaces",
    contractRef: null,
    reviewedAt: "2026-08-10T00:00:00.000Z",
    owner: "Data Governance",
    notes: ["Official US XBRL fundamentals candidate; fair-access controls and legal review are required before paid/public use."],
  },
  {
    datasetId: "twelve-data-commercial-candidate",
    provider: "Twelve Data",
    status: "unknown",
    allowedUses: [],
    prohibitedUses: [...DATA_USES],
    requiredGates: {},
    termsRef: "https://support.twelvedata.com/en/articles/5332349-commercial-and-personal-usage",
    contractRef: null,
    reviewedAt: "2026-08-10T00:00:00.000Z",
    owner: "Data Procurement",
    notes: ["Business plans may allow commercial display subject to exchange licensing; redistribution requires a separate agreement. Remains fail-closed until signed terms explicitly cover paid PDFs."],
  },
  {
    datasetId: "eodhd-commercial-candidate",
    provider: "EOD Historical Data",
    status: "unknown",
    allowedUses: [],
    prohibitedUses: [...DATA_USES],
    requiredGates: {},
    termsRef: "https://eodhd.com/financial-apis/terms-conditions",
    contractRef: null,
    reviewedAt: "2026-08-10T00:00:00.000Z",
    owner: "Data Procurement",
    notes: ["Commercial display, retransmission, or repackaging requires prior written approval. Retention obligations after termination must be negotiated."],
  },
  {
    datasetId: "fmp-commercial-candidate",
    provider: "Financial Modeling Prep",
    status: "unknown",
    allowedUses: [],
    prohibitedUses: [...DATA_USES],
    requiredGates: {},
    termsRef: "https://site.financialmodelingprep.com/developer/docs/terms-of-service",
    contractRef: null,
    reviewedAt: "2026-08-10T00:00:00.000Z",
    owner: "Data Procurement",
    notes: ["Data display or redistribution requires a specific agreement. A normal individual API plan is not sufficient for this product."],
  },
  {
    datasetId: "unclassified-source",
    provider: "Unknown",
    status: "unknown",
    allowedUses: [],
    prohibitedUses: [...DATA_USES],
    requiredGates: {},
    termsRef: null,
    contractRef: null,
    reviewedAt: "2026-08-09T00:00:00.000Z",
    owner: "Data Governance",
    notes: ["ค่าเริ่มต้นแบบ fail closed จนกว่าจะระบุแหล่งและสิทธิ์ได้"],
  },
] as const;

export type DataUseAssessment = {
  datasetId: string;
  use: DataUse;
  environment: "development" | "production";
  allowed: boolean;
  status: DataRightsStatus | "unregistered";
  missingGates: DataRightGate[];
  reason: string;
};

export function getDatasetRights(
  datasetId: string,
  registry: readonly DatasetRights[] = DATA_RIGHTS_REGISTRY,
): DatasetRights | null {
  return registry.find((entry) => entry.datasetId === datasetId) ?? null;
}

export function assessDatasetUse(
  datasetId: string,
  use: DataUse,
  options: {
    environment?: "development" | "production";
    satisfiedGates?: readonly DataRightGate[];
    registry?: readonly DatasetRights[];
  } = {},
): DataUseAssessment {
  const environment = options.environment ?? "production";
  const entry = getDatasetRights(datasetId, options.registry ?? DATA_RIGHTS_REGISTRY);
  if (!entry) {
    return {
      datasetId,
      use,
      environment,
      allowed: false,
      status: "unregistered",
      missingGates: [],
      reason: "ไม่พบ dataset ใน data-rights registry",
    };
  }
  if (entry.status === "unknown") {
    return { datasetId, use, environment, allowed: false, status: entry.status, missingGates: [], reason: "สิทธิ์ข้อมูลยังไม่ทราบ" };
  }
  if (entry.status === "development_only" && environment === "production") {
    return {
      datasetId,
      use,
      environment,
      allowed: false,
      status: entry.status,
      missingGates: [],
      reason: "dataset นี้อนุญาตเฉพาะ development",
    };
  }
  if (!entry.allowedUses.includes(use) || entry.prohibitedUses.includes(use)) {
    return {
      datasetId,
      use,
      environment,
      allowed: false,
      status: entry.status,
      missingGates: [],
      reason: "use นี้ไม่อยู่ในสิทธิ์ที่อนุญาต",
    };
  }
  const satisfied = new Set(options.satisfiedGates ?? []);
  const missingGates = (entry.requiredGates[use] ?? []).filter((gate) => !satisfied.has(gate));
  if (missingGates.length > 0) {
    return {
      datasetId,
      use,
      environment,
      allowed: false,
      status: entry.status,
      missingGates,
      reason: "ยังไม่ผ่าน gate: " + missingGates.join(", "),
    };
  }
  return { datasetId, use, environment, allowed: true, status: entry.status, missingGates: [], reason: "ผ่าน policy gate" };
}

export function validateDataRightsRegistry(
  registry: readonly DatasetRights[] = DATA_RIGHTS_REGISTRY,
): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const candidate of registry) {
    const parsed = DatasetRightsSchema.safeParse(candidate);
    if (!parsed.success) {
      problems.push(`${candidate.datasetId || "unknown"}: schema ไม่ถูกต้อง`);
      continue;
    }
    const entry = parsed.data;
    if (ids.has(entry.datasetId)) problems.push("datasetId ซ้ำ: " + entry.datasetId);
    ids.add(entry.datasetId);
    const allowed = new Set(entry.allowedUses);
    const overlap = entry.prohibitedUses.filter((use) => allowed.has(use));
    if (overlap.length > 0) problems.push(`${entry.datasetId}: allowed/prohibited ซ้ำกัน: ${overlap.join(", ")}`);
    for (const use of Object.keys(entry.requiredGates) as DataUse[]) {
      if (!allowed.has(use)) problems.push(`${entry.datasetId}: มี gate สำหรับ use ที่ไม่ได้อนุญาต: ${use}`);
    }
    const hasCommercialUse = allowed.has("public_display") || allowed.has("paid_report") || allowed.has("redistribution");
    if (hasCommercialUse && !entry.termsRef && !entry.contractRef) {
      problems.push(`${entry.datasetId}: use เชิงพาณิชย์ไม่มี termsRef หรือ contractRef`);
    }
    if (entry.status === "unknown" && entry.allowedUses.length > 0) {
      problems.push(`${entry.datasetId}: status unknown ต้อง fail closed`);
    }
  }
  return problems;
}
