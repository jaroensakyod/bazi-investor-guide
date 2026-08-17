/** Fetch compact official JSE ListingDate records without retaining raw API responses. */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  JSE_ALL_ISSUERS_SERVICE_URL,
  JSE_DATA_DISCLAIMER_URL,
  JSE_INSTRUMENTS_SERVICE_URL,
  JSE_LISTED_COMPANIES_URL,
  jseIssuerProfileUrl,
  matchJseOfficialDates,
  normalizeJseCompanyName,
  normalizeJseSymbol,
  parseJseInstrumentListingPayload,
  parseJseListingDate,
  type JseInstrumentListingRow,
} from "../src/lib/research/jse-instrument-listing";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "jse-listing-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

type JseIssuer = { MasterID: number; AlphaCode: string; LongName: string };

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

function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function postJson(url: string, body: unknown): Promise<{ value: unknown; text: string }> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json; charset=utf-8",
          Referer: JSE_LISTED_COMPANIES_URL,
          "User-Agent": USER_AGENT,
        },
        body: JSON.stringify(body),
        redirect: "follow",
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_RESPONSE_BYTES) throw new Error(`response is too large (${contentLength} bytes)`);
      const text = await response.text();
      if (!text || Buffer.byteLength(text, "utf8") > MAX_RESPONSE_BYTES) {
        throw new Error(`response size is outside the accepted range`);
      }
      return { value: JSON.parse(text) as unknown, text };
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  const message = lastError instanceof Error ? lastError.message : "unknown request error";
  throw new Error(`${url}: ${message}`);
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseIssuers(value: unknown): JseIssuer[] {
  if (!Array.isArray(value)) throw new Error("JSE GetAllIssuers response must be an array");
  const issuers = value.flatMap((item): JseIssuer[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const MasterID = Number(row.MasterID);
    const AlphaCode = cleanText(row.AlphaCode).toUpperCase();
    const LongName = cleanText(row.LongName);
    const exchange = cleanText(row.ExchangeCode).toUpperCase();
    const status = cleanText(row.Status).toUpperCase();
    const role = cleanText(row.RoleDescription);
    if (!Number.isInteger(MasterID) || MasterID <= 0 || !AlphaCode || !LongName
      || exchange !== "JSE" || status !== "CURRENT" || role !== "Equity Issuer") return [];
    return [{ MasterID, AlphaCode, LongName }];
  });
  if (issuers.length === 0) throw new Error("JSE issuer response contains no current JSE equity issuers");
  return issuers;
}

