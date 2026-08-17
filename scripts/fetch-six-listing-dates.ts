/**
 * Fetch compact official listing dates from SIX IPO History plus Blue-Chip,
 * Domestic, Foreign and Sponsored Foreign Shares reference data. Raw bytes are
 * parsed in memory and discarded.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  SIX_IPO_HISTORY_PAGE_URL,
  SIX_IPO_HISTORY_XLS_URL,
  SIX_BLUE_CHIP_SHARES_CSV_URL,
  SIX_DOMESTIC_SHARES_CSV_URL,
  SIX_FOREIGN_SHARES_CSV_URL,
  SIX_SHARE_EXPLORER_PAGE_URL,
  SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
  SIX_SPONSORED_FOREIGN_SHARES_PAGE_URL,
  matchSixOfficialDates,
  normalizeSixSymbol,
  parseSixListingDate,
  parseSixListingDatePayload,
  type SixListingDateRow,
} from "../src/lib/research/six-listing-history";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "six-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;

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
      if (contentLength > MAX_SOURCE_BYTES) throw new Error(`response is too large (${contentLength} bytes)`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_SOURCE_BYTES) {
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

function parseIpoHistory(
  bytes: Uint8Array,
  targetSymbols: ReadonlySet<string>,
  retrievedAt: string,
): { sourceRows: number; records: SixListingDateRow[] } {
  if (!(bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0)) {
    throw new Error("SIX IPO History response is not an XLS compound document");
  }
  const workbook = XLSX.read(bytes, { type: "array", cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("SIX IPO History workbook has no worksheet");
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { raw: true, defval: null });
  const sourceHash = hash(bytes);
  const records = rows.flatMap((row): SixListingDateRow[] => {
    const symbol = normalizeSixSymbol(cleanText(row.Symbol));
    const listingDate = parseSixListingDate(row["First Listing Date"]);
    const isin = cleanText(row.ISIN).toUpperCase();
    const companyName = cleanText(row.Issuer);
    if (!targetSymbols.has(symbol) || !listingDate || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !companyName) return [];
    return [{
      sourceType: "ipo_history",
      symbol,
      isin,
      companyName,
      listingDate,
      tradingCurrency: null,
      sourceUrl: SIX_IPO_HISTORY_XLS_URL,
      sourceHash,
      retrievedAt,
    }];
  });
  return { sourceRows: rows.length, records };
}

function parseDelimitedLine(line: string): string[] {
  const fields: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ";" && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) throw new Error("SIX reference CSV contains an unterminated quote");
  fields.push(value);
  return fields;
}

function parseReferenceShares(
  bytes: Uint8Array,
  targetBaseSymbols: ReadonlySet<string>,
  retrievedAt: string,
  sourceType:
    | "blue_chip_share_reference"
    | "domestic_share_reference"
    | "foreign_share_reference"
    | "sponsored_foreign_share",
  sourceUrl: string,
): { sourceRows: number; records: SixListingDateRow[] } {
  // SIX currently declares this CSV as ISO-8859-1. windows-1252 is the
  // compatible WHATWG decoder and preserves issuer names with diacritics.
  const text = new TextDecoder("windows-1252").decode(bytes).replace(/^\uFEFF/, "").trim();
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = parseDelimitedLine(lines[0] ?? "");
  const expected = ["ShortName", "ValorSymbol", "ISIN", "GeographicalAreaCode", "TradingBaseCurrency", "FirstTradingDate"];
  if (headers.length !== expected.length || headers.some((header, index) => header !== expected[index])) {
    throw new Error("SIX reference CSV headers changed");
  }
  const sourceHash = hash(bytes);
  const records = lines.slice(1).flatMap((line): SixListingDateRow[] => {
    const fields = parseDelimitedLine(line);
    if (fields.length !== expected.length) return [];
    const row = Object.fromEntries(expected.map((header, index) => [header, fields[index]]));
    const symbol = normalizeSixSymbol(cleanText(row.ValorSymbol));
    const listingDate = parseSixListingDate(row.FirstTradingDate);
    const isin = cleanText(row.ISIN).toUpperCase();
    const companyName = cleanText(row.ShortName);
    const tradingCurrency = cleanText(row.TradingBaseCurrency).toUpperCase();
    if (!targetBaseSymbols.has(symbol) || !listingDate || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)
      || !companyName || !/^[A-Z]{3}$/.test(tradingCurrency)) {
      return [];
    }
    return [{
      sourceType,
      symbol,
      isin,
      companyName,
      listingDate,
      tradingCurrency,
      sourceUrl,
      sourceHash,
      retrievedAt,
    }];
  });
  return { sourceRows: lines.length - 1, records };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const refresh = flag("refresh");
  if (!refresh && existsSync(output)) {
    const cached = parseSixListingDatePayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "SWX");
  const targetSymbols = new Set(stocks.map((stock) => normalizeSixSymbol(stock.ticker)).filter(Boolean));
  const targetBaseSymbols = new Set([...targetSymbols].map((ticker) => ticker.replace(/\.USD$/, "")));
  const [ipoBytes, blueChipBytes, domesticBytes, foreignBytes, sponsoredBytes] = await Promise.all([
    download(SIX_IPO_HISTORY_XLS_URL, "application/vnd.ms-excel,application/octet-stream,*/*;q=0.5", SIX_IPO_HISTORY_PAGE_URL),
    download(SIX_BLUE_CHIP_SHARES_CSV_URL, "text/csv,text/plain,*/*;q=0.5", SIX_SHARE_EXPLORER_PAGE_URL),
    download(SIX_DOMESTIC_SHARES_CSV_URL, "text/csv,text/plain,*/*;q=0.5", SIX_SHARE_EXPLORER_PAGE_URL),
    download(SIX_FOREIGN_SHARES_CSV_URL, "text/csv,text/plain,*/*;q=0.5", SIX_SHARE_EXPLORER_PAGE_URL),
    download(SIX_SPONSORED_FOREIGN_SHARES_CSV_URL, "text/csv,text/plain,*/*;q=0.5", SIX_SPONSORED_FOREIGN_SHARES_PAGE_URL),
  ]);
  const retrievedAt = new Date().toISOString();
  const ipo = parseIpoHistory(ipoBytes, targetSymbols, retrievedAt);
  const blueChip = parseReferenceShares(
    blueChipBytes,
    targetBaseSymbols,
    retrievedAt,
    "blue_chip_share_reference",
    SIX_BLUE_CHIP_SHARES_CSV_URL,
  );
  const domestic = parseReferenceShares(
    domesticBytes,
    targetBaseSymbols,
    retrievedAt,
    "domestic_share_reference",
    SIX_DOMESTIC_SHARES_CSV_URL,
  );
  const foreign = parseReferenceShares(
    foreignBytes,
    targetBaseSymbols,
    retrievedAt,
    "foreign_share_reference",
    SIX_FOREIGN_SHARES_CSV_URL,
  );
  const sponsored = parseReferenceShares(
    sponsoredBytes,
    targetBaseSymbols,
    retrievedAt,
    "sponsored_foreign_share",
    SIX_SPONSORED_FOREIGN_SHARES_CSV_URL,
  );
  const unique = new Map<string, SixListingDateRow>();
  for (const row of [...ipo.records, ...blueChip.records, ...domestic.records, ...foreign.records, ...sponsored.records]) {
    unique.set(`${row.sourceType}\u0000${row.symbol}\u0000${row.tradingCurrency ?? ""}\u0000${row.listingDate}`, row);
  }
  const records = [...unique.values()].sort((a, b) =>
    a.symbol.localeCompare(b.symbol) || a.listingDate.localeCompare(b.listingDate),
  );
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: ipo.sourceRows + blueChip.sourceRows + domestic.sourceRows + foreign.sourceRows + sponsored.sourceRows,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "SIX IPO History and current Share Explorer reference tables",
      sourceUrls: [SIX_IPO_HISTORY_PAGE_URL, SIX_SHARE_EXPLORER_PAGE_URL, SIX_SPONSORED_FOREIGN_SHARES_PAGE_URL],
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_SIX_TERMS_AND_DATA_LICENSE_REVIEW",
      rawXlsAndCsvStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: stocks.length,
      ipoSourceRows: ipo.sourceRows,
      blueChipSourceRows: blueChip.sourceRows,
      domesticSourceRows: domestic.sourceRows,
      foreignSourceRows: foreign.sourceRows,
      sponsoredSourceRows: sponsored.sourceRows,
      compactIpoRecords: records.filter((record) => record.sourceType === "ipo_history").length,
      compactBlueChipRecords: records.filter((record) => record.sourceType === "blue_chip_share_reference").length,
      compactDomesticRecords: records.filter((record) => record.sourceType === "domestic_share_reference").length,
      compactForeignRecords: records.filter((record) => record.sourceType === "foreign_share_reference").length,
      compactSponsoredRecords: records.filter((record) => record.sourceType === "sponsored_foreign_share").length,
    },
    records,
  };
  const parsed = parseSixListingDatePayload(payload);
  const matches = matchSixOfficialDates(stocks, parsed);
  const summary = {
    ...payload.summary,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalidAliases: matches.filter((record) => record.status === "invalid").length,
  };
  saveAtomic(output, { ...payload, summary });
  console.log(JSON.stringify({ output, cached: false, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
