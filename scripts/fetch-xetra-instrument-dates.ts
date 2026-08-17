/**
 * Fetch a compact catalog-scoped snapshot from Deutsche Börse's official
 * Xetra All Tradable Instruments CSV. Raw HTML/CSV bytes stay in memory.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
  extractXetraInstrumentCsvUrl,
  matchXetraInstrumentDates,
  normalizeXetraInstrumentSymbol,
  parseXetraInstrumentReferencePayload,
  type XetraInstrumentReferenceRow,
} from "../src/lib/research/xetra-instrument-reference";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "xetra-instrument-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const MAX_CSV_BYTES = 16 * 1024 * 1024;

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

function decodeCsv(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  }
}

function validDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
}

function parseInstrumentCsv(
  bytes: Uint8Array,
  sourceUrl: string,
  targetSymbols: ReadonlySet<string>,
  retrievedAt: string,
): { sourceRows: number; records: XetraInstrumentReferenceRow[] } {
  const text = decodeCsv(bytes);
  const lines = text.split(/\r?\n/);
  if (lines.length < 4 || lines[0].trim() !== "Market:;XETR"
    || !lines[2].startsWith("Product Status;Instrument Status;Instrument;ISIN;")) {
    throw new Error("Deutsche Börse instrument CSV headers changed or the response is not the expected file");
  }
  const workbook = XLSX.read(lines.slice(2).join("\n"), { type: "string", raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("Deutsche Börse instrument CSV has no worksheet");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
  const sourceHash = hash(bytes);
  const records = rows.flatMap((row): XetraInstrumentReferenceRow[] => {
    const symbol = normalizeXetraInstrumentSymbol(cleanText(row.Mnemonic));
    const productStatus = cleanText(row["Product Status"]);
    const instrumentStatus = cleanText(row["Instrument Status"]);
    const instrumentType = cleanText(row["Instrument Type"]).toUpperCase();
    const micCode = cleanText(row["MIC Code"]).toUpperCase();
    const unitOfQuotation = cleanText(row["Unit of Quotation"]);
    const isin = cleanText(row.ISIN).toUpperCase();
    const instrumentName = cleanText(row.Instrument);
    const primaryMarketMicCode = cleanText(row["Primary Market MIC Code"]).toUpperCase();
    const currency = cleanText(row.Currency).toUpperCase();
    const firstTradingDate = cleanText(row["First Trading Date"]);
    if (!targetSymbols.has(symbol) || productStatus !== "Active" || instrumentStatus !== "Active"
      || instrumentType !== "CS" || micCode !== "XETR" || unitOfQuotation !== "Shares"
      || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !instrumentName
      || !/^[A-Z0-9]{4}$/.test(primaryMarketMicCode) || !/^[A-Z]{3}$/.test(currency)
      || !validDate(firstTradingDate)) {
      return [];
    }
    return [{
      symbol,
      isin,
      instrumentName,
      instrumentType: "CS",
      micCode: "XETR",
      primaryMarketMicCode,
      currency,
      firstTradingDate,
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
    const cached = parseXetraInstrumentReferencePayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "XETR");
  const targetSymbols = new Set(stocks.map((stock) => normalizeXetraInstrumentSymbol(stock.ticker)).filter(Boolean));
  const pageBytes = await download(
    XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
    "text/html,*/*;q=0.8",
    XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
    MAX_PAGE_BYTES,
  );
  const sourceUrl = extractXetraInstrumentCsvUrl(new TextDecoder("utf-8").decode(pageBytes));
  const csvBytes = await download(
    sourceUrl,
    "text/csv,text/plain,*/*;q=0.5",
    XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
    MAX_CSV_BYTES,
  );
  const retrievedAt = new Date().toISOString();
  const source = parseInstrumentCsv(csvBytes, sourceUrl, targetSymbols, retrievedAt);
  const unique = new Map<string, XetraInstrumentReferenceRow>();
  for (const row of source.records) unique.set(`${row.symbol}\u0000${row.isin}\u0000${row.firstTradingDate}`, row);
  const records = [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol) || a.isin.localeCompare(b.isin));
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: source.sourceRows,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "Deutsche Börse Xetra All Tradable Instruments reference data",
      sourcePageUrl: XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
      sourceCsvUrl: sourceUrl,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_DEUTSCHE_BOERSE_TERMS_AND_DATA_LICENSE_REVIEW",
      exactFirstTradeTimeAvailable: false,
      interpretation: "Venue-instrument First Trading Date; not issuer incorporation date or guaranteed original IPO date",
    },
    records,
  };
  const normalized = parseXetraInstrumentReferencePayload(payload);
  const matches = matchXetraInstrumentDates(stocks, normalized);
  saveAtomic(output, payload);
  console.log(JSON.stringify({
    output,
    cached: false,
    sourceUrl,
    sourceRows: source.sourceRows,
    records: records.length,
    catalog: stocks.length,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
