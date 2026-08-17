import type { CanonicalPriceSeries, PriceBar } from "./price-series";

export const PATTERN_MODEL_VERSION = "trend-observation-v1";

export type PatternRegime = "uptrend" | "downtrend" | "range" | "mixed" | "insufficient";
export type VolatilityBand = "low" | "moderate" | "high" | "extreme" | "unknown";
export type TrendDirection = "up" | "down" | "neutral";

export type PatternObservationCode =
  | "above_20d_average"
  | "below_20d_average"
  | "above_50d_average"
  | "below_50d_average"
  | "near_20d_high"
  | "near_20d_low"
  | "volatility_elevated"
  | "drawdown_elevated";

export type HistoricalScenarioEnvelope = {
  horizonSessions: number;
  sampleCount: number;
  lower10Pct: number;
  medianPct: number;
  upper90Pct: number;
  positiveFrequencyPct: number;
  label: "historical_distribution_not_forecast";
};

export type PatternAnalysis = {
  modelVersion: typeof PATTERN_MODEL_VERSION;
  securityId: string;
  asOf: string | null;
  sampleSize: number;
  regime: PatternRegime;
  direction: TrendDirection;
  lastPrice: number | null;
  trend: {
    sma20: number | null;
    sma50: number | null;
    sma20Slope5Pct: number | null;
    distanceFromSma20Pct: number | null;
  };
  risk: {
    atr14Pct: number | null;
    annualizedVolatility60Pct: number | null;
    volatilityBand: VolatilityBand;
    maxDrawdown252Pct: number | null;
  };
  levels: {
    recentSupport20: number | null;
    recentResistance20: number | null;
    positionInRange20Pct: number | null;
  };
  observations: PatternObservationCode[];
  scenarios: HistoricalScenarioEnvelope[];
  dataQuality: {
    validBars: number;
    rejectedBars: number;
    sufficientForTrend: boolean;
    sufficientForEvaluation: boolean;
  };
  publication: {
    mode: "observation_only";
    forecastRelease: "internal_only_pending_legal_and_model_review";
    forbiddenUse: "personalized_buy_sell_timing";
  };
};

export type TrendModelEvaluationEvent = {
  securityId: string;
  asOf: string;
  modelVersion: typeof PATTERN_MODEL_VERSION;
  horizonSessions: number;
  direction: TrendDirection;
  futureReturnPct: number;
  correct: boolean | null;
};

