import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { buildEditorialProductPdf } from "../src/api/report-pdf-editorial";
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { FINANCIAL_PRESETS } from "../src/lib/report/financial-system";
import { REPORT_TIERS } from "../src/lib/report/product-system";

const repository = createInMemoryKnowledgeRepository();
const primaryProfile = {
  birthDate: "1993-11-24",
  birthTime: "15:12",
  gender: "male" as const,
  province: "Bangkok",
};
const primaryState = await calculateBaziChart(primaryProfile, repository);
const finalDir = path.resolve("output/pdf");
const qaDir = path.resolve("tmp/pdfs/cross-profile");
mkdirSync(finalDir, { recursive: true });
mkdirSync(qaDir, { recursive: true });

const generated: Array<{ file: string; bytes: number; milliseconds: number }> = [];

for (const tier of REPORT_TIERS) {
  const started = performance.now();
  const buffer = await buildEditorialProductPdf(primaryState, {
    tier,
    financial: FINANCIAL_PRESETS.builder,
    profile: primaryProfile,
  });
  const file = path.join(finalDir, `bazi-report-${tier}-editorial-v7.2.pdf`);
  writeFileSync(file, buffer);
  generated.push({ file, bytes: buffer.length, milliseconds: Math.round((performance.now() - started) * 10) / 10 });
}

const crossProfiles = [
  { id: "north-starter", birthDate: "1985-04-09", birthTime: "06:35", gender: "female" as const, province: "Chiang Mai", preset: "starter" as const },
  { id: "isaan-established", birthDate: "1978-08-18", birthTime: "22:10", gender: "male" as const, province: "Khon Kaen", preset: "established" as const },
  { id: "leap-builder", birthDate: "2000-02-29", birthTime: "11:45", gender: "female" as const, province: "Phuket", preset: "builder" as const },
];

for (const profile of crossProfiles) {
  const started = performance.now();
  const state = await calculateBaziChart(profile, repository);
  const buffer = await buildEditorialProductPdf(state, {
    tier: "790",
    financial: FINANCIAL_PRESETS[profile.preset],
    profile,
  });
  const file = path.join(qaDir, `${profile.id}-790-editorial-v7.2.pdf`);
  writeFileSync(file, buffer);
  generated.push({ file, bytes: buffer.length, milliseconds: Math.round((performance.now() - started) * 10) / 10 });
}

console.log(JSON.stringify({ generated }, null, 2));
