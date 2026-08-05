/**
 * Fundamentals — ตัวเลขพื้นฐานบริษัทจาก Yahoo financialData (v10 quoteSummary)
 *
 * ใช้กับ: วิเคราะห์พื้นฐานในแชท + Buffett checklist + hidden gems (ตัวกรองคุณภาพ)
 * เก็บ cache ไว้ data/cache/fundamentals.json (key = yahoo ticker) — resumable
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
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
};

/** normalize financialData module ของ Yahoo → Fundamentals (ทศนิยม → %)
 *  หมายเหตุ: v10 ส่งค่ามาเป็น object { raw, fmt } — ต้องแกะ .raw */
export function normalizeFundamentals(m: Record<string, unknown>): Fundamentals {
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
  writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache), null, 1) + "\n", "utf8");
}

/** ดึง fundamentals ของ ticker (Yahoo) — ใช้ cache ถ้ามี (เฉพาะที่ข้อมูลครบ ไม่ใช่ก้อนว่าง) */
export async function fetchFundamentals(
  yahooTickerKey: string,
  session: { cookie: string; crumb: string },
  cache?: Map<string, Fundamentals>,
): Promise<Fundamentals | null> {
  const hit = cache?.get(yahooTickerKey);
  // cache ที่มีแค่ currency/fetchedAt = ก้อนว่าง (Yahoo ไม่ส่งตัวเลข) — ถือว่าพลาด fetch ใหม่
  if (hit && (hit.roe !== undefined || hit.debtToEquity !== undefined || hit.totalRevenue !== undefined)) return hit;
  const m = await fetchQuoteSummaryModule(yahooTickerKey, "financialData", session);
  if (!m) return null;
  const f = normalizeFundamentals(m);
  cache?.set(yahooTickerKey, f);
  return f;
}
