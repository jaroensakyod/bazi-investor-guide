/**
 * Fetch compact official PSX current identities, annual equity-listing
 * history and exact-symbol company-profile listing statements. Raw HTML, ZIP
 * and spreadsheet bytes are parsed in memory and are not retained; SHA-256
 * hashes preserve provenance for the staged rows.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  PSX_CURRENT_LISTINGS_URL,
  PSX_LISTING_HISTORY_ARCHIVE_URLS,
  PSX_LISTINGS_HISTORY_PAGE_URL,
  matchPsxOfficialDates,
  normalizePsxTicker,
  parsePsxCompanyProfileListingEvidence,
  parsePsxCurrentListingsHtml,
  parsePsxListingDate,
  parsePsxListingDatePayload,
  psxCompanyProfileUrl,
  type PsxListingHistoryRow,
} from "../src/lib/research/psx-listing-history";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "psx-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_DOWNLOAD_BYTES = 8 * 1024 * 1024;
const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;
const MAX_WORKSHEET_ROWS = 5_000;
const MAX_WORKSHEET_COLUMNS = 100;

type CellValue = string | number | boolean | Date | null | undefined;

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

async function download(url: string, accept: string, referer: string): Promise<Uint8Array> {
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
      if (contentLength > MAX_DOWNLOAD_BYTES) throw new Error(`response is too large (${contentLength} bytes)`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_DOWNLOAD_BYTES) {
        throw new Error(`response size ${bytes.length} is outside the accepted range`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 600);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "unknown download error";
  throw new Error(`${url}: ${message}`);
}

function cleanText(value: CellValue): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function excelDate(value: CellValue): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? parsePsxListingDate(`${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`) : null;
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return parsePsxListingDate(`${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`);
  }
  return parsePsxListingDate(cleanText(value));
}

function discoverColumns(rows: readonly CellValue[][]): { name: number; date: number; symbol: number | null } | null {
  const maxColumns = Math.min(
    MAX_WORKSHEET_COLUMNS,
    rows.reduce((maximum, row) => Math.max(maximum, row.length), 0),
  );
  let name = -1;
  let date = -1;
  let symbol: number | null = null;
  for (let column = 0; column < maxColumns; column += 1) {
    const header = rows.slice(0, 15).map((row) => cleanText(row[column])).join(" ").toUpperCase();
    if (name < 0 && header.includes("NAME") && header.includes("COMPANY")) name = column;
    if (date < 0 && header.includes("FORMAL") && header.includes("LISTING")) date = column;
    if (symbol === null && header.includes("SYMBOL")) symbol = column;
  }
  return name >= 0 && date >= 0 ? { name, date, symbol } : null;
}

function parseWorkbook(
  bytes: Uint8Array,
  year: number,
  sourceUrl: string,
  sourceHash: string,
  retrievedAt: string,
): PsxListingHistoryRow[] {
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const parsed: PsxListingHistoryRow[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet?.["!ref"]) continue;
    const decoded = XLSX.utils.decode_range(sheet["!ref"]);
    const range = {
      s: decoded.s,
      e: {
        r: Math.min(decoded.e.r, MAX_WORKSHEET_ROWS - 1),
        c: Math.min(decoded.e.c, MAX_WORKSHEET_COLUMNS - 1),
      },
    };
    const rows = XLSX.utils.sheet_to_json<CellValue[]>(sheet, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: false,
      range,
    });
    const columns = discoverColumns(rows);
    if (!columns) continue;
    for (const row of rows) {
      const companyName = cleanText(row[columns.name]).replace(/\*+$/g, "").trim();
      const listingDate = excelDate(row[columns.date]);
      if (!companyName || !listingDate
        || /\b(?:TOTAL|PREMIUM AMOUNT|OPEN[ -]?END MUTUAL FUNDS?)\b/i.test(companyName)
        || /\b(?:2ND|SECOND)\s+ISSUE\b/i.test(companyName)) {
        continue;
      }
      const rawSymbol = columns.symbol === null ? "" : cleanText(row[columns.symbol]);
      const symbol = normalizePsxTicker(rawSymbol);
      parsed.push({
        sourceType: "annual_listing_history",
        year,
        companyName,
        symbol: symbol || null,
        listingDate,
        evidenceExcerpt: null,
        sourceUrl,
        sourceHash,
        retrievedAt,
      });
    }
  }
  const unique = new Map<string, PsxListingHistoryRow>();
  for (const row of parsed) {
    unique.set(`${row.companyName}\u0000${row.symbol ?? ""}\u0000${row.listingDate}`, row);
  }
  return [...unique.values()];
}

function extractWorkbooks(zipBytes: Uint8Array): Array<{ name: string; bytes: Uint8Array }> {
  if (zipBytes[0] !== 0x50 || zipBytes[1] !== 0x4b) throw new Error("PSX archive is not a ZIP file");
  let oversizedWorkbook = false;
  const unzipped = unzipSync(zipBytes, {
    filter: (file) => {
      const spreadsheet = /\.xlsx?$/i.test(file.name) && !file.name.startsWith("__MACOSX/");
      if (spreadsheet && file.originalSize > MAX_WORKBOOK_BYTES) oversizedWorkbook = true;
      return spreadsheet && file.originalSize <= MAX_WORKBOOK_BYTES;
    },
  });
  if (oversizedWorkbook) throw new Error("PSX archive contains an oversized workbook");
  const entries = Object.entries(unzipped).map(([name, bytes]) => ({ name, bytes }));
  if (entries.length === 0 || entries.length > 4) {
    throw new Error(`PSX archive contains ${entries.length} supported workbooks`);
  }
  return entries;
}

async function fetchYear(year: number, sourceUrl: string): Promise<PsxListingHistoryRow[]> {
  const retrievedAt = new Date().toISOString();
  const zipBytes = await download(sourceUrl, "application/zip,application/octet-stream,*/*;q=0.5", PSX_LISTINGS_HISTORY_PAGE_URL);
  const sourceHash = hash(zipBytes);
  const rows = extractWorkbooks(zipBytes).flatMap((workbook) =>
    parseWorkbook(workbook.bytes, year, sourceUrl, sourceHash, retrievedAt),
  );
  if (rows.length === 0) throw new Error(`PSX ${year} archive contains no valid Date of Formal Listing rows`);
  return rows;
}

