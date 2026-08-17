import type { DataRightGate, DataUse } from "../trust/data-rights-registry";
import { assessDatasetUse, type DataUseAssessment } from "../trust/data-rights-registry";
import type { StockResearchAssessment } from "./stock-research";

export const RESEARCH_RELEASE_GATE_VERSION = "research-release-gate-v1" as const;

export type ResearchReleaseUse = Extract<DataUse, "internal_research" | "public_display" | "paid_report">;

export type ResearchReleaseAssessment = {
  gateVersion: typeof RESEARCH_RELEASE_GATE_VERSION;
  use: ResearchReleaseUse;
  environment: "development" | "production";
  allowed: boolean;
  capabilityAllowed: boolean;
  dataAllowed: boolean;
  auditReady: boolean;
  evidenceRights: Array<DataUseAssessment & { evidenceId: string }>;
  blockers: string[];
};

export function assessResearchRelease(
  assessment: Pick<StockResearchAssessment, "evidence" | "releasePolicy">,
  options: {
    use: ResearchReleaseUse;
    environment: "development" | "production";
    satisfiedGatesByDataset?: Readonly<Record<string, readonly DataRightGate[]>>;
    auditReady?: boolean;
  },
): ResearchReleaseAssessment {
  const capabilityAllowed =
    options.use === "internal_research" || assessment.releasePolicy.publicReleaseAllowed;
  const evidenceRights = assessment.evidence.map((item) => ({
    evidenceId: item.id,
    ...assessDatasetUse(item.datasetId, options.use, {
      environment: options.environment,
      satisfiedGates: options.satisfiedGatesByDataset?.[item.datasetId] ?? [],
    }),
  }));
  const dataAllowed = assessment.evidence.length > 0 && evidenceRights.every((item) => item.allowed);
  const auditReady = options.use !== "paid_report" || options.auditReady === true;
  const blockers: string[] = [];
  if (!capabilityAllowed) blockers.push("capability ยังไม่ผ่าน operating-model/legal release gate");
  if (assessment.evidence.length === 0) blockers.push("ไม่มี evidence ที่ผูก dataset rights");
  for (const item of evidenceRights.filter((entry) => !entry.allowed)) {
    blockers.push(`${item.evidenceId}: ${item.reason}`);
  }
  if (!auditReady) blockers.push("paid report ต้องมี production audit persistence");
  return {
    gateVersion: RESEARCH_RELEASE_GATE_VERSION,
    use: options.use,
    environment: options.environment,
    allowed: capabilityAllowed && dataAllowed && auditReady,
    capabilityAllowed,
    dataAllowed,
    auditReady,
    evidenceRights,
    blockers: [...new Set(blockers)],
  };
}
