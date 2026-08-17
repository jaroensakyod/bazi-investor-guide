/**
 * Fetch compact HKEX-hosted equity profile dates for catalog stock codes.
 *
 * The public HKEX quote page loads `listing_date` from getequityquote. The
 * company-profile footnote attributes this data to Refinitiv, so staged dates
 * remain blocked from commercial display until the applicable licence is
 * reviewed. Raw HTML/JSONP is hashed in memory and discarded.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  HKEX_EQUITIES_QUOTE_PAGE_URL,
  HKEX_EQUITY_QUOTE_API_URL,
  hkexEquityQuotePageUrl,
  normalizeHkexCatalogTicker,
  parseHkexEquityQuoteJsonp,
  type HkexEquityQuoteSnapshot,
} from "../src/lib/research/hkex-equity-profile";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "hkex-company-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";

type Target = {
  symbol: string;
  catalogTickers: string[];
};

type FetchRecord = HkexEquityQuoteSnapshot & Target & {
  status: "matched" | "unmatched" | "invalid" | "fetch_error";
  sourceUrl: string;
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    if (!Array.isArray(payload.records)) return [];
    return payload.records.filter((value): value is FetchRecord => {
      if (!value || typeof value !== "object") return false;
      const row = value as Partial<FetchRecord>;
      return row.status === "matched"
        && normalizeHkexCatalogTicker(String(row.symbol ?? "")) !== ""
        && typeof row.listingDate === "string"
        && typeof row.sourceUrl === "string";
    });
  } catch {
    return [];
  }
}

async function loadPublicToken(symbol: string): Promise<string> {
  const pageUrl = hkexEquityQuotePageUrl(symbol);
  const response = await fetch(pageUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HKEX token page HTTP ${response.status}`);
  const html = await response.text();
  const block = /LabCI\.getToken\s*=\s*function\s*\(\)\s*\{([\s\S]*?)\};/.exec(html)?.[1] ?? "";
  const token = [...block.matchAll(/return\s+["']([^"']+)["']/g)]
    .map((match) => match[1])
    .find((value) => value.length > 40 && value !== "Base64-AES-Encrypted-Token");
  if (!token) throw new Error("HKEX quote page did not expose its public data token");
  return decodeURIComponent(token);
}

async function fetchQuote(target: Target, token: string): Promise<FetchRecord> {
  const retrievedAt = new Date().toISOString();
  const qid = Date.now();
  const callback = `hkex_${qid}_${target.symbol}`;
  const apiUrl = new URL(HKEX_EQUITY_QUOTE_API_URL);
  apiUrl.searchParams.set("sym", target.symbol);
  apiUrl.searchParams.set("token", token);
  apiUrl.searchParams.set("lang", "eng");
  apiUrl.searchParams.set("qid", String(qid));
  apiUrl.searchParams.set("callback", callback);
  apiUrl.searchParams.set("_", String(qid + 1));
  const sourceUrl = hkexEquityQuotePageUrl(target.symbol);
  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/javascript,application/json,*/*;q=0.8",
      Referer: sourceUrl,
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HKEX ${target.symbol} HTTP ${response.status}`);
  const body = await response.text();
  const quote = parseHkexEquityQuoteJsonp(body);
  const identityMatches = quote.symbol === target.symbol;
  const eligibleEquity = !["EW", "RGHT"].includes(quote.productSubtype ?? "");
  const matched = identityMatches && eligibleEquity && quote.listingDate !== null;
  return {
    ...target,
    ...quote,
    status: matched ? "matched" : identityMatches ? "invalid" : "unmatched",
    sourceUrl,
    sourceHash: createHash("sha256").update(body).digest("hex"),
    retrievedAt,
    warnings: [
      ...(!identityMatches ? [`HKEX returned symbol ${quote.symbol} for requested ${target.symbol}`] : []),
      ...(!eligibleEquity ? [`Excluded product subtype ${quote.productSubtype}`] : []),
      ...(quote.listingDate === null ? ["HKEX profile has no valid day-precision Listing Date"] : []),
    ],
  };
}

function errorRecord(target: Target, error: unknown): FetchRecord {
  return {
    ...target,
    status: "fetch_error",
    symbol: target.symbol,
    ric: "",
    companyName: "",
    listingDate: null,
    transferOfListingDate: null,
    productType: "",
    productSubtype: null,
    primaryExchange: "",
    databaseUpdatedAt: null,
    sourceUrl: hkexEquityQuotePageUrl(target.symbol),
    sourceHash: null,
    retrievedAt: new Date().toISOString(),
    warnings: [error instanceof Error ? error.message : "Unknown HKEX fetch error"],
  };
}

async function fetchWithRetry(
  target: Target,
  initialToken: string,
): Promise<{ record: FetchRecord; token: string }> {
  let token = initialToken;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const record = await fetchQuote(target, token);
      if (record.status !== "unmatched") return { record, token };
      lastError = new Error(record.warnings.join("; ") || `HKEX did not return ${target.symbol}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) {
      await delay(attempt * 500);
      token = await loadPublicToken(target.symbol);
    }
  }
  return { record: errorRecord(target, lastError), token };
}

