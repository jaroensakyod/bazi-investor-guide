import { getResearchableStocks, type StockEntry } from "../investor/stock-database";
import { loadFundamentalsCache, type Fundamentals } from "../market/fundamentals";
import { loadSnapshot, type MarketData } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { analyzePricePattern } from "./pattern-engine";
import { loadCanonicalStoredPriceSeries } from "./price-series-store";
import { getSecurityBirth } from "./security-event-repository";
import {
  buildStockResearchAssessment,
  MAX_PATTERN_SCORE,
  type ResearchEvidenceItem,
} from "./stock-research";
import { assessResearchCapability, RESEARCH_ONLY_DISCLOSURE } from "./research-policy";
import { classifyEvidenceFreshness, DEFAULT_FRESHNESS_DAYS } from "./evidence-freshness";
import type { SecurityBirthResolution } from "./security-birth";

export type ResearchScreenResult = {
  screenVersion: "generic-research-screen-v1";
  generatedAt: string;
  markets: string[];
  universeCount: number;
  assessedCount: number;
  returnedCount: number;
  candidates: Array<{
    securityId: string;
    ticker: string;
    name: string;
    market: string;
    sector: string;
    screenScore: number;
    qualityScore: number | null;
    patternScore: number | null;
    dataQualityScore: number;
    status: "deeper_research_candidate" | "monitor" | "risk_review";
    positiveEvidence: string[];
    riskFlags: string[];
  }>;
  releasePolicy: ReturnType<typeof assessResearchCapability>;
  productionDataAllowed: boolean;
  disclosure: string;
};

type ScreenWorkItem = {
  stock: StockEntry;
  quote: MarketData;
  fundamentals: Fundamentals;
  birth: SecurityBirthResolution;
  evidence: ResearchEvidenceItem[];
  scoreUpperBound: number;
};

function compareCandidate(
  left: ResearchScreenResult["candidates"][number],
  right: ResearchScreenResult["candidates"][number],
): number {
  return right.screenScore - left.screenScore
    || right.dataQualityScore - left.dataQualityScore
    || left.securityId.localeCompare(right.securityId);
}

export function buildGenericResearchScreen(options: {
  markets?: string[];
  limit?: number;
  includeRiskReview?: boolean;
} = {}): ResearchScreenResult {
  const markets = (options.markets ?? []).map((market) => market.toUpperCase());
  const limit = Math.max(1, Math.min(200, Math.floor(options.limit ?? 30)));
  const stocks = getResearchableStocks().filter((stock) => markets.length === 0 || markets.includes(stock.market.toUpperCase()));
  const snapshot = loadSnapshot();
  const fundamentalsCache = loadFundamentalsCache();
  const candidates: ResearchScreenResult["candidates"] = [];
  const workItems: ScreenWorkItem[] = [];
  let assessedCount = 0;
  let developmentOnlyEvidence = false;

  for (const stock of stocks) {
    const quoteKey = yahooTicker(stock.ticker, stock.market) ?? "";
    const quote = snapshot?.quotes[quoteKey] ?? null;
    const fundamentals = fundamentalsCache.get(quoteKey) ?? null;
    if (!quote?.price || !fundamentals) continue;
    assessedCount += 1;
    developmentOnlyEvidence = true;
    const birth = getSecurityBirth(stock.market, stock.ticker);
    const evidence: ResearchEvidenceItem[] = [
      {
        id: `${birth.securityId}:quote`,
        datasetId: "yahoo-development-market",
        category: "market",
        source: "Yahoo development snapshot",
        asOf: quote.updatedAt ?? snapshot?.updatedAt ?? null,
        freshness: classifyEvidenceFreshness(quote.updatedAt ?? snapshot?.updatedAt ?? null, DEFAULT_FRESHNESS_DAYS.latestQuote),
        license: "development_only",
      },
      {
        id: `${birth.securityId}:fundamentals`,
        datasetId: "yahoo-development-market",
        category: "fundamental",
        source: "Yahoo development snapshot",
        asOf: fundamentals.fetchedAt ?? null,
        freshness: classifyEvidenceFreshness(fundamentals.fetchedAt ?? null, DEFAULT_FRESHNESS_DAYS.fundamentals),
        license: "development_only",
      },
    ];
    const baseline = buildStockResearchAssessment({
      stock,
      quote,
      fundamentals,
      pattern: null,
      securityBirth: birth,
      evidence,
    });
    const qualityScore = baseline.marketAssessment.qualityScore;
    if (qualityScore === null || baseline.marketAssessment.status === "insufficient_evidence") continue;
    // Fundamental risk flags cannot be removed by adding a price pattern.
    if (!options.includeRiskReview && baseline.marketAssessment.status === "risk_review") continue;
    workItems.push({
      stock,
      quote,
      fundamentals,
      birth,
      evidence,
      // If EOD is unavailable the final score is qualityScore. If it exists,
      // the pattern contribution is 30% and bounded by MAX_PATTERN_SCORE.
      scoreUpperBound: Math.max(
        qualityScore,
        Math.ceil((qualityScore * 0.7 + MAX_PATTERN_SCORE * 0.3) * 100) / 100,
      ),
    });
  }

  workItems.sort((left, right) =>
    right.scoreUpperBound - left.scoreUpperBound || left.birth.securityId.localeCompare(right.birth.securityId),
  );

  for (const item of workItems) {
    if (candidates.length >= limit && item.scoreUpperBound < candidates[limit - 1].screenScore) break;
    const series =
      loadCanonicalStoredPriceSeries({ securityId: item.birth.securityId, timeframe: "1d", adjustment: "total_return" }) ??
      loadCanonicalStoredPriceSeries({ securityId: item.birth.securityId, timeframe: "1d", adjustment: "split_adjusted" }) ??
      loadCanonicalStoredPriceSeries({ securityId: item.birth.securityId, timeframe: "1d", adjustment: "raw" });
    const pattern = series ? analyzePricePattern(series) : null;
    const assessment = buildStockResearchAssessment({
      stock: item.stock,
      quote: item.quote,
      fundamentals: item.fundamentals,
      pattern,
      securityBirth: item.birth,
      evidence: item.evidence,
    });
    const screenScore = assessment.marketAssessment.screenScore;
    if (screenScore === null || assessment.marketAssessment.status === "insufficient_evidence") continue;
    if (!options.includeRiskReview && assessment.marketAssessment.status === "risk_review") continue;
    candidates.push({
      securityId: assessment.security.securityId,
      ticker: assessment.security.ticker,
      name: assessment.security.name,
      market: assessment.security.exchange,
      sector: assessment.security.sector,
      screenScore,
      qualityScore: assessment.marketAssessment.qualityScore,
      patternScore: assessment.marketAssessment.patternScore,
      dataQualityScore: assessment.dataQuality.score,
      status: assessment.marketAssessment.status,
      positiveEvidence: assessment.marketAssessment.positiveEvidence,
      riskFlags: assessment.marketAssessment.riskFlags,
    });
    candidates.sort(compareCandidate);
    if (candidates.length > limit) candidates.length = limit;
  }

  candidates.sort(compareCandidate);
  return {
    screenVersion: "generic-research-screen-v1",
    generatedAt: new Date().toISOString(),
    markets,
    universeCount: stocks.length,
    assessedCount,
    returnedCount: candidates.length,
    candidates,
    releasePolicy: assessResearchCapability("generic_screen"),
    productionDataAllowed: !developmentOnlyEvidence,
    disclosure: RESEARCH_ONLY_DISCLOSURE,
  };
}
