import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync, gzipSync } from "node:zlib";
import {
  canonicalizePriceSeries,
  compactPriceSeries,
  expandCanonicalStoredPriceSeries,
  expandPriceSeries,
  mergePriceSeries,
  seriesKey,
  type CanonicalPriceSeries,
  type CompactPriceSeries,
  type PriceSeriesMetadata,
} from "./price-series";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const PRICE_SERIES_CACHE_DIR = path.join(ROOT, "data/cache/price-series");

export type StoredSeriesResult = {
  file: string;
  rowCount: number;
  startAt: string | null;
  endAt: string | null;
  sha256: string;
  compressedBytes: number;
};

function safePart(value: string): string {
  const cleaned = value.replace(/[^A-Za-z0-9._-]/g, "_");
  if (!cleaned || cleaned === "." || cleaned === "..") throw new Error("ส่วนประกอบ path ไม่ถูกต้อง");
  return cleaned;
}

export function priceSeriesFile(metadata: Pick<PriceSeriesMetadata, "securityId" | "timeframe" | "adjustment">, root = PRICE_SERIES_CACHE_DIR): string {
  return path.join(root, safePart(metadata.securityId), `${safePart(metadata.timeframe)}-${safePart(metadata.adjustment)}.json.gz`);
}

export function loadStoredPriceSeries(
  metadata: Pick<PriceSeriesMetadata, "securityId" | "timeframe" | "adjustment">,
  root = PRICE_SERIES_CACHE_DIR,
): CanonicalPriceSeries | null {
  const file = priceSeriesFile(metadata, root);
  if (!existsSync(file)) return null;
  try {
    const compact = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as CompactPriceSeries;
    return expandPriceSeries(compact);
  } catch {
    return null;
  }
}

/**
 * Fast read path for cache files created by saveStoredPriceSeries. It verifies
 * the requested identity but relies on ingestion-time canonical validation.
 */
export function loadCanonicalStoredPriceSeries(
  metadata: Pick<PriceSeriesMetadata, "securityId" | "timeframe" | "adjustment">,
  root = PRICE_SERIES_CACHE_DIR,
): CanonicalPriceSeries | null {
  const file = priceSeriesFile(metadata, root);
  if (!existsSync(file)) return null;
  try {
    const compact = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8")) as CompactPriceSeries;
    if (seriesKey(compact.metadata) !== seriesKey(metadata)) return null;
    return expandCanonicalStoredPriceSeries(compact);
  } catch {
    return null;
  }
}

/**
 * Store one compressed series per security/timeframe. Existing rows are merged
 * by timestamp, so no user-specific copy of market history is created.
 */
export function saveStoredPriceSeries(
  metadata: PriceSeriesMetadata,
  bars: CanonicalPriceSeries["bars"],
  root = PRICE_SERIES_CACHE_DIR,
): StoredSeriesResult {
  const incoming = canonicalizePriceSeries(metadata, bars);
  if (incoming.issues.length > 0) throw new Error(`price series มีข้อมูลผิด ${incoming.issues.length} แถว`);
  const current = loadStoredPriceSeries(metadata, root);
  const merged = mergePriceSeries(current, incoming);
  const payload = JSON.stringify(compactPriceSeries(merged));
  const compressed = gzipSync(Buffer.from(payload, "utf8"), { level: 9 });
  const file = priceSeriesFile(metadata, root);
  mkdirSync(path.dirname(file), { recursive: true });

  const temporaryFile = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporaryFile, compressed);
  renameSync(temporaryFile, file);

  return {
    file,
    rowCount: merged.bars.length,
    startAt: merged.startAt,
    endAt: merged.endAt,
    sha256: createHash("sha256").update(payload).digest("hex"),
    compressedBytes: compressed.byteLength,
  };
}