function outputPayload(records: readonly FetchRecord[], catalogCount: number, startedAt: string): unknown {
  const sorted = [...records].sort((a, b) => Number(a.symbol) - Number(b.symbol));
  const retrievedAt = sorted.map((record) => record.retrievedAt).sort().at(-1) ?? new Date().toISOString();
  return {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: new Date().toISOString(),
    sourceRowCount: sorted.length,
    sourcePolicy: {
      authority: "licensed_market_data",
      host: "Hong Kong Exchanges and Clearing Limited",
      profileProvider: "Refinitiv",
      sourceName: "HKEX Equities Quote company profile",
      sourceUrl: HKEX_EQUITIES_QUOTE_PAGE_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_HKEX_AND_REFINITIV_LICENSE_REVIEW",
      rawHtmlStored: false,
      rawJsonpStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: catalogCount,
      uniqueStockCodes: sorted.length,
      matched: sorted.filter((record) => record.status === "matched").length,
      unmatched: sorted.filter((record) => record.status === "unmatched").length,
      invalid: sorted.filter((record) => record.status === "invalid").length,
      fetchError: sorted.filter((record) => record.status === "fetch_error").length,
      listingDates: sorted.filter((record) => record.listingDate !== null).length,
      transferOfListingDates: sorted.filter((record) => record.transferOfListingDate !== null).length,
    },
    records: sorted,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const concurrency = Math.max(1, Math.min(8, Number(arg("concurrency") ?? 4) || 4));
  const limit = Math.max(0, Number(arg("limit") ?? 0) || 0);
  const refresh = flag("refresh");
  const stocks = getGlobalStocks()
    .filter(isResearchableStock)
    .filter((stock) => stock.market.trim().toUpperCase() === "HKEX");
  const targetsBySymbol = new Map<string, Target>();
  for (const stock of stocks) {
    const symbol = normalizeHkexCatalogTicker(stock.ticker);
    if (!symbol) continue;
    const target = targetsBySymbol.get(symbol) ?? { symbol, catalogTickers: [] };
    const ticker = stock.ticker.trim().toUpperCase();
    if (!target.catalogTickers.includes(ticker)) target.catalogTickers.push(ticker);
    targetsBySymbol.set(symbol, target);
  }
  const targets = [...targetsBySymbol.values()]
    .map((target) => ({ ...target, catalogTickers: target.catalogTickers.sort() }))
    .sort((a, b) => Number(a.symbol) - Number(b.symbol));
  const selected = limit > 0 ? targets.slice(0, limit) : targets;
  const selectedSymbols = new Set(selected.map((target) => target.symbol));
  const cached = refresh ? [] : readCache(output).filter((record) => selectedSymbols.has(record.symbol));
  const records = new Map(cached.map((record) => [record.symbol, record]));
  const pending = selected.filter((target) => !records.has(target.symbol));
  let cursor = 0;
  let completed = 0;
  const initialToken = pending.length > 0 ? await loadPublicToken(pending[0].symbol) : "";

  const checkpoint = (): void => {
    saveAtomic(output, outputPayload([...records.values()], stocks.length, startedAt));
  };

  async function worker(): Promise<void> {
    let token = initialToken;
    while (true) {
      const index = cursor;
      cursor += 1;
      const target = pending[index];
      if (!target) return;
      const result = await fetchWithRetry(target, token);
      token = result.token;
      records.set(target.symbol, result.record);
      completed += 1;
      if (completed % 25 === 0 || completed === pending.length) {
        checkpoint();
        console.log(JSON.stringify({
          completed,
          pending: pending.length,
          symbol: target.symbol,
          status: result.record.status,
        }));
      }
      await delay(120);
    }
  }

  if (pending.length > 0) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  checkpoint();
  const finalPayload = outputPayload([...records.values()], stocks.length, startedAt) as { summary: unknown };
  console.log(JSON.stringify({ output, cached: cached.length, fetched: pending.length, summary: finalPayload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
