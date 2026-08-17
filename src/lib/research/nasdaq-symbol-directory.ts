import type { StockEntry } from "../investor/stock-database";
import { securityIdOf } from "./security-birth";
import { isUsListedCatalogMarket, normalizeUsTicker } from "./sec-security-master";

export const NASDAQ_LISTED_DIRECTORY_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt";
export const OTHER_LISTED_DIRECTORY_URL = "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt";

export type NasdaqSymbolDirectoryRow = {
  symbol: string;
  securityName: string;
  currentExchange: string;
  canonicalMarket: string;
  testIssue: boolean;
  sourceUrl: string;
};

export type UsCurrentVenueRecord = {
  catalogSecurityId: string;
  catalogTicker: string;
  catalogMarket: string;
  catalogName: string;
  status: "matched" | "exchange_mismatch" | "identity_mismatch" | "ambiguous" | "unmatched" | "unsupported_venue";
  venueResolved: boolean;
  canonicalMarket: string | null;
  currentExchange: string | null;
  officialSymbol: string | null;
  officialSecurityName: string | null;
  sourceUrl: string | null;
  note: string | null;
  identityEvidenceSource?: string | null;
  identityEvidenceUrl?: string | null;
};

export type UsCurrentVenueIdentityAlias = {
  catalogSecurityId: string;
  catalogTicker: string;
  catalogMarket: string;
  catalogName: string;
  officialSecurityName: string;
  identityEvidenceSource: string;
  identityEvidenceUrl: string;
};

export type UsCurrentVenueResolution = {
  canonicalMarket: string;
  currentExchange: string;
  sourceName: string;
  sourceUrl: string;
};

const OTHER_EXCHANGE = new Map<string, { currentExchange: string; canonicalMarket: string }>([
  ["A", { currentExchange: "NYSE American", canonicalMarket: "NYSE" }],
  ["N", { currentExchange: "New York Stock Exchange", canonicalMarket: "NYSE" }],
  ["P", { currentExchange: "NYSE Arca", canonicalMarket: "NYSE" }],
  ["Z", { currentExchange: "Cboe BZX", canonicalMarket: "CBOE" }],
  ["V", { currentExchange: "Investors Exchange", canonicalMarket: "IEX" }],
]);

const NAME_STOP_WORDS = new Set([
  "A", "AN", "AND", "THE", "OF", "NEW",
  "CO", "COMPANY", "CORP", "CORPORATION", "INC", "INCORPORATED", "LLC", "LTD", "LIMITED", "LP", "PLC",
  "AG", "NV", "SA", "SE", "GROUP", "HOLDING", "HOLDINGS",
  "AMERICAN", "DEPOSITARY", "DEPOSITORY", "ADR", "ADS", "ORDINARY", "COMMON", "STOCK", "SHARE", "SHARES",
  "CLASS", "SERIES", "UNIT", "UNITS", "REPRESENTING", "EACH", "BENEFICIAL", "INTEREST", "INTERESTS",
]);

const IDENTITY_EVIDENCE_HOSTS = new Set([
  "investorcenter.slb.com",
  "www.slb.com",
  "ir.wabteccorp.com",
  "www.wabteccorp.com",
]);

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`US venue identity alias is missing ${field}`);
  return value.trim();
}

