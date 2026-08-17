import type { CanonicalPriceSeries, PriceAdjustment, PriceTimeframe } from "./price-series";

export type PriceHistoryRequest = {
  securityId: string;
  ticker: string;
  exchange: string;
  currency?: string;
  timeZone?: string;
  timeframe: PriceTimeframe;
  adjustment: PriceAdjustment;
  from: string;
  to: string;
};

export interface PriceHistoryProvider {
  readonly id: string;
  readonly licence: "commercial" | "development_only" | "unknown";
  fetchSeries(request: PriceHistoryRequest): Promise<CanonicalPriceSeries>;
}

export function assertCommercialSeries(series: CanonicalPriceSeries): void {
  if (series.metadata.source.license !== "commercial") {
    throw new Error(
      `price series จาก ${series.metadata.source.provider} มีสิทธิ์ ${series.metadata.source.license}; ห้ามใช้ใน paid/public production`,
    );
  }
}

