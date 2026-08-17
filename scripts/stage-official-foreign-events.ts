/**
 * Stage and optionally import bulk official listing dates from exchange files.
 *
 * Supported sources:
 * - TWSE OpenAPI listed-company basic information
 * - NSE equity, REIT and InvIT security lists
 * - SSE Main Board, STAR and B-share security lists
 * - SZSE paginated A-share list or a normalized official XLSX bridge
 * - JPX normalized Listed Company Search details (prepared by research:fetch-jpx-dates)
 * - LSE normalized instrument reference data (prepared by research:fetch-lse-dates)
 * - KRX KIND bulk listed-company file
 * - ASX Company Directory CSV
 * - PSE EDGE paginated Company List
 * - Saudi Exchange normalized Company Profile snapshot
 * - Indonesia Stock Exchange normalized Listed Company Profiles snapshot
 * - Vietnam HOSE/HNX normalized official listed-stock snapshot
 * - Singapore Exchange normalized Corporate Information snapshot
 * - HKEX-hosted equity profile snapshot (company-profile data supplied by Refinitiv)
 * - B3 Listed Companies issuer dates with exact security-code confirmation
 * - PSX annual Listings History with current-directory identity confirmation
 * - SIX IPO History plus Blue-Chip, Domestic, Foreign and Sponsored Foreign Shares reference data
 * - Deutsche Börse New Companies / Primary Market Statistics
 * - Deutsche Börse Xetra current All Tradable Instruments reference data
 * - TSX current Listed Companies workbook with current-instrument confirmation
 * - Borsa Istanbul current-code First Trading Date workbook
 * - JSE Client Portal exact-instrument ListingDate records
 *
 * Examples:
 *   npm run research:stage-official-foreign-events
 *   npm run research:stage-official-foreign-events -- --twse-input=tmp/twse.json --nse-equity-input=tmp/equity.csv --nse-reit-input=tmp/reit.csv --nse-invit-input=tmp/invit.csv --szse-input=tmp/szse.normalized.json --apply
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  ASX_COMPANY_DIRECTORY_CSV_URL,
  ASX_COMPANY_DIRECTORY_PAGE_URL,
  matchAsxOfficialDates,
  parseAsxCompanyDirectory,
} from "../src/lib/research/asx-company-directory";
import {
  B3_LISTED_COMPANIES_PAGE_URL,
  matchB3OfficialDates,
  parseB3CompanyDatePayload,
} from "../src/lib/research/b3-listed-company";
import {
  BIST_MARKET_DATA_PAGE_URL,
  matchBistOfficialDates,
  parseBistFirstTradingDatePayload,
} from "../src/lib/research/bist-first-trading-date";
import {
  JPX_LISTED_COMPANY_SEARCH_URL,
  matchJpxOfficialDates,
  parseJpxCompanyDatePayload,
} from "../src/lib/research/jpx-company-detail";
import {
  JSE_LISTED_COMPANIES_URL,
  matchJseOfficialDates,
  parseJseInstrumentListingPayload,
} from "../src/lib/research/jse-instrument-listing";
import {
  IDX_LISTED_COMPANY_PROFILES_URL,
  matchIdxOfficialDates,
  parseIdxCompanyDatePayload,
  parseIdxOfficialDateSupplements,
} from "../src/lib/research/idx-company-profile";
import {
  HKEX_EQUITIES_QUOTE_PAGE_URL,
  matchHkexOfficialDates,
  parseHkexCompanyDatePayload,
} from "../src/lib/research/hkex-equity-profile";
import {
  LSE_ISSUER_PROFILE_HELP_URL,
  matchLseOfficialDates,
  parseLseInstrumentDatePayload,
} from "../src/lib/research/lse-instrument-data";
import {
  KRX_KIND_COMPANY_LIST_PAGE_URL,
  KRX_KIND_COMPANY_LIST_URL,
  matchKrxOfficialDates,
  parseKrxKindCompanyList,
} from "../src/lib/research/krx-kind-company-list";
import {
  NSE_EQUITY_LIST_URL,
  NSE_INVIT_LIST_URL,
  NSE_REIT_LIST_URL,
  matchNseOfficialDates,
  parseNseOfficialDateSupplements,
  parseNseSecurityList,
} from "../src/lib/research/nse-security-list";
import {
  PSE_COMPANY_DIRECTORY_PAGE_URL,
  matchPseOfficialDates,
  parsePseCompanyDirectory,
  parsePseDirectoryPageCount,
  pseCompanyDirectorySearchUrl,
} from "../src/lib/research/pse-company-directory";
import {
  PSX_LISTINGS_HISTORY_PAGE_URL,
  matchPsxOfficialDates,
  parsePsxListingDatePayload,
} from "../src/lib/research/psx-listing-history";
import {
  SGX_CORPORATE_INFORMATION_URL,
  matchSgxOfficialDates,
  parseSgxCorporateDatePayload,
} from "../src/lib/research/sgx-corporate-information";
import {
  SIX_IPO_HISTORY_PAGE_URL,
  SIX_SPONSORED_FOREIGN_SHARES_RECENT_CSV_URL,
  matchSixOfficialDates,
  parseSixListingDatePayload,
} from "../src/lib/research/six-listing-history";
import {
  loadSecurityEventFile,
  mergeSecurityEventsConflictSafe,
  saveSecurityEventFile,
} from "../src/lib/research/security-event-store";
import type { SecurityEvent } from "../src/lib/research/security-birth";
import {
  SSE_SECURITY_LIST_PAGE_URL,
  matchSseOfficialDates,
  parseSseSecurityList,
  sseSecurityListApiUrl,
} from "../src/lib/research/sse-security-list";
import {
  SZSE_SECURITY_LIST_PAGE_URL,
  matchSzseOfficialDates,
  parseSzseSecurityList,
  szseSecurityListApiUrl,
  type SzseSecurityListTab,
} from "../src/lib/research/szse-security-list";
import {
  TADAWUL_ISSUER_DIRECTORY_URL,
  matchTadawulOfficialDates,
  parseTadawulCompanyDatePayload,
} from "../src/lib/research/tadawul-company-profile";
import {
  HOSE_LISTED_STOCKS_URL,
  matchVietnamOfficialDates,
  parseVietnamCompanyDatePayload,
} from "../src/lib/research/vietnam-exchange-company-dates";
import {
  TWSE_COMPANY_BASIC_URL,
  matchTwseOfficialDates,
  parseTwseCompanyBasic,
  parseTwseOfficialDateSupplements,
} from "../src/lib/research/twse-company-basic";
import {
  TSX_LISTED_COMPANY_DIRECTORY_URL,
  matchTsxOfficialDates,
  parseTsxListedCompanyPayload,
} from "../src/lib/research/tsx-listed-company";
import {
  TSX_NEW_COMPANY_LISTINGS_URL,
  matchTsxBulletinOfficialDates,
  parseTsxExchangeBulletinPayload,
} from "../src/lib/research/tsx-exchange-bulletin";
import {
  XETRA_NEW_COMPANIES_PAGE_URL,
  matchXetraOfficialDates,
  parseXetraPrimaryMarketPayload,
} from "../src/lib/research/xetra-primary-market";
import {
  XETRA_TRADABLE_INSTRUMENTS_PAGE_URL,
  combineXetraDateRecords,
  matchXetraInstrumentDates,
  parseXetraInstrumentReferencePayload,
} from "../src/lib/research/xetra-instrument-reference";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "official-foreign-security-events.json");
const NSE_OFFICIAL_SUPPLEMENTS = path.join(ROOT, "data", "curated", "nse-official-listing-date-supplements.json");
const IDX_OFFICIAL_SUPPLEMENTS = path.join(ROOT, "data", "curated", "idx-official-listing-date-supplements.json");
const TWSE_OFFICIAL_SUPPLEMENTS = path.join(ROOT, "data", "curated", "twse-official-listing-date-supplements.json");

type SourceFile = {
  key: "twse" | "nse_equity" | "nse_reit" | "nse_invit" | "sse_mainboard" | "sse_star" | "sse_bshare" | "szse" | "jpx" | "lse" | "krx" | "asx" | "pse" | "tadawul" | "idx" | "vietnam" | "sgx" | "hkex" | "b3" | "psx" | "six" | "xetra" | "xetra_instrument" | "tsx" | "tsx_bulletin" | "bist" | "jse";
  name: string;
  url: string;
  inputArg: string;
  bytes: Buffer;
  sha256: string;
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

async function loadSource(
  key: SourceFile["key"],
  name: string,
  url: string,
  inputArg: string,
): Promise<SourceFile> {
  const input = arg(inputArg);
  let bytes: Buffer;
  if (input) {
    bytes = readFileSync(path.resolve(input));
  } else {
    let downloaded: Buffer | null = null;
    let lastError: unknown = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: key === "twse" || key === "szse" || key === "jpx" || key === "lse" || key === "vietnam" || key === "sgx" || key === "hkex" || key === "b3" || key === "psx" || key === "six" || key === "xetra" || key === "xetra_instrument" || key === "tsx" || key.startsWith("sse_")
              ? "application/json,*/*;q=0.8"
              : key === "krx" ? "application/vnd.ms-excel,text/html,*/*;q=0.8" : "text/csv,*/*;q=0.8",
            "User-Agent": "Mozilla/5.0 bazi-investor-guide-research/1.0",
            ...(key.startsWith("nse_") ? { Referer: "https://www.nseindia.com/" } : {}),
            ...(key.startsWith("sse_") ? { Referer: SSE_SECURITY_LIST_PAGE_URL } : {}),
            ...(key === "szse" ? { Referer: SZSE_SECURITY_LIST_PAGE_URL } : {}),
            ...(key === "krx" ? { Referer: KRX_KIND_COMPANY_LIST_PAGE_URL } : {}),
            ...(key === "asx" ? { Origin: "https://www.asx.com.au", Referer: ASX_COMPANY_DIRECTORY_PAGE_URL } : {}),
            ...(key === "pse" ? { Referer: PSE_COMPANY_DIRECTORY_PAGE_URL } : {}),
          },
          redirect: "follow",
          signal: AbortSignal.timeout(45_000),
        });
        if (!response.ok) throw new Error(`${name} HTTP ${response.status}`);
        downloaded = Buffer.from(await response.arrayBuffer());
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
    if (!downloaded) {
      throw lastError instanceof Error ? lastError : new Error(`${name} download failed`);
    }
    bytes = downloaded;
  }
  return {
    key,
    name,
    url,
    inputArg: input ? path.resolve(input) : "downloaded",
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function szsePageCount(payload: unknown, tabKey: SzseSecurityListTab): number {
  if (!Array.isArray(payload)) throw new Error("SZSE first page must be a ShowReport array");
  for (const value of payload) {
    if (!value || typeof value !== "object") continue;
    const report = value as { metadata?: { tabkey?: unknown; pagecount?: unknown } };
    if (String(report.metadata?.tabkey ?? "") !== tabKey) continue;
    const count = Number(report.metadata?.pagecount);
    if (Number.isInteger(count) && count >= 1 && count <= 1_000) return count;
  }
  throw new Error(`SZSE first page is missing a valid ${tabKey} pagecount`);
}

async function fetchSzsePage(tabKey: SzseSecurityListTab, pageNo: number): Promise<unknown> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(szseSecurityListApiUrl(pageNo, tabKey), {
        headers: {
          Accept: "application/json,*/*;q=0.8",
          Referer: SZSE_SECURITY_LIST_PAGE_URL,
          "User-Agent": "Mozilla/5.0 bazi-investor-guide-research/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`SZSE ${tabKey} page ${pageNo} HTTP ${response.status}`);
      return JSON.parse(await response.text()) as unknown;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`SZSE ${tabKey} page ${pageNo} failed`);
}

async function fetchSzseTab(tabKey: SzseSecurityListTab): Promise<{ pages: unknown[]; totalPages: number }> {
  const firstPage = await fetchSzsePage(tabKey, 1);
  const totalPages = szsePageCount(firstPage, tabKey);
  const pages: unknown[] = [firstPage];
  const concurrency = 8;
  for (let first = 2; first <= totalPages; first += concurrency) {
    const pageNumbers = Array.from(
      { length: Math.min(concurrency, totalPages - first + 1) },
      (_, index) => first + index,
    );
    pages.push(...await Promise.all(pageNumbers.map((pageNo) => fetchSzsePage(tabKey, pageNo))));
  }
  return { pages, totalPages };
}

async function loadSzseSource(): Promise<SourceFile> {
  const input = arg("szse-input");
  if (input) {
    return loadSource("szse", "SZSE A/B-share lists", SZSE_SECURITY_LIST_PAGE_URL, "szse-input");
  }

  const [aShares, bShares] = await Promise.all([fetchSzseTab("tab1"), fetchSzseTab("tab2")]);
  const pages = [...aShares.pages, ...bShares.pages];
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, pages }), "utf8");
  return {
    key: "szse",
    name: "SZSE A/B-share lists",
    url: SZSE_SECURITY_LIST_PAGE_URL,
    inputArg: `downloaded (${aShares.totalPages} A-share + ${bShares.totalPages} B-share JSON pages)`,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

async function fetchPsePage(pageNo: number): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(pseCompanyDirectorySearchUrl(pageNo), {
        headers: {
          Accept: "text/html,*/*;q=0.8",
          Referer: PSE_COMPANY_DIRECTORY_PAGE_URL,
          "User-Agent": "Mozilla/5.0 bazi-investor-guide-research/1.0",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`PSE EDGE page ${pageNo} HTTP ${response.status}`);
      return response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 300));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`PSE EDGE page ${pageNo} failed`);
}

