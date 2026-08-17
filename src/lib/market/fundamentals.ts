/**
 * Fundamentals — ตัวเลขพื้นฐานบริษัทจาก Yahoo financialData (v10 quoteSummary)
 *
 * ใช้กับ: วิเคราะห์พื้นฐานในแชท + Buffett checklist + hidden gems (ตัวกรองคุณภาพ)
 * เก็บ cache ไว้ data/cache/fundamentals.json (key = yahoo ticker) — resumable
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchQuoteSummaryModule } from "./yahoo";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CACHE_FILE = path.join(ROOT, "data/cache/fundamentals.json");

export type Fundamentals = {
  /** % (0.15 → 15) */
  roe?: number;
  /** % (debt/equity — Yahoo ให้เป็น % ตรงๆ) */
  debtToEquity?: number;
  /** % */
  grossMargin?: number;
  /** % */
  operatingMargin?: number;
  /** % */
  profitMargin?: number;
  /** % (YoY) */
  revenueGrowth?: number;
  currentRatio?: number;
  quickRatio?: number;
  totalRevenue?: number; // สกุลรายงาน
  currency?: string;
  industry?: string;
  sector?: string;
  fetchedAt?: string;
  /** Provenance is mandatory for new fetches. Legacy cache rows without this field are Yahoo development data. */
  source?: {
    datasetId: string;
    provider: string;
    license: "commercial" | "development_only" | "unknown";
    sourceRef?: string;
  };
  /** Financial statements describe the issuer, even when requested through a listed security ticker. */
  scope?: "issuer";
  issuerTicker?: string;
  resolution?: "direct_ticker" | "curated_issuer_alias";
};

export const YAHOO_DEVELOPMENT_FUNDAMENTALS_SOURCE = {
  datasetId: "yahoo-development-market",
  provider: "yahoo-development-quote-summary",
  license: "development_only",
} as const;

export function fundamentalsCoreFieldCount(fundamentals: Fundamentals | null | undefined): number {
  if (!fundamentals) return 0;
  return [
    fundamentals.roe,
    fundamentals.profitMargin,
    fundamentals.revenueGrowth,
    fundamentals.debtToEquity,
  ].filter((value) => value !== undefined).length;
}

export function hasUsableFundamentals(fundamentals: Fundamentals | null | undefined): boolean {
  return fundamentalsCoreFieldCount(fundamentals) > 0 || fundamentals?.totalRevenue !== undefined;
}

export function isFundamentalsFresh(
  fundamentals: Fundamentals | null | undefined,
  maximumAgeDays = 120,
  now = new Date(),
): boolean {
  if (!hasUsableFundamentals(fundamentals) || !fundamentals?.fetchedAt) return false;
  const fetchedAt = Date.parse(fundamentals.fetchedAt);
  return Number.isFinite(fetchedAt) && now.getTime() - fetchedAt <= maximumAgeDays * 86_400_000;
}

export function fundamentalsLicense(
  fundamentals: Fundamentals | null | undefined,
): "commercial" | "development_only" | "unknown" {
  if (!fundamentals) return "unknown";
  // All rows predating provenance support were fetched by this module's Yahoo adapter.
  return fundamentals.source?.license ?? "development_only";
}

export function materializeIssuerFundamentalsAlias(
  aliasTicker: string,
  issuerTicker: string,
  issuerFundamentals: Fundamentals | null | undefined,
  currentAlias?: Fundamentals | null,
): Fundamentals | null {
  if (!hasUsableFundamentals(issuerFundamentals)) return null;
  if (fundamentalsLicense(currentAlias) === "commercial" && fundamentalsLicense(issuerFundamentals) !== "commercial") {
    return currentAlias ?? null;
  }
  const issuer = issuerFundamentals as Fundamentals;
  return {
    ...issuer,
    scope: "issuer",
    issuerTicker,
    resolution: "curated_issuer_alias",
    source: issuer.source
      ? {
          ...issuer.source,
          sourceRef: `issuer:${issuerTicker};alias:${aliasTicker}`,
        }
      : {
          ...YAHOO_DEVELOPMENT_FUNDAMENTALS_SOURCE,
          sourceRef: `issuer:${issuerTicker};alias:${aliasTicker}`,
        },
  };
}

