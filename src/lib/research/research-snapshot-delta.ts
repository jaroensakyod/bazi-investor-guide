import type { DecisionObject } from "../decision/decision-object";
import type { ResearchSnapshot } from "./research-snapshot";

type ChangedVersion = { component: string; from: string | null; to: string | null };

export type ResearchSnapshotDelta = {
  securityId: string;
  fromSnapshotId: string;
  toSnapshotId: string;
  status: { from: DecisionObject["status"]; to: DecisionObject["status"]; changed: boolean };
  confidence: { from: number; to: number; delta: number };
  dataAsOf: { from: string | null; to: string | null; changed: boolean };
  claims: { added: string[]; removed: string[] };
  risks: { added: string[]; resolved: string[] };
  unknowns: { added: string[]; resolved: string[] };
  evidence: {
    added: string[];
    removed: string[];
    becameStale: string[];
    licenseDowngraded: string[];
  };
  versionsChanged: ChangedVersion[];
  materialChange: boolean;
  summary: string[];
};

function difference<T>(current: readonly T[], previous: readonly T[]): T[] {
  const previousSet = new Set(previous);
  return current.filter((item) => !previousSet.has(item));
}

function versionChanges(previous: ResearchSnapshot, current: ResearchSnapshot): ChangedVersion[] {
  const components: Array<keyof ResearchSnapshot["versions"]> = [
    "researchModel",
    "patternModel",
    "decisionProtocol",
    "personalLensModel",
  ];
  return components
    .filter((component) => previous.versions[component] !== current.versions[component])
    .map((component) => ({ component, from: previous.versions[component], to: current.versions[component] }));
}

export function compareResearchSnapshots(
  previous: ResearchSnapshot,
  current: ResearchSnapshot,
): ResearchSnapshotDelta {
  if (previous.securityId !== current.securityId) throw new Error("เปรียบเทียบ snapshot คนละ securityId ไม่ได้");
  const previousClaims = previous.decision.claims.map((item) => item.id);
  const currentClaims = current.decision.claims.map((item) => item.id);
  const previousRisks = previous.decision.risks.map((item) => item.id);
  const currentRisks = current.decision.risks.map((item) => item.id);
  const previousUnknowns = previous.decision.unknowns.map((item) => item.id);
  const currentUnknowns = current.decision.unknowns.map((item) => item.id);
  const previousEvidence = new Map(previous.decision.evidence.map((item) => [item.id, item]));
  const currentEvidence = new Map(current.decision.evidence.map((item) => [item.id, item]));
  const evidenceAdded = difference([...currentEvidence.keys()], [...previousEvidence.keys()]);
  const evidenceRemoved = difference([...previousEvidence.keys()], [...currentEvidence.keys()]);
  const becameStale = [...currentEvidence.entries()]
    .filter(([id, item]) => item.freshness === "stale" && previousEvidence.get(id)?.freshness !== "stale")
    .map(([id]) => id);
  const licenseRank = { unknown: 0, development_only: 1, commercial: 2 } as const;
  const licenseDowngraded = [...currentEvidence.entries()]
    .filter(([id, item]) => {
      const before = previousEvidence.get(id);
      return before ? licenseRank[item.license] < licenseRank[before.license] : false;
    })
    .map(([id]) => id);
  const versionsChanged = versionChanges(previous, current);
  const statusChanged = previous.decision.status !== current.decision.status;
  const confidenceDelta = current.decision.confidence.score - previous.decision.confidence.score;
  const dataAsOfChanged = previous.decision.provenance.dataAsOf !== current.decision.provenance.dataAsOf;
  const claims = { added: difference(currentClaims, previousClaims), removed: difference(previousClaims, currentClaims) };
  const risks = { added: difference(currentRisks, previousRisks), resolved: difference(previousRisks, currentRisks) };
  const unknowns = { added: difference(currentUnknowns, previousUnknowns), resolved: difference(previousUnknowns, currentUnknowns) };
  const materialChange =
    statusChanged ||
    Math.abs(confidenceDelta) >= 10 ||
    dataAsOfChanged ||
    claims.added.length + claims.removed.length + risks.added.length + risks.resolved.length > 0 ||
    unknowns.added.length + unknowns.resolved.length > 0 ||
    evidenceAdded.length + evidenceRemoved.length + becameStale.length + licenseDowngraded.length > 0 ||
    versionsChanged.length > 0;
  const summary: string[] = [];
  if (statusChanged) summary.push(`สถานะเปลี่ยนจาก ${previous.decision.status} เป็น ${current.decision.status}`);
  if (confidenceDelta !== 0) summary.push(`ความเชื่อมั่นเปลี่ยน ${confidenceDelta > 0 ? "+" : ""}${confidenceDelta} จุด`);
  if (risks.added.length > 0) summary.push(`พบความเสี่ยงใหม่ ${risks.added.length} เรื่อง`);
  if (risks.resolved.length > 0) summary.push(`ความเสี่ยงเดิมคลี่คลาย ${risks.resolved.length} เรื่อง`);
  if (unknowns.added.length > 0) summary.push(`มีคำถามสำคัญเพิ่ม ${unknowns.added.length} เรื่อง`);
  if (becameStale.length > 0) summary.push(`หลักฐานล้าสมัยเพิ่ม ${becameStale.length} รายการ`);
  if (licenseDowngraded.length > 0) summary.push(`สิทธิ์หลักฐานลดระดับ ${licenseDowngraded.length} รายการ`);
  if (versionsChanged.length > 0) summary.push(`โมเดลหรือ protocol เปลี่ยน ${versionsChanged.length} รายการ`);
  if (summary.length === 0) summary.push("ไม่มีการเปลี่ยนแปลงที่มีสาระสำคัญ");
  return {
    securityId: current.securityId,
    fromSnapshotId: previous.snapshotId,
    toSnapshotId: current.snapshotId,
    status: { from: previous.decision.status, to: current.decision.status, changed: statusChanged },
    confidence: { from: previous.decision.confidence.score, to: current.decision.confidence.score, delta: confidenceDelta },
    dataAsOf: {
      from: previous.decision.provenance.dataAsOf,
      to: current.decision.provenance.dataAsOf,
      changed: dataAsOfChanged,
    },
    claims,
    risks,
    unknowns,
    evidence: { added: evidenceAdded, removed: evidenceRemoved, becameStale, licenseDowngraded },
    versionsChanged,
    materialChange,
    summary,
  };
}
