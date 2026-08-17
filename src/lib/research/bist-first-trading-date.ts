import type { StockEntry } from "../investor/stock-database";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf, type SecurityEvent } from "./security-birth";

export const BIST_MARKET_DATA_PAGE_URL = "https://www.borsaistanbul.com/en/market-data";
export const BIST_FIRST_TRADING_DATES_ZIP_URL = "https://www.borsaistanbul.com/datum/ilkislem.zip";

export type BistFirstTradingDateRow = {
  firstCode: string;
  currentCode: string;
  symbol: string;
  companyName: string;
  listingDate: string | null;
  firstTradingDate: string;
  sourceUrl: string;
  sourceHash: string;
  retrievedAt: string;
};

export type BistFirstTradingDatePayload = {
  retrievedAt: string;
  sourceRowCount: number;
  records: BistFirstTradingDateRow[];
};

export type BistOfficialDateRecord = {
  securityId: string;
  ticker: string;
  status: "matched" | "unmatched" | "ambiguous" | "invalid";
  sourceCode: string | null;
  companyName: string | null;
  listingDate: string | null;
  firstTradingDate: string | null;
  nameIdentityConfirmed: boolean | null;
  sourceUrl: string | null;
  events: SecurityEvent[];
  warnings: string[];
};

function isoDate(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseBistDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (isoMatch) return isoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  const sourceMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(normalized);
  return sourceMatch
    ? isoDate(Number(sourceMatch[3]), Number(sourceMatch[2]), Number(sourceMatch[1]))
    : null;
}

export function normalizeBistSymbol(value: string): string {
  const symbol = value.trim().toUpperCase();
  return /^[A-Z0-9]{1,16}$/.test(symbol) ? symbol : "";
}

export function normalizeBistCurrentCode(value: string): string {
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{1,16}\.(?:E|G)$/.test(code) ? code : "";
}

const LEGAL_ENDINGS: readonly (readonly string[])[] = [
  ["ANONIM", "SIRKETI"],
  ["ANONIM", "SIRKET"],
  ["ANONIM", "ORTAKLIGI"],
  ["T", "A", "S"],
  ["T", "A", "O"],
  ["A", "S"],
  ["A", "O"],
  ["TAS"],
  ["TAO"],
  ["AS"],
  ["AO"],
];

/** Conservative key for diagnostics after an exact official current-code match. */
export function normalizeBistCompanyName(value: string): string {
  let tokens = value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length >= 2 && tokens[tokens.length - 2] === "CLASS" && /^[A-Z0-9]$/.test(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -2);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const ending of LEGAL_ENDINGS) {
      if (tokens.length < ending.length) continue;
      const offset = tokens.length - ending.length;
      if (ending.every((token, index) => tokens[offset + index] === token)) {
        tokens = tokens.slice(0, offset);
        changed = true;
        break;
      }
    }
  }
  return tokens.join(" ");
}

const IDENTITY_STOP_WORDS = new Set([
  "ANONIM", "SIRKETI", "SIRKET", "SANAYI", "SANAYII", "TICARET", "VE",
  "YATIRIM", "YATIRIMLARI", "ORTAKLIGI", "HOLDING", "TURKIYE", "TURK",
  "BANKASI", "BANK", "SIGORTA", "CIMENTO", "ENERJI", "GAYRIMENKUL",
  "FINANSAL", "HIZMETLER", "GRUBU", "GRUP", "CLASS",
]);

function identityTokens(value: string): string[] {
  return normalizeBistCompanyName(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !IDENTITY_STOP_WORDS.has(token));
}

export function bistCompanyNamesShareIdentity(catalogName: string, officialName: string): boolean {
  const catalogKey = normalizeBistCompanyName(catalogName);
  const officialKey = normalizeBistCompanyName(officialName);
  if (!catalogKey || !officialKey) return false;
  if (catalogKey === officialKey) return true;
  const officialTokens = new Set(identityTokens(officialName));
  return identityTokens(catalogName).some((token) => officialTokens.has(token));
}

function isOfficialSourceUrl(value: string): boolean {
  try {
    return new URL(value).toString() === new URL(BIST_FIRST_TRADING_DATES_ZIP_URL).toString();
  } catch {
    return false;
  }
}

export function parseBistFirstTradingDatePayload(payload: unknown): BistFirstTradingDatePayload {
  if (!payload || typeof payload !== "object") throw new Error("BIST first-trading-date payload must be an object");
  const input = payload as Record<string, unknown>;
  const retrievedAtValue = String(input.retrievedAt ?? input.updatedAt ?? "");
  if (!Number.isFinite(Date.parse(retrievedAtValue))) throw new Error("BIST payload has an invalid retrievedAt");
  if (!Array.isArray(input.records)) throw new Error("BIST payload is missing records");

  const records = input.records.flatMap((value): BistFirstTradingDateRow[] => {
    if (!value || typeof value !== "object") return [];
    const row = value as Record<string, unknown>;
    const currentCode = normalizeBistCurrentCode(String(row.currentCode ?? ""));
    const symbol = normalizeBistSymbol(String(row.symbol ?? ""));
    const firstCode = String(row.firstCode ?? "").trim().toUpperCase();
    const companyName = String(row.companyName ?? "").replace(/\s+/g, " ").trim();
    const rawListingDate = row.listingDate;
    const listingDate = rawListingDate === null || rawListingDate === undefined || rawListingDate === ""
      ? null
      : parseBistDate(rawListingDate);
    const firstTradingDate = parseBistDate(row.firstTradingDate);
    const sourceUrl = String(row.sourceUrl ?? "").trim();
    const sourceHash = String(row.sourceHash ?? "").trim().toLowerCase();
    const rowRetrievedAt = String(row.retrievedAt ?? retrievedAtValue);
    if (!currentCode || symbol !== currentCode.split(".")[0] || !/^[A-Z0-9.]{1,24}$/.test(firstCode)
      || !companyName || !firstTradingDate || (rawListingDate !== null && rawListingDate !== undefined
        && rawListingDate !== "" && !listingDate)
      || !isOfficialSourceUrl(sourceUrl) || !/^[a-f0-9]{64}$/.test(sourceHash)
      || !Number.isFinite(Date.parse(rowRetrievedAt))) {
      return [];
    }
    return [{
      firstCode,
      currentCode,
      symbol,
      companyName,
      listingDate,
      firstTradingDate,
      sourceUrl,
      sourceHash,
      retrievedAt: new Date(rowRetrievedAt).toISOString(),
    }];
  });
  if (records.length === 0) throw new Error("BIST payload contains no valid first-trading-date records");
  const sourceRowCount = Number(input.sourceRowCount);
  return {
    retrievedAt: new Date(retrievedAtValue).toISOString(),
    sourceRowCount: Number.isInteger(sourceRowCount) && sourceRowCount >= records.length
      ? sourceRowCount
      : records.length,
    records: [...records].sort((a, b) =>
      a.symbol.localeCompare(b.symbol) || a.firstTradingDate.localeCompare(b.firstTradingDate),
    ),
  };
}

