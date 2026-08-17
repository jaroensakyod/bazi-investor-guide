/**
 * Fetch a compact TSX listing-date snapshot from the official current issuer
 * workbook and confirm that each promoted issuer root is itself a current
 * tradable instrument in the official Listed Company Directory.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  TSX_CURRENT_LISTED_COMPANIES_XLSX_URL,
  TSX_LISTED_COMPANY_DIRECTORY_URL,
  matchTsxOfficialDates,
  normalizeTsxCatalogTicker,
  parseTsxListedCompanyPayload,
  parseTsxListingDate,
  tsxCompanyDirectorySearchUrl,
  type TsxListedCompanyRow,
} from "../src/lib/research/tsx-listed-company";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "tsx-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_XLSX_BYTES = 4 * 1024 * 1024;
const MAX_DIRECTORY_RESPONSE_BYTES = 2 * 1024 * 1024;
const DIRECTORY_QUERIES = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0-9"] as const;

type DirectoryIssuer = {
  symbol: string;
  name: string;
  instruments: Array<{ symbol: string; name: string }>;
};

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

function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function download(url: string, accept: string, referer: string, maxBytes: number): Promise<Uint8Array> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, Referer: referer, "User-Agent": USER_AGENT },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > maxBytes) throw new Error(`response is too large (${contentLength} bytes)`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > maxBytes) {
        throw new Error(`response size ${bytes.length} is outside the accepted range`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "unknown download error";
  throw new Error(`${url}: ${message}`);
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDirectoryResponse(bytes: Uint8Array, query: string): DirectoryIssuer[] {
  const payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
  if (!payload || typeof payload !== "object") throw new Error(`TSX directory query ${query} returned a non-object`);
  const input = payload as Record<string, unknown>;
  if (input.isHttpError === true || !Array.isArray(input.results)) {
    throw new Error(`TSX directory query ${query} returned an error payload`);
  }
  const declaredLength = Number(input.length);
  if (!Number.isInteger(declaredLength) || declaredLength !== input.results.length) {
    throw new Error(`TSX directory query ${query} has an inconsistent result count`);
  }
  return input.results.flatMap((value): DirectoryIssuer[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const symbol = normalizeTsxCatalogTicker(String(row.symbol ?? ""));
    const name = cleanText(row.name);
    if (!symbol || !name || !Array.isArray(row.instruments)) return [];
    const instruments = row.instruments.flatMap((item): Array<{ symbol: string; name: string }> => {
      if (!item || typeof item !== "object") return [];
      const instrument = item as Record<string, unknown>;
      const instrumentSymbol = normalizeTsxCatalogTicker(String(instrument.symbol ?? ""));
      const instrumentName = cleanText(instrument.name);
      return instrumentSymbol && instrumentName ? [{ symbol: instrumentSymbol, name: instrumentName }] : [];
    });
    return instruments.length > 0 ? [{ symbol, name, instruments }] : [];
  });
}

function mergeDirectoryIssuers(groups: readonly DirectoryIssuer[][]): Map<string, DirectoryIssuer> {
  const merged = new Map<string, DirectoryIssuer>();
  for (const issuer of groups.flat()) {
    const current = merged.get(issuer.symbol);
    if (!current) {
      merged.set(issuer.symbol, issuer);
      continue;
    }
    if (current.name !== issuer.name) {
      throw new Error(`TSX directory returned conflicting issuer names for ${issuer.symbol}`);
    }
    const instruments = new Map(current.instruments.map((item) => [item.symbol, item.name]));
    for (const instrument of issuer.instruments) {
      const currentName = instruments.get(instrument.symbol);
      if (currentName && currentName !== instrument.name) {
        throw new Error(`TSX directory returned conflicting instrument names for ${instrument.symbol}`);
      }
      instruments.set(instrument.symbol, instrument.name);
    }
    current.instruments = [...instruments].map(([symbol, name]) => ({ symbol, name }));
  }
  return merged;
}

function normalizeHeader(value: unknown): string {
  return cleanText(value).toUpperCase();
}

function parseCurrentIssuerWorkbook(
  bytes: Uint8Array,
  targetRootTickers: ReadonlySet<string>,
  directory: ReadonlyMap<string, DirectoryIssuer>,
  directorySnapshotHash: string,
  retrievedAt: string,
): { sourceRows: number; records: TsxListedCompanyRow[] } {
  if (!(bytes[0] === 0x50 && bytes[1] === 0x4b)) {
    throw new Error("TSX current issuer response is not an XLSX ZIP document");
  }
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames.find((name) => /^TSX Issuers\b/i.test(name));
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) throw new Error("TSX current issuer workbook is missing its TSX Issuers worksheet");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: null });
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("CO_ID") && headers.includes("EXCHANGE")
      && headers.includes("NAME") && headers.includes("ROOT TICKER") && headers.includes("LISTING DATE");
  });
  if (headerIndex < 0) throw new Error("TSX current issuer workbook headers changed");
  const headers = rows[headerIndex].map(normalizeHeader);
  const index = (name: string): number => {
    const found = headers.indexOf(name);
    if (found < 0) throw new Error(`TSX current issuer workbook is missing ${name}`);
    return found;
  };
  const issuerIdIndex = index("CO_ID");
  const exchangeIndex = index("EXCHANGE");
  const nameIndex = index("NAME");
  const rootTickerIndex = index("ROOT TICKER");
  const listingTypeIndex = index("LISTING TYPE");
  const listingDateIndex = index("LISTING DATE");
  const xlsxSourceHash = hash(bytes);
  const sourceRows = rows.slice(headerIndex + 1).filter((row) => cleanText(row[exchangeIndex]).toUpperCase() === "TSX").length;
  const records = rows.slice(headerIndex + 1).flatMap((row): TsxListedCompanyRow[] => {
    if (cleanText(row[exchangeIndex]).toUpperCase() !== "TSX") return [];
    const issuerId = cleanText(row[issuerIdIndex]).toUpperCase();
    const rootTicker = normalizeTsxCatalogTicker(cleanText(row[rootTickerIndex]));
    const issuerName = cleanText(row[nameIndex]);
    const listingType = cleanText(row[listingTypeIndex]) || null;
    const listingDate = parseTsxListingDate(row[listingDateIndex]);
    if (!targetRootTickers.has(rootTicker) || !/^[A-Z0-9-]{2,24}$/.test(issuerId)
      || !issuerName || !listingDate) {
      return [];
    }
    const currentIssuer = directory.get(rootTicker);
    const currentInstrument = currentIssuer?.instruments.find((instrument) => instrument.symbol === rootTicker) ?? null;
    return [{
      issuerId,
      rootTicker,
      issuerName,
      listingType,
      listingDate,
      rootInstrumentConfirmed: currentInstrument !== null,
      currentDirectoryIssuerName: currentIssuer?.name ?? null,
      currentInstrumentName: currentInstrument?.name ?? null,
      xlsxSourceUrl: TSX_CURRENT_LISTED_COMPANIES_XLSX_URL,
      xlsxSourceHash,
      directorySourceUrl: TSX_LISTED_COMPANY_DIRECTORY_URL,
      directorySnapshotHash,
      retrievedAt,
    }];
  });
  return { sourceRows, records };
}

async function mapConcurrent<T, R>(items: readonly T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  if (!refresh && existsSync(output)) {
    const cached = parseTsxListedCompanyPayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "TSX");
  const targetRootTickers = new Set(stocks.map((stock) => normalizeTsxCatalogTicker(stock.ticker)).filter(Boolean));
  const [xlsxBytes, directoryDownloads] = await Promise.all([
    download(
      TSX_CURRENT_LISTED_COMPANIES_XLSX_URL,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/octet-stream,*/*;q=0.5",
      TSX_LISTED_COMPANY_DIRECTORY_URL,
      MAX_XLSX_BYTES,
    ),
    mapConcurrent(DIRECTORY_QUERIES, 6, async (query) => {
      const url = tsxCompanyDirectorySearchUrl(query);
      const bytes = await download(url, "application/json,*/*;q=0.8", TSX_LISTED_COMPANY_DIRECTORY_URL, MAX_DIRECTORY_RESPONSE_BYTES);
      return { query, bytes, records: parseDirectoryResponse(bytes, query) };
    }),
  ]);
  const retrievedAt = new Date().toISOString();
  const directoryHashBuilder = createHash("sha256");
  for (const item of directoryDownloads) directoryHashBuilder.update(`${item.query}\u0000${hash(item.bytes)}\n`);
  const directorySnapshotHash = directoryHashBuilder.digest("hex");
  const directory = mergeDirectoryIssuers(directoryDownloads.map((item) => item.records));
  const source = parseCurrentIssuerWorkbook(
    xlsxBytes,
    targetRootTickers,
    directory,
    directorySnapshotHash,
    retrievedAt,
  );
  const unique = new Map<string, TsxListedCompanyRow>();
  for (const row of source.records) unique.set(`${row.rootTicker}\u0000${row.issuerId}\u0000${row.listingDate}`, row);
  const records = [...unique.values()].sort((a, b) => a.rootTicker.localeCompare(b.rootTicker));
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: source.sourceRows,
    directoryIssuerCount: directory.size,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "TSX & TSXV Listed Companies and Listed Company Directory",
      sourceUrls: [TSX_CURRENT_LISTED_COMPANIES_XLSX_URL, TSX_LISTED_COMPANY_DIRECTORY_URL],
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_TSX_WRITTEN_CONSENT_AND_TERMS_REVIEW",
      copyrightNoticeObserved: "Workbook states not to copy, distribute, sell or modify without TSX Inc. prior written consent.",
      rawXlsxAndDirectoryJsonStored: false,
      exactFirstTradeTimeAvailable: false,
      dateSemantics: "issuer-level Listing Date; not claimed as share-class first-trading date",
      identityRule: "exact current issuer root plus exact current tradable root instrument",
    },
    summary: {
      catalog: stocks.length,
      sourceRows: source.sourceRows,
      directoryIssuers: directory.size,
      compactRecords: records.length,
      rootInstrumentsConfirmed: records.filter((record) => record.rootInstrumentConfirmed).length,
    },
    records,
  };
  const parsed = parseTsxListedCompanyPayload(payload);
  const matches = matchTsxOfficialDates(stocks, parsed);
  const summary = {
    ...payload.summary,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
    classOrIssuerRootDatesRejected: matches.filter((record) =>
      record.warnings.some((warning) => warning.includes("not itself a current tradable instrument")),
    ).length,
    issuerIdentityRejected: matches.filter((record) =>
      record.warnings.some((warning) => warning.includes("share no identity token")),
    ).length,
  };
  saveAtomic(output, { ...payload, summary });
  console.log(JSON.stringify({ output, cached: false, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