export function parseUsCurrentVenueIdentityAliases(payload: unknown): Map<string, UsCurrentVenueIdentityAlias> {
  if (!payload || typeof payload !== "object") throw new Error("US venue identity aliases must be an object");
  const input = payload as { schemaVersion?: unknown; records?: unknown };
  if (input.schemaVersion !== 1 || !Array.isArray(input.records)) {
    throw new Error("US venue identity aliases have an invalid schema");
  }
  const aliases = new Map<string, UsCurrentVenueIdentityAlias>();
  for (const value of input.records) {
    if (!value || typeof value !== "object") throw new Error("US venue identity alias record must be an object");
    const record = value as Record<string, unknown>;
    const catalogTicker = requiredString(record.catalogTicker, "catalogTicker").toUpperCase();
    const catalogMarket = requiredString(record.catalogMarket, "catalogMarket").toUpperCase();
    const catalogSecurityId = requiredString(record.catalogSecurityId, "catalogSecurityId");
    if (!isUsListedCatalogMarket(catalogMarket) || securityIdOf(catalogMarket, catalogTicker) !== catalogSecurityId) {
      throw new Error(`US venue identity alias has inconsistent catalog identity: ${catalogSecurityId}`);
    }
    const identityEvidenceUrl = requiredString(record.identityEvidenceUrl, "identityEvidenceUrl");
    let evidenceUrl: URL;
    try {
      evidenceUrl = new URL(identityEvidenceUrl);
    } catch {
      throw new Error(`US venue identity alias has an invalid evidence URL: ${catalogSecurityId}`);
    }
    if (evidenceUrl.protocol !== "https:" || !IDENTITY_EVIDENCE_HOSTS.has(evidenceUrl.hostname.toLowerCase())) {
      throw new Error(`US venue identity alias evidence is not from an approved issuer host: ${catalogSecurityId}`);
    }
    if (aliases.has(catalogSecurityId)) throw new Error(`Duplicate US venue identity alias: ${catalogSecurityId}`);
    aliases.set(catalogSecurityId, {
      catalogSecurityId,
      catalogTicker,
      catalogMarket,
      catalogName: requiredString(record.catalogName, "catalogName"),
      officialSecurityName: requiredString(record.officialSecurityName, "officialSecurityName"),
      identityEvidenceSource: requiredString(record.identityEvidenceSource, "identityEvidenceSource"),
      identityEvidenceUrl,
    });
  }
  return aliases;
}

function rows(text: string): string[][] {
  return text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean).map((line) => line.split("|"));
}

function headerIndex(header: readonly string[], name: string): number {
  const index = header.indexOf(name);
  if (index < 0) throw new Error(`Nasdaq Symbol Directory is missing field ${name}`);
  return index;
}

function normalizedNameTokens(value: string): Set<string> {
  return new Set(
    value.normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/&/g, " AND ")
      .replace(/[^A-Z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((token) => token.length >= 2 && !NAME_STOP_WORDS.has(token)),
  );
}

function catalogDirectoryTicker(value: string): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  const preferred = /^(.+?)[/.]P([A-Z0-9]+)$/.exec(normalized);
  return preferred ? `${normalizeUsTicker(preferred[1])}-P${preferred[2]}` : normalizeUsTicker(normalized);
}

function officialDirectoryTicker(value: string): string {
  const normalized = String(value ?? "").trim().toUpperCase();
  const preferred = /^(.+?)\$([A-Z0-9]+)$/.exec(normalized);
  return preferred ? `${normalizeUsTicker(preferred[1])}-P${preferred[2]}` : normalizeUsTicker(normalized);
}

export function hasUsIssuerIdentityOverlap(catalogName: string, officialName: string): boolean {
  const catalog = normalizedNameTokens(catalogName);
  const official = normalizedNameTokens(officialName);
  if (catalog.size === 0 || official.size === 0) return false;
  if ([...catalog].some((token) => official.has(token))) return true;
  const catalogCompact = [...catalog].join("");
  const officialCompact = [...official].join("");
  if (catalogCompact.length >= 4 && officialCompact.length >= 4
    && (catalogCompact.includes(officialCompact) || officialCompact.includes(catalogCompact))) return true;
  const catalogAcronym = [...catalog].map((token) => token[0]).join("");
  const officialAcronym = [...official].map((token) => token[0]).join("");
  return catalogCompact === officialAcronym || officialCompact === catalogAcronym;
}

