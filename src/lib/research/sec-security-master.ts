import { securityIdOf } from "./security-birth";

export const SEC_TICKER_EXCHANGE_URL = "https://www.sec.gov/files/company_tickers_exchange.json";

/** SEC asks automated clients to identify the organization and a monitored email. */
export function isAcceptableSecUserAgent(value: string): boolean {
  const normalized = String(value ?? "").trim();
  const email = normalized.match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/i);
  if (!email || email.index === undefined || normalized.slice(0, email.index).trim().length < 2) return false;
  const domain = email[1].toLowerCase();
  return !["example.com", "example.org", "example.net"].includes(domain);
}

export type SecTickerExchangeRow = {
  cik: number;
  issuerName: string;
  ticker: string;
  exchange: string | null;
};

export type UsCatalogSecurity = {
  ticker: string;
  market: string;
  name?: string;
  country?: string;
};

export type UsSecurityMasterMatchStatus =
  | "exact"
  | "normalized"
  | "exchange_mismatch"
  | "ambiguous"
  | "unmatched";

export type UsSecurityMasterRecord = {
  catalogSecurityId: string;
  catalogTicker: string;
  catalogMarket: string;
  catalogName: string | null;
  matchStatus: UsSecurityMasterMatchStatus;
  canonicalSecurityId: string | null;
  canonicalMarket: string | null;
  currentExchange: string | null;
  secTicker: string | null;
  cik: number | null;
  issuerName: string | null;
  catalogMigrationNeeded: boolean;
  note: string | null;
};

const US_CATALOG_MARKETS = new Set(["NYSE/NASDAQ", "NYSE", "NASDAQ"]);

export function isUsListedCatalogMarket(market: string): boolean {
  return US_CATALOG_MARKETS.has(String(market ?? "").trim().toUpperCase());
}

/** SEC uses a dash for US share classes while parts of our catalog use a dot. */
export function normalizeUsTicker(ticker: string): string {
  return String(ticker ?? "")
    .trim()
    .toUpperCase()
    .replace(/[./]/g, "-")
    .replace(/\s+/g, "");
}

export function canonicalMarketFromSecExchange(exchange: string | null): string | null {
  const normalized = String(exchange ?? "").trim().toUpperCase();
  if (!normalized) return null;
  if (normalized === "NASDAQ") return "NASDAQ";
  if (normalized === "NYSE" || normalized === "NYSE AMERICAN" || normalized === "NYSE ARCA") return "NYSE";
  if (normalized === "CBOE") return "CBOE";
  if (normalized === "OTC") return "OTC";
  return normalized.replace(/\s+/g, "_");
}

export function parseSecTickerExchange(payload: unknown): SecTickerExchangeRow[] {
  if (!payload || typeof payload !== "object") throw new Error("SEC ticker payload must be an object");
  const data = payload as { fields?: unknown; data?: unknown };
  if (!Array.isArray(data.fields) || !Array.isArray(data.data)) throw new Error("SEC ticker payload is missing fields/data");

  const fields = data.fields.map(String);
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");
  if ([cikIndex, nameIndex, tickerIndex, exchangeIndex].some((index) => index < 0)) {
    throw new Error(`SEC ticker payload fields are unsupported: ${fields.join(",")}`);
  }

  const rows: SecTickerExchangeRow[] = [];
  for (const raw of data.data) {
    if (!Array.isArray(raw)) continue;
    const cik = Number(raw[cikIndex]);
    const issuerName = String(raw[nameIndex] ?? "").trim();
    const ticker = String(raw[tickerIndex] ?? "").trim().toUpperCase();
    const exchangeValue = raw[exchangeIndex];
    const exchange = exchangeValue === null || exchangeValue === undefined || exchangeValue === ""
      ? null
      : String(exchangeValue).trim();
    if (!Number.isSafeInteger(cik) || cik <= 0 || !issuerName || !ticker) continue;
    rows.push({ cik, issuerName, ticker, exchange });
  }
  return rows;
}

