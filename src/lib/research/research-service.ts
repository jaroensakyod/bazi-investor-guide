import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { getAllStocks, isResearchableStock, resolveCanonicalStock } from "../investor/stock-database";
import { loadFundamentalsCache } from "../market/fundamentals";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { analyzePricePattern } from "./pattern-engine";
import { loadCanonicalStoredPriceSeries } from "./price-series-store";
import { getSecurityBirth } from "./security-event-repository";
import { buildBaziCompatibility } from "./bazi-compatibility";
import { buildStockResearchAssessment, type ResearchEvidenceItem, type StockResearchAssessment } from "./stock-research";
import { classifyEvidenceFreshness, DEFAULT_FRESHNESS_DAYS } from "./evidence-freshness";

function findStock(ticker: string, market?: string) {
  const normalizedTicker = ticker.trim().toUpperCase();
  const catalog = getAllStocks();
  const match = market
    ? catalog.find((stock) => stock.ticker.toUpperCase() === normalizedTicker && stock.market.toUpperCase() === market.toUpperCase())
    : catalog.find((stock) => stock.ticker.toUpperCase() === normalizedTicker);
  return match ? resolveCanonicalStock(match, catalog) : undefined;
}

export function buildStockResearchSnapshot(input: {
  ticker: string;
  market?: string;
  baziState?: CalculatedStateValue | null;
}): StockResearchAssessment {
  const stock = findStock(input.ticker, input.market);
  if (!stock) throw new Error(`ไม่พบหุ้น ${input.ticker}${input.market ? ` (${input.market})` : ""} ในคลัง`);
  if (!isResearchableStock(stock)) {
    throw new Error(
      `${stock.market}:${stock.ticker} ไม่ใช่หลักทรัพย์ปัจจุบัน (${stock.securityStatus})${stock.successorTicker ? ` — ใช้ ${stock.successorTicker} แทน` : ""}`,
    );
  }
  const quoteKey = yahooTicker(stock.ticker, stock.market) ?? "";
  const snapshot = loadSnapshot();
  const quote = snapshot?.quotes[quoteKey] ?? null;
  const fundamentals = loadFundamentalsCache().get(quoteKey) ?? null;
  const securityBirth = getSecurityBirth(stock.market, stock.ticker);
  const storedSeries =
    loadCanonicalStoredPriceSeries({ securityId: securityBirth.securityId, timeframe: "1d", adjustment: "total_return" }) ??
    loadCanonicalStoredPriceSeries({ securityId: securityBirth.securityId, timeframe: "1d", adjustment: "split_adjusted" }) ??
    loadCanonicalStoredPriceSeries({ securityId: securityBirth.securityId, timeframe: "1d", adjustment: "raw" });
  const pattern = storedSeries ? analyzePricePattern(storedSeries) : null;
  const evidence: ResearchEvidenceItem[] = [
    {
      id: `${securityBirth.securityId}:identity`,
      datasetId: "curated-security-catalog",
      category: "identity",
      source: "stock-catalog",
      asOf: null,
      freshness: "unknown",
      license: "unknown",
    },
  ];
  if (stock.businessEvidence?.source) {
    evidence.push({
      id: `${securityBirth.securityId}:business`,
      datasetId: "curated-security-catalog",
      category: "business",
      source: stock.businessEvidence.source,
      sourceRef: stock.businessEvidence.url,
      asOf: stock.reviewedAt,
      freshness: "unknown",
      license: "unknown",
    });
  }
  if (quote) {
    const quoteAsOf = quote.updatedAt ?? snapshot?.updatedAt ?? null;
    evidence.push({
      id: `${securityBirth.securityId}:quote`,
      datasetId: "yahoo-development-market",
      category: "market",
      source: "Yahoo development snapshot",
      asOf: quoteAsOf,
      freshness: classifyEvidenceFreshness(quoteAsOf, DEFAULT_FRESHNESS_DAYS.latestQuote),
      license: "development_only",
    });
  }
  if (fundamentals) {
    const fundamentalsAsOf = fundamentals.fetchedAt ?? null;
    evidence.push({
      id: `${securityBirth.securityId}:fundamentals`,
      datasetId: "yahoo-development-market",
      category: "fundamental",
      source: "Yahoo development snapshot",
      asOf: fundamentalsAsOf,
      freshness: classifyEvidenceFreshness(fundamentalsAsOf, DEFAULT_FRESHNESS_DAYS.fundamentals),
      license: "development_only",
    });
  }
  if (storedSeries) {
    const seriesAsOf = storedSeries.metadata.source.asOf;
    evidence.push({
      id: `${securityBirth.securityId}:series`,
      datasetId: storedSeries.metadata.source.provider.toLowerCase().includes("yahoo")
        ? "yahoo-development-market"
        : "unclassified-source",
      category: "price_series",
      source: storedSeries.metadata.source.provider,
      sourceRef: storedSeries.metadata.source.sourceRef,
      asOf: seriesAsOf,
      freshness: classifyEvidenceFreshness(seriesAsOf, DEFAULT_FRESHNESS_DAYS.dailySeries),
      license: storedSeries.metadata.source.license,
    });
  }
  if (securityBirth.selectedEvent) {
    evidence.push({
      id: `${securityBirth.securityId}:birth`,
      datasetId: "official-security-events",
      category: "security_event",
      source: securityBirth.selectedEvent.evidence.sourceName,
      sourceRef: securityBirth.selectedEvent.evidence.sourceUrl,
      asOf: securityBirth.selectedEvent.localDate,
      freshness: "fresh",
      license: securityBirth.selectedEvent.evidence.displayRights === "allowed" ? "commercial" : "unknown",
    });
  }

  return buildStockResearchAssessment({
    stock,
    quote,
    fundamentals,
    pattern,
    securityBirth,
    evidence,
    baziCompatibility: input.baziState ? buildBaziCompatibility(input.baziState, stock) : null,
  });
}