function parseInstrumentResponse(
  value: unknown,
  responseText: string,
  issuer: JseIssuer,
  targetSymbols: ReadonlySet<string>,
  retrievedAt: string,
): { sourceRows: number; records: JseInstrumentListingRow[] } {
  if (!value || typeof value !== "object") throw new Error(`JSE instrument response for issuer ${issuer.MasterID} is invalid`);
  const rows = (value as Record<string, unknown>).GetAllInstrumentsForIssuerResult;
  if (!Array.isArray(rows)) return { sourceRows: 0, records: [] };
  const sourceHash = hash(responseText);
  const records = rows.flatMap((item): JseInstrumentListingRow[] => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const symbol = normalizeJseSymbol(cleanText(row.AlphaCode));
    const isin = cleanText(row.ISIN).toUpperCase();
    const listingDate = parseJseListingDate(row.ListingDate);
    const instrumentName = cleanText(row.LongName);
    const instrumentType = cleanText(row.InstrumentType);
    const board = cleanText(row.Board);
    const instrumentMasterId = Number(row.MasterID);
    const market = cleanText(row.Market);
    const status = cleanText(row.Status).toUpperCase();
    if (!targetSymbols.has(symbol) || !/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) || !listingDate
      || !instrumentName || !instrumentType || !board || !Number.isInteger(instrumentMasterId)
      || instrumentMasterId <= 0 || market !== "Equity Market" || status !== "CURRENT") return [];
    return [{
      symbol,
      isin,
      companyName: issuer.LongName,
      instrumentName,
      instrumentType,
      board,
      listingDate,
      issuerMasterId: issuer.MasterID,
      instrumentMasterId,
      sourceUrl: jseIssuerProfileUrl(issuer.MasterID),
      sourceApiUrl: JSE_INSTRUMENTS_SERVICE_URL,
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
    const cached = parseJseInstrumentListingPayload(JSON.parse(readFileSync(output, "utf8")) as unknown);
    console.log(JSON.stringify({ output, cached: true, records: cached.records.length }, null, 2));
    return;
  }

  const stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "JSE");
  const issuerInput = arg("issuer-input");
  const issuerPayload = issuerInput
    ? JSON.parse(readFileSync(path.resolve(issuerInput), "utf8").replace(/^\uFEFF/, "")) as unknown
    : (await postJson(JSE_ALL_ISSUERS_SERVICE_URL, { filterLongName: "", filterType: "Equity Issuer" })).value;
  const issuers = parseIssuers(issuerPayload);
  const issuersByName = new Map<string, JseIssuer[]>();
  for (const issuer of issuers) {
    const key = normalizeJseCompanyName(issuer.LongName);
    const rows = issuersByName.get(key) ?? [];
    rows.push(issuer);
    issuersByName.set(key, rows);
  }
  const targetByIssuer = new Map<number, { issuer: JseIssuer; symbols: Set<string> }>();
  const noExactIssuerIdentity: string[] = [];
  for (const stock of stocks) {
    const candidates = issuersByName.get(normalizeJseCompanyName(stock.name)) ?? [];
    if (candidates.length === 0) noExactIssuerIdentity.push(stock.ticker);
    for (const issuer of candidates) {
      const current = targetByIssuer.get(issuer.MasterID) ?? { issuer, symbols: new Set<string>() };
      current.symbols.add(normalizeJseSymbol(stock.ticker));
      targetByIssuer.set(issuer.MasterID, current);
    }
  }

  const retrievedAt = new Date().toISOString();
  const targets = [...targetByIssuer.values()].sort((a, b) => a.issuer.MasterID - b.issuer.MasterID);
  const sourceParts: Array<{ sourceRows: number; records: JseInstrumentListingRow[] }> = [];
  const concurrency = 6;
  for (let first = 0; first < targets.length; first += concurrency) {
    const batch = targets.slice(first, first + concurrency);
    sourceParts.push(...await Promise.all(batch.map(async ({ issuer, symbols }) => {
      const response = await postJson(JSE_INSTRUMENTS_SERVICE_URL, { issuerMasterId: issuer.MasterID });
      return parseInstrumentResponse(response.value, response.text, issuer, symbols, retrievedAt);
    })));
    if (first + concurrency < targets.length) await delay(100);
  }
  const unique = new Map<string, JseInstrumentListingRow>();
  for (const row of sourceParts.flatMap((part) => part.records)) {
    unique.set(`${row.symbol}\u0000${row.isin}\u0000${row.listingDate}`, row);
  }
  const records = [...unique.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  const payload = {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: retrievedAt,
    sourceRowCount: sourceParts.reduce((sum, part) => sum + part.sourceRows, 0),
    sourcePolicy: {
      authority: "exchange",
      sourceName: "JSE Client Portal Listed Companies / SharesService",
      sourceDirectoryUrl: JSE_LISTED_COMPANIES_URL,
      sourceIssuerServiceUrl: JSE_ALL_ISSUERS_SERVICE_URL,
      sourceInstrumentServiceUrl: JSE_INSTRUMENTS_SERVICE_URL,
      sourceDisclaimerUrl: JSE_DATA_DISCLAIMER_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_WITHOUT_EXPRESS_WRITTEN_JSE_PERMISSION",
      rawApiResponsesStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: stocks.length,
      currentJseEquityIssuers: issuers.length,
      selectedIssuerRequests: targets.length,
      noExactIssuerIdentity: noExactIssuerIdentity.length,
      sourceRows: sourceParts.reduce((sum, part) => sum + part.sourceRows, 0),
      compactRecords: records.length,
    },
    records,
  };
  const parsed = parseJseInstrumentListingPayload(payload);
  const matches = matchJseOfficialDates(stocks, parsed);
  const summary = {
    ...payload.summary,
    matched: matches.filter((record) => record.status === "matched").length,
    unmatched: matches.filter((record) => record.status === "unmatched").length,
    ambiguous: matches.filter((record) => record.status === "ambiguous").length,
    invalid: matches.filter((record) => record.status === "invalid").length,
  };
  saveAtomic(output, { ...payload, summary });
  console.log(JSON.stringify({ output, cached: false, issuerInput: issuerInput ? path.resolve(issuerInput) : "downloaded", summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
