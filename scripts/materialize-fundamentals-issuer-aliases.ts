/**
 * Resolve non-common US securities to issuer-level fundamentals.
 * The alias is explicit and audited; ratios are never presented as if they
 * were calculated specifically for the preferred/debt security.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  fetchFundamentals,
  fundamentalsCoreFieldCount,
  fundamentalsLicense,
  hasUsableFundamentals,
  loadFundamentalsCache,
  materializeIssuerFundamentalsAlias,
  saveFundamentalsCache,
  YAHOO_DEVELOPMENT_FUNDAMENTALS_SOURCE,
} from "../src/lib/market/fundamentals";
import { openYahooSession } from "../src/lib/market/yahoo";
import {
  delay,
  loadMarketDataFetchLedger,
  recordMarketDataFetch,
  retryWithBackoff,
  saveMarketDataFetchLedger,
} from "../src/lib/research/market-data-batch";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ALIAS_FILE = path.join(ROOT, "data/curated/fundamentals-issuer-aliases.json");

type AliasRecord = {
  securityId: string;
  providerTicker: string;
  issuerProviderTicker: string;
  reason: string;
};

type AliasFile = {
  schemaVersion: 1;
  records: AliasRecord[];
};

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function loadAliases(): AliasRecord[] {
  const payload = JSON.parse(readFileSync(ALIAS_FILE, "utf8")) as AliasFile;
  if (payload.schemaVersion !== 1 || !Array.isArray(payload.records)) throw new Error("Invalid issuer alias file");
  const seen = new Set<string>();
  for (const record of payload.records) {
    if (!record.securityId || !record.providerTicker || !record.issuerProviderTicker || !record.reason) {
      throw new Error("Issuer alias record is incomplete");
    }
    if (seen.has(record.providerTicker)) throw new Error(`Duplicate issuer alias ${record.providerTicker}`);
    seen.add(record.providerTicker);
  }
  return payload.records;
}

async function main(): Promise<void> {
  const aliases = loadAliases();
  const cache = loadFundamentalsCache();
  const ledger = loadMarketDataFetchLedger();
  let session: Awaited<ReturnType<typeof openYahooSession>> | null = null;
  let fetchedIssuers = 0;
  const results: Array<{ securityId: string; ok: boolean; issuerTicker: string; error?: string }> = [];

  // Make provenance explicit for legacy rows that predate the source/scope schema.
  for (const [ticker, fundamentals] of cache) {
    cache.set(ticker, {
      ...fundamentals,
      source: fundamentals.source ?? YAHOO_DEVELOPMENT_FUNDAMENTALS_SOURCE,
      scope: fundamentals.scope ?? "issuer",
      issuerTicker: fundamentals.issuerTicker ?? ticker,
      resolution: fundamentals.resolution ?? "direct_ticker",
    });
  }

  for (const alias of aliases) {
    let issuerFundamentals = cache.get(alias.issuerProviderTicker);
    if (!hasUsableFundamentals(issuerFundamentals) && !flag("no-fetch")) {
      session ??= await openYahooSession();
      issuerFundamentals = await retryWithBackoff(
        () => fetchFundamentals(alias.issuerProviderTicker, session as NonNullable<typeof session>, cache, { forceRefresh: true }),
        { attempts: 3, baseDelayMs: 1_500 },
      ) ?? undefined;
      fetchedIssuers += 1;
      await delay(700);
    }
    const current = cache.get(alias.providerTicker);
    const materialized = materializeIssuerFundamentalsAlias(
      alias.providerTicker,
      alias.issuerProviderTicker,
      issuerFundamentals,
      current,
    );
    if (!materialized) {
      results.push({ securityId: alias.securityId, ok: false, issuerTicker: alias.issuerProviderTicker, error: "issuer fundamentals unavailable" });
      recordMarketDataFetch(ledger, {
        dataset: "fundamentals",
        securityId: alias.securityId,
        provider: "curated-issuer-alias",
        providerTicker: alias.providerTicker,
        status: "no_data",
        error: `issuer ${alias.issuerProviderTicker} unavailable`,
      });
      continue;
    }
    if (fundamentalsLicense(current) !== "commercial" || fundamentalsLicense(materialized) === "commercial") {
      cache.set(alias.providerTicker, materialized);
    }
    results.push({ securityId: alias.securityId, ok: true, issuerTicker: alias.issuerProviderTicker });
    recordMarketDataFetch(ledger, {
      dataset: "fundamentals",
      securityId: alias.securityId,
      provider: "curated-issuer-alias",
      providerTicker: alias.providerTicker,
      status: "succeeded",
      rowCount: fundamentalsCoreFieldCount(materialized),
    });
  }

  saveFundamentalsCache(cache);
  saveMarketDataFetchLedger(ledger);
  console.log(
    JSON.stringify(
      {
        aliases: aliases.length,
        resolved: results.filter((result) => result.ok).length,
        unresolved: results.filter((result) => !result.ok),
        fetchedIssuers,
        cacheRows: cache.size,
        scope: "issuer_level",
        commercialUse: "INHERITS_SOURCE_RIGHTS_AND_REMAINS_BLOCKED_FOR_YAHOO",
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
