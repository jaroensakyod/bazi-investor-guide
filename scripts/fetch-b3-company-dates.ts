/**
 * Fetch compact issuer-level listing dates from B3 Listed Companies.
 *
 * GetInitialCompanies supplies `dateListing`; GetDetail confirms the exact B3
 * security codes belonging to that issuer. Odd-lot codes ending in F are not
 * treated as separate securities. Raw API responses are hashed and discarded.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  B3_LISTED_COMPANIES_API_BASE,
  B3_LISTED_COMPANIES_PAGE_URL,
  b3CompanyDetailUrl,
  b3IssuerCodeFromTicker,
  normalizeB3CatalogTicker,
  parseB3ListingDate,
  parseB3QuotationDate,
} from "../src/lib/research/b3-listed-company";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "b3-company-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";
const PAGE_SIZE = 120;

type Target = {
  issuingCompany: string;
  catalogTickers: string[];
};

type InitialRow = {
  codeCVM?: unknown;
  issuingCompany?: unknown;
  companyName?: unknown;
  tradingName?: unknown;
  dateListing?: unknown;
  status?: unknown;
  type?: unknown;
  market?: unknown;
};

type InitialPayload = {
  page?: { pageNumber?: unknown; pageSize?: unknown; totalRecords?: unknown; totalPages?: unknown };
  results?: InitialRow[];
};

type DetailPayload = {
  issuingCompany?: unknown;
  companyName?: unknown;
  tradingName?: unknown;
  codeCVM?: unknown;
  code?: unknown;
  otherCodes?: Array<{ code?: unknown; isin?: unknown }>;
  dateQuotation?: unknown;
  market?: unknown;
};

type FetchRecord = Target & {
  status: "matched" | "unmatched" | "ambiguous" | "invalid" | "fetch_error";
  codeCvm: string;
  companyName: string;
  tradingName: string;
  listingDate: string | null;
  quotationDate: string | null;
  codes: string[];
  market: string;
  sourceUrl: string | null;
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
        && typeof row.issuingCompany === "string"
        && typeof row.listingDate === "string"
        && Array.isArray(row.codes);
    });
  } catch {
    return [];
  }
}

function apiUrl(operation: "GetInitialCompanies" | "GetDetail", payload: unknown): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return `${B3_LISTED_COMPANIES_API_BASE}/${operation}/${encoded}`;
}

async function fetchJson(url: string): Promise<{ body: string; payload: unknown }> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json,*/*;q=0.8",
      Referer: B3_LISTED_COMPANIES_PAGE_URL,
      "User-Agent": USER_AGENT,
    },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`B3 HTTP ${response.status}`);
  const body = await response.text();
  return { body, payload: JSON.parse(body) as unknown };
}

async function fetchInitialPage(pageNumber: number): Promise<InitialPayload> {
  const { payload } = await fetchJson(apiUrl("GetInitialCompanies", {
    language: "en-us",
    pageNumber,
    pageSize: PAGE_SIZE,
  }));
  if (!payload || typeof payload !== "object") throw new Error(`B3 initial page ${pageNumber} is invalid`);
  return payload as InitialPayload;
}

function initialPageCount(payload: InitialPayload): number {
  const totalPages = Number(payload.page?.totalPages);
  if (!Number.isInteger(totalPages) || totalPages < 1 || totalPages > 1_000) {
    throw new Error("B3 initial company response has an invalid totalPages");
  }
  return totalPages;
}

function initialSourceRowCount(payload: InitialPayload): number {
  const totalRecords = Number(payload.page?.totalRecords);
  if (!Number.isInteger(totalRecords) || totalRecords < 1) {
    throw new Error("B3 initial company response has an invalid totalRecords");
  }
  return totalRecords;
}

async function loadInitialRows(): Promise<{ rows: InitialRow[]; sourceRowCount: number }> {
  const first = await fetchInitialPage(1);
  const totalPages = initialPageCount(first);
  const pages: InitialPayload[] = [first];
  const concurrency = 6;
  for (let start = 2; start <= totalPages; start += concurrency) {
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, totalPages - start + 1) },
      (_, index) => start + index,
    );
    pages.push(...await Promise.all(pageNumbers.map(async (pageNumber) => {
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          return await fetchInitialPage(pageNumber);
        } catch (error) {
          lastError = error;
          if (attempt < 3) await delay(attempt * 400);
        }
      }
      throw lastError instanceof Error ? lastError : new Error(`B3 page ${pageNumber} failed`);
    })));
  }
  return {
    rows: pages.flatMap((page) => Array.isArray(page.results) ? page.results : []),
    sourceRowCount: initialSourceRowCount(first),
  };
}

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanSecurityCode(value: unknown): string {
  const code = cleanText(value).toUpperCase();
  return /^[A-Z0-9]{5,10}$/.test(code) ? code : "";
}

