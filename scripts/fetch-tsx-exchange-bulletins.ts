/**
 * Crawl the public TSX Exchange Bulletin archive and retain only exact-symbol
 * listing-date records for securities in the curated TSX catalog. Raw bulletin
 * HTML is intentionally not stored.
 */
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  TSX_NEW_COMPANY_LISTINGS_URL,
  matchTsxBulletinOfficialDates,
  parseTsxExchangeBulletin,
  parseTsxExchangeBulletinPayload,
  tsxExchangeBulletinUrl,
  type TsxExchangeBulletinRow,
} from "../src/lib/research/tsx-exchange-bulletin";
import { normalizeTsxCatalogTicker } from "../src/lib/research/tsx-listed-company";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "tsx-exchange-bulletin-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const BATCH_SIZE = 10;

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function saveAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

async function downloadText(url: string): Promise<string | null> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "text/html,*/*;q=0.8", Referer: TSX_NEW_COMPANY_LISTINGS_URL, "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new Error(`response is too large (${contentLength} bytes)`);
      const text = await response.text();
      if (text.length === 0 || Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error(`response size is outside the accepted range`);
      }
      return text;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "unknown download error";
  throw new Error(`${url}: ${message}`);
}

function latestBulletinId(html: string): number {
  const ids = [...html.matchAll(/\/en\/news\/new-company-listings\?id=(\d+)/g)].map((match) => Number(match[1]));
  const latest = ids.length > 0 ? Math.max(...ids) : 0;
  if (!Number.isInteger(latest) || latest < 1) throw new Error("TSX bulletin archive exposed no valid bulletin ids");
  return latest;
}

function payload(
  retrievedAt: string,
  lastBulletinId: number,
  processedBulletinCount: number,
  records: readonly TsxExchangeBulletinRow[],
) {
  return {
    schemaVersion: 1,
    retrievedAt,
    firstBulletinId: 1,
    lastBulletinId,
    processedBulletinCount,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "TSX Exchange Bulletins — New Company Listings",
      sourceUrl: TSX_NEW_COMPANY_LISTINGS_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_TSX_TERMS_AND_DATA_RIGHTS_REVIEW",
      rawHtmlStored: false,
      dateSemantics: "exact-security Listing date; Posted for trading date retained separately when stated",
      identityRule: "exact normalized symbol plus issuer-name identity overlap",
    },
    records,
  };
}

async function main(): Promise<void> {
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  const archiveHtml = await downloadText(TSX_NEW_COMPANY_LISTINGS_URL);
  if (!archiveHtml) throw new Error("TSX bulletin archive returned 404");
  const currentLastId = latestBulletinId(archiveHtml);
  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "TSX");
  const targets = new Set(stocks.map((stock) => normalizeTsxCatalogTicker(stock.ticker)).filter(Boolean));
  let records: TsxExchangeBulletinRow[] = [];
  let processed = 0;
  let lastBulletinId = currentLastId;
  if (!refresh && existsSync(output)) {
    const cached = parseTsxExchangeBulletinPayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    records = cached.records;
    processed = cached.processedBulletinCount;
    lastBulletinId = Math.max(cached.lastBulletinId, currentLastId);
    if (processed === lastBulletinId) {
      const matches = matchTsxBulletinOfficialDates(stocks, cached);
      console.log(JSON.stringify({
        output,
        cached: true,
        lastBulletinId,
        processed,
        exactTargetRecords: records.length,
        matched: matches.filter((record) => record.status === "matched").length,
      }, null, 2));
      return;
    }
  }

  const retrievedAt = new Date().toISOString();
  const unique = new Map(records.map((row) => [`${row.bulletinId}\u0000${row.symbol}`, row]));
  for (let first = processed + 1; first <= lastBulletinId; first += BATCH_SIZE) {
    const ids = Array.from({ length: Math.min(BATCH_SIZE, lastBulletinId - first + 1) }, (_, index) => first + index);
    const pages = await Promise.all(ids.map(async (id) => ({ id, html: await downloadText(tsxExchangeBulletinUrl(id)) })));
    for (const page of pages) {
      if (!page.html) continue;
      for (const row of parseTsxExchangeBulletin(page.html, page.id, retrievedAt)) {
        if (targets.has(row.symbol)) unique.set(`${row.bulletinId}\u0000${row.symbol}`, row);
      }
    }
    processed = ids[ids.length - 1];
    records = [...unique.values()].sort((a, b) => a.bulletinId - b.bulletinId || a.symbol.localeCompare(b.symbol));
    if (processed % 100 === 0 || processed === lastBulletinId) {
      saveAtomic(output, payload(retrievedAt, lastBulletinId, processed, records));
      console.log(JSON.stringify({ progress: processed, lastBulletinId, exactTargetRecords: records.length }));
    }
  }

  const parsed = parseTsxExchangeBulletinPayload(payload(retrievedAt, lastBulletinId, processed, records));
  const matches = matchTsxBulletinOfficialDates(stocks, parsed);
  const summary = {
    catalog: stocks.length,
    lastBulletinId,
    processedBulletinCount: processed,
    exactTargetRecords: records.length,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
  };
  saveAtomic(output, { ...payload(retrievedAt, lastBulletinId, processed, records), summary });
  console.log(JSON.stringify({ output, cached: false, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