function explicitCatalogMarket(market: string): "NYSE" | "NASDAQ" | null {
  const normalized = market.trim().toUpperCase();
  return normalized === "NYSE" || normalized === "NASDAQ" ? normalized : null;
}

function chooseCandidate(stock: UsCatalogSecurity, candidates: readonly SecTickerExchangeRow[]): {
  selected: SecTickerExchangeRow | null;
  ambiguous: boolean;
} {
  if (candidates.length === 0) return { selected: null, ambiguous: false };
  if (candidates.length === 1) return { selected: candidates[0], ambiguous: false };

  const explicit = explicitCatalogMarket(stock.market);
  if (explicit) {
    const venueMatches = candidates.filter((candidate) => canonicalMarketFromSecExchange(candidate.exchange) === explicit);
    if (venueMatches.length === 1) return { selected: venueMatches[0], ambiguous: false };
  }

  const unique = new Map(candidates.map((candidate) => [`${candidate.cik}|${candidate.ticker}|${candidate.exchange ?? ""}`, candidate]));
  return unique.size === 1
    ? { selected: [...unique.values()][0], ambiguous: false }
    : { selected: null, ambiguous: true };
}

export function matchUsCatalogToSec(
  stocks: readonly UsCatalogSecurity[],
  secRows: readonly SecTickerExchangeRow[],
): UsSecurityMasterRecord[] {
  const byTicker = new Map<string, SecTickerExchangeRow[]>();
  for (const row of secRows) {
    const key = normalizeUsTicker(row.ticker);
    const current = byTicker.get(key) ?? [];
    current.push(row);
    byTicker.set(key, current);
  }

  return stocks
    .filter((stock) => isUsListedCatalogMarket(stock.market))
    .map<UsSecurityMasterRecord>((stock) => {
      const catalogTicker = stock.ticker.trim().toUpperCase();
      const catalogMarket = stock.market.trim().toUpperCase();
      const candidates = byTicker.get(normalizeUsTicker(catalogTicker)) ?? [];
      const { selected, ambiguous } = chooseCandidate(stock, candidates);
      const catalogSecurityId = securityIdOf(catalogMarket, catalogTicker);

      if (!selected) {
        return {
          catalogSecurityId,
          catalogTicker,
          catalogMarket,
          catalogName: stock.name?.trim() || null,
          matchStatus: ambiguous ? "ambiguous" as const : "unmatched" as const,
          canonicalSecurityId: null,
          canonicalMarket: null,
          currentExchange: null,
          secTicker: null,
          cik: null,
          issuerName: null,
          catalogMigrationNeeded: false,
          note: ambiguous
            ? `SEC has ${candidates.length} possible ticker associations; manual identity review required`
            : "No current SEC ticker/exchange association; this is not proof of delisting",
        };
      }

      const canonicalMarket = canonicalMarketFromSecExchange(selected.exchange);
      const canonicalSecurityId = canonicalMarket ? securityIdOf(canonicalMarket, selected.ticker) : null;
      const explicit = explicitCatalogMarket(catalogMarket);
      const exchangeMismatch = Boolean(explicit && canonicalMarket && explicit !== canonicalMarket);
      const normalizedOnly = catalogTicker !== selected.ticker;
      const catalogMigrationNeeded = Boolean(canonicalSecurityId && canonicalSecurityId !== catalogSecurityId);

      return {
        catalogSecurityId,
        catalogTicker,
        catalogMarket,
        catalogName: stock.name?.trim() || null,
        matchStatus: exchangeMismatch ? "exchange_mismatch" : normalizedOnly ? "normalized" : "exact",
        canonicalSecurityId,
        canonicalMarket,
        currentExchange: selected.exchange,
        secTicker: selected.ticker,
        cik: selected.cik,
        issuerName: selected.issuerName,
        catalogMigrationNeeded,
        note: exchangeMismatch
          ? `Catalog says ${explicit}; current SEC association says ${canonicalMarket}`
          : catalogMigrationNeeded
            ? "Catalog venue is unresolved or ticker notation differs; migrate only after downstream key review"
            : null,
      };
    })
    .sort((a, b) => a.catalogSecurityId.localeCompare(b.catalogSecurityId));
}
