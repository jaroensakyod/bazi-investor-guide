import { z } from "zod";
import type { StockResearchAssessment } from "../research/stock-research";
import { stableJson, stableSha256 } from "../research/canonical-json";
import { validatePublicResearchText } from "../research/research-policy";
import { assessResearchRelease } from "../research/research-release-gate";

export const DECISION_OBJECT_SCHEMA_VERSION = 2 as const;
export const DECISION_PROTOCOL_VERSION = "decision-protocol-v2" as const;

const nonEmptyText = z.string().trim().min(1).max(4_000);
const identifier = z.string().trim().min(1).max(256);
const dateLike = z.string().refine((value) => Number.isFinite(Date.parse(value)), "ต้องเป็นวันที่ที่อ่านได้");
const httpUrl = z.string().refine((value) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}, "ต้องเป็น URL แบบ http/https");

export const decisionEvidenceSchema = z.object({
  id: identifier,
  datasetId: identifier,
  category: z.enum([
    "identity",
    "business",
    "market",
    "fundamental",
    "price_series",
    "security_event",
    "personal_context",
  ]),
  source: nonEmptyText,
  sourceRef: httpUrl.nullable(),
  asOf: dateLike.nullable(),
  freshness: z.enum(["fresh", "stale", "unknown"]),
  license: z.enum(["commercial", "development_only", "unknown"]),
});

export const decisionClaimSchema = z.object({
  id: identifier,
  stance: z.enum(["supports", "challenges", "context"]),
  text: nonEmptyText,
  evidenceIds: z.array(identifier).min(1),
  derivedBy: nonEmptyText,
});

export const decisionObjectSchema = z.object({
  schemaVersion: z.literal(DECISION_OBJECT_SCHEMA_VERSION),
  protocolVersion: z.literal(DECISION_PROTOCOL_VERSION),
  decisionId: z.string().regex(/^decision_[a-f0-9]{24}$/),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  securityId: identifier,
  question: nonEmptyText,
  status: z.enum(["research", "watch", "review", "avoid_for_now"]),
  answer: nonEmptyText,
  lenses: z.object({
    market: z.object({
      assessmentStatus: z.enum(["insufficient_evidence", "deeper_research_candidate", "monitor", "risk_review"]),
      summary: nonEmptyText,
      evidenceIds: z.array(identifier),
    }),
    personal: z.object({
      available: z.boolean(),
      framework: nonEmptyText.nullable(),
      summary: nonEmptyText,
      evidenceIds: z.array(identifier),
      guardrails: z.array(nonEmptyText),
      affectsMarketStatus: z.literal(false),
    }),
  }),
  claims: z.array(decisionClaimSchema),
  confidence: z.object({
    level: z.enum(["low", "medium", "high"]),
    score: z.number().min(0).max(100),
    reasons: z.array(nonEmptyText).min(1),
  }),
  unknowns: z.array(z.object({
    id: identifier,
    label: nonEmptyText,
    impact: z.enum(["low", "medium", "high"]),
    requiredEvidence: nonEmptyText,
  })),
  risks: z.array(z.object({
    id: identifier,
    label: nonEmptyText,
    severity: z.enum(["low", "medium", "high"]),
    lens: z.enum(["market", "portfolio", "behavior", "data"]),
    basis: z.enum(["evidence", "system_validation", "user_input"]),
    evidenceIds: z.array(identifier),
  })),
  changeConditions: z.array(z.object({
    id: identifier,
    direction: z.enum(["strengthens", "weakens", "review"]),
    description: nonEmptyText,
    evidenceNeeded: nonEmptyText,
  })).min(1),
  nextAction: z.object({
    kind: z.enum(["research", "monitor", "review", "none"]),
    label: nonEmptyText,
    dueAt: dateLike.nullable(),
    trigger: nonEmptyText,
  }),
  evidence: z.array(decisionEvidenceSchema),
  provenance: z.object({
    generatedAt: dateLike,
    dataAsOf: dateLike.nullable(),
    versions: z.object({
      decisionProtocol: z.literal(DECISION_PROTOCOL_VERSION),
      researchModel: nonEmptyText,
      patternModel: nonEmptyText.nullable(),
      personalLensModel: nonEmptyText.nullable(),
    }),
  }),
  release: z.object({
    publicReleaseAllowed: z.boolean(),
    blockingReasons: z.array(nonEmptyText),
  }),
  disclosure: nonEmptyText,
});

export type DecisionObject = z.infer<typeof decisionObjectSchema>;
type DecisionObjectDraft = Omit<DecisionObject, "decisionId" | "contentHash">;

