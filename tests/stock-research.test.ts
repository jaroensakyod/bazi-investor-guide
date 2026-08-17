import { describe, expect, it } from "vitest";
import type { StockEntry } from "../src/lib/investor/stock-database";
import { buildStockResearchAssessment, type StockResearchInput } from "../src/lib/research/stock-research";
import type { BaziCompatibility } from "../src/lib/research/bazi-compatibility";
import { createResearchSnapshot, validateResearchSnapshot } from "../src/lib/research/research-snapshot";
import { classifyEvidenceFreshness } from "../src/lib/research/evidence-freshness";

const stock = {
  type: "stock",
  ticker: "TEST",
  name: "Test Company",
  country: "US",
  market: "NASDAQ",
  currency: "USD",
  sector: "Technology",
  business: "Enterprise software and cloud services",
  businessKeywords: ["software"],
  growthStage: "large",
  theme: ["AI"],
  risingStar: false,
  listedDate: null,
  elements: ["ทอง"],
  primaryElement: "ทอง",
  elementReason: "เทคโนโลยีและระบบคำนวณจัดเป็นธาตุทอง",
  elementSource: "rule",
  tier: "mega",
  isHighLiquidity: true,
  status: "reviewed",
  reviewedBy: "fixture",
  reviewedAt: "2026-08-01T00:00:00.000Z",
} satisfies StockEntry;

const base: StockResearchInput = {
  stock,
  quote: { price: 100, pe: 20, pbv: 4, dividendYield: 1, updatedAt: "2026-08-08T00:00:00.000Z" },
  fundamentals: { roe: 20, profitMargin: 18, revenueGrowth: 12, debtToEquity: 30, currentRatio: 1.8, fetchedAt: "2026-08-07T00:00:00.000Z" },
  pattern: null,
  securityBirth: {
    securityId: "NASDAQ:TEST",
    grade: "D",
    status: "unavailable",
    calculationMode: "business_element_only",
    selectedEvent: null,
    timeKnown: false,
    scenarioCount: 0,
    limitations: ["unknown"],
  },
  evidence: [],
};

const compatibility: BaziCompatibility = {
  modelVersion: "bazi-symbolic-compatibility-v1",
  framework: "bazi_symbolic_compatibility",
  band: "high",
  symbolicScore: 5,
  businessElement: "ทอง",
  explanations: ["fixture"],
  affectsMarketScore: false,
  permittedUse: "reflection_and_behavior_only",
  disclaimer: "fixture",
};

describe("stock research assessment", () => {
  it("จัด freshness จาก asOf อย่าง deterministic", () => {
    const now = new Date("2026-08-08T00:00:00.000Z");
    expect(classifyEvidenceFreshness("2026-08-07", 4, now)).toBe("fresh");
    expect(classifyEvidenceFreshness("2026-01-01", 120, now)).toBe("stale");
    expect(classifyEvidenceFreshness(null, 4, now)).toBe("unknown");
  });

  it("คะแนนตลาดไม่เปลี่ยนเมื่อเพิ่ม BaZi compatibility", () => {
    const withoutBazi = buildStockResearchAssessment(base);
    const withBazi = buildStockResearchAssessment({ ...base, baziCompatibility: compatibility });
    expect(withBazi.marketAssessment).toEqual(withoutBazi.marketAssessment);
    expect(withBazi.baziCompatibility?.affectsMarketScore).toBe(false);
    expect(withBazi.evidence).toContainEqual(expect.objectContaining({
      datasetId: "user-private-profile",
      category: "personal_context",
    }));
    expect(withBazi.productionDataAllowed).toBe(false);
  });

  it("ไม่สร้างคะแนนเมื่อหลักฐานไม่พอ", () => {
    const result = buildStockResearchAssessment({ ...base, quote: null, fundamentals: null });
    expect(result.marketAssessment.screenScore).toBeNull();
    expect(result.marketAssessment.status).toBe("insufficient_evidence");
    expect(result.dataQuality.missing.length).toBeGreaterThan(0);
  });

  it("สร้าง immutable snapshot id จาก content และตรวจ tampering ได้", () => {
    const assessment = buildStockResearchAssessment(base);
    const first = createResearchSnapshot(assessment, "2026-08-08T00:00:00.000Z");
    const second = createResearchSnapshot(assessment, "2026-08-09T00:00:00.000Z");
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(validateResearchSnapshot(first)).toEqual([]);
    expect(validateResearchSnapshot({ ...first, contentHash: "0".repeat(64) })).toContain("contentHash ไม่ตรงกับ assessment");
  });
});
