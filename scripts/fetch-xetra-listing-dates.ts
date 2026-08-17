/**
 * Fetch a compact catalog-scoped snapshot from Deutsche Börse's official
 * Primary Market Statistics CSV. Raw HTML/CSV bytes are parsed in memory and
 * are not retained in the staging artifact.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  XETRA_NEW_COMPANIES_PAGE_URL,
  XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL,
  extractXetraPrimaryMarketCsvUrl,
  matchXetraOfficialDates,
  normalizeXetraSymbol,
  parseXetraFirstTradingDate,
  parseXetraPrimaryMarketPayload,
  type XetraPrimaryMarketRow,
  type XetraTransactionType,
} from "../src/lib/research/xetra-primary-market";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "xetra-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_CSV_BYTES = 4 * 1024 * 1024;

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

function decodePrimaryMarketCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    // Deutsche Börse currently publishes PM_Statistik_EN.csv as Windows-1252.
    return new TextDecoder("windows-1252", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  }
}

function transactionType(value: unknown): XetraTransactionType | null {
  const normalized = cleanText(value).toUpperCase();
  return (["NI", "LI", "PP", "DL", "TR"] as string[]).includes(normalized)
    ? normalized as XetraTransactionType
    : null;
}

function parsePrimaryMarketCsv(
  bytes: Uint8Array,
  sourceUrl: string,
  targetSymbols: ReadonlySet<string>,
  retrievedAt: string,
): { sourceRows: number; records: XetraPrimaryMarketRow[] } {
  const text = decodePrimaryMarketCsv(bytes);
  if (!text.startsWith('"No.","Market","Current Segment"')) {
    throw new Error("Deutsche Börse CSV headers changed or response is not the expected file");
  }
  const workbook = XLSX.read(text, { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Deutsche Börse CSV has no worksheet");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
  const sourceHash = hash(bytes);
  const records = rows.flatMap((row): XetraPrimaryMarketRow[] => {
    const symbol = normalizeXetraSymbol(cleanText(row.Symbol));
    const isin = cleanText(row.ISIN).toUpperCase();
    const companyName = cleanText(row.Company);
    const firstTradingDate = parseXetraFirstTradingDate(row["First Trading Day"]);
    const type = transactionType(row.Type);
    const market = cleanText(row.Market);
    const currentSegment = cleanText(row["Current Segment"]);
    if (!targetSymbols.has(symbol) || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)
      || !companyName || !firstTradingDate || !type || !market || !currentSegment) {
      return [];
    }
    return [{
      symbol,
      isin,
      companyName,
      firstTradingDate,
      transactionType: type,
      market,
      currentSegment,
      sourceUrl,
      sourceHash,
      retrievedAt,
    }];
  });
  return { sourceRows: rows.length, records };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  if (!refresh && existsSync(output)) {
    const cached = parseXetraPrimaryMarketPayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "XETR");
  const targetSymbols = new Set(stocks.map((stock) => normalizeXetraSymbol(stock.ticker)).filter(Boolean));
  const pageBytes = await download(
    XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL,
    "text/html,*/*;q=0.8",
    XETRA_NEW_COMPANIES_PAGE_URL,
    MAX_PAGE_BYTES,
  );
  const sourceUrl = extractXetraPrimaryMarketCsvUrl(new TextDecoder("utf-8").decode(pageBytes));
  const csvBytes = await download(
    sourceUrl,
    "text/csv,text/plain,*/*;q=0.5",
    XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL,
    MAX_CSV_BYTES,
  );
  const retrievedAt = new Date().toISOString();
  const source = parsePrimaryMarketCsv(csvBytes, sourceUrl, targetSymbols, retrievedAt);
  const unique = new Map<string, XetraPrimaryMarketRow>();
  for (const row of source.records) {
    unique.set(`${row.symbol}\u0000${row.isin}\u0000${row.firstTradingDate}\u0000${row.transactionType}`, row);
  }
  const records = [...unique.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol)
    || a.firstTradingDate.localeCompare(b.firstTradingDate)
    || a.isin.localeCompare(b.isin),
  );
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: source.sourceRows,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "Deutsche Börse New Companies / Primary Market Statistics",
      sourcePageUrl: XETRA_NEW_COMPANIES_PAGE_URL,
      sourceDownloadPageUrl: XETRA_PRIMARY_MARKET_DOWNLOAD_PAGE_URL,
      sourceCsvUrl: sourceUrl,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_DEUTSCHE_BOERSE_TERMS_AND_DATA_LICENSE_REVIEW",
      rawHtmlAndCsvStored: false,
      exactFirstTradeTimeAvailable: false,
      identityRule: "exact symbol plus exact conservative normalized company name; one ISIN only",
    },
    summary: {
      catalog: stocks.length,
      sourceRows: source.sourceRows,
      compactRecords: records.length,
    },
    records,
  };
  const parsed = parseXetraPrimaryMarketPayload(payload);
  const matches = matchXetraOfficialDates(stocks, parsed);
  const summary = {
    ...payload.summary,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
    tickerReuseRejected: matches.filter((record) =>
      record.warnings.some((warning) => warning.includes("ticker may have been reused")),
    ).length,
  };
  saveAtomic(output, { ...payload, summary });
  console.log(JSON.stringify({ output, cached: false, sourceUrl, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
