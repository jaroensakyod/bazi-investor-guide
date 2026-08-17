import type { Fundamentals } from "../market/fundamentals";
import type { MarketData } from "../market/market-data";
import type { StockEntry } from "../investor/stock-database";
import type { PatternAnalysis } from "./pattern-engine";
import type { BaziCompatibility } from "./bazi-compatibility";
import type { SecurityBirthResolution } from "./security-birth";
import { assessDatasetUse } from "../trust/data-rights-registry";
import { assessResearchCapability, RESEARCH_ONLY_DISCLOSURE } from "./research-policy";

export const STOCK_RESEARCH_MODEL_VERSION = "stock-research-v1";
/** Tight upper bound used by exact branch-and-bound screens. */
export const MAX_PATTERN_SCORE = 90 as const;

export type ResearchEvidenceItem = {
  id: string;
  datasetId: string;
  category:
    | "identity"
    | "business"
    | "market"
    | "fundamental"
    | "price_series"
    | "security_event"
    | "personal_context";
  source: string;
  sourceRef?: string;
  asOf: string | null;
  freshness: "fresh" | "stale" | "unknown";
  license: "commercial" | "development_only" | "unknown";
};

export type StockResearchInput = {
  stock: StockEntry;
  quote: MarketData | null;
  fundamentals: Fundamentals | null;
  pattern: PatternAnalysis | null;
  securityBirth: SecurityBirthResolution;
  evidence: ResearchEvidenceItem[];
  baziCompatibility?: BaziCompatibility | null;
};

export type StockResearchAssessment = {
  modelVersion: typeof STOCK_RESEARCH_MODEL_VERSION;
  security: {
    securityId: string;
    ticker: string;
    name: string;
    exchange: string;
    country: string;
    currency: string;
    sector: string;
    business: string;
  };
  asOf: string | null;
  dataQuality: {
    score: number;
    availableFundamentalWeightPct: number;
    hasCurrentQuote: boolean;
    hasPriceSeries: boolean;
    hasOfficialSecurityDate: boolean;
    missing: string[];
  };
  marketAssessment: {
    qualityScore: number | null;
    patternScore: number | null;
    screenScore: number | null;
    status: "insufficient_evidence" | "deeper_research_candidate" | "monitor" | "risk_review";
    positiveEvidence: string[];
    riskFlags: string[];
    valuationContext: {
      pe: number | null;
      pbv: number | null;
      dividendYieldPct: number | null;
      peerNormalized: false;
    };
  };
  pattern: PatternAnalysis | null;
  securityBirth: SecurityBirthResolution;
  /** Deliberately separate and never included in marketAssessment.screenScore. */
  baziCompatibility: BaziCompatibility | null;
  evidence: ResearchEvidenceItem[];
  releasePolicy: ReturnType<typeof assessResearchCapability>;
  productionDataAllowed: boolean;
  disclosure: string;
};

type WeightedMetric = {
  id: string;
  weight: number;
  value: number | undefined;
  points: (value: number) => number;
  positive: (value: number) => string | null;
  risk: (value: number) => string | null;
};

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function isFinancialSector(stock: StockEntry, fundamentals: Fundamentals | null): boolean {
  const text = `${stock.sector} ${fundamentals?.sector ?? ""} ${fundamentals?.industry ?? ""}`.toLowerCase();
  return /bank|financial|insurance|ธนาคาร|การเงิน|ประกัน/.test(text);
}

