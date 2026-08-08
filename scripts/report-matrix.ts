import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { buildMonthlyPicks } from "../src/lib/picks/monthly-picks";
import { buildPersonalDashboard } from "../src/lib/portfolio/personal-dashboard";
import { buildFinancialSnapshot, FINANCIAL_PRESETS } from "../src/lib/report/financial-system";
import { REPORT_TIERS, getReportManifest, reportManifestSummary } from "../src/lib/report/product-system";
import { buildEditorialProductPdf } from "../src/api/report-pdf-editorial";

const PROFILE_FIXTURES = [
  { id: "water-builder", birthDate: "1993-11-24", birthTime: "15:12", gender: "male" as const, province: "Bangkok", financePreset: "builder" as const },
  { id: "north-starter", birthDate: "1985-04-09", birthTime: "06:35", gender: "female" as const, province: "Chiang Mai", financePreset: "starter" as const },
  { id: "isaan-established", birthDate: "1978-08-18", birthTime: "22:10", gender: "male" as const, province: "Khon Kaen", financePreset: "established" as const },
  { id: "leap-builder", birthDate: "2000-02-29", birthTime: "11:45", gender: "female" as const, province: "Phuket", financePreset: "builder" as const },
  { id: "south-established", birthDate: "1966-12-03", birthTime: "03:20", gender: "male" as const, province: "Songkhla", financePreset: "established" as const },
  { id: "young-starter", birthDate: "2002-07-14", birthTime: "19:05", gender: "female" as const, province: "Nakhon Ratchasima", financePreset: "starter" as const },
];

type MatrixProfile = {
  id: string;
  birth: string;
  persona: string;
  band: string;
  dominant: string;
  support: string;
  financialPreset: string;
  effectiveRisk: string;
  goalStatus: string;
  topResearch: string[];
  calculationMs: number;
  pdfGenerationMs: number;
  pdfBytes: number;
};

const repository = createInMemoryKnowledgeRepository();
const profiles: MatrixProfile[] = [];

for (const fixture of PROFILE_FIXTURES) {
  const started = performance.now();
  const state = await calculateBaziChart(fixture, repository);
  const dashboard = buildPersonalDashboard(state);
  const picks = buildMonthlyPicks(state, "TH", 5, "premium");
  const financial = buildFinancialSnapshot(FINANCIAL_PRESETS[fixture.financePreset]);
  const calculationMs = Math.round((performance.now() - started) * 10) / 10;
  const pdfStarted = performance.now();
  const pdf = await buildEditorialProductPdf(state, {
    tier: "790",
    financial: FINANCIAL_PRESETS[fixture.financePreset],
    profile: fixture,
  });
  profiles.push({
    id: fixture.id,
    birth: `${fixture.birthDate} ${fixture.birthTime} · ${fixture.gender} · ${fixture.province}`,
    persona: dashboard.persona.name,
    band: dashboard.persona.bandLabel,
    dominant: dashboard.strongestElement.element,
    support: dashboard.strengthen.element,
    financialPreset: fixture.financePreset,
    effectiveRisk: financial.effectiveRisk,
    goalStatus: financial.goalStatus,
    topResearch: picks.picks.map((pick) => pick.ticker),
    calculationMs,
    pdfGenerationMs: Math.round((performance.now() - pdfStarted) * 10) / 10,
    pdfBytes: pdf.length,
  });
}

const deliveries = PROFILE_FIXTURES.flatMap((fixture) => REPORT_TIERS.map((tier) => {
  const manifest = getReportManifest(tier);
  const params = new URLSearchParams({
    birthDate: fixture.birthDate,
    birthTime: fixture.birthTime,
    gender: fixture.gender,
    province: fixture.province,
    tier,
    financePreset: fixture.financePreset,
  });
  return {
    profileId: fixture.id,
    tier,
    price: manifest.config.priceLabel,
    pages: manifest.pageCount,
    reportVersion: manifest.version,
    previewPath: `/report/print?${params.toString()}`,
  };
}));