function identityPayload(decision: DecisionObject | DecisionObjectDraft): unknown {
  return {
    schemaVersion: decision.schemaVersion,
    protocolVersion: decision.protocolVersion,
    securityId: decision.securityId,
    question: decision.question,
    status: decision.status,
    answer: decision.answer,
    lenses: decision.lenses,
    claims: decision.claims,
    confidence: decision.confidence,
    unknowns: decision.unknowns,
    risks: decision.risks,
    changeConditions: decision.changeConditions,
    nextAction: decision.nextAction,
    evidence: decision.evidence,
    provenance: {
      dataAsOf: decision.provenance.dataAsOf,
      versions: decision.provenance.versions,
    },
    release: decision.release,
    disclosure: decision.disclosure,
  };
}

export function stableDecisionJson(decision: DecisionObject | DecisionObjectDraft): string {
  return stableJson(identityPayload(decision));
}

export function decisionContentHash(decision: DecisionObject | DecisionObjectDraft): string {
  return stableSha256(identityPayload(decision));
}

function evidenceIdsByCategory(
  assessment: StockResearchAssessment,
  categories: DecisionObject["evidence"][number]["category"][],
): string[] {
  const wanted = new Set(categories);
  return assessment.evidence.filter((item) => wanted.has(item.category)).map((item) => item.id);
}

function evidenceIdsForClaim(assessment: StockResearchAssessment, text: string): string[] {
  const isPattern = /แนวโน้ม|ค่าเฉลี่ย|ผันผวน|drawdown|pattern|regime/iu.test(text);
  const preferred = evidenceIdsByCategory(
    assessment,
    isPattern ? ["price_series", "market"] : ["fundamental", "business"],
  );
  if (preferred.length > 0) return preferred;
  return assessment.evidence.filter((item) => item.category !== "personal_context").map((item) => item.id);
}

function statusContent(assessment: StockResearchAssessment): {
  status: DecisionObject["status"];
  answer: string;
  summary: string;
  nextAction: DecisionObject["nextAction"];
} {
  const ticker = assessment.security.ticker;
  const trigger = "เมื่อมีงบ เหตุการณ์บริษัท หรือข้อมูลตลาดชุดใหม่";
  switch (assessment.marketAssessment.status) {
    case "deeper_research_candidate":
      return {
        status: "research",
        answer: "หลักฐานปัจจุบันของ " + ticker + " รองรับการวิจัยเชิงลึกต่อ แต่ยังไม่ใช่ข้อสรุปสำหรับทำธุรกรรม",
        summary: "คุณภาพและแนวโน้มบางส่วนผ่านเกณฑ์คัดกรองทั่วไป จึงต้องตรวจมูลค่า ความเสี่ยง และสมมติฐานต่อ",
        nextAction: {
          kind: "research",
          label: "สร้าง thesis, valuation range และเงื่อนไขที่ทำให้ thesis ใช้ไม่ได้",
          dueAt: null,
          trigger,
        },
      };
    case "monitor":
      return {
        status: "watch",
        answer: "หลักฐานของ " + ticker + " ยังไม่เด่นพอให้จัดลำดับวิจัยก่อนรายการอื่น จึงควรเก็บไว้ในรายการเฝ้าดู",
        summary: "ข้อมูลมีพอสำหรับติดตาม แต่ข้อสนับสนุนยังไม่แข็งแรงพอสำหรับเพิ่มระดับความสำคัญ",
        nextAction: {
          kind: "monitor",
          label: "ติดตามเฉพาะตัวแปรที่มีผลต่อคุณภาพ มูลค่า และความเสี่ยง",
          dueAt: null,
          trigger,
        },
      };
    case "risk_review":
      return {
        status: "review",
        answer: "หลักฐานของ " + ticker + " มีประเด็นความเสี่ยงที่ต้องทบทวนก่อนให้เวลาวิจัยเพิ่มเติม",
        summary: "risk flags มีน้ำหนักมากกว่าหรือขัดกับข้อสนับสนุนบางส่วน",
        nextAction: {
          kind: "review",
          label: "ตรวจ risk flags กับงบ เหตุการณ์ และข้อมูลราคาต้นทาง",
          dueAt: null,
          trigger,
        },
      };
    default:
      return {
        status: "research",
        answer: "ข้อมูลของ " + ticker + " ยังไม่พอสำหรับข้อสรุปที่น่าเชื่อถือ",
        summary: "ระบบหยุดที่ขั้นรวบรวมหลักฐาน เพราะข้อมูลสำคัญยังขาดหรือไม่สดพอ",
        nextAction: {
          kind: "research",
          label: "เติมหลักฐานที่ขาดและตรวจสิทธิ์ข้อมูลก่อนประเมินอีกครั้ง",
          dueAt: null,
          trigger,
        },
      };
  }
}