export function parseNasdaqListedDirectory(text: string): NasdaqSymbolDirectoryRow[] {
  const parsed = rows(text);
  if (parsed.length < 2) throw new Error("Nasdaq-listed directory is empty");
  const header = parsed[0];
  const symbolIndex = headerIndex(header, "Symbol");
  const nameIndex = headerIndex(header, "Security Name");
  const testIndex = headerIndex(header, "Test Issue");
  if (!parsed.at(-1)?.[0]?.startsWith("File Creation Time:")) {
    throw new Error("Nasdaq-listed directory is missing its file creation footer");
  }
  return parsed.slice(1, -1).flatMap((row) => {
    const symbol = officialDirectoryTicker(row[symbolIndex] ?? "");
    const securityName = String(row[nameIndex] ?? "").trim();
    const testIssue = String(row[testIndex] ?? "").trim().toUpperCase() === "Y";
    return symbol && securityName && !testIssue ? [{
      symbol,
      securityName,
      currentExchange: "Nasdaq Stock Market",
      canonicalMarket: "NASDAQ",
      testIssue,
      sourceUrl: NASDAQ_LISTED_DIRECTORY_URL,
    }] : [];
  });
}

export function parseOtherListedDirectory(text: string): NasdaqSymbolDirectoryRow[] {
  const parsed = rows(text);
  if (parsed.length < 2) throw new Error("Other-listed directory is empty");
  const header = parsed[0];
  const symbolIndex = headerIndex(header, "ACT Symbol");
  const nameIndex = headerIndex(header, "Security Name");
  const exchangeIndex = headerIndex(header, "Exchange");
  const testIndex = headerIndex(header, "Test Issue");
  if (!parsed.at(-1)?.[0]?.startsWith("File Creation Time:")) {
    throw new Error("Other-listed directory is missing its file creation footer");
  }
  return parsed.slice(1, -1).flatMap((row) => {
    const symbol = officialDirectoryTicker(row[symbolIndex] ?? "");
    const securityName = String(row[nameIndex] ?? "").trim();
    const exchange = OTHER_EXCHANGE.get(String(row[exchangeIndex] ?? "").trim().toUpperCase());
    const testIssue = String(row[testIndex] ?? "").trim().toUpperCase() === "Y";
    return symbol && securityName && exchange && !testIssue ? [{
      symbol,
      securityName,
      currentExchange: exchange.currentExchange,
      canonicalMarket: exchange.canonicalMarket,
      testIssue,
      sourceUrl: OTHER_LISTED_DIRECTORY_URL,
    }] : [];
  });
}

