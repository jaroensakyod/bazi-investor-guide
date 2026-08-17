/**
 * Fetch compact official admission dates from the LSE instrument endpoint.
 * Live quote fields are deliberately discarded; only identity/reference fields,
 * the admission date and a SHA-256 response hash are staged.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  LSE_ISSUER_PROFILE_HELP_URL,
  hasLseIssuerIdentityOverlap,
  lseInstrumentDataUrl,
  lseOfficialTidmCandidates,
  normalizeLseCatalogTicker,
  parseLseInstrumentResponse,
} from "../src/lib/research/lse-instrument-data";
import { securityIdOf } from "../src/lib/research/security-birth";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "lse-instrument-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";

type Target = { securityId: string; ticker: string; normalizedTicker: string; companyName: string };
type FetchRecord = Target & {
  status: "matched" | "unmatched" | "invalid" | "fetch_error";
  sourceTicker: string;
  description: string;
  instrumentName: string;
  isin: string;
  country: string;
  market: string;
  segment: string;
  issuerCode: string;
  issuerName: string;
  instrumentType: string;
  listingAdmissionDate: string | null;
  sourceHash: string | null;
  retrievedAt: string;
  warnings: string[];
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function saveAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

function readCache(file: string): FetchRecord[] {
  if (!existsSync(file)) return [];
  try {
    const payload = JSON.parse(readFileSync(file, "utf8")) as { records?: unknown };
    return Array.isArray(payload.records) ? payload.records as FetchRecord[] : [];
  } catch {
    return [];
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function errorRecord(target: Target, status: FetchRecord["status"], warning: string): FetchRecord {
  return {
    ...target,
    status,
    sourceTicker: "",
    description: "",
    instrumentName: "",
    isin: "",
    country: "",
    market: "",
    segment: "",
    issuerCode: "",
    issuerName: "",
    instrumentType: "",
    listingAdmissionDate: null,
    sourceHash: null,
    retrievedAt: new Date().toISOString(),
    warnings: [warning],
  };
}

async function fetchInstrument(target: Target): Promise<FetchRecord> {
  for (const candidate of lseOfficialTidmCandidates(target.normalizedTicker)) {
    const response = await fetch(lseInstrumentDataUrl(candidate), {
      headers: {
        Accept: "application/json,*/*;q=0.8",
        Origin: "https://www.londonstockexchange.com",
        Referer: "https://www.londonstockexchange.com/",
        "User-Agent": USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 404) continue;
    if (!response.ok) throw new Error(`LSE ${candidate} HTTP ${response.status}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const payload = JSON.parse(new TextDecoder("utf-8").decode(bytes)) as unknown;
    const detail = parseLseInstrumentResponse(payload, candidate);
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    const confirmed = detail.sourceTicker === candidate;
    const trailingDotAlias = candidate === `${target.normalizedTicker}.`;
    const identityConfirmed = !trailingDotAlias
      || hasLseIssuerIdentityOverlap(target.companyName, detail.issuerName);
    const matched = confirmed && identityConfirmed && detail.listingAdmissionDate !== null;
    return {
      ...target,
      status: matched ? "matched" : confirmed && identityConfirmed ? "invalid" : "unmatched",
      sourceTicker: detail.sourceTicker,
      description: detail.description,
      instrumentName: detail.instrumentName,
      isin: detail.isin,
      country: detail.country,
      market: detail.market,
      segment: detail.segment,
      issuerCode: detail.issuerCode,
      issuerName: detail.issuerName,
      instrumentType: detail.instrumentType,
      listingAdmissionDate: detail.listingAdmissionDate,
      sourceHash,
      retrievedAt: new Date().toISOString(),
      warnings: identityConfirmed
        ? detail.warnings
        : [...detail.warnings, "Trailing-dot TIDM issuer identity does not match the catalog company"],
    };
  }
  return errorRecord(target, "unmatched", `LSE ${target.ticker} and trailing-dot TIDM returned HTTP 404`);
}

async function fetchWithRetry(target: Target): Promise<FetchRecord> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const record = await fetchInstrument(target);
      if (record.status !== "fetch_error") return record;
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await delay(attempt * 350);
  }
  return errorRecord(target, "fetch_error", lastError instanceof Error ? lastError.message : "Unknown LSE fetch error");
}

function outputPayload(records: readonly FetchRecord[], startedAt: string): unknown {
  const sorted = [...records].sort((a, b) => a.securityId.localeCompare(b.securityId));
  return {
    schemaVersion: 1,
    startedAt,
    updatedAt: new Date().toISOString(),
    sourcePolicy: {
      authority: "exchange",
      sourceName: "London Stock Exchange instrument reference data",
      sourceUrl: LSE_ISSUER_PROFILE_HELP_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_EXCHANGE_TERMS_AND_DATA_LICENSE_REVIEW",
      liveQuoteFieldsStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: sorted.length,
      matched: sorted.filter((record) => record.status === "matched").length,
      unmatched: sorted.filter((record) => record.status === "unmatched").length,
      invalid: sorted.filter((record) => record.status === "invalid").length,
      fetchError: sorted.filter((record) => record.status === "fetch_error").length,
      listingDates: sorted.filter((record) => record.listingAdmissionDate !== null).length,
    },
    records: sorted,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const concurrency = Math.max(1, Math.min(12, Number(arg("concurrency") ?? 6) || 6));
  const limit = Math.max(0, Number(arg("limit") ?? 0) || 0);
  const refresh = flag("refresh");
  const targets: Target[] = getGlobalStocks()
    .filter(isResearchableStock)
    .filter((stock) => stock.market.trim().toUpperCase() === "LSE")
    .map((stock) => ({
      securityId: securityIdOf("LSE", stock.ticker),
      ticker: stock.ticker.trim().toUpperCase(),
      normalizedTicker: normalizeLseCatalogTicker(stock.ticker),
      companyName: stock.name,
    }))
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
  const selected = limit > 0 ? targets.slice(0, limit) : targets;
  const selectedIds = new Set(selected.map((target) => target.securityId));
  const cached = refresh ? [] : readCache(output)
    .filter((record) => selectedIds.has(record.securityId) && record.status === "matched");
  const records = new Map(cached.map((record) => [record.securityId, record]));
  const pending = selected.filter((target) => !records.has(target.securityId));
  let cursor = 0;
  let completed = 0;

  const checkpoint = (): void => {
    saveAtomic(output, outputPayload([...records.values()], startedAt));
  };

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      const target = pending[index];
      if (!target) return;
      const record = await fetchWithRetry(target);
      records.set(target.securityId, record);
      completed += 1;
      if (completed % 25 === 0 || completed === pending.length) {
        checkpoint();
        console.log(JSON.stringify({ completed, pending: pending.length, ticker: target.ticker, status: record.status }));
      }
      await delay(60);
    }
  }

  if (pending.length > 0) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  checkpoint();
  const finalPayload = outputPayload([...records.values()], startedAt) as { summary: unknown };
  console.log(JSON.stringify({ output, cached: cached.length, fetched: pending.length, summary: finalPayload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