async function fetchDetail(target: Target, row: InitialRow): Promise<FetchRecord> {
  const retrievedAt = new Date().toISOString();
  const codeCvm = cleanText(row.codeCVM);
  const issuingCompany = cleanText(row.issuingCompany).toUpperCase();
  if (issuingCompany !== target.issuingCompany || !/^\d{3,9}$/.test(codeCvm)) {
    throw new Error("B3 initial row identity does not match the catalog issuer target");
  }
  const listingDate = parseB3ListingDate(row.dateListing);
  const { body, payload } = await fetchJson(apiUrl("GetDetail", { codeCVM: codeCvm, language: "en-us" }));
  if (!payload || typeof payload !== "object") throw new Error(`B3 ${issuingCompany} detail is invalid`);
  const detail = payload as DetailPayload;
  const detailIssuer = cleanText(detail.issuingCompany).toUpperCase();
  const detailCodeCvm = cleanText(detail.codeCVM);
  const codes = [...new Set([
    cleanSecurityCode(detail.code),
    ...(Array.isArray(detail.otherCodes) ? detail.otherCodes.map((item) => cleanSecurityCode(item.code)) : []),
  ].filter(Boolean))].sort();
  const confirmedCatalogCodes = target.catalogTickers.filter((ticker) => codes.includes(ticker));
  const identityMatches = detailIssuer === issuingCompany && detailCodeCvm === codeCvm;
  const matched = identityMatches && listingDate !== null && confirmedCatalogCodes.length > 0;
  return {
    ...target,
    status: matched ? "matched" : identityMatches ? "invalid" : "unmatched",
    codeCvm,
    companyName: cleanText(detail.companyName || row.companyName),
    tradingName: cleanText(detail.tradingName || row.tradingName),
    listingDate,
    quotationDate: parseB3QuotationDate(detail.dateQuotation),
    codes,
    market: cleanText(detail.market || row.market),
    sourceUrl: b3CompanyDetailUrl(codeCvm, issuingCompany),
    sourceHash: createHash("sha256").update(JSON.stringify(row)).update(body).digest("hex"),
    retrievedAt,
    warnings: [
      ...(!identityMatches ? ["B3 GetDetail identity differs from the initial company row"] : []),
      ...(listingDate === null ? ["B3 dateListing is missing, invalid or uses the 31/12/9999 sentinel"] : []),
      ...(confirmedCatalogCodes.length === 0 ? ["No exact non-odd-lot catalog code appears in B3 GetDetail"] : []),
    ],
  };
}

function emptyRecord(
  target: Target,
  status: FetchRecord["status"],
  warning: string,
): FetchRecord {
  return {
    ...target,
    status,
    codeCvm: "",
    companyName: "",
    tradingName: "",
    listingDate: null,
    quotationDate: null,
    codes: [],
    market: "",
    sourceUrl: null,
    sourceHash: null,
    retrievedAt: new Date().toISOString(),
    warnings: [warning],
  };
}

async function fetchWithRetry(target: Target, row: InitialRow): Promise<FetchRecord> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await fetchDetail(target, row);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await delay(attempt * 500);
    }
  }
  return emptyRecord(target, "fetch_error", lastError instanceof Error ? lastError.message : "Unknown B3 fetch error");
}