function confidenceOf(assessment: StockResearchAssessment): DecisionObject["confidence"] {
  const evidence = assessment.evidence.filter((item) => item.category !== "personal_context");
  let score = assessment.dataQuality.score;
  const reasons = ["คะแนนคุณภาพข้อมูลตั้งต้น " + assessment.dataQuality.score + "/100"];
  if (evidence.length === 0) {
    score = Math.min(score, 25);
    reasons.push("assessment ยังไม่มี evidence reference ที่ตรวจย้อนกลับได้");
  }
  const stale = evidence.filter((item) => item.freshness === "stale").length;
  const unknownFreshness = evidence.filter((item) => item.freshness === "unknown").length;
  if (stale > 0) {
    score -= Math.min(25, stale * 10);
    reasons.push("มีหลักฐานล้าสมัย " + stale + " รายการ");
  }
  if (unknownFreshness > 0) {
    score -= Math.min(15, unknownFreshness * 5);
    reasons.push("ไม่ทราบความสดของหลักฐาน " + unknownFreshness + " รายการ");
  }
  if (assessment.dataQuality.missing.length > 0) {
    score -= Math.min(20, assessment.dataQuality.missing.length * 5);
    reasons.push("ข้อมูลสำคัญยังขาด " + assessment.dataQuality.missing.length + " เรื่อง");
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    score,
    level: score >= 75 ? "high" : score >= 45 ? "medium" : "low",
    reasons,
  };
}

function idFromText(prefix: string, text: string, index: number): string {
  return prefix + "_" + (index + 1) + "_" + stableSha256(text).slice(0, 10);
}