function scoreFundamentals(stock: StockEntry, fundamentals: Fundamentals | null): {
  score: number | null;
  coveragePct: number;
  positive: string[];
  risks: string[];
} {
  if (!fundamentals) return { score: null, coveragePct: 0, positive: [], risks: [] };
  const financial = isFinancialSector(stock, fundamentals);
  const metrics: WeightedMetric[] = [
    {
      id: "roe",
      weight: 30,
      value: fundamentals.roe,
      points: (value) => (value >= 15 ? 1 : value >= 8 ? 0.65 : value >= 0 ? 0.25 : 0),
      positive: (value) => (value >= 15 ? `ROE ${value}% อยู่ในระดับแข็งแรงตามเกณฑ์ทั่วไป` : null),
      risk: (value) => (value < 0 ? `ROE ติดลบ ${value}%` : null),
    },
    {
      id: "profitMargin",
      weight: 20,
      value: fundamentals.profitMargin,
      points: (value) => (value >= 15 ? 1 : value > 0 ? 0.55 : 0),
      positive: (value) => (value > 0 ? `อัตรากำไรสุทธิเป็นบวก ${value}%` : null),
      risk: (value) => (value <= 0 ? `อัตรากำไรสุทธิไม่เป็นบวก ${value}%` : null),
    },
    {
      id: "revenueGrowth",
      weight: 20,
      value: fundamentals.revenueGrowth,
      points: (value) => (value >= 10 ? 1 : value > 0 ? 0.55 : 0),
      positive: (value) => (value > 0 ? `รายได้เติบโต ${value}%` : null),
      risk: (value) => (value < 0 ? `รายได้หดตัว ${value}%` : null),
    },
    ...(financial
      ? []
      : [
          {
            id: "debtToEquity",
            weight: 20,
            value: fundamentals.debtToEquity,
            points: (value: number) => (value <= 50 ? 1 : value <= 100 ? 0.6 : value <= 200 ? 0.25 : 0),
            positive: (value: number) => (value <= 50 ? `D/E ${value}% อยู่ในระดับต่ำตามเกณฑ์ทั่วไป` : null),
            risk: (value: number) => (value > 200 ? `D/E สูง ${value}%` : null),
          },
          {
            id: "currentRatio",
            weight: 10,
            value: fundamentals.currentRatio,
            points: (value: number) => (value >= 1.5 ? 1 : value >= 1 ? 0.6 : 0.2),
            positive: (value: number) => (value >= 1.5 ? `Current ratio ${round(value)} แสดงสภาพคล่องระยะสั้นที่ดีตามเกณฑ์ทั่วไป` : null),
            risk: (value: number) => (value < 1 ? `Current ratio ต่ำกว่า 1 (${round(value)})` : null),
          },
        ]),
  ];

  const totalWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const available = metrics.filter((metric) => metric.value !== undefined && Number.isFinite(metric.value));
  const availableWeight = available.reduce((sum, metric) => sum + metric.weight, 0);
  const earned = available.reduce((sum, metric) => sum + metric.weight * metric.points(metric.value as number), 0);
  const positive = available.map((metric) => metric.positive(metric.value as number)).filter((value): value is string => Boolean(value));
  const risks = available.map((metric) => metric.risk(metric.value as number)).filter((value): value is string => Boolean(value));

  return {
    score: availableWeight >= 50 ? round((earned / availableWeight) * 100) : null,
    coveragePct: round((availableWeight / totalWeight) * 100),
    positive,
    risks,
  };
}

function scorePattern(pattern: PatternAnalysis | null): { score: number | null; positive: string[]; risks: string[] } {
  if (!pattern || !pattern.dataQuality.sufficientForTrend) return { score: null, positive: [], risks: [] };
  const regimeScore: Record<PatternAnalysis["regime"], number | null> = {
    uptrend: 85,
    range: 60,
    mixed: 45,
    downtrend: 20,
    insufficient: null,
  };
  let score = regimeScore[pattern.regime];
  if (score === null) return { score: null, positive: [], risks: [] };
  const positive: string[] = [];
  const risks: string[] = [];
  if (pattern.regime === "uptrend") positive.push("แนวโน้มราคายังอยู่เหนือค่าเฉลี่ยหลักตามโมเดล observation");
  if (pattern.risk.volatilityBand === "low" || pattern.risk.volatilityBand === "moderate") score += 5;
  if (pattern.risk.volatilityBand === "high") {
    score -= 10;
    risks.push("ความผันผวนย้อนหลังอยู่ในระดับสูง");
  }
  if (pattern.risk.volatilityBand === "extreme") {
    score -= 25;
    risks.push("ความผันผวนย้อนหลังอยู่ในระดับรุนแรง");
  }
  if ((pattern.risk.maxDrawdown252Pct ?? 0) >= 30) {
    score -= 10;
    risks.push(`Maximum drawdown ย้อนหลังประมาณ ${pattern.risk.maxDrawdown252Pct}%`);
  }
  if (pattern.regime === "downtrend") risks.push("โมเดล observation จัดเป็นแนวโน้มลง");
  return { score: round(Math.max(0, Math.min(100, score))), positive, risks };
}

