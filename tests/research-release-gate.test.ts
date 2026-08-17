import { describe, expect, it } from "vitest";
import { assessResearchRelease } from "../src/lib/research/research-release-gate";
import { assessResearchCapability } from "../src/lib/research/research-policy";
import type { ResearchEvidenceItem } from "../src/lib/research/stock-research";

function assessment(evidence: ResearchEvidenceItem[], publicReleaseAllowed = false) {
  const releasePolicy = assessResearchCapability(publicReleaseAllowed ? "historical_facts" : "generic_screen");
  return { evidence, releasePolicy };
}

const ownedEvidence: ResearchEvidenceItem = {
  id: "SET:TEST:owned",
  datasetId: "application-owned-analysis",
  category: "business",
  source: "fixture",
  asOf: "2026-08-09",
  freshness: "fresh",
  license: "commercial",
};

describe("research release gate", () => {
  it("อนุญาต internal research บน development dataset เฉพาะ development environment", () => {
    const evidence: ResearchEvidenceItem = {
      ...ownedEvidence,
      id: "SET:TEST:yahoo",
      datasetId: "yahoo-development-market",
      license: "development_only",
    };
    expect(assessResearchRelease(assessment([evidence]), { use: "internal_research", environment: "development" }).allowed).toBe(true);
    expect(assessResearchRelease(assessment([evidence]), { use: "internal_research", environment: "production" }).allowed).toBe(false);
  });

  it("ไม่ให้ capability internal-only หลุดเป็น public แม้ข้อมูลเป็นของระบบ", () => {
    const result = assessResearchRelease(assessment([ownedEvidence]), {
      use: "public_display",
      environment: "production",
    });
    expect(result.allowed).toBe(false);
    expect(result.capabilityAllowed).toBe(false);
  });

  it("paid report ต้องผ่านทั้งสิทธิ์ข้อมูลและ production audit", () => {
    const withoutAudit = assessResearchRelease(assessment([ownedEvidence], true), {
      use: "paid_report",
      environment: "production",
    });
    expect(withoutAudit.allowed).toBe(false);
    expect(withoutAudit.auditReady).toBe(false);

    const ready = assessResearchRelease(assessment([ownedEvidence], true), {
      use: "paid_report",
      environment: "production",
      auditReady: true,
    });
    expect(ready.allowed).toBe(true);
  });

  it("unregistered dataset fail closed พร้อม evidence id ที่ตรวจย้อนกลับได้", () => {
    const evidence = { ...ownedEvidence, datasetId: "missing-dataset", id: "SET:TEST:missing" };
    const result = assessResearchRelease(assessment([evidence], true), {
      use: "public_display",
      environment: "production",
    });
    expect(result.allowed).toBe(false);
    expect(result.blockers.some((item) => item.includes("SET:TEST:missing"))).toBe(true);
  });

  it("personal context requires server-verified consent for internal and paid use", () => {
    const personalEvidence: ResearchEvidenceItem = {
      ...ownedEvidence,
      id: "SET:TEST:personal",
      datasetId: "user-private-profile",
      category: "personal_context",
      license: "unknown",
    };
    const withoutConsent = assessResearchRelease(assessment([ownedEvidence, personalEvidence], true), {
      use: "paid_report",
      environment: "production",
      auditReady: true,
    });
    expect(withoutConsent.allowed).toBe(false);
    expect(withoutConsent.blockers.some((item) => item.includes("user_consent"))).toBe(true);

    const withConsent = assessResearchRelease(assessment([ownedEvidence, personalEvidence], true), {
      use: "paid_report",
      environment: "production",
      auditReady: true,
      satisfiedGatesByDataset: { "user-private-profile": ["user_consent"] },
    });
    expect(withConsent.allowed).toBe(true);
  });
});
