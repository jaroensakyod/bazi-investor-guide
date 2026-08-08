import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { loadSnapshot } from "../lib/market/market-data";
import { reportProfileFingerprint } from "../lib/report/report-entitlement";
import { getReportManifest } from "../lib/report/product-system";
import { buildEditorialProductPdf, type EditorialPdfOptions } from "./report-pdf-editorial";

const inflight = new Map<string, Promise<Buffer>>();

export type ReportArtifactIdentityInput = {
  tier: string;
  reportVersion: string;
  profileHash: string;
  financial: EditorialPdfOptions["financial"];
  marketUpdatedAt: string;
};

export function reportArtifactIdentity(input: ReportArtifactIdentityInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 32);
}

function validPdf(buffer: Buffer): boolean {
  return buffer.length > 1_000 && buffer.subarray(0, 4).toString("ascii") === "%PDF";
}

function artifactDescriptor(options: EditorialPdfOptions): { artifactId: string; file: string } {
  const manifest = getReportManifest(options.tier);
  const marketUpdatedAt = loadSnapshot()?.updatedAt ?? "market-unavailable";
  const profileHash = reportProfileFingerprint(options.profile ?? {});
  const artifactId = reportArtifactIdentity({
    tier: manifest.config.tier,
    reportVersion: manifest.version,
    profileHash,
    financial: options.financial,
    marketUpdatedAt,
  });
  const cacheDir = process.env.REPORT_ARTIFACT_CACHE_DIR
    ? path.resolve(process.env.REPORT_ARTIFACT_CACHE_DIR)
    : path.resolve("data/cache/report-artifacts-v7");
  return { artifactId, file: path.join(cacheDir, `${artifactId}.pdf`) };
}

export function readCachedEditorialProductPdf(options: EditorialPdfOptions): { buffer: Buffer; artifactId: string } | null {
  const { artifactId, file } = artifactDescriptor(options);
  if (!existsSync(file)) return null;
  const buffer = readFileSync(file);
  return validPdf(buffer) ? { buffer, artifactId } : null;
}

export async function buildCachedEditorialProductPdf(
  state: CalculatedStateValue,
  options: EditorialPdfOptions,
): Promise<{ buffer: Buffer; cache: "hit" | "miss"; artifactId: string }> {
  const manifest = getReportManifest(options.tier);
  const normalizedOptions = { ...options, tier: manifest.config.tier };
  const { artifactId, file } = artifactDescriptor(normalizedOptions);
  const cacheDir = path.dirname(file);
  const cached = readCachedEditorialProductPdf(normalizedOptions);
  if (cached) return { ...cached, cache: "hit" };

  const current = inflight.get(artifactId);
  if (current) return { buffer: await current, cache: "hit", artifactId };

  const pending = (async () => {
    const buffer = await buildEditorialProductPdf(state, normalizedOptions);
    if (!validPdf(buffer)) throw new Error("ตัวสร้างรายงานคืนไฟล์ที่ไม่ใช่ PDF");
    mkdirSync(cacheDir, { recursive: true });
    const temporary = path.join(cacheDir, `${artifactId}.${process.pid}.${randomUUID()}.tmp`);
    writeFileSync(temporary, buffer);
    try {
      if (!existsSync(file)) renameSync(temporary, file);
      else unlinkSync(temporary);
    } catch (error) {
      if (existsSync(temporary)) unlinkSync(temporary);
      throw error;
    }
    return buffer;
  })();
  inflight.set(artifactId, pending);
  try {
    return { buffer: await pending, cache: "miss", artifactId };
  } finally {
    inflight.delete(artifactId);
  }
}
