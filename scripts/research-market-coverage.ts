/** Build an auditable Fundamentals/EOD coverage snapshot by market. */
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getResearchableStocks } from "../src/lib/investor/stock-database";
import {
  fundamentalsCoreFieldCount,
  fundamentalsLicense,
  hasUsableFundamentals,
  isFundamentalsFresh,
  loadFundamentalsCache,
} from "../src/lib/market/fundamentals";
import { yahooTicker } from "../src/lib/market/yahoo";
import { isDateWithinDays, positiveInteger } from "../src/lib/research/market-data-batch";
import { loadStoredPriceSeries, priceSeriesFile } from "../src/lib/research/price-series-store";
import { securityIdOf } from "../src/lib/research/security-birth";
import type { CanonicalPriceSeries, PriceAdjustment } from "../src/lib/research/price-series";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_FILE = path.join(ROOT, "data/staging/research-market-coverage.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 10_000) / 100;
}

type CoverageCounter = {
  total: number;
  fundamentalsUsable: number;
  fundamentalsCore: number;
  fundamentalsFresh: number;
  fundamentalsCommercial: number;
  eodAvailable: number;
  eodFresh: number;
  eodPatternReady: number;
  eodCommercial: number;
  eodCompressedBytes: number;
};

function emptyCounter(): CoverageCounter {
  return {
    total: 0,
    fundamentalsUsable: 0,
    fundamentalsCore: 0,
    fundamentalsFresh: 0,
    fundamentalsCommercial: 0,
    eodAvailable: 0,
    eodFresh: 0,
    eodPatternReady: 0,
    eodCommercial: 0,
    eodCompressedBytes: 0,
  };
}

function seriesFor(securityId: string): { series: CanonicalPriceSeries | null; adjustment: PriceAdjustment | null } {
  for (const adjustment of ["total_return", "split_adjusted", "raw"] as const) {
    const series = loadStoredPriceSeries({ securityId, timeframe: "1d", adjustment });
    if (series) return { series, adjustment };
  }
  return { series: null, adjustment: null };
}

function addRecord(
  counter: CoverageCounter,
  input: {
    fundamentalsUsable: boolean;
    fundamentalsCore: boolean;
    fundamentalsFresh: boolean;
    fundamentalsCommercial: boolean;
    series: CanonicalPriceSeries | null;
    seriesFresh: boolean;
    compressedBytes: number;
  },
): void {
  counter.total += 1;
  if (input.fundamentalsUsable) counter.fundamentalsUsable += 1;
  if (input.fundamentalsCore) counter.fundamentalsCore += 1;
  if (input.fundamentalsFresh) counter.fundamentalsFresh += 1;
  if (input.fundamentalsCommercial) counter.fundamentalsCommercial += 1;
  if (input.series) {
    counter.eodAvailable += 1;
    if (input.seriesFresh) counter.eodFresh += 1;
    if (input.series.bars.length >= 252) counter.eodPatternReady += 1;
    if (input.series.metadata.source.license === "commercial") counter.eodCommercial += 1;
    counter.eodCompressedBytes += input.compressedBytes;
  }
}

function present(counter: CoverageCounter) {
  return {
    total: counter.total,
    fundamentals: {
      usable: counter.fundamentalsUsable,
      usablePct: pct(counter.fundamentalsUsable, counter.total),
      core: counter.fundamentalsCore,
      corePct: pct(counter.fundamentalsCore, counter.total),
      fresh: counter.fundamentalsFresh,
      freshPct: pct(counter.fundamentalsFresh, counter.total),
      commercialEligible: counter.fundamentalsCommercial,
      commercialEligiblePct: pct(counter.fundamentalsCommercial, counter.total),
    },
    eod: {
      available: counter.eodAvailable,
      availablePct: pct(counter.eodAvailable, counter.total),
      fresh: counter.eodFresh,
      freshPct: pct(counter.eodFresh, counter.total),
      patternReady: counter.eodPatternReady,
      patternReadyPct: pct(counter.eodPatternReady, counter.total),
      commercialEligible: counter.eodCommercial,
      commercialEligiblePct: pct(counter.eodCommercial, counter.total),
      compressedBytes: counter.eodCompressedBytes,
    },
  };
}

const fundamentalsRefreshDays = positiveInteger(arg("fundamentals-refresh-days"), 120, 730);
const eodRefreshDays = positiveInteger(arg("eod-refresh-days"), 7, 60);
const fundamentals = loadFundamentalsCache();
const overall = emptyCounter();
const byMarket = new Map<string, CoverageCounter>();
const byCountry = new Map<string, CoverageCounter>();

for (const stock of getResearchableStocks()) {
  const securityId = securityIdOf(stock.market, stock.ticker);
  const providerTicker = yahooTicker(stock.ticker, stock.market);
  const fundamental = fundamentals.get(providerTicker);
  const { series, adjustment } = seriesFor(securityId);
  let compressedBytes = 0;
  if (series && adjustment) {
    try {
      compressedBytes = statSync(priceSeriesFile({ securityId, timeframe: "1d", adjustment })).size;
    } catch {
      compressedBytes = 0;
    }
  }
  const input = {
    fundamentalsUsable: hasUsableFundamentals(fundamental),
    fundamentalsCore: fundamentalsCoreFieldCount(fundamental) >= 3,
    fundamentalsFresh: isFundamentalsFresh(fundamental, fundamentalsRefreshDays),
    fundamentalsCommercial: hasUsableFundamentals(fundamental) && fundamentalsLicense(fundamental) === "commercial",
    series,
    seriesFresh: Boolean(series && isDateWithinDays(series.endAt, eodRefreshDays)),
    compressedBytes,
  };
  addRecord(overall, input);
  const market = byMarket.get(stock.market) ?? emptyCounter();
  addRecord(market, input);
  byMarket.set(stock.market, market);
  const country = byCountry.get(stock.country) ?? emptyCounter();
  addRecord(country, input);
  byCountry.set(stock.country, country);
}

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  thresholds: { fundamentalsRefreshDays, eodRefreshDays, patternMinimumBars: 252 },
  rightsPolicy: {
    internalCoverageIncludesDevelopmentData: true,
    commercialEligibleRequiresExplicitCommercialProvenance: true,
    legacyFundamentalsWithoutProvenance: "classified_as_yahoo_development_only",
  },
  overall: present(overall),
  byMarket: [...byMarket.entries()]
    .map(([market, counter]) => ({ market, ...present(counter) }))
    .sort((left, right) => right.total - left.total || left.market.localeCompare(right.market)),
  byCountry: [...byCountry.entries()]
    .map(([country, counter]) => ({ country, ...present(counter) }))
    .sort((left, right) => right.total - left.total || left.country.localeCompare(right.country)),
};

if (flag("write")) {
  mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  const temporary = `${OUTPUT_FILE}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(output, null, 2) + "\n", "utf8");
  renameSync(temporary, OUTPUT_FILE);
}

console.log(JSON.stringify({ ...output, ...(flag("write") ? { outputFile: OUTPUT_FILE } : {}) }, null, 2));
