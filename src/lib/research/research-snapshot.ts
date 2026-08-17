import { createDecisionObject, validateDecisionObject, type DecisionObject } from "../decision/decision-object";
import { stableJson, stableSha256 } from "./canonical-json";
import type { StockResearchAssessment } from "./stock-research";

export const RESEARCH_SNAPSHOT_SCHEMA_VERSION = 3 as const;

export type ResearchSnapshot = {
  schemaVersion: typeof RESEARCH_SNAPSHOT_SCHEMA_VERSION;
  snapshotId: string;
  createdAt: string;
  securityId: string;
  contentHash: string;
  versions: {
    researchModel: string;
    patternModel: string | null;
    decisionProtocol: string;
    personalLensModel: string | null;
  };
  sourceAsOf: Array<{
    evidenceId: string;
    datasetId: string;
    asOf: string | null;
    source: string;
    sourceRef: string | null;
    freshness: string;
    license: string;
  }>;
  assessment: StockResearchAssessment;
  decision: DecisionObject;
};

export function stableResearchJson(value: unknown): string {
  return stableJson(value);
}

export function researchContentHash(assessment: StockResearchAssessment, decision: DecisionObject): string {
  return stableSha256({ assessment, decisionContentHash: decision.contentHash });
}

export function createResearchSnapshot(
  assessment: StockResearchAssessment,
  createdAt = new Date().toISOString(),
): ResearchSnapshot {
  const decision = createDecisionObject(assessment, createdAt);
  const decisionProblems = validateDecisionObject(decision);
  if (decisionProblems.length > 0) throw new Error(decisionProblems.join("; "));
  const contentHash = researchContentHash(assessment, decision);
  return {
    schemaVersion: RESEARCH_SNAPSHOT_SCHEMA_VERSION,
    snapshotId: `research_${contentHash.slice(0, 24)}`,
    createdAt,
    securityId: assessment.security.securityId,
    contentHash,
    versions: {
      researchModel: assessment.modelVersion,
      patternModel: assessment.pattern?.modelVersion ?? null,
      decisionProtocol: decision.protocolVersion,
      personalLensModel: assessment.baziCompatibility?.modelVersion ?? null,
    },
    sourceAsOf: assessment.evidence.map((item) => ({
      evidenceId: item.id,
      datasetId: item.datasetId,
      asOf: item.asOf,
      source: item.source,
      sourceRef: item.sourceRef ?? null,
      freshness: item.freshness,
      license: item.license,
    })),
    assessment,
    decision,
  };
}

export function validateResearchSnapshot(snapshot: ResearchSnapshot): string[] {
  const problems: string[] = [];
  if (snapshot.schemaVersion !== RESEARCH_SNAPSHOT_SCHEMA_VERSION) {
    problems.push("schemaVersion ไม่รองรับ");
    return problems;
  }
  if (!Number.isFinite(Date.parse(snapshot.createdAt))) problems.push("createdAt ไม่ใช่ ISO timestamp");
  if (snapshot.securityId !== snapshot.assessment.security.securityId) problems.push("securityId ไม่ตรงกับ assessment");
  if (!snapshot.decision) {
    problems.push("snapshot ไม่มี decision object");
    return problems;
  }
  if (snapshot.decision.securityId !== snapshot.securityId) problems.push("decision securityId ไม่ตรงกับ snapshot");
  if (snapshot.decision.provenance.generatedAt !== snapshot.createdAt) problems.push("decision generatedAt ไม่ตรงกับ snapshot");
  problems.push(...validateDecisionObject(snapshot.decision).map((problem) => "decision: " + problem));
  const expectedHash = researchContentHash(snapshot.assessment, snapshot.decision);
  if (snapshot.contentHash !== expectedHash) problems.push("contentHash ไม่ตรงกับ assessment");
  if (snapshot.snapshotId !== `research_${expectedHash.slice(0, 24)}`) problems.push("snapshotId ไม่ตรงกับ contentHash");
  return problems;
}
