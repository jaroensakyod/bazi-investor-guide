import { beforeAll, describe, expect, it } from "vitest";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { buildPersonalDashboard } from "../src/lib/portfolio/personal-dashboard";
import { buildFinancialSnapshot, FINANCIAL_PRESETS } from "../src/lib/report/financial-system";
import {
  REPORT_TIERS,
  getReportManifest,
  reportManifestSummary,
} from "../src/lib/report/product-system";
import { bookNarrativeCacheIdentity } from "../src/lib/report/narrative-v6";
import {
  reportProfileFingerprint,
  resolveReportAccess,
  signReportEntitlement,
  verifyReportEntitlement,
} from "../src/lib/report/report-entitlement";
import { resolveFinancialInputs } from "../src/lib/report/report-input";
import { reportArtifactIdentity } from "../src/api/report-pdf-artifact-cache";

const PROFILE_FIXTURES = [
  { birthDate: "1993-11-24", birthTime: "15:12", gender: "male" as const, province: "Bangkok" },
  { birthDate: "1985-04-09", birthTime: "06:35", gender: "female" as const, province: "Chiang Mai" },
  { birthDate: "1978-08-18", birthTime: "22:10", gender: "male" as const, province: "Khon Kaen" },
  { birthDate: "2000-02-29", birthTime: "11:45", gender: "female" as const, province: "Phuket" },
  { birthDate: "1966-12-03", birthTime: "03:20", gender: "male" as const, province: "Songkhla" },
];

describe("report product system", () => {
  it("adds real modules monotonically at each price without duplicate pages", () => {
    const expectedPages = [11, 18, 28, 32];
    const manifests = REPORT_TIERS.map((tier) => getReportManifest(tier));

    manifests.forEach((manifest, index) => {
      expect(manifest.pageCount).toBe(expectedPages[index]);
      expect(new Set(manifest.pageIds).size).toBe(manifest.pageIds.length);
      if (index > 0) {
        const previous = manifests[index - 1];
        expect(previous.pageIds.every((pageId) => manifest.pageIds.includes(pageId))).toBe(true);
      }
    });

    for (const summary of reportManifestSummary()) {
      expect(summary.addedValue.length).toBeGreaterThan(0);
      expect(summary.addedValue.every((value) => value.length > 20)).toBe(true);
    }
  });

  it("separates willingness from capacity and never lets willingness override a weak base", () => {
    const fragile = buildFinancialSnapshot({
      ...FINANCIAL_PRESETS.starter,
      maxDrawdown: 40,
    });
    const established = buildFinancialSnapshot(FINANCIAL_PRESETS.established);

    expect(fragile.willingness).toBe("รับความผันผวนได้");
    expect(fragile.capacity).toBe("ระวังสูง");
    expect(fragile.effectiveRisk).toBe("ระวังสูง");
    expect(fragile.goalStatus).toBe("ต้องซ่อมฐานก่อน");
    expect(established.capacity).not.toBe("ระวังสูง");
    expect(established.stressScenarios).toHaveLength(3);
  });

  it("requires verified financial fields before a paid production report is deliverable", () => {
    const demo = resolveFinancialInputs((key) => ({ tier: "490", financePreset: "builder" })[key as "tier" | "financePreset"] ?? null);
    expect(demo.deliverable).toBe(false);
    expect(demo.inputs.isDemo).toBe(true);
    expect(() => resolveFinancialInputs(
      (key) => ({ tier: "490", financePreset: "builder" })[key as "tier" | "financePreset"] ?? null,
      { allowDemo: false },
    )).toThrow(/ข้อมูลการเงินไม่ครบ/);
  });

  it("binds paid entitlement to profile, tier, signature, and expiry", () => {
    const secret = "test-secret-with-at-least-24-characters";
    const profile = PROFILE_FIXTURES[0];
    const now = 1_800_000_000;
    const token = signReportEntitlement({
      reportId: "report-001",
      profileHash: reportProfileFingerprint(profile),
      tier: "790",
      issuedAt: now - 60,
      expiresAt: now + 3600,
    }, secret);
    expect(verifyReportEntitlement(token, secret, now).reportId).toBe("report-001");
    const access = resolveReportAccess(
      (key) => key === "tier" ? "490" : key === "entitlement" ? token : null,
      profile,
      { production: true, secret, nowSeconds: now },
    );
    expect(access).toMatchObject({ tier: "490", source: "signed-entitlement" });
    expect(() => resolveReportAccess(
      (key) => key === "tier" ? "790" : key === "entitlement" ? token : null,
      PROFILE_FIXTURES[1],
      { production: true, secret, nowSeconds: now },
    )).toThrow(/ไม่ตรงกับโปรไฟล์/);
    expect(() => verifyReportEntitlement(`${token.slice(0, -1)}x`, secret, now)).toThrow(/ลายเซ็น/);
    expect(() => verifyReportEntitlement(token, secret, now + 7200)).toThrow(/หมดอายุ/);
  });

  it("isolates cached PDF artifacts by profile, tier, finance, version, and market date", () => {
    const base = {
      tier: "790",
      reportVersion: "editorial-v7.2",
      profileHash: reportProfileFingerprint(PROFILE_FIXTURES[0]),
      financial: FINANCIAL_PRESETS.builder,
      marketUpdatedAt: "2026-08-08T00:00:00.000Z",
    };
    const first = reportArtifactIdentity(base);
    expect(reportArtifactIdentity({ ...base, profileHash: reportProfileFingerprint(PROFILE_FIXTURES[1]) })).not.toBe(first);
    expect(reportArtifactIdentity({ ...base, tier: "490" })).not.toBe(first);
    expect(reportArtifactIdentity({ ...base, financial: FINANCIAL_PRESETS.starter })).not.toBe(first);
    expect(reportArtifactIdentity({ ...base, marketUpdatedAt: "2026-08-09T00:00:00.000Z" })).not.toBe(first);
  });
});

describe("cross-profile report regression", () => {
  const dashboards: ReturnType<typeof buildPersonalDashboard>[] = [];
  const states: Awaited<ReturnType<typeof calculateBaziChart>>[] = [];

  beforeAll(async () => {
    const repository = createInMemoryKnowledgeRepository();
    for (const fixture of PROFILE_FIXTURES) {
      const state = await calculateBaziChart(fixture, repository);
      states.push(state);
      dashboards.push(buildPersonalDashboard(state));
    }
  });

  it("changes the personal reading across representative birth fixtures", () => {
    const signatures = dashboards.map((dashboard) => [
      dashboard.persona.name,
      dashboard.persona.band,
      dashboard.strongestElement.element,
      dashboard.strengthen.element,
    ].join("|"));
    const dominantElements = new Set(dashboards.map((dashboard) => dashboard.strongestElement.element));
    const supportElements = new Set(dashboards.map((dashboard) => dashboard.strengthen.element));

    expect(new Set(signatures).size).toBeGreaterThanOrEqual(4);
    expect(dominantElements.size).toBeGreaterThanOrEqual(3);
    expect(supportElements.size).toBeGreaterThanOrEqual(3);
  });

  it("uses state-specific narrative cache identities", () => {
    const identities = states.flatMap((state) => [1, 2, 3, 4, 5, 6].map((part) => bookNarrativeCacheIdentity(state, part)));
    expect(new Set(identities).size).toBe(identities.length);
  });
});