export function matchUsCatalogToNasdaqDirectory(
  stocks: readonly Pick<StockEntry, "ticker" | "market" | "name">[],
  directoryRows: readonly NasdaqSymbolDirectoryRow[],
  identityAliases: ReadonlyMap<string, UsCurrentVenueIdentityAlias> = new Map(),
): UsCurrentVenueRecord[] {
  const byTicker = new Map<string, NasdaqSymbolDirectoryRow[]>();
  for (const row of directoryRows) {
    const current = byTicker.get(row.symbol) ?? [];
    current.push(row);
    byTicker.set(row.symbol, current);
  }
  return stocks.filter((stock) => isUsListedCatalogMarket(stock.market)).map((stock): UsCurrentVenueRecord => {
    const catalogTicker = stock.ticker.trim().toUpperCase();
    const catalogMarket = stock.market.trim().toUpperCase();
    const catalogSecurityId = securityIdOf(catalogMarket, catalogTicker);
    const candidates = byTicker.get(catalogDirectoryTicker(catalogTicker)) ?? [];
    const identityAlias = identityAliases.get(catalogSecurityId) ?? null;
    const aliasMatchesCatalog = Boolean(identityAlias
      && identityAlias.catalogTicker === catalogTicker
      && identityAlias.catalogMarket === catalogMarket
      && identityAlias.catalogName === stock.name);
    const aliasMatchesRow = (row: NasdaqSymbolDirectoryRow) => Boolean(
      aliasMatchesCatalog && identityAlias?.officialSecurityName === row.securityName,
    );
    const identityMatches = candidates.filter(
      (row) => hasUsIssuerIdentityOverlap(stock.name, row.securityName) || aliasMatchesRow(row),
    );
    if (identityMatches.length === 0) return {
      catalogSecurityId,
      catalogTicker,
      catalogMarket,
      catalogName: stock.name,
      status: candidates.length > 0 ? "identity_mismatch" : "unmatched",
      venueResolved: false,
      canonicalMarket: null,
      currentExchange: null,
      officialSymbol: null,
      officialSecurityName: null,
      sourceUrl: null,
      note: candidates.length > 0
        ? "Current official ticker exists, but issuer identity does not overlap; ticker reuse or stale catalog identity requires review."
        : "No current Nasdaq Trader Symbol Directory record; this is not proof of delisting.",
    };
    const unique = new Map(identityMatches.map((row) => [`${row.canonicalMarket}|${row.symbol}`, row]));
    if (unique.size !== 1) return {
      catalogSecurityId,
      catalogTicker,
      catalogMarket,
      catalogName: stock.name,
      status: "ambiguous",
      venueResolved: false,
      canonicalMarket: null,
      currentExchange: null,
      officialSymbol: null,
      officialSecurityName: null,
      sourceUrl: null,
      note: `Found ${unique.size} current official venue candidates for the exact normalized ticker and issuer identity.`,
    };
    const selected = [...unique.values()][0];
    const datePolicySupported = selected.canonicalMarket === "NYSE" || selected.canonicalMarket === "NASDAQ";
    const identityAliasUsed = !hasUsIssuerIdentityOverlap(stock.name, selected.securityName) && aliasMatchesRow(selected);
    const explicitMarket = catalogMarket === "NYSE" || catalogMarket === "NASDAQ" ? catalogMarket : null;
    const exchangeMismatch = Boolean(explicitMarket && explicitMarket !== selected.canonicalMarket);
    return {
      catalogSecurityId,
      catalogTicker,
      catalogMarket,
      catalogName: stock.name,
      status: !datePolicySupported ? "unsupported_venue" : exchangeMismatch ? "exchange_mismatch" : "matched",
      venueResolved: true,
      canonicalMarket: selected.canonicalMarket,
      currentExchange: selected.currentExchange,
      officialSymbol: selected.symbol,
      officialSecurityName: selected.securityName,
      sourceUrl: selected.sourceUrl,
      note: !datePolicySupported
        ? `Current official venue ${selected.currentExchange} is outside the legacy NYSE/Nasdaq market policy.`
        : exchangeMismatch
          ? `Catalog says ${explicitMarket}; the current official Symbol Directory says ${selected.canonicalMarket}.`
          : identityAliasUsed
            ? `Issuer identity was reconciled with ${identityAlias?.identityEvidenceSource}; this source does not provide a first-trading date.`
          : catalogMarket === "NYSE/NASDAQ"
            ? `Resolved the legacy combined venue to current ${selected.canonicalMarket}; this source does not provide a first-trading date.`
            : null,
      identityEvidenceSource: identityAliasUsed ? identityAlias?.identityEvidenceSource ?? null : null,
      identityEvidenceUrl: identityAliasUsed ? identityAlias?.identityEvidenceUrl ?? null : null,
    };
  }).sort((a, b) => a.catalogSecurityId.localeCompare(b.catalogSecurityId));
}

export function currentVenueResolutionsFromSnapshot(payload: unknown): Map<string, UsCurrentVenueResolution> {
  if (!payload || typeof payload !== "object") throw new Error("US current venue snapshot must be an object");
  const input = payload as { schemaVersion?: unknown; records?: unknown };
  if (input.schemaVersion !== 1 || !Array.isArray(input.records)) throw new Error("US current venue snapshot schema is invalid");
  const result = new Map<string, UsCurrentVenueResolution>();
  for (const value of input.records) {
    if (!value || typeof value !== "object") continue;
    const record = value as Record<string, unknown>;
    if (record.venueResolved !== true || typeof record.catalogSecurityId !== "string") continue;
    const canonicalMarket = String(record.canonicalMarket ?? "");
    const currentExchange = String(record.currentExchange ?? "");
    const sourceUrl = String(record.sourceUrl ?? "");
    if (!["NYSE", "NASDAQ", "CBOE", "IEX"].includes(canonicalMarket) || !currentExchange
      || ![NASDAQ_LISTED_DIRECTORY_URL, OTHER_LISTED_DIRECTORY_URL].includes(sourceUrl)) continue;
    result.set(record.catalogSecurityId, {
      canonicalMarket,
      currentExchange,
      sourceName: "Nasdaq Trader Symbol Directory",
      sourceUrl,
    });
  }
  return result;
}
