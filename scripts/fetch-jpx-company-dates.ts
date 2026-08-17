/**
 * Fetch compact official company/listing dates from JPX Listed Company Search.
 * Raw detail HTML is parsed in memory and discarded; only normalized fields and
 * a SHA-256 response hash are staged. Existing matched records are resumable.
 */
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  JPX_DETAIL_ACTION_URL,
  JPX_LISTED_COMPANY_SEARCH_URL,
  JPX_PREFERRED_ISSUES_URL,
  JPX_SEARCH_SESSION_URL,
  jpxManagerCode,
  normalizeJpxCatalogTicker,
  parseJpxCompanyDetail,
  parseJpxPreferredIssuesHtml,
  type JpxPreferredIssueRow,
} from "../src/lib/research/jpx-company-detail";
import { securityIdOf } from "../src/lib/research/security-birth";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "jpx-company-dates.json");
const USER_AGENT = "Mozilla/5.0 bazi-investor-guide-research/1.0";

type Target = { securityId: string; ticker: string; normalizedTicker: string; managerCode: string };
type FetchRecord = Target & {
  status: "matched" | "unmatched" | "invalid" | "fetch_error";
  companyName: string;
  companyNameEnglish: string;
  isin: string;
  establishmentDate: string | null;
  listingDate: string | null;
  headOffice: string;
  sourceType?: "listed_company_search" | "preferred_issue_list";
  sourceUrl?: string;
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
    return Array.isArray(payload.records) ? payload.records as FetchRecord[] : [];
  } catch {
    return [];
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function openSession(): Promise<string> {
  const response = await fetch(JPX_SEARCH_SESSION_URL, {
    headers: { Accept: "text/html,*/*;q=0.8", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`JPX session HTTP ${response.status}`);
  await response.arrayBuffer();
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";", 1)[0].trim();
  if (!cookie.includes("=")) throw new Error("JPX session did not return a cookie");
  return cookie;
}

function decodeHtml(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (utf8.includes("上場会社詳細") || utf8.includes("検索条件入力")) return utf8;
  return new TextDecoder("shift_jis").decode(bytes);
}

async function fetchPreferredIssues(): Promise<{
  byTicker: Map<string, JpxPreferredIssueRow>;
  sourceHash: string;
  retrievedAt: string;
}> {
  const response = await fetch(JPX_PREFERRED_ISSUES_URL, {
    headers: { Accept: "text/html,*/*;q=0.8", "User-Agent": USER_AGENT },
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`JPX preferred issues HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const rows = parseJpxPreferredIssuesHtml(new TextDecoder("utf-8").decode(bytes));
  if (rows.length === 0) throw new Error("JPX preferred issues page returned no valid issue rows");
  return {
    byTicker: new Map(rows.map((row) => [row.ticker, row])),
    sourceHash: createHash("sha256").update(bytes).digest("hex"),
    retrievedAt: new Date().toISOString(),
  };
}

async function fetchDetail(target: Target, cookie: string): Promise<FetchRecord> {
  const retrievedAt = new Date().toISOString();
  const body = new URLSearchParams({
    BaseJh: "BaseJh",
    lstDspPg: "1",
    dspGs: "10",
    souKnsu: "1",
    sniMtGmnId: "JJK010010",
    dspJnKbn: "0",
    dspJnKmkNo: "0",
    mgrCd: target.managerCode,
    jjHisiFlg: "1",
  });
  const response = await fetch(JPX_DETAIL_ACTION_URL, {
    method: "POST",
    headers: {
      Accept: "text/html,*/*;q=0.8",
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: JPX_SEARCH_SESSION_URL,
      "User-Agent": USER_AGENT,
    },
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`JPX ${target.ticker} HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const html = decodeHtml(bytes);
  const detail = parseJpxCompanyDetail(html, target.managerCode);
  const sourceHash = createHash("sha256").update(bytes).digest("hex");
  const confirmed = detail.managerCode === target.managerCode;
  const matched = confirmed && detail.listingDate !== null;
  return {
    ...target,
    status: matched ? "matched" : confirmed ? "invalid" : "unmatched",
    companyName: detail.companyName,
    companyNameEnglish: detail.companyNameEnglish,
    isin: detail.isin,
    establishmentDate: detail.establishmentDate,
    listingDate: detail.listingDate,
    headOffice: detail.headOffice,
    sourceType: "listed_company_search",
    sourceUrl: JPX_LISTED_COMPANY_SEARCH_URL,
    sourceHash,
    retrievedAt,
    warnings: detail.warnings,
  };
}

async function fetchWithRetry(target: Target, initialCookie: string): Promise<{ record: FetchRecord; cookie: string }> {
  let cookie = initialCookie;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const record = await fetchDetail(target, cookie);
      if (record.status === "matched" || record.status === "invalid") return { record, cookie };
      lastError = new Error(record.warnings.join("; ") || `JPX did not return ${target.managerCode}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) {
      await delay(attempt * 400);
      cookie = await openSession();
    }
  }
  return {
    cookie,
    record: {
      ...target,
      status: "fetch_error",
      companyName: "",
      companyNameEnglish: "",
      isin: "",
      establishmentDate: null,
      listingDate: null,
      headOffice: "",
      sourceType: "listed_company_search",
      sourceUrl: JPX_LISTED_COMPANY_SEARCH_URL,
      sourceHash: null,
      retrievedAt: new Date().toISOString(),
      warnings: [lastError instanceof Error ? lastError.message : "Unknown JPX fetch error"],
    },
  };
}

function outputPayload(records: readonly FetchRecord[], startedAt: string): unknown {
  const sorted = [...records].sort((a, b) => a.securityId.localeCompare(b.securityId));
  return {
    schemaVersion: 1,
    startedAt,
    updatedAt: new Date().toISOString(),
    sourcePolicy: {
      authority: "exchange",
      sourceName: "JPX Listed Company Search",
      sourceUrl: JPX_LISTED_COMPANY_SEARCH_URL,
      supplementarySourceUrl: JPX_PREFERRED_ISSUES_URL,
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_EXCHANGE_TERMS_AND_DATA_LICENSE_REVIEW",
      rawHtmlStored: false,
      exactFirstTradeTimeAvailable: false,
    },
    summary: {
      catalog: sorted.length,
      matched: sorted.filter((record) => record.status === "matched").length,
      unmatched: sorted.filter((record) => record.status === "unmatched").length,
      invalid: sorted.filter((record) => record.status === "invalid").length,
      fetchError: sorted.filter((record) => record.status === "fetch_error").length,
      establishmentDates: sorted.filter((record) => record.establishmentDate !== null).length,
      listingDates: sorted.filter((record) => record.listingDate !== null).length,
    },
    records: sorted,
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const concurrency = Math.max(1, Math.min(12, Number(arg("concurrency") ?? 6) || 6));
  const limit = Math.max(0, Number(arg("limit") ?? 0) || 0);
  const tickerFilter = arg("ticker")?.trim().toUpperCase();
  const refresh = flag("refresh");
  const stocks = getGlobalStocks()
    .filter(isResearchableStock)
    .filter((stock) => stock.market.trim().toUpperCase() === "TSE");
  const targets: Target[] = stocks.map((stock) => ({
    securityId: securityIdOf("TSE", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    normalizedTicker: normalizeJpxCatalogTicker(stock.ticker),
    managerCode: jpxManagerCode(stock.ticker),
  })).sort((a, b) => a.securityId.localeCompare(b.securityId));
  const filtered = tickerFilter
    ? targets.filter((target) => target.ticker === tickerFilter || target.normalizedTicker === normalizeJpxCatalogTicker(tickerFilter))
    : targets;
  if (tickerFilter && filtered.length === 0) throw new Error(`JPX catalog ticker not found: ${tickerFilter}`);
  const selected = limit > 0 ? filtered.slice(0, limit) : filtered;
  const selectedIds = new Set(selected.map((target) => target.securityId));
  const existing = readCache(output);
  const preserved = tickerFilter ? existing.filter((record) => !selectedIds.has(record.securityId)) : [];
  const cached = refresh ? [] : existing.filter((record) => selectedIds.has(record.securityId) && record.status === "matched");
  const records = new Map([...preserved, ...cached].map((record) => [record.securityId, record]));
  const pending = selected.filter((target) => !records.has(target.securityId));
  const preferredSnapshot = pending.some((target) => /^\d{5}$/.test(target.normalizedTicker))
    ? await fetchPreferredIssues().catch((error) => {
        console.warn(error instanceof Error ? error.message : "JPX preferred issues fetch failed");
        return null;
      })
    : null;
  let cursor = 0;
  let completed = 0;

  const checkpoint = (): void => {
    saveAtomic(output, outputPayload([...records.values()], startedAt));
  };

  async function worker(): Promise<void> {
    let cookie: string | null = null;
    while (true) {
      const index = cursor;
      cursor += 1;
      const target = pending[index];
      if (!target) return;
      const preferred = preferredSnapshot?.byTicker.get(target.normalizedTicker);
      let record: FetchRecord;
      if (preferred && preferredSnapshot) {
        record = {
          ...target,
          status: "matched",
          companyName: preferred.issueName,
          companyNameEnglish: preferred.issueName,
          isin: "",
          establishmentDate: null,
          listingDate: preferred.listingDate,
          headOffice: "",
          sourceType: "preferred_issue_list",
          sourceUrl: JPX_PREFERRED_ISSUES_URL,
          sourceHash: preferredSnapshot.sourceHash,
          retrievedAt: preferredSnapshot.retrievedAt,
          warnings: preferred.marketSegment ? [`JPX market segment: ${preferred.marketSegment}`] : [],
        };
      } else {
        cookie ??= await openSession();
        const result = await fetchWithRetry(target, cookie);
        cookie = result.cookie;
        record = result.record;
      }
      records.set(target.securityId, record);
      completed += 1;
      if (completed % 20 === 0 || completed === pending.length) {
        checkpoint();
        console.log(JSON.stringify({ completed, pending: pending.length, ticker: target.ticker, status: record.status }));
      }
      await delay(80);
    }
  }

  if (pending.length > 0) await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
  checkpoint();
  const finalPayload = outputPayload([...records.values()], startedAt) as { summary: unknown };
  console.log(JSON.stringify({ output, cached: cached.length, fetched: pending.length, summary: finalPayload.summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