export function buildStockResearchAssessment(input: StockResearchInput): StockResearchAssessment {
  const fundamental = scoreFundamentals(input.stock, input.fundamentals);
  const pattern = scorePattern(input.pattern);
  const missing: string[] = [];
  if (!input.quote?.price) missing.push("ราคาล่าสุด");
  if (fundamental.coveragePct < 50) missing.push("ข้อมูลพื้นฐานอย่างน้อย 50% ของน้ำหนักที่เกี่ยวข้อง");
  if (!input.pattern) missing.push("ข้อมูลราคารายวันสำหรับ pattern");
  if (input.securityBirth.grade === "D") missing.push("วันเริ่มซื้อขายที่มีหลักฐาน");

  const screenScore =
    fundamental.score !== null && pattern.score !== null
      ? round(fundamental.score * 0.7 + pattern.score * 0.3)
      : fundamental.score !== null
        ? fundamental.score
        : null;
  const riskFlags = [...fundamental.risks, ...pattern.risks];
  const positiveEvidence = [...fundamental.positive, ...pattern.positive];
  const status: StockResearchAssessment["marketAssessment"]["status"] =
    screenScore === null || !input.quote?.price
      ? "insufficient_evidence"
      : riskFlags.length >= 2 || input.pattern?.regime === "downtrend"
        ? "risk_review"
        : screenScore >= 65
          ? "deeper_research_candidate"
          : "monitor";

  const qualityParts = [
    input.quote?.price ? 20 : 0,
    Math.min(35, fundamental.coveragePct * 0.35),
    input.pattern ? 25 : 0,
    input.stock.businessEvidence?.source ? 10 : 0,
    input.securityBirth.grade === "A" || input.securityBirth.grade === "B" ? 10 : 0,
  ];
  const asOfCandidates = [input.quote?.updatedAt, input.fundamentals?.fetchedAt, input.pattern?.asOf]
    .filter((value): value is string => Boolean(value))
    .sort();
  const evidence = [...input.evidence];
  if (input.baziCompatibility && !evidence.some((item) => item.category === "personal_context")) {
    evidence.push({
      id: `${input.securityBirth.securityId}:personal-context`,
      datasetId: "user-private-profile",
      category: "personal_context",
      source: "Private user chart reference",
      asOf: null,
      freshness: "unknown",
      license: "unknown",
    });
  }

  return {
    modelVersion: STOCK_RESEARCH_MODEL_VERSION,
    security: {
      securityId: input.securityBirth.securityId,
      ticker: input.stock.ticker,
      name: input.stock.name,
      exchange: input.stock.market,
      country: input.stock.country,
      currency: input.stock.currency,
      sector: input.stock.sector,
      business: input.stock.business,
    },
    asOf: asOfCandidates.at(-1) ?? null,
    dataQuality: {
      score: round(qualityParts.reduce((sum, value) => sum + value, 0)),
      availableFundamentalWeightPct: fundamental.coveragePct,
      hasCurrentQuote: Boolean(input.quote?.price),
      hasPriceSeries: Boolean(input.pattern),
      hasOfficialSecurityDate: input.securityBirth.grade === "A" || input.securityBirth.grade === "B",
      missing,
    },
    marketAssessment: {
      qualityScore: fundamental.score,
      patternScore: pattern.score,
      screenScore,
      status,
      positiveEvidence,
      riskFlags,
      valuationContext: {
        pe: input.quote?.pe ?? null,
        pbv: input.quote?.pbv ?? null,
        dividendYieldPct: input.quote?.dividendYield ?? null,
        peerNormalized: false,
      },
    },
    pattern: input.pattern,
    securityBirth: input.securityBirth,
    baziCompatibility: input.baziCompatibility ?? null,
    evidence,
    releasePolicy: assessResearchCapability("generic_screen"),
    productionDataAllowed:
      evidence.length > 0 &&
      evidence.every((item) =>
        assessDatasetUse(item.datasetId, "public_display", { environment: "production" }).allowed,
      ),
    disclosure: RESEARCH_ONLY_DISCLOSURE,
  };
}