function emptyRecord(
  stock: Pick<StockEntry, "ticker" | "name">,
  status: BistOfficialDateRecord["status"],
): BistOfficialDateRecord {
  return {
    securityId: securityIdOf("BIST", stock.ticker),
    ticker: stock.ticker.trim().toUpperCase(),
    status,
    sourceCode: null,
    companyName: stock.name || null,
    listingDate: null,
    firstTradingDate: null,
    nameIdentityConfirmed: null,
    sourceUrl: null,
    events: [],
    warnings: [],
  };
}

function evidence(row: BistFirstTradingDateRow): SecurityEvent["evidence"] {
  return {
    authority: "exchange",
    sourceName: "Borsa Istanbul First Trading Date and Price of the Equities",
    sourceUrl: row.sourceUrl,
    retrievedAt: row.retrievedAt,
    verification: "verified",
    displayRights: "unknown",
  };
}

export function matchBistOfficialDates(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  payload: BistFirstTradingDatePayload,
): BistOfficialDateRecord[] {
  const bySymbol = new Map<string, BistFirstTradingDateRow[]>();
  for (const row of payload.records) {
    const rows = bySymbol.get(row.symbol) ?? [];
    if (!rows.some((item) => item.currentCode === row.currentCode
      && item.firstTradingDate === row.firstTradingDate && item.companyName === row.companyName)) {
      rows.push(row);
    }
    bySymbol.set(row.symbol, rows);
  }

  return stocks
    .filter((stock) => stock.market.trim().toUpperCase() === "BIST")
    .map((stock): BistOfficialDateRecord => {
      const ticker = normalizeBistSymbol(stock.ticker);
      const empty = emptyRecord(stock, "unmatched");
      if (!ticker) {
        return { ...empty, status: "invalid", warnings: ["Catalog ticker does not follow a supported BIST symbol shape"] };
      }
      empty.ticker = ticker;
      empty.securityId = securityIdOf("BIST", ticker);
      const rows = bySymbol.get(ticker) ?? [];
      if (rows.length === 0) {
        return {
          ...empty,
          warnings: ["Exact current Borsa Istanbul code was not found in the official first-trading-date workbook"],
        };
      }
      const distinct = new Set(rows.map((row) => `${row.currentCode}\u0000${row.firstTradingDate}`));
      if (distinct.size !== 1) {
        return {
          ...empty,
          status: "ambiguous",
          warnings: [`Official workbook maps catalog symbol ${ticker} to ${distinct.size} current-code/date combinations`],
        };
      }

      const row = rows[0];
      const nameIdentityConfirmed = bistCompanyNamesShareIdentity(stock.name, row.companyName);
      const firstTradingEvent: SecurityEvent = {
        schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
        securityId: empty.securityId,
        kind: "first_trading_day",
        localDate: row.firstTradingDate,
        localTime: null,
        timePrecision: "unknown",
        timeZone: "Europe/Istanbul",
        exchange: "Borsa Istanbul",
        venueCity: "Istanbul",
        venueCountry: "TR",
        evidence: evidence(row),
        note: `Official Borsa Istanbul First Trading Day for exact current instrument code ${row.currentCode}; date-only.`,
      };
      const events = [firstTradingEvent];
      if (row.listingDate && row.listingDate !== row.firstTradingDate) {
        events.push({
          ...firstTradingEvent,
          kind: "exchange_admission",
          localDate: row.listingDate,
          note: `Official Borsa Istanbul Listing Date for exact current instrument code ${row.currentCode}; date-only.`,
        });
      }
      const warnings: string[] = [];
      if (!nameIdentityConfirmed) {
        warnings.push("Exact official current code matched, but catalog and workbook issuer names do not share a conservative identity token; likely rename/successor and should be reviewed before issuer-level claims");
      }
      if (row.currentCode.endsWith(".G")) {
        warnings.push(`Official instrument code ${row.currentCode} is a certificate-class .G line; the source suffix is preserved and not treated as an .E common share`);
      }
      if (!row.listingDate) warnings.push("Official workbook provides First Trading Day but no separate Listing Date");
      return {
        ...empty,
        status: "matched",
        sourceCode: row.currentCode,
        companyName: row.companyName,
        listingDate: row.listingDate,
        firstTradingDate: row.firstTradingDate,
        nameIdentityConfirmed,
        sourceUrl: row.sourceUrl,
        events,
        warnings,
      };
    })
    .sort((a, b) => a.securityId.localeCompare(b.securityId));
}