function outputPayload(
  records: readonly FetchRecord[],
  sourceRowCount: number,
  catalogCount: number,
  oddLotAliasCount: number,
  startedAt: string,
): unknown {
  const sorted = [...records].sort((a, b) => a.issuingCompany.localeCompare(b.issuingCompany) || a.codeCvm.localeCompare(b.codeCvm));
  const retrievedAt = sorted.map((record) => record.retrievedAt).sort().at(-1) ?? new Date().toISOString();
  const confirmedCodes = new Set(sorted.flatMap((record) => record.catalogTickers.filter((ticker) => record.codes.includes(ticker))));
  return {
    schemaVersion: 1,
    startedAt,
    retrievedAt,
    updatedAt: new Date().toISOString(),
    sourceRowCount,
    sourcePolicy: {
      authority: "exchange",
      sourceName: "B3 Listed Companies",
      sourceUrl: B3_LISTED_COMPANIES_PAGE_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_B3_TERMS_AND_DATA_LICENSE_REVIEW",
      issuerLevelDate: true,
      exactSecurityCodeConfirmedByGetDetail: true,
      oddLotCodesExcluded: true,
      rawJsonStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: catalogCount,
      oddLotAliasesExcluded: oddLotAliasCount,
      issuerTargets: new Set(sorted.map((record) => record.issuingCompany)).size,
      matchedIssuerRows: sorted.filter((record) => record.status === "matched").length,
      unmatchedIssuerRows: sorted.filter((record) => record.status === "unmatched").length,
      ambiguousIssuerRows: sorted.filter((record) => record.status === "ambiguous").length,
      invalidIssuerRows: sorted.filter((record) => record.status === "invalid").length,
      fetchError: sorted.filter((record) => record.status === "fetch_error").length,
      confirmedCatalogCodes: confirmedCodes.size,
      listingDates: sorted.filter((record) => record.listingDate !== null).length,
      quotationDatesContextOnly: sorted.filter((record) => record.quotationDate !== null).length,
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
    .filter((stock) => stock.market.trim().toUpperCase() === "BOVESPA");
  const oddLotAliasCount = stocks.filter((stock) => normalizeB3CatalogTicker(stock.ticker).endsWith("F")).length;
  const targetMap = new Map<string, Target>();
  for (const stock of stocks) {
    const ticker = normalizeB3CatalogTicker(stock.ticker);
    if (ticker.endsWith("F")) continue;
    const issuingCompany = b3IssuerCodeFromTicker(ticker);
    if (!issuingCompany) continue;
    const target = targetMap.get(issuingCompany) ?? { issuingCompany, catalogTickers: [] };
    if (!target.catalogTickers.includes(ticker)) target.catalogTickers.push(ticker);
    targetMap.set(issuingCompany, target);
  }
  const targets = [...targetMap.values()]
    .map((target) => ({ ...target, catalogTickers: target.catalogTickers.sort() }))
    .sort((a, b) => a.issuingCompany.localeCompare(b.issuingCompany));
  const selected = limit > 0 ? targets.slice(0, limit) : targets;
  const { rows, sourceRowCount } = await loadInitialRows();
  const rowsByIssuer = new Map<string, InitialRow[]>();
  for (const row of rows) {
    const issuingCompany = cleanText(row.issuingCompany).toUpperCase();
    if (!targetMap.has(issuingCompany) || cleanText(row.status).toUpperCase() !== "A" || cleanText(row.type) !== "1") continue;
    const current = rowsByIssuer.get(issuingCompany) ?? [];
    current.push(row);
    rowsByIssuer.set(issuingCompany, current);
  }
  const cachedRows = refresh ? [] : readCache(output);
  const cached = new Map(cachedRows.map((record) => [record.issuingCompany, record]));
  const records = new Map<string, FetchRecord[]>();
  const pending: Array<{ target: Target; row: InitialRow }> = [];
  for (const target of selected) {
    const cache = cached.get(target.issuingCompany);
    if (cache && target.catalogTickers.every((ticker) => cache.catalogTickers.includes(ticker))) {
      records.set(target.issuingCompany, [cache]);
      continue;
    }
    const candidates = rowsByIssuer.get(target.issuingCompany) ?? [];
    if (candidates.length === 0) {
      records.set(target.issuingCompany, [emptyRecord(target, "unmatched", "Issuer code is absent from active type-1 B3 Listed Companies rows")]);
      continue;
    }
    for (const row of candidates) pending.push({ target, row });
  }
  let cursor = 0;
  let completed = 0;

  const checkpoint = (): void => {
    saveAtomic(output, outputPayload(
      [...records.values()].flat(),
      sourceRowCount,
      stocks.length,
      oddLotAliasCount,
      startedAt,
    ));
  };

  async function worker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      const item = pending[index];
      if (!item) return;
      const record = await fetchWithRetry(item.target, item.row);
      const current = records.get(item.target.issuingCompany) ?? [];
      current.push(record);
      records.set(item.target.issuingCompany, current);
      completed += 1;
      if (completed % 20 === 0 || completed === pending.length) {
        checkpoint();
        console.log(JSON.stringify({
          completed,
          pending: pending.length,
          issuer: item.target.issuingCompany,
          status: record.status,
        }));
      }
      await delay(100);
    }
  }

  if (pending.length > 0) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  checkpoint();
  const finalPayload = outputPayload(
    [...records.values()].flat(),
    sourceRowCount,
    stocks.length,
    oddLotAliasCount,
    startedAt,
  ) as { summary: unknown };
  console.log(JSON.stringify({
    output,
    cached: [...records.values()].flat().length - pending.length,
    fetched: pending.length,
    summary: finalPayload.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