async function fetchCompanyProfile(
  symbol: string,
  companyName: string,
): Promise<PsxListingHistoryRow | null> {
  const sourceUrl = psxCompanyProfileUrl(symbol);
  const retrievedAt = new Date().toISOString();
  const bytes = await download(sourceUrl, "text/html,*/*;q=0.8", PSX_CURRENT_LISTINGS_URL);
  const evidence = parsePsxCompanyProfileListingEvidence(new TextDecoder("utf-8").decode(bytes), symbol);
  if (!evidence) return null;
  return {
    sourceType: "company_profile",
    year: Number(evidence.listingDate.slice(0, 4)),
    companyName,
    symbol: evidence.symbol,
    listingDate: evidence.listingDate,
    evidenceExcerpt: evidence.evidenceExcerpt,
    sourceUrl,
    sourceHash: hash(bytes),
    retrievedAt,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  if (!refresh && existsSync(output)) {
    const cached = parsePsxListingDatePayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({
      output,
      cached: true,
      summary: {
        directoryRows: cached.directoryRows.length,
        historyRows: cached.records.length,
        explicitSymbols: cached.records.filter((record) => record.symbol !== null).length,
        profileRows: cached.records.filter((record) => record.sourceType === "company_profile").length,
      },
    }, null, 2));
    return;
  }

  const directoryBytes = await download(PSX_CURRENT_LISTINGS_URL, "text/html,*/*;q=0.8", "https://dps.psx.com.pk/listings");
  const directoryRows = parsePsxCurrentListingsHtml(new TextDecoder("utf-8").decode(directoryBytes));
  const archives = Object.entries(PSX_LISTING_HISTORY_ARCHIVE_URLS)
    .map(([year, sourceUrl]) => ({ year: Number(year), sourceUrl }))
    .sort((a, b) => a.year - b.year);
  const records: PsxListingHistoryRow[] = [];
  const concurrency = Math.max(1, Math.min(8, Number(arg("concurrency") ?? 4) || 4));
  let cursor = 0;
  let completed = 0;
  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      const archive = archives[index];
      if (!archive) return;
      const rows = await fetchYear(archive.year, archive.sourceUrl);
      records.push(...rows);
      completed += 1;
      console.log(JSON.stringify({ completed, total: archives.length, year: archive.year, rows: rows.length }));
      await delay(80);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, archives.length) }, worker));

  const directorySourceHash = hash(directoryBytes);
  const annualRetrievedAt = new Date().toISOString();
  const annualPayload = parsePsxListingDatePayload({
    retrievedAt: annualRetrievedAt,
    sourceRowCount: records.length,
    directorySourceUrl: PSX_CURRENT_LISTINGS_URL,
    directorySourceHash,
    directoryRows,
    records,
  });
  const catalogStocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "KSE");
  const directoryBySymbol = new Map(directoryRows.map((row) => [row.symbol, row]));
  const profileTargets = matchPsxOfficialDates(catalogStocks, annualPayload)
    .filter((record) => record.status === "unmatched" && directoryBySymbol.has(record.ticker))
    .map((record) => directoryBySymbol.get(record.ticker)!)
    .sort((a, b) => a.symbol.localeCompare(b.symbol));
  let profileCursor = 0;
  let profilesCompleted = 0;
  async function profileWorker(): Promise<void> {
    while (true) {
      const index = profileCursor;
      profileCursor += 1;
      const target = profileTargets[index];
      if (!target) return;
      const row = await fetchCompanyProfile(target.symbol, target.name);
      if (row) records.push(row);
      profilesCompleted += 1;
      console.log(JSON.stringify({
        profilesCompleted,
        profileTotal: profileTargets.length,
        symbol: target.symbol,
        listingDate: row?.listingDate ?? null,
      }));
      await delay(100);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, profileTargets.length) }, profileWorker));

  const unique = new Map<string, PsxListingHistoryRow>();
  for (const row of records) {
    unique.set(`${row.sourceType}\u0000${row.year}\u0000${row.companyName}\u0000${row.symbol ?? ""}\u0000${row.listingDate}`, row);
  }
  const sorted = [...unique.values()].sort((a, b) =>
    a.listingDate.localeCompare(b.listingDate) || a.companyName.localeCompare(b.companyName),
  );
  const retrievedAt = new Date().toISOString();
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: records.length + profileTargets.length,
    directorySourceUrl: PSX_CURRENT_LISTINGS_URL,
    directorySourceHash,
    directoryRows,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "Pakistan Stock Exchange Listings History and Company Profiles",
      sourceUrl: PSX_LISTINGS_HISTORY_PAGE_URL,
      companyProfileUrlTemplate: "https://dps.psx.com.pk/company/{symbol}",
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_PSX_TERMS_AND_DATA_LICENSE_REVIEW",
      coverageStartYear: 2000,
      rawHtmlZipAndWorkbooksStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      currentDirectoryRows: directoryRows.length,
      archiveYears: archives.length,
      historyRows: sorted.length,
      annualHistoryRows: sorted.filter((record) => record.sourceType === "annual_listing_history").length,
      profilePagesScanned: profileTargets.length,
      profileDayPrecisionRecords: sorted.filter((record) => record.sourceType === "company_profile").length,
      explicitSymbols: sorted.filter((record) => record.symbol !== null).length,
      dateOnlyRows: sorted.length,
    },
    records: sorted,
  };
  parsePsxListingDatePayload(payload);
  saveAtomic(output, payload);
  console.log(JSON.stringify({ output, cached: false, summary: payload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