export function createDecisionObject(
  assessment: StockResearchAssessment,
  generatedAt = new Date().toISOString(),
): DecisionObject {
  const content = statusContent(assessment);
  const evidence: DecisionObject["evidence"] = assessment.evidence.map((item) => ({
    ...item,
    sourceRef: item.sourceRef ?? null,
  }));
  const claims: DecisionObject["claims"] = [];
  for (const [index, text] of assessment.marketAssessment.positiveEvidence.entries()) {
    const evidenceIds = evidenceIdsForClaim(assessment, text);
    if (evidenceIds.length > 0) {
      claims.push({
        id: idFromText("support", text, index),
        stance: "supports",
        text,
        evidenceIds,
        derivedBy: assessment.modelVersion,
      });
    }
  }
  for (const [index, text] of assessment.marketAssessment.riskFlags.entries()) {
    const evidenceIds = evidenceIdsForClaim(assessment, text);
    if (evidenceIds.length > 0) {
      claims.push({
        id: idFromText("challenge", text, index),
        stance: "challenges",
        text,
        evidenceIds,
        derivedBy: assessment.modelVersion,
      });
    }
  }

  const unknowns: DecisionObject["unknowns"] = assessment.dataQuality.missing.map((label, index) => ({
    id: idFromText("unknown", label, index),
    label,
    impact: index === 0 ? "high" : "medium",
    requiredEvidence: "เพิ่มแหล่งข้อมูลที่ตรวจสอบได้สำหรับ " + label,
  }));
  if (evidence.length === 0) {
    unknowns.push({
      id: "unknown_evidence_references",
      label: "ยังไม่มี evidence reference ที่ผูกกับ assessment",
      impact: "high",
      requiredEvidence: "ผูกทุก claim กับ source, as-of, freshness และสิทธิ์ข้อมูล",
    });
  }

  const risks: DecisionObject["risks"] = assessment.marketAssessment.riskFlags.map((label, index) => {
    const evidenceIds = evidenceIdsForClaim(assessment, label);
    return {
      id: idFromText("risk", label, index),
      label,
      severity: index === 0 ? "high" : "medium",
      lens: "market",
      basis: evidenceIds.length > 0 ? "evidence" : "system_validation",
      evidenceIds,
    };
  });
  for (const [index, item] of assessment.evidence
    .filter((item) => item.category !== "personal_context" && item.freshness !== "fresh")
    .entries()) {
    risks.push({
      id: "data_" + (index + 1) + "_" + stableSha256(item.id).slice(0, 10),
      label: item.freshness === "stale"
        ? "ข้อมูลจาก " + item.source + " ล้าสมัยตามเกณฑ์ที่กำหนด"
        : "ยังประเมินความสดของข้อมูลจาก " + item.source + " ไม่ได้",
      severity: item.category === "market" || item.category === "price_series" ? "high" : "medium",
      lens: "data",
      basis: "system_validation",
      evidenceIds: [item.id],
    });
  }

  const changeConditions: DecisionObject["changeConditions"] = [];
  for (const [index, missing] of assessment.dataQuality.missing.entries()) {
    changeConditions.push({
      id: idFromText("change", missing, index),
      direction: "review",
      description: "ทบทวนใหม่เมื่อมี " + missing,
      evidenceNeeded: "แหล่งข้อมูลล่าสุดที่ระบุวันที่และสิทธิ์สำหรับ " + missing,
    });
  }
  if (changeConditions.length === 0) {
    changeConditions.push({
      id: "change_material_update",
      direction: "review",
      description: "ทบทวนเมื่อผลประกอบการ มูลค่า ความเสี่ยง หรือเหตุการณ์สำคัญเปลี่ยน",
      evidenceNeeded: "งบ เหตุการณ์บริษัท และข้อมูลตลาดชุดใหม่จากแหล่งที่ตรวจสอบได้",
    });
  }

  const freshnessBlocks = assessment.evidence.filter(
    (item) => ["market", "fundamental", "price_series"].includes(item.category) && item.freshness !== "fresh",
  );
  const releaseGate = assessResearchRelease(assessment, {
    use: "public_display",
    environment: "production",
  });
  const blockingReasons = [...releaseGate.blockers];
  if (freshnessBlocks.length > 0) blockingReasons.push("ข้อมูลตลาด/พื้นฐาน/ราคาอย่างน้อยหนึ่งชุดไม่สดตามเกณฑ์");

  const personal = assessment.baziCompatibility;
  const draft: DecisionObjectDraft = {
    schemaVersion: DECISION_OBJECT_SCHEMA_VERSION,
    protocolVersion: DECISION_PROTOCOL_VERSION,
    securityId: assessment.security.securityId,
    question: "หลักฐานปัจจุบันบอกอะไรเกี่ยวกับ " + assessment.security.ticker + " และต้องทบทวนอะไรต่อ",
    status: content.status,
    answer: content.answer,
    lenses: {
      market: {
        assessmentStatus: assessment.marketAssessment.status,
        summary: content.summary,
        evidenceIds: evidence.filter((item) => item.category !== "personal_context").map((item) => item.id),
      },
      personal: {
        available: Boolean(personal),
        framework: personal?.framework ?? null,
        summary: personal
          ? personal.explanations.join(" ")
          : "ยังไม่ได้ใช้ข้อมูลส่วนบุคคลในการสะท้อนพฤติกรรมสำหรับ decision นี้",
        evidenceIds: evidence.filter((item) => item.category === "personal_context").map((item) => item.id),
        guardrails: personal
          ? [personal.disclaimer, "Personal lens ไม่มีสิทธิ์เปลี่ยน market status หรือ market score"]
          : ["การไม่มี personal lens ไม่เปลี่ยนผลประเมินหลักฐานตลาด"],
        affectsMarketStatus: false,
      },
    },
    claims,
    confidence: confidenceOf(assessment),
    unknowns,
    risks,
    changeConditions,
    nextAction: content.nextAction,
    evidence,
    provenance: {
      generatedAt,
      dataAsOf: assessment.asOf,
      versions: {
        decisionProtocol: DECISION_PROTOCOL_VERSION,
        researchModel: assessment.modelVersion,
        patternModel: assessment.pattern?.modelVersion ?? null,
        personalLensModel: personal?.modelVersion ?? null,
      },
    },
    release: {
      publicReleaseAllowed: blockingReasons.length === 0,
      blockingReasons: [...new Set(blockingReasons)],
    },
    disclosure: assessment.disclosure,
  };
  const contentHash = decisionContentHash(draft);
  return {
    ...draft,
    decisionId: "decision_" + contentHash.slice(0, 24),
    contentHash,
  };
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

function publicText(decision: DecisionObject): string {
  return [
    decision.question,
    decision.answer,
    decision.lenses.market.summary,
    decision.lenses.personal.summary,
    ...decision.lenses.personal.guardrails,
    ...decision.claims.map((item) => item.text),
    ...decision.unknowns.flatMap((item) => [item.label, item.requiredEvidence]),
    ...decision.risks.map((item) => item.label),
    ...decision.changeConditions.flatMap((item) => [item.description, item.evidenceNeeded]),
    decision.nextAction.label,
    decision.nextAction.trigger,
  ].join("\n");
}

export function validateDecisionObject(decision: DecisionObject): string[] {
  const problems: string[] = [];
  const parsed = decisionObjectSchema.safeParse(decision);
  if (!parsed.success) {
    problems.push(...parsed.error.issues.map((issue) => "schema:" + (issue.path.join(".") || "root") + ":" + issue.message));
    return problems;
  }

  const expectedHash = decisionContentHash(decision);
  if (decision.contentHash !== expectedHash) problems.push("contentHash ไม่ตรงกับ decision");
  if (decision.decisionId !== "decision_" + expectedHash.slice(0, 24)) problems.push("decisionId ไม่ตรงกับ contentHash");

  for (const group of [decision.evidence, decision.claims, decision.unknowns, decision.risks, decision.changeConditions]) {
    for (const duplicate of duplicateIds(group)) problems.push("id ซ้ำ: " + duplicate);
  }

  const evidenceIds = new Set(decision.evidence.map((item) => item.id));
  const personalEvidenceIds = new Set(
    decision.evidence.filter((item) => item.category === "personal_context").map((item) => item.id),
  );
  for (const item of decision.evidence.filter((candidate) => candidate.category === "personal_context")) {
    if (item.datasetId !== "user-private-profile") {
      problems.push("personal context evidence ต้องผูกกับ user-private-profile: " + item.id);
    }
  }
  for (const claim of decision.claims) {
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) problems.push("claim " + claim.id + " อ้าง evidence ที่ไม่มี: " + evidenceId);
      if (personalEvidenceIds.has(evidenceId)) problems.push("claim " + claim.id + " ห้ามใช้ personal context เป็นหลักฐานตลาด");
    }
  }
  for (const risk of decision.risks) {
    if (risk.basis === "evidence" && risk.evidenceIds.length === 0) {
      problems.push("risk " + risk.id + " ระบุว่าอิงหลักฐานแต่ไม่มี evidence");
    }
    for (const evidenceId of risk.evidenceIds) {
      if (!evidenceIds.has(evidenceId)) problems.push("risk " + risk.id + " อ้าง evidence ที่ไม่มี: " + evidenceId);
      if (risk.lens === "market" && personalEvidenceIds.has(evidenceId)) {
        problems.push("market risk " + risk.id + " ห้ามใช้ personal context เป็นหลักฐานตลาด");
      }
    }
  }
  for (const evidenceId of decision.lenses.market.evidenceIds) {
    if (!evidenceIds.has(evidenceId)) problems.push("market lens อ้าง evidence ที่ไม่มี: " + evidenceId);
    if (personalEvidenceIds.has(evidenceId)) problems.push("market lens ห้ามอ้าง personal context");
  }
  for (const evidenceId of decision.lenses.personal.evidenceIds) {
    if (!evidenceIds.has(evidenceId)) problems.push("personal lens อ้าง evidence ที่ไม่มี: " + evidenceId);
    if (!personalEvidenceIds.has(evidenceId)) problems.push("personal lens อ้าง evidence ที่ไม่ใช่ personal context: " + evidenceId);
  }
  if (decision.lenses.personal.available && decision.lenses.personal.evidenceIds.length === 0) {
    problems.push("personal lens พร้อมใช้งานแต่ไม่มี personal context evidence");
  }
  if (!decision.lenses.personal.available && decision.lenses.personal.evidenceIds.length > 0) {
    problems.push("personal lens ไม่พร้อมใช้งานแต่ยังอ้าง personal context evidence");
  }

  const expectedLevel = decision.confidence.score >= 75 ? "high" : decision.confidence.score >= 45 ? "medium" : "low";
  if (decision.confidence.level !== expectedLevel) problems.push("confidence level ไม่ตรงกับ score");
  if (decision.lenses.personal.affectsMarketStatus !== false) problems.push("personal lens ห้ามเปลี่ยน market status");
  if (decision.release.publicReleaseAllowed && decision.release.blockingReasons.length > 0) {
    problems.push("publicReleaseAllowed ขัดกับ blockingReasons");
  }

  for (const violation of validatePublicResearchText(publicText(decision))) {
    problems.push("publicText:" + violation.code + ":" + violation.match);
  }
  return problems;
}

export function assertValidDecisionObject(decision: DecisionObject): DecisionObject {
  const problems = validateDecisionObject(decision);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return decision;
}
