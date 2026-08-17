import { describe, expect, it } from "vitest";
import type { StockEntry } from "../src/lib/investor/stock-database";
import {
  createDecisionObject,
  validateDecisionObject,
  type DecisionObject,
} from "../src/lib/decision/decision-object";
import {
  BAZI_COMPATIBILITY_MODEL_VERSION,
  type BaziCompatibility,
} from "../src/lib/research/bazi-compatibility";
import { createResearchSnapshot, validateResearchSnapshot } from "../src/lib/research/research-snapshot";
import { buildStockResearchAssessment, type StockResearchInput } from "../src/lib/research/stock-research";
import { MODEL_REGISTRY, getModelCard, validateModelRegistry } from "../src/lib/trust/model-registry";

const stock = {
  type: "stock",
  ticker: "TRUST",
  name: "Trust Fixture",
  country: "US",
  market: "NASDAQ",
  currency: "USD",
  sector: "Technology",
  business: "Enterprise software",
  businessKeywords: ["software"],
  growthStage: "large",
  theme: ["Quality"],
  risingStar: false,
  listedDate: null,
  elements: ["ทอง"],
  primaryElement: "ทอง",
  elementReason: "fixture",
  elementSource: "rule",
  tier: "mega",
  isHighLiquidity: true,
  status: "reviewed",
  reviewedBy: "fixture",
  reviewedAt: "2026-08-01T00:00:00.000Z",
} satisfies StockEntry;

const input: StockResearchInput = {
  stock,
  quote: {
    price: 100,
    pe: 20,
    pbv: 4,
    dividendYield: 1,
    updatedAt: "2026-08-08T00:00:00.000Z",
  },
  fundamentals: {
    roe: 20,
    profitMargin: 18,
    revenueGrowth: 12,
    debtToEquity: 30,
    currentRatio: 1.8,
    fetchedAt: "2026-08-07T00:00:00.000Z",
  },
  pattern: null,
  securityBirth: {
    securityId: "NASDAQ:TRUST",
    grade: "D",
    status: "unavailable",
    calculationMode: "business_element_only",
    selectedEvent: null,
    timeKnown: false,
    scenarioCount: 0,
    limitations: ["unknown"],
  },
  evidence: [
    {
      id: "NASDAQ:TRUST:market",
      datasetId: "application-owned-analysis",
      category: "market",
      source: "Licensed market fixture",
      sourceRef: "https://example.com/market",
      asOf: "2026-08-08T00:00:00.000Z",
      freshness: "fresh",
      license: "commercial",
    },
    {
      id: "NASDAQ:TRUST:fundamental",
      datasetId: "application-owned-analysis",
      category: "fundamental",
      source: "Licensed fundamentals fixture",
      sourceRef: "https://example.com/fundamentals",
      asOf: "2026-08-07T00:00:00.000Z",
      freshness: "fresh",
      license: "commercial",
    },
  ],
};

const compatibility: BaziCompatibility = {
  modelVersion: BAZI_COMPATIBILITY_MODEL_VERSION,
  framework: "bazi_symbolic_compatibility",
  band: "moderate",
  symbolicScore: 3,
  businessElement: "ทอง",
  explanations: ["ใช้เป็นกรอบสะท้อนพฤติกรรมเท่านั้น"],
  affectsMarketScore: false,
  permittedUse: "reflection_and_behavior_only",
  disclaimer: "ไม่ใช่หลักฐานการคาดการณ์ราคา",
};

describe("decision object foundation", () => {
  it("สร้าง identity เดิมเมื่อเนื้อหาเดิม แม้ generatedAt ต่างกัน", () => {
    const assessment = buildStockResearchAssessment(input);
    const first = createDecisionObject(assessment, "2026-08-08T00:00:00.000Z");
    const second = createDecisionObject(assessment, "2026-08-09T00:00:00.000Z");

    expect(first.decisionId).toBe(second.decisionId);
    expect(first.contentHash).toBe(second.contentHash);
    expect(validateDecisionObject(first)).toEqual([]);
    expect(first.claims.length).toBeGreaterThan(0);
    expect(first.claims.every((claim) => claim.evidenceIds.length > 0)).toBe(true);
  });

  it("BaZi เปลี่ยนเฉพาะ personal lens และไม่เปลี่ยน market status", () => {
    const generic = createDecisionObject(buildStockResearchAssessment(input));
    const personal = createDecisionObject(buildStockResearchAssessment({ ...input, baziCompatibility: compatibility }));

    expect(personal.status).toBe(generic.status);
    expect(personal.lenses.market).toEqual(generic.lenses.market);
    expect(personal.lenses.personal.available).toBe(true);
    expect(personal.lenses.personal.evidenceIds).toHaveLength(1);
    expect(personal.lenses.market.evidenceIds).not.toContain(personal.lenses.personal.evidenceIds[0]);
    expect(personal.claims.every((claim) => !claim.evidenceIds.includes(personal.lenses.personal.evidenceIds[0]))).toBe(true);
    expect(personal.lenses.personal.affectsMarketStatus).toBe(false);
    expect(personal.provenance.versions.personalLensModel).toBe(BAZI_COMPATIBILITY_MODEL_VERSION);
  });

  it("rejects personal evidence leaking into the market lens", () => {
    const decision = createDecisionObject(buildStockResearchAssessment({ ...input, baziCompatibility: compatibility }));
    const personalEvidenceId = decision.lenses.personal.evidenceIds[0];
    const tampered = {
      ...decision,
      lenses: {
        ...decision.lenses,
        market: {
          ...decision.lenses.market,
          evidenceIds: [...decision.lenses.market.evidenceIds, personalEvidenceId],
        },
      },
    } as DecisionObject;

    expect(validateDecisionObject(tampered)).toContain("market lens ห้ามอ้าง personal context");
  });

  it("จับ orphan evidence และภาษาสั่งทำธุรกรรมก่อนเผยแพร่", () => {
    const decision = createDecisionObject(buildStockResearchAssessment(input));
    const tampered = {
      ...decision,
      answer: "ควรซื้อตอนนี้",
      claims: [{ ...decision.claims[0], evidenceIds: ["missing:evidence"] }],
    } as DecisionObject;
    const problems = validateDecisionObject(tampered);

    expect(problems.some((problem) => problem.includes("อ้าง evidence ที่ไม่มี"))).toBe(true);
    expect(problems.some((problem) => problem.includes("publicText:transaction_directive"))).toBe(true);
    expect(problems).toContain("contentHash ไม่ตรงกับ decision");
  });

  it("ResearchSnapshot บรรจุ decision contract และตรวจ tampering ได้", () => {
    const snapshot = createResearchSnapshot(buildStockResearchAssessment(input), "2026-08-09T00:00:00.000Z");
    expect(snapshot.schemaVersion).toBe(3);
    expect(snapshot.decision.securityId).toBe(snapshot.securityId);
    expect(validateResearchSnapshot(snapshot)).toEqual([]);

    const tampered = {
      ...snapshot,
      decision: { ...snapshot.decision, answer: "ข้อความถูกแก้ภายหลัง" },
    };
    expect(validateResearchSnapshot(tampered).some((problem) => problem.startsWith("decision:"))).toBe(true);
  });

  it("model registry ระบุ intended use, ข้อห้าม, validation และ limitations ครบ", () => {
    expect(MODEL_REGISTRY.length).toBeGreaterThanOrEqual(4);
    expect(validateModelRegistry()).toEqual([]);
    expect(getModelCard("decision-protocol-v2")?.releaseStatus).toBe("controlled_preview");
    expect(getModelCard("trend-observation-v1")?.releaseStatus).toBe("internal_only");
  });
});