/** normalize financialData module ของ Yahoo → Fundamentals (ทศนิยม → %)
 *  หมายเหตุ: v10 ส่งค่ามาเป็น object { raw, fmt } — ต้องแกะ .raw */
export function normalizeFundamentals(
  m: Record<string, unknown>,
  source: Fundamentals["source"] = YAHOO_DEVELOPMENT_FUNDAMENTALS_SOURCE,
): Fundamentals {
  const raw = (v: unknown): number | undefined => {
    if (typeof v === "number" && isFinite(v)) return v;
    if (v && typeof v === "object" && "raw" in v) {
      const r = (v as { raw: unknown }).raw;
      if (typeof r === "number" && isFinite(r)) return r;
    }
    return undefined;
  };
  const pct = (v: unknown): number | undefined => {
    const n = raw(v);
    return n === undefined ? undefined : Math.round(n * 1000) / 10;
  };
  const fc = m.financialCurrency;
  const f: Fundamentals = {
    roe: pct(m.returnOnEquity),
    debtToEquity: raw(m.debtToEquity),
    grossMargin: pct(m.grossMargins),
    operatingMargin: pct(m.operatingMargins),
    profitMargin: pct(m.profitMargins),
    revenueGrowth: pct(m.revenueGrowth),
    currentRatio: raw(m.currentRatio),
    quickRatio: raw(m.quickRatio),
    totalRevenue: raw(m.totalRevenue),
    currency: typeof fc === "string" ? fc : undefined,
    industry: typeof m.industry === "string" ? m.industry : undefined,
    sector: typeof m.sector === "string" ? m.sector : undefined,
    fetchedAt: new Date().toISOString(),
    source,
  };
  return f;
}

export function loadFundamentalsCache(): Map<string, Fundamentals> {
  try {
    return new Map(Object.entries(JSON.parse(readFileSync(CACHE_FILE, "utf8")) as Record<string, Fundamentals>));
  } catch {
    return new Map();
  }
}

export function saveFundamentalsCache(cache: Map<string, Fundamentals>): void {
  mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
  const temporary = `${CACHE_FILE}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(Object.fromEntries(cache), null, 1) + "\n", "utf8");
  renameSync(temporary, CACHE_FILE);
}

/** ดึง fundamentals ของ ticker (Yahoo) — ใช้ cache ถ้ามี (เฉพาะที่ข้อมูลครบ ไม่ใช่ก้อนว่าง) */
export async function fetchFundamentals(
  yahooTickerKey: string,
  session: { cookie: string; crumb: string },
  cache?: Map<string, Fundamentals>,
  options: { forceRefresh?: boolean } = {},
): Promise<Fundamentals | null> {
  const hit = cache?.get(yahooTickerKey);
  // cache ที่มีแค่ currency/fetchedAt = ก้อนว่าง (Yahoo ไม่ส่งตัวเลข) — ถือว่าพลาด fetch ใหม่
  if (!options.forceRefresh && hasUsableFundamentals(hit)) return hit ?? null;
  const m = await fetchQuoteSummaryModule(yahooTickerKey, "financialData", session);
  if (!m) return null;
  const f: Fundamentals = {
    ...normalizeFundamentals(m),
    scope: "issuer",
    issuerTicker: yahooTickerKey,
    resolution: "direct_ticker",
  };
  // Never replace a licensed commercial row with development-only data.
  if (hasUsableFundamentals(f) && fundamentalsLicense(hit) !== "commercial") cache?.set(yahooTickerKey, f);
  return f;
}
