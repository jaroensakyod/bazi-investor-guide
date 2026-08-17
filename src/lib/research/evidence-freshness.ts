export type EvidenceFreshness = "fresh" | "stale" | "unknown";

export const DEFAULT_FRESHNESS_DAYS = {
  latestQuote: 4,
  dailySeries: 4,
  fundamentals: 120,
  businessDescription: 365,
} as const;

export function classifyEvidenceFreshness(
  asOf: string | null | undefined,
  maxAgeDays: number,
  now = new Date(),
): EvidenceFreshness {
  if (!asOf || !Number.isFinite(Date.parse(asOf)) || !Number.isFinite(maxAgeDays) || maxAgeDays < 0) return "unknown";
  const ageDays = (now.getTime() - Date.parse(asOf)) / 86_400_000;
  if (ageDays < -1) return "unknown";
  return ageDays <= maxAgeDays ? "fresh" : "stale";
}

