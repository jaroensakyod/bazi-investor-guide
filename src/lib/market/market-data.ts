/**
 * Market Data layer — normalize ราคา Yahoo → schema ชั้น B + snapshot รายวัน + merge ตอนอ่าน
 *
 * หลัก: ข้อมูลตลาด = dynamic (ไม่กรอกมือ) — เก็บ snapshot ไว้ data/cache/market/<date>.json
 * แล้ว merge เข้า stock.marketData ตอน runtime (chat/รายงาน) — ไฟล์คลังหุ้นไม่รกทุกวัน
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { StockEntry } from "../investor/stock-database";
import type { YahooQuote } from "./yahoo";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const MARKET_CACHE_DIR = path.join(ROOT, "data/cache/market");
export const LATEST_SNAPSHOT = path.join(MARKET_CACHE_DIR, "latest.json");

/** schema ชั้น B (stock-database) + currency เพิ่ม (marketCap เก็บสกุลเดิม ไม่แปลงมั่ว) */
export type MarketData = NonNullable<StockEntry["marketData"]> & {
  currency?: string;
};

export type MarketSnapshot = {
  normalizationVersion?: number;
  updatedAt: string; // ISO
  quotes: Record<string, MarketData>; // key = yahoo ticker
};

export const MARKET_NORMALIZATION_VERSION = 2 as const;

/** normalize v7 quote → MarketData (schema ชั้น B); dividendYield is already percentage points. */
export function normalizeQuote(q: YahooQuote, updatedAt: string): MarketData {
  const md: MarketData = {
    updatedAt,
    currency: q.currency,
  };
  if (typeof q.regularMarketPrice === "number") md.price = round2(q.regularMarketPrice);
  if (typeof q.regularMarketChangePercent === "number") md.changePct = round2(q.regularMarketChangePercent);
  if (typeof q.trailingPE === "number") md.pe = round2(q.trailingPE);
  if (typeof q.priceToBook === "number") md.pbv = round2(q.priceToBook);
  if (typeof q.dividendYield === "number") md.dividendYield = round2(q.dividendYield);
  if (typeof q.marketCap === "number") md.marketCap = Math.round(q.marketCap);
  if (typeof q.averageVolume === "number") md.avgVolume = Math.round(q.averageVolume);
  if (typeof q.fiftyTwoWeekHigh === "number") md.high52w = round2(q.fiftyTwoWeekHigh);
  if (typeof q.fiftyTwoWeekLow === "number") md.low52w = round2(q.fiftyTwoWeekLow);
  return md;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** รวม quotes → snapshot (dedupe symbol ตัวหลังชนะ) */
export function buildSnapshot(quotes: Iterable<YahooQuote>, updatedAt = new Date().toISOString()): MarketSnapshot {
  const map: Record<string, MarketData> = {};
  for (const q of quotes) {
    if (!q.symbol) continue;
    map[q.symbol] = normalizeQuote(q, updatedAt);
  }
  return { normalizationVersion: MARKET_NORMALIZATION_VERSION, updatedAt, quotes: map };
}

/** Upgrade v1 snapshots where Yahoo dividendYield percentage points were multiplied by 100 again. */
export function upgradeMarketSnapshot(snapshot: MarketSnapshot): MarketSnapshot {
  if ((snapshot.normalizationVersion ?? 1) >= MARKET_NORMALIZATION_VERSION) return snapshot;
  const quotes = Object.fromEntries(
    Object.entries(snapshot.quotes).map(([ticker, quote]) => [
      ticker,
      {
        ...quote,
        ...(typeof quote.dividendYield === "number"
          ? { dividendYield: round2(quote.dividendYield / 100) }
          : {}),
      },
    ]),
  );
  return { ...snapshot, normalizationVersion: MARKET_NORMALIZATION_VERSION, quotes };
}

export function saveSnapshot(snapshot: MarketSnapshot, date = new Date().toISOString().slice(0, 10), dir = MARKET_CACHE_DIR): string {
  const canonical = upgradeMarketSnapshot(snapshot);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${date}.json`);
  writeFileSync(file, JSON.stringify(canonical, null, 1) + "\n", "utf8");
  writeFileSync(path.join(dir, "latest.json"), JSON.stringify(canonical, null, 1) + "\n", "utf8");
  return file;
}

export function loadSnapshot(date?: string, dir = MARKET_CACHE_DIR): MarketSnapshot | null {
  const file = date ? path.join(dir, `${date}.json`) : path.join(dir, "latest.json");
  if (!existsSync(file)) return null;
  try {
    return upgradeMarketSnapshot(JSON.parse(readFileSync(file, "utf8")) as MarketSnapshot);
  } catch {
    return null;
  }
}

/** ราคาล่าสุดของ ticker (รับ yahoo ticker) — chat/รายงานใช้ */
export function getMarketData(yahooTickerKey: string): MarketData | null {
  const snap = loadSnapshot();
  return snap?.quotes[yahooTickerKey] ?? null;
}

/** merge snapshot เข้า stock entries (ไม่แก้ไฟล์ — คืน object ใหม่เฉพาะ marketData) */
export function withMarketData<T extends StockEntry>(stock: T, snap?: MarketSnapshot | null): T & { marketData: MarketData | null } {
  const s = snap ?? loadSnapshot();
  const yt = s?.quotes ? findQuoteKey(s, stock) : undefined;
  return { ...stock, marketData: yt ? s!.quotes[yt] : null };
}

/** หา quote ของ stock: ลอง yahoo ticker ที่ตรงเป๊ะ แล้วค่อย fallback ตาม suffix ที่มี */
function findQuoteKey(snap: MarketSnapshot, stock: StockEntry): string | undefined {
  const candidates = [String(stock.ticker ?? "")];
  // ไทย: ticker เปล่าๆ (KBANK) → KBANK.BK
  if (!candidates[0].includes(".")) {
    for (const key of Object.keys(snap.quotes)) {
      if (key.startsWith(candidates[0] + ".")) {
        candidates.push(key);
        break;
      }
    }
  }
  return candidates.find((c) => c in snap.quotes);
}