export type TrendModelEvaluation = {
  modelVersion: typeof PATTERN_MODEL_VERSION;
  securityId: string;
  horizonSessions: number;
  observations: number;
  directionalSignals: number;
  coveragePct: number;
  directionalAccuracyPct: number | null;
  baselineAccuracyPct: number | null;
  averageFutureReturnPct: Record<TrendDirection, number | null>;
  status: "insufficient_sample" | "not_better_than_baseline" | "promising_internal_only";
  productionReady: false;
  events: TrendModelEvaluationEvent[];
};

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function closeOf(bar: PriceBar): number {
  return bar.adjustedClose ?? bar.close;
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function smaAt(values: readonly number[], period: number, endIndex = values.length - 1): number | null {
  const start = endIndex - period + 1;
  if (start < 0 || endIndex >= values.length) return null;
  return average(values.slice(start, endIndex + 1));
}

function standardDeviation(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const mean = average(values) as number;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(values: readonly number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function simpleReturns(values: readonly number[]): number[] {
  const returns: number[] = [];
  for (let index = 1; index < values.length; index += 1) {
    returns.push(values[index] / values[index - 1] - 1);
  }
  return returns;
}

function rollingReturns(values: readonly number[], horizon: number): number[] {
  const returns: number[] = [];
  for (let index = horizon; index < values.length; index += 1) {
    returns.push((values[index] / values[index - horizon] - 1) * 100);
  }
  return returns;
}

function trueRanges(bars: readonly PriceBar[]): number[] {
  const output: number[] = [];
  for (let index = 1; index < bars.length; index += 1) {
    const previousClose = closeOf(bars[index - 1]);
    output.push(
      Math.max(
        bars[index].high - bars[index].low,
        Math.abs(bars[index].high - previousClose),
        Math.abs(bars[index].low - previousClose),
      ),
    );
  }
  return output;
}

function maxDrawdownPct(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  let peak = values[0];
  let worst = 0;
  for (const value of values) {
    peak = Math.max(peak, value);
    worst = Math.min(worst, value / peak - 1);
  }
  return Math.abs(worst * 100);
}

function directionAt(closes: readonly number[], index: number): TrendDirection {
  const sma20 = smaAt(closes, 20, index);
  const sma50 = smaAt(closes, 50, index);
  const sma20FiveAgo = smaAt(closes, 20, index - 5);
  if (sma20 === null || sma50 === null || sma20FiveAgo === null) return "neutral";
  const slope = sma20 / sma20FiveAgo - 1;
  const close = closes[index];
  if (close > sma20 && sma20 > sma50 && slope > 0.002) return "up";
  if (close < sma20 && sma20 < sma50 && slope < -0.002) return "down";
  return "neutral";
}

function regimeOf(direction: TrendDirection, sma20: number | null, sma50: number | null, slope: number | null): PatternRegime {
  if (sma20 === null || sma50 === null || slope === null) return "insufficient";
  if (direction === "up") return "uptrend";
  if (direction === "down") return "downtrend";
  const distance = Math.abs(sma20 / sma50 - 1);
  if (distance < 0.01 && Math.abs(slope) < 0.005) return "range";
  return "mixed";
}

function volatilityBand(value: number | null): VolatilityBand {
  if (value === null) return "unknown";
  if (value < 20) return "low";
  if (value < 40) return "moderate";
  if (value < 60) return "high";
  return "extreme";
}

function historicalScenarios(closes: readonly number[]): HistoricalScenarioEnvelope[] {
  const scenarios: HistoricalScenarioEnvelope[] = [];
  for (const horizon of [5, 20, 60]) {
    const sample = rollingReturns(closes.slice(-756), horizon);
    if (sample.length < 20) continue;
    scenarios.push({
      horizonSessions: horizon,
      sampleCount: sample.length,
      lower10Pct: round(quantile(sample, 0.1) as number),
      medianPct: round(quantile(sample, 0.5) as number),
      upper90Pct: round(quantile(sample, 0.9) as number),
      positiveFrequencyPct: round((sample.filter((value) => value > 0).length / sample.length) * 100),
      label: "historical_distribution_not_forecast",
    });
  }
  return scenarios;
}

export function analyzePricePattern(series: CanonicalPriceSeries): PatternAnalysis {
  const bars = series.bars;
  const closes = bars.map(closeOf);
  const lastPrice = closes.at(-1) ?? null;
  const sma20 = smaAt(closes, 20);
  const sma50 = smaAt(closes, 50);
  const sma20FiveAgo = smaAt(closes, 20, closes.length - 6);
  const slope = sma20 !== null && sma20FiveAgo !== null ? sma20 / sma20FiveAgo - 1 : null;
  const direction = closes.length > 0 ? directionAt(closes, closes.length - 1) : "neutral";
  const recent20 = bars.slice(-20);
  const support = recent20.length >= 20 ? Math.min(...recent20.map((bar) => bar.low)) : null;
  const resistance = recent20.length >= 20 ? Math.max(...recent20.map((bar) => bar.high)) : null;
  const ranges = trueRanges(bars).slice(-14);
  const atr14 = ranges.length === 14 ? average(ranges) : null;
  const returns60 = simpleReturns(closes.slice(-61));
  const dailyStd = standardDeviation(returns60);
  const annualizedVolatility = dailyStd === null ? null : dailyStd * Math.sqrt(252) * 100;
  const drawdown = maxDrawdownPct(closes.slice(-252));
  const position =
    lastPrice !== null && support !== null && resistance !== null && resistance > support
      ? ((lastPrice - support) / (resistance - support)) * 100
      : null;
  const observations: PatternObservationCode[] = [];

  if (lastPrice !== null && sma20 !== null) observations.push(lastPrice >= sma20 ? "above_20d_average" : "below_20d_average");
  if (lastPrice !== null && sma50 !== null) observations.push(lastPrice >= sma50 ? "above_50d_average" : "below_50d_average");
  if (position !== null && position >= 90) observations.push("near_20d_high");
  if (position !== null && position <= 10) observations.push("near_20d_low");
  if (annualizedVolatility !== null && annualizedVolatility >= 40) observations.push("volatility_elevated");
  if (drawdown !== null && drawdown >= 20) observations.push("drawdown_elevated");

  return {
    modelVersion: PATTERN_MODEL_VERSION,
    securityId: series.metadata.securityId,
    asOf: series.endAt,
    sampleSize: bars.length,
    regime: regimeOf(direction, sma20, sma50, slope),
    direction,
    lastPrice: lastPrice === null ? null : round(lastPrice, 4),
    trend: {
      sma20: sma20 === null ? null : round(sma20, 4),
      sma50: sma50 === null ? null : round(sma50, 4),
      sma20Slope5Pct: slope === null ? null : round(slope * 100),
      distanceFromSma20Pct: lastPrice === null || sma20 === null ? null : round((lastPrice / sma20 - 1) * 100),
    },
    risk: {
      atr14Pct: lastPrice === null || atr14 === null ? null : round((atr14 / lastPrice) * 100),
      annualizedVolatility60Pct: annualizedVolatility === null ? null : round(annualizedVolatility),
      volatilityBand: volatilityBand(annualizedVolatility),
      maxDrawdown252Pct: drawdown === null ? null : round(drawdown),
    },
    levels: {
      recentSupport20: support === null ? null : round(support, 4),
      recentResistance20: resistance === null ? null : round(resistance, 4),
      positionInRange20Pct: position === null ? null : round(position),
    },
    observations,
    scenarios: historicalScenarios(closes),
    dataQuality: {
      validBars: bars.length,
      rejectedBars: series.issues.length,
      sufficientForTrend: bars.length >= 50,
      sufficientForEvaluation: bars.length >= 180,
    },
    publication: {
      mode: "observation_only",
      forecastRelease: "internal_only_pending_legal_and_model_review",
      forbiddenUse: "personalized_buy_sell_timing",
    },
  };
}

/**
 * Walk-forward evaluation: features at t use only bars at or before t, and the
 * outcome is measured at t+h. Events are compact audit rows, not graph images.
 */
export function evaluateTrendObservationModel(
  series: CanonicalPriceSeries,
  horizonSessions = 20,
  options: { minimumDirectionalSignals?: number; includeEvents?: boolean } = {},
): TrendModelEvaluation {
  if (!Number.isInteger(horizonSessions) || horizonSessions < 1) throw new Error("horizonSessions ต้องเป็นจำนวนเต็มบวก");
  const minimumDirectionalSignals = options.minimumDirectionalSignals ?? 100;
  const closes = series.bars.map(closeOf);
  const events: TrendModelEvaluationEvent[] = [];
  const returnsByDirection: Record<TrendDirection, number[]> = { up: [], down: [], neutral: [] };
  let observationCount = 0;
  let directionalSignals = 0;
  let correct = 0;
  let positiveOutcomes = 0;
  let negativeOutcomes = 0;

  for (let index = 54; index + horizonSessions < closes.length; index += 1) {
    observationCount += 1;
    const direction = directionAt(closes, index);
    const futureReturnPct = (closes[index + horizonSessions] / closes[index] - 1) * 100;
    const isCorrect = direction === "neutral" ? null : direction === "up" ? futureReturnPct > 0 : futureReturnPct < 0;
    if (direction !== "neutral") {
      directionalSignals += 1;
      if (isCorrect) correct += 1;
      if (futureReturnPct > 0) positiveOutcomes += 1;
      else negativeOutcomes += 1;
    }
    returnsByDirection[direction].push(futureReturnPct);
    if (options.includeEvents) {
      events.push({
        securityId: series.metadata.securityId,
        asOf: series.bars[index].timestamp,
        modelVersion: PATTERN_MODEL_VERSION,
        horizonSessions,
        direction,
        futureReturnPct: round(futureReturnPct),
        correct: isCorrect,
      });
    }
  }

  const accuracy = directionalSignals > 0 ? (correct / directionalSignals) * 100 : null;
  const baseline = directionalSignals > 0 ? (Math.max(positiveOutcomes, negativeOutcomes) / directionalSignals) * 100 : null;
  const averageByDirection = Object.fromEntries(
    (Object.keys(returnsByDirection) as TrendDirection[]).map((direction) => {
      const value = average(returnsByDirection[direction]);
      return [direction, value === null ? null : round(value)];
    }),
  ) as Record<TrendDirection, number | null>;

  const status =
    directionalSignals < minimumDirectionalSignals
      ? "insufficient_sample"
      : accuracy !== null && baseline !== null && accuracy > baseline + 2
        ? "promising_internal_only"
        : "not_better_than_baseline";

  return {
    modelVersion: PATTERN_MODEL_VERSION,
    securityId: series.metadata.securityId,
    horizonSessions,
    observations: observationCount,
    directionalSignals,
    coveragePct: observationCount > 0 ? round((directionalSignals / observationCount) * 100) : 0,
    directionalAccuracyPct: accuracy === null ? null : round(accuracy),
    baselineAccuracyPct: baseline === null ? null : round(baseline),
    averageFutureReturnPct: averageByDirection,
    status,
    productionReady: false,
    events,
  };
}
