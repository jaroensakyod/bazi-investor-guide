/**
 * Stage official SET factsheet dates for the Thai research universe.
 *
 * This script stores parsed dates, evidence URLs and hashes only; it does not
 * archive factsheet HTML. Public factsheet access does not grant commercial
 * redistribution rights, so every generated event remains displayRights=unknown.
 *
 * Examples:
 *   npm run research:stage-set-events -- --limit=10
 *   npm run research:stage-set-events -- --tickers=ADVANC,AOT,KBANK --refresh
 *   npm run research:stage-set-events -- --apply
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getThaiStocks, isResearchableStock, type StockEntry } from "../src/lib/investor/stock-database";
import { loadSecurityEventFile, saveSecurityEventFile } from "../src/lib/research/security-event-store";
import type { SecurityEvent } from "../src/lib/research/security-birth";
import { extractSetFactsheet, type SetFactsheetExtraction } from "../src/lib/research/set-factsheet";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "set-security-events.json");
const STAGING_SCHEMA_VERSION = 1 as const;

type StageStatus = "parsed" | "partial" | "failed";

type StagedSetFactsheet = SetFactsheetExtraction & {
  status: StageStatus;
  httpStatus: number;
  pageSha256: string;
  etag: string | null;
  lastModified: string | null;
  error?: string;
};

type ApplySummary = {
  appliedAt: string;
  added: number;
  alreadyPresent: number;
  conflicts: Array<{ securityId: string; kind: SecurityEvent["kind"]; incomingDate: string; existingDates: string[] }>;
};

type StagingFile = {
  schemaVersion: typeof STAGING_SCHEMA_VERSION;
  generatedAt: string;
  source: {
    name: "SET Factsheet";
    authority: "exchange";
    termsUrl: string;
    rightsStatus: "internal_research_only_pending_set_license";
  };
  records: StagedSetFactsheet[];
  applySummary?: ApplySummary;
};

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Math.floor(Number(value ?? fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function emptyStaging(): StagingFile {
  return {
    schemaVersion: STAGING_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      name: "SET Factsheet",
      authority: "exchange",
      termsUrl: "https://www.set.or.th/en/terms-and-conditions",
      rightsStatus: "internal_research_only_pending_set_license",
    },
    records: [],
  };
}

function loadStaging(file: string): StagingFile {
  if (!existsSync(file)) return emptyStaging();
  const parsed = JSON.parse(readFileSync(file, "utf8")) as StagingFile;
  if (parsed.schemaVersion !== STAGING_SCHEMA_VERSION || !Array.isArray(parsed.records)) {
    throw new Error(`staging schema ไม่รองรับ: ${parsed.schemaVersion}`);
  }
  return parsed;
}

function saveStaging(data: StagingFile, file: string): void {
  const canonical: StagingFile = {
    ...data,
    generatedAt: new Date().toISOString(),
    records: [...data.records].sort((a, b) => a.securityId.localeCompare(b.securityId)),
  };
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(canonical, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

function sourceUrl(ticker: string): string {
  return `https://www.set.or.th/en/market/product/stock/quote/${encodeURIComponent(ticker)}/factsheet`;
}

async function fetchFactsheet(stock: StockEntry): Promise<StagedSetFactsheet> {
  const ticker = stock.ticker.trim().toUpperCase();
  const market = stock.market.trim().toUpperCase();
  const url = sourceUrl(ticker);
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": "bazi-investor-guide-research/1.0 (+internal evidence staging)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(25_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const html = await response.text();
      const retrievedAt = new Date().toISOString();
      const extraction = extractSetFactsheet({
        ticker,
        market,
        html,
        sourceUrl: response.url || url,
        retrievedAt,
        catalogFoundedYear: stock.foundedYear,
      });
      const hasListing = extraction.listing.precision === "day";
      const status: StageStatus = hasListing ? "parsed" : extraction.events.length > 0 ? "partial" : "failed";
      return {
        ...extraction,
        status,
        httpStatus: response.status,
        pageSha256: createHash("sha256").update(html).digest("hex"),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        ...(status === "failed" ? { error: "ไม่พบวันที่ที่นำมาใช้ได้ในหน้า factsheet" } : {}),
      };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 1_000);
    }
  }

  const retrievedAt = new Date().toISOString();
  const extraction = extractSetFactsheet({
    ticker,
    market,
    html: "",
    sourceUrl: url,
    retrievedAt,
    catalogFoundedYear: stock.foundedYear,
  });
  return {
    ...extraction,
    status: "failed",
    httpStatus: 0,
    pageSha256: "",
    etag: null,
    lastModified: null,
    error: (lastError as Error)?.message ?? String(lastError),
  };
}

function applyStagedEvents(records: readonly StagedSetFactsheet[]): ApplySummary {
  const current = loadSecurityEventFile();
  const merged = [...current.events];
  let added = 0;
  let alreadyPresent = 0;
  const conflicts: ApplySummary["conflicts"] = [];

  for (const record of records) {
    for (const event of record.events) {
      const sameKind = merged.filter(
        (existing) => existing.securityId === event.securityId && existing.kind === event.kind,
      );
      if (sameKind.some((existing) => existing.localDate === event.localDate)) {
        alreadyPresent += 1;
        continue;
      }

      if (event.kind === "incorporation") {
        const curatedSuccessor = merged.find(
          (existing) => existing.securityId === event.securityId && existing.kind === "merger_successor",
        );
        if (curatedSuccessor?.localDate === event.localDate) {
          alreadyPresent += 1;
          continue;
        }
      }

      if (sameKind.length > 0) {
        conflicts.push({
          securityId: event.securityId,
          kind: event.kind,
          incomingDate: event.localDate,
          existingDates: [...new Set(sameKind.map((existing) => existing.localDate))],
        });
        continue;
      }

      merged.push(event);
      added += 1;
    }
  }

  if (added > 0) saveSecurityEventFile(merged);
  return { appliedAt: new Date().toISOString(), added, alreadyPresent, conflicts };
}

async function main(): Promise<void> {
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  const shouldApply = flag("apply");
  const includeInactive = flag("include-inactive");
  const concurrency = positiveInteger(arg("concurrency"), 3, 8);
  const delayMs = positiveInteger(arg("delay-ms"), 250, 10_000);
  const limit = positiveInteger(arg("limit"), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const markets = new Set(
    String(arg("market") ?? "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );
  const tickers = new Set(
    String(arg("tickers") ?? "")
      .split(",")
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean),
  );

  const staging = loadStaging(output);
  const bySecurity = new Map(staging.records.map((record) => [record.securityId, record]));
  const stocks = getThaiStocks()
    .filter((stock) => includeInactive || isResearchableStock(stock))
    .filter((stock) => markets.size === 0 || markets.has(stock.market.toUpperCase()))
    .filter((stock) => tickers.size === 0 || tickers.has(stock.ticker.toUpperCase()))
    .slice(0, limit);
  const targets = stocks.filter((stock) => refresh || !bySecurity.has(`${stock.market.toUpperCase()}:${stock.ticker.toUpperCase()}`));

  console.log(`SET factsheet staging: ${targets.length} fetch / ${stocks.length} selected · concurrency=${concurrency}`);
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(targets.length, 1)) }, async () => {
    while (cursor < targets.length) {
      const stock = targets[cursor];
      cursor += 1;
      const record = await fetchFactsheet(stock);
      bySecurity.set(record.securityId, record);
      completed += 1;
      if (completed % 10 === 0 || completed === targets.length) {
        staging.records = [...bySecurity.values()];
        saveStaging(staging, output);
        const parsed = staging.records.filter((item) => item.status === "parsed").length;
        console.log(`  progress ${completed}/${targets.length} · parsed total=${parsed}`);
      }
      await delay(delayMs);
    }
  });
  await Promise.all(workers);

  staging.records = [...bySecurity.values()];
  if (shouldApply) staging.applySummary = applyStagedEvents(staging.records);
  saveStaging(staging, output);

  const selectedIds = new Set(stocks.map((stock) => `${stock.market.toUpperCase()}:${stock.ticker.toUpperCase()}`));
  const selectedRecords = staging.records.filter((record) => selectedIds.has(record.securityId));
  const exactOrigins = selectedRecords.filter((record) => record.establishment.precision === "day").length;
  const exactListings = selectedRecords.filter((record) => record.listing.precision === "day").length;
  const partialOrigins = selectedRecords.filter((record) => record.establishment.precision === "year").length;
  const failed = selectedRecords.filter((record) => record.status === "failed").length;
  const lineageReview = selectedRecords.filter((record) => record.lineageReviewReasons.length > 0).length;

  console.log(
    JSON.stringify(
      {
        selected: stocks.length,
        fetched: targets.length,
        exactOrigins,
        partialOrigins,
        exactListings,
        failed,
        lineageReview,
        output,
        apply: staging.applySummary ?? null,
        commercialUse: "BLOCKED_PENDING_SET_LICENSE",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
