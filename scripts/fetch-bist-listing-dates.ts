/**
 * Fetch a compact catalog-scoped snapshot from Borsa Istanbul's official
 * First Trading Date workbook. Raw ZIP/XLSX bytes and closing prices are not
 * retained in the staging artifact.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  BIST_FIRST_TRADING_DATES_ZIP_URL,
  BIST_MARKET_DATA_PAGE_URL,
  matchBistOfficialDates,
  normalizeBistCurrentCode,
  normalizeBistSymbol,
  parseBistDate,
  parseBistFirstTradingDatePayload,
  type BistFirstTradingDateRow,
} from "../src/lib/research/bist-first-trading-date";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "bist-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_ARCHIVE_BYTES = 2 * 1024 * 1024;
const MAX_WORKBOOK_BYTES = 8 * 1024 * 1024;

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

async function downloadArchive(): Promise<Uint8Array> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(BIST_FIRST_TRADING_DATES_ZIP_URL, {
        headers: {
          Accept: "application/zip,application/octet-stream,*/*;q=0.5",
          Referer: BIST_MARKET_DATA_PAGE_URL,
          "User-Agent": USER_AGENT,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_ARCHIVE_BYTES) throw new Error(`archive is too large (${contentLength} bytes)`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
        throw new Error(`archive size ${bytes.length} is outside the accepted range`);
      }
      return bytes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "unknown download error";
  throw new Error(`${BIST_FIRST_TRADING_DATES_ZIP_URL}: ${message}`);
}

function workbookFromArchive(archiveBytes: Uint8Array): Uint8Array {
  if (archiveBytes[0] !== 0x50 || archiveBytes[1] !== 0x4b) {
    throw new Error("Borsa Istanbul response is not a ZIP archive");
  }
  const entries = unzipSync(archiveBytes);
  const workbook = Object.entries(entries).find(([name]) => /(?:^|\/)ilkislem\.xlsx$/i.test(name));
  if (!workbook) throw new Error("Borsa Istanbul archive does not contain ilkislem.xlsx");
  if (workbook[1].length === 0 || workbook[1].length > MAX_WORKBOOK_BYTES) {
    throw new Error(`Borsa Istanbul workbook size ${workbook[1].length} is outside the accepted range`);
  }
  return workbook[1];
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseWorkbookDate(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? parseBistDate(`${parsed.d}.${parsed.m}.${parsed.y}`) : null;
  }
  return parseBistDate(value);
}

function parseWorkbook(
  workbookBytes: Uint8Array,
  archiveHash: string,
  targetSymbols: ReadonlySet<string>,
  retrievedAt: string,
): { sourceRows: number; records: BistFirstTradingDateRow[] } {
  const workbook = XLSX.read(workbookBytes, { type: "array", cellDates: false, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Borsa Istanbul workbook has no worksheet");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: null });
  const headers = (rows[0] ?? []).map(cleanText);
  const expectedFragments = ["FIRST CODE", "CURRENT CODE", "CURRENT NAME", "LISTING DATE", "FIRST TRADING DAY"];
  if (headers.length < 5 || expectedFragments.some((fragment, index) => !headers[index]?.includes(fragment))) {
    throw new Error("Borsa Istanbul workbook headers changed");
  }

  const instrumentRows = rows.slice(1).filter((row) =>
    typeof row[1] === "string" && /^[A-Z0-9]{1,16}\.[A-Z0-9]{1,3}$/.test(row[1].trim().toUpperCase()),
  );
  const records = instrumentRows.flatMap((row): BistFirstTradingDateRow[] => {
    const currentCode = normalizeBistCurrentCode(cleanText(row[1]));
    const symbol = normalizeBistSymbol(currentCode.split(".")[0] ?? "");
    if (!currentCode || !targetSymbols.has(symbol)) return [];
    const firstCode = cleanText(row[0]).toUpperCase();
    const companyName = cleanText(row[2]);
    const listingDate = parseWorkbookDate(row[3]);
    const firstTradingDate = parseWorkbookDate(row[4]);
    if (!firstCode || !companyName || !firstTradingDate) return [];
    return [{
      firstCode,
      currentCode,
      symbol,
      companyName,
      listingDate,
      firstTradingDate,
      sourceUrl: BIST_FIRST_TRADING_DATES_ZIP_URL,
      sourceHash: archiveHash,
      retrievedAt,
    }];
  });
  return { sourceRows: instrumentRows.length, records };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  if (!refresh && existsSync(output)) {
    const cached = parseBistFirstTradingDatePayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "BIST");
  const targetSymbols = new Set(stocks.map((stock) => normalizeBistSymbol(stock.ticker)).filter(Boolean));
  const zipInput = arg("zip-input");
  const archiveBytes = zipInput
    ? new Uint8Array(readFileSync(path.resolve(zipInput)))
    : await downloadArchive();
  const workbookBytes = workbookFromArchive(archiveBytes);
  const retrievedAt = new Date().toISOString();
  const source = parseWorkbook(workbookBytes, hash(archiveBytes), targetSymbols, retrievedAt);
  const unique = new Map<string, BistFirstTradingDateRow>();
  for (const row of source.records) unique.set(`${row.currentCode}\u0000${row.firstTradingDate}`, row);
  const records = [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: source.sourceRows,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "Borsa Istanbul First Trading Date and Price of the Equities",
      sourcePageUrl: BIST_MARKET_DATA_PAGE_URL,
      sourceArchiveUrl: BIST_FIRST_TRADING_DATES_ZIP_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_BORSA_ISTANBUL_DATA_DISTRIBUTION_AGREEMENT_REVIEW",
      rawZipAndXlsxStored: false,
      firstTradingClosingPricesStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: stocks.length,
      sourceRows: source.sourceRows,
      compactRecords: records.length,
    },
    records,
  };
  const parsed = parseBistFirstTradingDatePayload(payload);
  const matches = matchBistOfficialDates(stocks, parsed);
  const summary = {
    ...payload.summary,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
    nameIdentityWarnings: matches.filter((record) => record.nameIdentityConfirmed === false).length,
    certificateLines: matches.filter((record) => record.sourceCode?.endsWith(".G")).length,
  };
  saveAtomic(output, { ...payload, summary });
  console.log(JSON.stringify({ output, cached: false, sourceInput: zipInput ? path.resolve(zipInput) : "downloaded", summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