const signatures = new Set(profiles.map((profile) => [profile.persona, profile.band, profile.dominant, profile.support].join("|")));
const dominantElements = new Set(profiles.map((profile) => profile.dominant));
const supportElements = new Set(profiles.map((profile) => profile.support));
const researchQueues = new Set(profiles.map((profile) => profile.topResearch.join("|")));

const assertions = {
  fixtureCount: profiles.length,
  deliveryCount: deliveries.length,
  uniquePersonalSignatures: signatures.size,
  uniqueDominantElements: dominantElements.size,
  uniqueSupportElements: supportElements.size,
  uniqueResearchQueues: researchQueues.size,
  maxPdfGenerationMs: Math.max(...profiles.map((profile) => profile.pdfGenerationMs)),
  allPdfsValid: profiles.every((profile) => profile.pdfBytes > 1_000_000),
  allTierPageCountsCorrect: REPORT_TIERS.every((tier, index) => getReportManifest(tier).pageCount === [11, 18, 28, 32][index]),
  allPassed: signatures.size >= 4 && dominantElements.size >= 3 && supportElements.size >= 3 && researchQueues.size >= 3 && profiles.every((profile) => profile.pdfBytes > 1_000_000),
};

if (!assertions.allPassed || !assertions.allTierPageCountsCorrect) {
  throw new Error(`Report matrix regression failed: ${JSON.stringify(assertions)}`);
}

const outputDir = path.resolve("output/report-matrix");
mkdirSync(outputDir, { recursive: true });

const artifact = {
  generatedAt: new Date().toISOString(),
  methodology: "Deterministic BaZi + deterministic financial engine; no LLM is allowed to calculate financial values.",
  tierSummary: reportManifestSummary(),
  profiles,
  deliveries,
  assertions,
};

writeFileSync(path.join(outputDir, "report-matrix.json"), `${JSON.stringify(artifact, null, 2)}\n`, "utf8");

const markdown = [
  "# Report generation matrix",
  "",
  `Generated: ${artifact.generatedAt}`,
  "",
  "## Product ladder",
  "",
  "| Tier | Price | Pages | New value vs previous tier |",
  "|---|---:|---:|---|",
  ...artifact.tierSummary.map((tier) => `| ${tier.tier} | ${tier.price} | ${tier.pages} | ${tier.addedValue.join(" · ")} |`),
  "",
  "## Cross-profile comparison",
  "",
  "| Fixture | Persona | Band | Dominant | Support | Finance | Effective risk | Goal | Research queue | Calc ms | PDF ms |",
  "|---|---|---|---|---|---|---|---|---|---:|---:|",
  ...profiles.map((profile) => `| ${profile.id} | ${profile.persona} | ${profile.band} | ${profile.dominant} | ${profile.support} | ${profile.financialPreset} | ${profile.effectiveRisk} | ${profile.goalStatus} | ${profile.topResearch.join(", ")} | ${profile.calculationMs} | ${profile.pdfGenerationMs} |`),
  "",
  "## Regression result",
  "",
  `- ${assertions.fixtureCount} birth/finance fixtures × ${REPORT_TIERS.length} tiers = ${assertions.deliveryCount} delivery combinations`,
  `- Unique personal signatures: ${assertions.uniquePersonalSignatures}`,
  `- Unique dominant/support elements: ${assertions.uniqueDominantElements}/${assertions.uniqueSupportElements}`,
  `- Unique research queues: ${assertions.uniqueResearchQueues}`,
  `- Slowest cold 32-page PDF generation: ${assertions.maxPdfGenerationMs} ms`,
  `- All generated PDFs valid: ${assertions.allPdfsValid ? "PASS" : "FAIL"}`,
  `- Tier page contract: ${assertions.allTierPageCountsCorrect ? "PASS" : "FAIL"}`,
  `- Cross-profile personalization: ${assertions.allPassed ? "PASS" : "FAIL"}`,
  "",
  "The preview paths in `report-matrix.json` are the canonical inputs for HTML-to-PDF QA. Demo finance presets must never be delivered as customer data.",
  "",
].join("\n");

writeFileSync(path.join(outputDir, "report-matrix.md"), markdown, "utf8");

console.log(JSON.stringify({ outputDir, assertions, profiles }, null, 2));