async function loadPseSource(): Promise<SourceFile> {
  const input = arg("pse-input");
  if (input) {
    return loadSource("pse", "PSE EDGE Company List", PSE_COMPANY_DIRECTORY_PAGE_URL, "pse-input");
  }

  const firstPage = await fetchPsePage(1);
  const totalPages = parsePseDirectoryPageCount(firstPage);
  const remaining = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) => fetchPsePage(index + 2)),
  );
  const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, pages: [firstPage, ...remaining] }), "utf8");
  return {
    key: "pse",
    name: "PSE EDGE Company List",
    url: PSE_COMPANY_DIRECTORY_PAGE_URL,
    inputArg: `downloaded (${totalPages} HTML pages)`,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function parsePseSource(bytes: Buffer): ReturnType<typeof parsePseCompanyDirectory> {
  const text = bytes.toString("utf8");
  try {
    return parsePseCompanyDirectory(JSON.parse(text) as unknown);
  } catch (error) {
    if (text.includes("<table") || text.includes("cmDetail(")) return parsePseCompanyDirectory(text);
    throw error;
  }
}

function applyWithoutDateConflicts(incoming: readonly SecurityEvent[]): {
  appliedAt: string;
  added: number;
  alreadyPresent: number;
  refreshed: number;
  correctedDates: number;
  conflicts: Array<{ securityId: string; kind: SecurityEvent["kind"]; incomingDate: string; existingDates: string[] }>;
} {
  const current = loadSecurityEventFile();
  const result = mergeSecurityEventsConflictSafe(current.events, incoming, {
    supersededSourceUrls: [SIX_SPONSORED_FOREIGN_SHARES_RECENT_CSV_URL],
  });
  if (result.added > 0 || result.refreshed > 0) saveSecurityEventFile(result.events);
  return {
    appliedAt: new Date().toISOString(),
    added: result.added,
    alreadyPresent: result.alreadyPresent,
    refreshed: result.refreshed,
    correctedDates: result.correctedDates,
    conflicts: result.conflicts,
  };
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const [twseSource, nseEquity, nseReit, nseInvit, sseMainboard, sseStar, sseBshare, szseSource, krxSource, asxSource, pseSource] = await Promise.all([
    loadSource("twse", "TWSE Listed Company Basic Information", TWSE_COMPANY_BASIC_URL, "twse-input"),
    loadSource("nse_equity", "NSE Securities available for Equity segment", NSE_EQUITY_LIST_URL, "nse-equity-input"),
    loadSource("nse_reit", "NSE Units available for REITs", NSE_REIT_LIST_URL, "nse-reit-input"),
    loadSource("nse_invit", "NSE Units available for InvITs", NSE_INVIT_LIST_URL, "nse-invit-input"),
    loadSource("sse_mainboard", "SSE Main Board A-share list", sseSecurityListApiUrl("1"), "sse-mainboard-input"),
    loadSource("sse_star", "SSE STAR Market list", sseSecurityListApiUrl("8"), "sse-star-input"),
    loadSource("sse_bshare", "SSE B-share list", sseSecurityListApiUrl("2"), "sse-bshare-input"),
    loadSzseSource(),
    loadSource("krx", "KRX KIND Listed Companies", KRX_KIND_COMPANY_LIST_URL, "krx-input"),
    loadSource("asx", "ASX Company Directory CSV", ASX_COMPANY_DIRECTORY_CSV_URL, "asx-input"),
    loadPseSource(),
  ]);

  const stocks = getGlobalStocks().filter(isResearchableStock);
  const jpxSource = arg("jpx-input")
    ? await loadSource("jpx", "JPX Listed Company Search details", JPX_LISTED_COMPANY_SEARCH_URL, "jpx-input")
    : null;
  const lseSource = arg("lse-input")
    ? await loadSource("lse", "LSE instrument reference data", LSE_ISSUER_PROFILE_HELP_URL, "lse-input")
    : null;
  const tadawulSource = arg("tadawul-input")
    ? await loadSource("tadawul", "Saudi Exchange Company Profile snapshot", TADAWUL_ISSUER_DIRECTORY_URL, "tadawul-input")
    : null;
  const idxSource = arg("idx-input")
    ? await loadSource("idx", "IDX Listed Company Profiles snapshot", IDX_LISTED_COMPANY_PROFILES_URL, "idx-input")
    : null;
  const vietnamSource = arg("vietnam-input")
    ? await loadSource("vietnam", "HOSE/HNX official listed-stock snapshot", HOSE_LISTED_STOCKS_URL, "vietnam-input")
    : null;
  const sgxSource = arg("sgx-input")
    ? await loadSource("sgx", "SGX Corporate Information snapshot", SGX_CORPORATE_INFORMATION_URL, "sgx-input")
    : null;
  const hkexSource = arg("hkex-input")
    ? await loadSource("hkex", "HKEX Equities Quote company-profile snapshot", HKEX_EQUITIES_QUOTE_PAGE_URL, "hkex-input")
    : null;
  const b3Source = arg("b3-input")
    ? await loadSource("b3", "B3 Listed Companies snapshot", B3_LISTED_COMPANIES_PAGE_URL, "b3-input")
    : null;
  const psxSource = arg("psx-input")
    ? await loadSource("psx", "PSX Listings History snapshot", PSX_LISTINGS_HISTORY_PAGE_URL, "psx-input")
    : null;
  const sixSource = arg("six-input")
    ? await loadSource("six", "SIX listing-date snapshot", SIX_IPO_HISTORY_PAGE_URL, "six-input")
    : null;
  const xetraSource = arg("xetra-input")
    ? await loadSource("xetra", "Deutsche Börse Primary Market Statistics snapshot", XETRA_NEW_COMPANIES_PAGE_URL, "xetra-input")
    : null;
  const xetraInstrumentSource = arg("xetra-instrument-input")
    ? await loadSource("xetra_instrument", "Deutsche Börse Xetra instrument-reference snapshot", XETRA_TRADABLE_INSTRUMENTS_PAGE_URL, "xetra-instrument-input")
    : null;
  const tsxSource = arg("tsx-input")
    ? await loadSource("tsx", "TSX current listed-company snapshot", TSX_LISTED_COMPANY_DIRECTORY_URL, "tsx-input")
    : null;
  const tsxBulletinSource = arg("tsx-bulletin-input")
    ? await loadSource("tsx_bulletin", "TSX exact-security Exchange Bulletin snapshot", TSX_NEW_COMPANY_LISTINGS_URL, "tsx-bulletin-input")
    : null;
  const bistSource = arg("bist-input")
    ? await loadSource("bist", "Borsa Istanbul first-trading-date snapshot", BIST_MARKET_DATA_PAGE_URL, "bist-input")
    : null;
  const jseSource = arg("jse-input")
    ? await loadSource("jse", "JSE current instrument listing-date snapshot", JSE_LISTED_COMPANIES_URL, "jse-input")
    : null;
  const twseRecords = matchTwseOfficialDates(
    stocks,
    [
      ...parseTwseCompanyBasic(JSON.parse(twseSource.bytes.toString("utf8")) as unknown),
      ...parseTwseOfficialDateSupplements(JSON.parse(readFileSync(TWSE_OFFICIAL_SUPPLEMENTS, "utf8")) as unknown),
    ],
    generatedAt,
  );
  const nseRows = [
    ...[nseEquity, nseReit, nseInvit].flatMap((source) =>
      parseNseSecurityList(source.bytes.toString("utf8"), source.name, source.url),
    ),
    ...parseNseOfficialDateSupplements(JSON.parse(readFileSync(NSE_OFFICIAL_SUPPLEMENTS, "utf8")) as unknown),
  ];
  const nseRecords = matchNseOfficialDates(stocks, nseRows, generatedAt);
  const sseRows = [sseMainboard, sseStar, sseBshare].flatMap((source) =>
    parseSseSecurityList(JSON.parse(source.bytes.toString("utf8")) as unknown),
  );
  const sseRecords = matchSseOfficialDates(stocks, sseRows, generatedAt);
  const szseRecords = matchSzseOfficialDates(
    stocks,
    parseSzseSecurityList(JSON.parse(szseSource.bytes.toString("utf8")) as unknown),
    generatedAt,
  );
  const jpxRecords = jpxSource
    ? matchJpxOfficialDates(
      stocks,
      parseJpxCompanyDatePayload(JSON.parse(jpxSource.bytes.toString("utf8")) as unknown),
      generatedAt,
    )
    : [];
  const lseRecords = lseSource
    ? matchLseOfficialDates(
      stocks,
      parseLseInstrumentDatePayload(JSON.parse(lseSource.bytes.toString("utf8")) as unknown),
      generatedAt,
    )
    : [];
  const krxRecords = matchKrxOfficialDates(
    stocks,
    parseKrxKindCompanyList(new TextDecoder("euc-kr").decode(krxSource.bytes)),
    generatedAt,
  );
  const asxRecords = matchAsxOfficialDates(
    stocks,
    parseAsxCompanyDirectory(asxSource.bytes.toString("utf8")),
    generatedAt,
  );
  const pseRecords = matchPseOfficialDates(
    stocks,
    parsePseSource(pseSource.bytes),
    generatedAt,
  );
  const tadawulRecords = tadawulSource
    ? matchTadawulOfficialDates(
      stocks,
      parseTadawulCompanyDatePayload(JSON.parse(tadawulSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const idxRecords = idxSource
    ? (() => {
      const payload = parseIdxCompanyDatePayload(JSON.parse(idxSource.bytes.toString("utf8")) as unknown);
      return matchIdxOfficialDates(stocks, {
        ...payload,
        records: [
          ...payload.records,
          ...parseIdxOfficialDateSupplements(JSON.parse(readFileSync(IDX_OFFICIAL_SUPPLEMENTS, "utf8")) as unknown),
        ],
      });
    })()
    : [];
  const vietnamRecords = vietnamSource
    ? matchVietnamOfficialDates(
      stocks,
      parseVietnamCompanyDatePayload(JSON.parse(vietnamSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const sgxRecords = sgxSource
    ? matchSgxOfficialDates(
      stocks,
      parseSgxCorporateDatePayload(JSON.parse(sgxSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const hkexRecords = hkexSource
    ? matchHkexOfficialDates(
      stocks,
      parseHkexCompanyDatePayload(JSON.parse(hkexSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const b3Records = b3Source
    ? matchB3OfficialDates(
      stocks,
      parseB3CompanyDatePayload(JSON.parse(b3Source.bytes.toString("utf8")) as unknown),
    )
    : [];
  const psxRecords = psxSource
    ? matchPsxOfficialDates(
      stocks,
      parsePsxListingDatePayload(JSON.parse(psxSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const sixRecords = sixSource
    ? matchSixOfficialDates(
      stocks,
      parseSixListingDatePayload(JSON.parse(sixSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const xetraPrimaryMarketRecords = xetraSource
    ? matchXetraOfficialDates(
      stocks,
      parseXetraPrimaryMarketPayload(JSON.parse(xetraSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const xetraInstrumentRecords = xetraInstrumentSource
    ? matchXetraInstrumentDates(
      stocks,
      parseXetraInstrumentReferencePayload(JSON.parse(xetraInstrumentSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const xetraRecords = xetraSource || xetraInstrumentSource
    ? combineXetraDateRecords(stocks, xetraPrimaryMarketRecords, xetraInstrumentRecords)
    : [];
  const tsxIssuerRecords = tsxSource
    ? matchTsxOfficialDates(
      stocks,
      parseTsxListedCompanyPayload(JSON.parse(tsxSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const tsxBulletinRecords = tsxBulletinSource
    ? matchTsxBulletinOfficialDates(
      stocks,
      parseTsxExchangeBulletinPayload(JSON.parse(tsxBulletinSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const tsxIssuerById = new Map(tsxIssuerRecords.map((record) => [record.securityId, record]));
  const tsxBulletinById = new Map(tsxBulletinRecords.map((record) => [record.securityId, record]));
  const tsxRecords = [...new Set([...tsxIssuerById.keys(), ...tsxBulletinById.keys()])]
    .map((securityId) => {
      const issuer = tsxIssuerById.get(securityId);
      const bulletin = tsxBulletinById.get(securityId);
      return issuer?.status === "matched" ? issuer : (bulletin?.status === "matched" ? bulletin : (issuer ?? bulletin!));
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
  const bistRecords = bistSource
    ? matchBistOfficialDates(
      stocks,
      parseBistFirstTradingDatePayload(JSON.parse(bistSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const jseRecords = jseSource
    ? matchJseOfficialDates(
      stocks,
      parseJseInstrumentListingPayload(JSON.parse(jseSource.bytes.toString("utf8")) as unknown),
    )
    : [];
  const events = [...twseRecords, ...nseRecords, ...sseRecords, ...szseRecords, ...jpxRecords, ...lseRecords, ...krxRecords, ...asxRecords, ...pseRecords, ...tadawulRecords, ...idxRecords, ...vietnamRecords, ...sgxRecords, ...hkexRecords, ...b3Records, ...psxRecords, ...sixRecords, ...xetraRecords, ...tsxRecords, ...bistRecords, ...jseRecords]
    .flatMap((record) => record.events);
  const shouldApply = flag("apply");
  const applySummary = shouldApply ? applyWithoutDateConflicts(events) : null;
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const summary = {
    catalog: twseRecords.length + nseRecords.length + sseRecords.length + szseRecords.length + jpxRecords.length + lseRecords.length + krxRecords.length + asxRecords.length + pseRecords.length + tadawulRecords.length + idxRecords.length + vietnamRecords.length + sgxRecords.length + hkexRecords.length + b3Records.length + psxRecords.length + sixRecords.length + xetraRecords.length + tsxRecords.length + bistRecords.length + jseRecords.length,
    officialListingDates: events.filter((event) =>
      event.kind === "exchange_admission" || event.kind === "first_trading_day"
      || event.kind === "first_trade" || event.kind === "relisting",
    ).length,
    companyOriginDates: events.filter((event) => event.kind === "incorporation").length,
    twse: {
      catalog: twseRecords.length,
      matched: twseRecords.filter((record) => record.status === "matched").length,
      unmatched: twseRecords.filter((record) => record.status === "unmatched").length,
      invalid: twseRecords.filter((record) => record.status === "invalid").length,
    },
    nse: {
      catalog: nseRecords.length,
      matched: nseRecords.filter((record) => record.status === "matched").length,
      unmatched: nseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: nseRecords.filter((record) => record.status === "ambiguous").length,
      invalid: nseRecords.filter((record) => record.status === "invalid").length,
    },
    sse: {
      catalog: sseRecords.length,
      matched: sseRecords.filter((record) => record.status === "matched").length,
      unmatched: sseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: sseRecords.filter((record) => record.status === "ambiguous").length,
      catalogMigrationHints: sseRecords.filter((record) => record.catalogMigrationHint !== null).length,
    },
    szse: {
      catalog: szseRecords.length,
      matched: szseRecords.filter((record) => record.status === "matched").length,
      unmatched: szseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: szseRecords.filter((record) => record.status === "ambiguous").length,
    },
    jpx: {
      sourceProvided: jpxSource !== null,
      catalog: jpxRecords.length,
      matched: jpxRecords.filter((record) => record.status === "matched").length,
      unmatched: jpxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: jpxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: jpxRecords.filter((record) => record.status === "invalid").length,
    },
    lse: {
      sourceProvided: lseSource !== null,
      catalog: lseRecords.length,
      matched: lseRecords.filter((record) => record.status === "matched").length,
      unmatched: lseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: lseRecords.filter((record) => record.status === "ambiguous").length,
      invalid: lseRecords.filter((record) => record.status === "invalid").length,
    },
    krx: {
      catalog: krxRecords.length,
      matched: krxRecords.filter((record) => record.status === "matched").length,
      unmatched: krxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: krxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: krxRecords.filter((record) => record.status === "invalid").length,
    },
    asx: {
      catalog: asxRecords.length,
      matched: asxRecords.filter((record) => record.status === "matched").length,
      unmatched: asxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: asxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: asxRecords.filter((record) => record.status === "invalid").length,
    },
    pse: {
      catalog: pseRecords.length,
      matched: pseRecords.filter((record) => record.status === "matched").length,
      unmatched: pseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: pseRecords.filter((record) => record.status === "ambiguous").length,
      invalid: pseRecords.filter((record) => record.status === "invalid").length,
    },
    tadawul: {
      sourceProvided: tadawulSource !== null,
      catalog: tadawulRecords.length,
      matched: tadawulRecords.filter((record) => record.status === "matched").length,
      unmatched: tadawulRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: tadawulRecords.filter((record) => record.status === "ambiguous").length,
      invalid: tadawulRecords.filter((record) => record.status === "invalid").length,
      companyOriginDates: tadawulRecords.filter((record) => record.establishedDate !== null).length,
    },
    idx: {
      sourceProvided: idxSource !== null,
      catalog: idxRecords.length,
      matched: idxRecords.filter((record) => record.status === "matched").length,
      unmatched: idxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: idxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: idxRecords.filter((record) => record.status === "invalid").length,
    },
    vietnam: {
      sourceProvided: vietnamSource !== null,
      catalog: vietnamRecords.length,
      matched: vietnamRecords.filter((record) => record.status === "matched").length,
      unmatched: vietnamRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: vietnamRecords.filter((record) => record.status === "ambiguous").length,
      invalid: vietnamRecords.filter((record) => record.status === "invalid").length,
      hose: vietnamRecords.filter((record) => record.sourceExchange === "HOSE").length,
      hnx: vietnamRecords.filter((record) => record.sourceExchange === "HNX").length,
    },
    sgx: {
      sourceProvided: sgxSource !== null,
      catalog: sgxRecords.length,
      matched: sgxRecords.filter((record) => record.status === "matched").length,
      unmatched: sgxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: sgxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: sgxRecords.filter((record) => record.status === "invalid").length,
    },
    hkex: {
      sourceProvided: hkexSource !== null,
      catalog: hkexRecords.length,
      matched: hkexRecords.filter((record) => record.status === "matched").length,
      unmatched: hkexRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: hkexRecords.filter((record) => record.status === "ambiguous").length,
      invalid: hkexRecords.filter((record) => record.status === "invalid").length,
      catalogAliasWarnings: hkexRecords.filter((record) => record.warnings.some((warning) => warning.includes("catalog aliases"))).length,
    },
    b3: {
      sourceProvided: b3Source !== null,
      catalog: b3Records.length,
      matched: b3Records.filter((record) => record.status === "matched").length,
      unmatched: b3Records.filter((record) => record.status === "unmatched").length,
      ambiguous: b3Records.filter((record) => record.status === "ambiguous").length,
      invalid: b3Records.filter((record) => record.status === "invalid").length,
      oddLotAliasesExcluded: b3Records.filter((record) => record.warnings.some((warning) => warning.includes("odd-lot"))).length,
    },
    psx: {
      sourceProvided: psxSource !== null,
      catalog: psxRecords.length,
      matched: psxRecords.filter((record) => record.status === "matched").length,
      unmatched: psxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: psxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: psxRecords.filter((record) => record.status === "invalid").length,
      explicitSymbolMatches: psxRecords.filter((record) => record.matchMethod === "explicit_symbol").length,
      exactOfficialNameMatches: psxRecords.filter((record) => record.matchMethod === "exact_official_name").length,
      officialProfileMatches: psxRecords.filter((record) => record.matchMethod === "official_profile").length,
    },
    six: {
      sourceProvided: sixSource !== null,
      catalog: sixRecords.length,
      matched: sixRecords.filter((record) => record.status === "matched").length,
      unmatched: sixRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: sixRecords.filter((record) => record.status === "ambiguous").length,
      invalid: sixRecords.filter((record) => record.status === "invalid").length,
      ipoHistoryMatches: sixRecords.filter((record) => record.sourceType === "ipo_history" && record.status === "matched").length,
      blueChipShareMatches: sixRecords.filter((record) => record.sourceType === "blue_chip_share_reference" && record.status === "matched").length,
      domesticShareMatches: sixRecords.filter((record) => record.sourceType === "domestic_share_reference" && record.status === "matched").length,
      foreignShareMatches: sixRecords.filter((record) => record.sourceType === "foreign_share_reference" && record.status === "matched").length,
      sponsoredForeignMatches: sixRecords.filter((record) => record.sourceType === "sponsored_foreign_share" && record.status === "matched").length,
    },
    xetra: {
      sourceProvided: xetraSource !== null || xetraInstrumentSource !== null,
      primaryMarketSourceProvided: xetraSource !== null,
      instrumentReferenceSourceProvided: xetraInstrumentSource !== null,
      catalog: xetraRecords.length,
      matched: xetraRecords.filter((record) => record.status === "matched").length,
      unmatched: xetraRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: xetraRecords.filter((record) => record.status === "ambiguous").length,
      invalid: xetraRecords.filter((record) => record.status === "invalid").length,
      primaryMarketHistoryMatches: xetraRecords.filter((record) => record.sourceType === "primary_market_history").length,
      instrumentReferenceFallbackMatches: xetraRecords.filter((record) => record.sourceType === "current_instrument_reference").length,
      crossSourceDateDifferences: xetraRecords.filter((record) => record.comparison.sourcesAgree === false).length,
      tickerReuseRejected: xetraRecords.filter((record) =>
        record.warnings.some((warning) => warning.includes("ticker may have been reused")),
      ).length,
    },
    tsx: {
      sourceProvided: tsxSource !== null || tsxBulletinSource !== null,
      issuerWorkbookSourceProvided: tsxSource !== null,
      exchangeBulletinSourceProvided: tsxBulletinSource !== null,
      catalog: tsxRecords.length,
      matched: tsxRecords.filter((record) => record.status === "matched").length,
      unmatched: tsxRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: tsxRecords.filter((record) => record.status === "ambiguous").length,
      invalid: tsxRecords.filter((record) => record.status === "invalid").length,
      classOrIssuerRootDatesRejected: tsxRecords.filter((record) =>
        record.warnings.some((warning) => warning.includes("not itself a current tradable instrument")),
      ).length,
      issuerIdentityRejected: tsxRecords.filter((record) =>
        record.warnings.some((warning) => warning.includes("share no identity token")),
      ).length,
      exactSecurityBulletinMatches: tsxBulletinRecords.filter((record) => record.status === "matched").length,
      issuerWorkbookMatches: tsxIssuerRecords.filter((record) => record.status === "matched").length,
      crossSourceDateDifferences: tsxBulletinRecords.filter((record) => {
        if (record.status !== "matched") return false;
        const issuer = tsxIssuerById.get(record.securityId);
        return issuer?.status === "matched" && issuer.listingDate !== record.listingDate;
      }).length,
      bulletinFallbackMatchesUsed: tsxRecords.filter((record) =>
        record.status === "matched" && tsxBulletinById.get(record.securityId) === record,
      ).length,
    },
    bist: {
      sourceProvided: bistSource !== null,
      catalog: bistRecords.length,
      matched: bistRecords.filter((record) => record.status === "matched").length,
      unmatched: bistRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: bistRecords.filter((record) => record.status === "ambiguous").length,
      invalid: bistRecords.filter((record) => record.status === "invalid").length,
      nameIdentityWarnings: bistRecords.filter((record) => record.nameIdentityConfirmed === false).length,
      certificateLines: bistRecords.filter((record) => record.sourceCode?.endsWith(".G")).length,
    },
    jse: {
      sourceProvided: jseSource !== null,
      catalog: jseRecords.length,
      matched: jseRecords.filter((record) => record.status === "matched").length,
      unmatched: jseRecords.filter((record) => record.status === "unmatched").length,
      ambiguous: jseRecords.filter((record) => record.status === "ambiguous").length,
      invalid: jseRecords.filter((record) => record.status === "invalid").length,
    },
  };

  saveAtomic(output, {
    schemaVersion: 1,
    generatedAt,
    sourcePolicy: {
      authority: "exchange",
      verification: "verified",
      displayRights: "unknown",
      commercialUse: "BLOCKED_PENDING_EXCHANGE_TERMS_AND_DATA_LICENSE_REVIEW",
      exactFirstTradeTimeAvailable: false,
    },
    sources: [twseSource, nseEquity, nseReit, nseInvit, sseMainboard, sseStar, sseBshare, szseSource, jpxSource, lseSource, krxSource, asxSource, pseSource, tadawulSource, idxSource, vietnamSource, sgxSource, hkexSource, b3Source, psxSource, sixSource, xetraSource, xetraInstrumentSource, tsxSource, tsxBulletinSource, bistSource, jseSource]
      .filter((source): source is SourceFile => source !== null)
      .map(({ bytes: _bytes, ...source }) => source),
    summary,
    records: { twse: twseRecords, nse: nseRecords, sse: sseRecords, szse: szseRecords, jpx: jpxRecords, lse: lseRecords, krx: krxRecords, asx: asxRecords, pse: pseRecords, tadawul: tadawulRecords, idx: idxRecords, vietnam: vietnamRecords, sgx: sgxRecords, hkex: hkexRecords, b3: b3Records, psx: psxRecords, six: sixRecords, xetra: xetraRecords, xetraPrimaryMarket: xetraPrimaryMarketRecords, xetraInstrument: xetraInstrumentRecords, tsx: tsxRecords, tsxIssuer: tsxIssuerRecords, tsxBulletin: tsxBulletinRecords, bist: bistRecords, jse: jseRecords },
    applySummary,
  });
  console.log(JSON.stringify({ output, summary, applySummary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
