import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { StockEntry } from "../src/lib/investor/stock-database";
import { compareResearchSnapshots } from "../src/lib/research/research-snapshot-delta";
import {
  loadResearchSnapshotHistory,
  loadResearchSnapshotIndex,
  validateResearchSnapshotIndex,
} from "../src/lib/research/research-snapshot-index";
import { createResearchSnapshot } from "../src/lib/research/research-snapshot";
import { saveResearchSnapshot } from "../src/lib/research/research-snapshot-store";
import { buildStockResearchAssessment, type StockResearchInput } from "../src/lib/research/stock-research";

const temporaryDirectories: string[] = [];
afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const stock = {
  type: "stock",
  ticker: "HISTORY",
  name: "History Fixture",
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

const base: StockResearchInput = {
  stock,
  quote: { price: 100, pe: 20, pbv: 4, dividendYield: 1, updatedAt: "2026-08-08T00:00:00.000Z" },
  fundamentals: { roe: 20, profitMargin: 18, revenueGrowth: 12, debtToEquity: 30, currentRatio: 1.8, fetchedAt: "2026-08-07T00:00:00.000Z" },
  pattern: null,
  securityBirth: {
    securityId: "NASDAQ:HISTORY",
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

function snapshotPair() {
  const first = createResearchSnapshot(buildStockResearchAssessment(base), "2026-08-08T00:00:00.000Z");
  const second = createResearchSnapshot(
    buildStockResearchAssessment({
      ...base,
      quote: { ...base.quote!, updatedAt: "2026-08-09T00:00:00.000Z" },
      fundamentals: {
        ...base.fundamentals!,
        roe: -5,
        profitMargin: -2,
        revenueGrowth: -12,
        fetchedAt: "2026-08-09T00:00:00.000Z",
      },
    }),
    "2026-08-09T00:00:00.000Z",
  );
  return { first, second };
}

describe("research snapshot history and delta", () => {
  it("save snapshot แล้วอัปเดต index และอ่าน history ล่าสุดก่อน", () => {
    const root = mkdtempSync(path.join(tmpdir(), "bazi-snapshot-"));
    temporaryDirectories.push(root);
    const { first, second } = snapshotPair();
    saveResearchSnapshot(first, root);
    saveResearchSnapshot(second, root);

    const index = loadResearchSnapshotIndex(root);
    expect(index?.entries).toHaveLength(2);
    expect(index && validateResearchSnapshotIndex(index)).toEqual([]);
    expect(loadResearchSnapshotHistory("NASDAQ:HISTORY", root).map((item) => item.snapshotId)).toEqual([
      second.snapshotId,
      first.snapshotId,
    ]);
  });

  it("สรุปสิ่งที่เปลี่ยนระหว่าง assessment ได้", () => {
    const { first, second } = snapshotPair();
    const delta = compareResearchSnapshots(first, second);
    expect(delta.materialChange).toBe(true);
    expect(delta.dataAsOf.changed).toBe(true);
    expect(delta.risks.added.length + delta.claims.added.length).toBeGreaterThan(0);
  });

  it("snapshot เดิมไม่มี material change", () => {
    const { first } = snapshotPair();
    const delta = compareResearchSnapshots(first, first);
    expect(delta.materialChange).toBe(false);
    expect(delta.summary).toEqual(["ไม่มีการเปลี่ยนแปลงที่มีสาระสำคัญ"]);
  });
});
