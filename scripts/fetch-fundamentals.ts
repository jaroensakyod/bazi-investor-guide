/**
 * Resumable fundamentals fetch for the research universe.
 *
 * Yahoo is intentionally development-only. New rows carry provenance and the
 * script will never replace a commercially licensed cache row with Yahoo data.
 *
 * Examples:
 *   npm run research:fundamentals -- --country=US --limit=100
 *   npm run research:fundamentals -- --markets=NASDAQ,NYSE --limit=250
 *   npm run research:fundamentals -- --tickers=AAPL,MSFT --refresh
 *   npm run research:fundamentals -- --country=US --limit=100 --dry-run
 */
import type { StockEntry } from "../src/lib/investor/stock-database";
import { getResearchableStocks } from "../src/lib/investor/stock-database";
import {
  fetchFundamentals,
  fundamentalsCoreFieldCount,
  fundamentalsLicense,
  hasUsableFundamentals,
  isFundamentalsFresh,
  loadFundamentalsCache,
  saveFundamentalsCache,
} from "../src/lib/market/fundamentals";
import { loadSnapshot } from "../src/lib/market/market-data";
import { openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import {
  commaSeparatedSet,
  delay,
  loadMarketDataFetchLedger,
  positiveInteger,
  recordMarketDataFetch,
  retryWithBackoff,
  saveMarketDataFetchLedger,
  selectMarketDataTargets,
  shouldDeferMarketDataRetry,
  type MarketDataTarget,
} from "../src/lib/research/market-data-batch";
import { securityIdOf } from "../src/lib/research/security-birth";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function tierWeight(stock: StockEntry): number {
  const tier = stock.tier.toLowerCase();
  if (["set50", "mega"].includes(tier)) return 4_000;
  if (["set100", "large"].includes(tier)) return 3_000;
  if (stock.growthStage === "mid") return 2_000;
  if (stock.growthStage === "small") return 1_000;
  return 0;
}

function candidatePriority(stock: StockEntry, marketCap: number): number {
  const capScore = marketCap > 0 ? Math.log10(marketCap + 1) * 100 : 0;
  return tierWeight(stock) + capScore + (stock.isHighLiquidity ? 500 : 0);
}

async function main(): Promise<void> {
  const refresh = flag("refresh");
  const dryRun = flag("dry-run");
  const refreshDays = positiveInteger(arg("refresh-days"), 120, 730);
  const retryAfterHours = positiveInteger(arg("retry-after-hours"), 24, 720);
  const concurrency = positiveInteger(arg("concurrency"), 1, 3);
  const delayMs = positiveInteger(arg("delay-ms"), 700, 10_000);
  const limit = positiveInteger(arg("limit"), 200, Number.MAX_SAFE_INTEGER);
  const tickers = commaSeparatedSet(arg("tickers"));
  const markets = commaSeparatedSet(arg("markets") ?? arg("market"));
  const country = arg("country")?.trim().toUpperCase();
  const hasExplicitUniverse = tickers.size > 0 || markets.size > 0 || Boolean(country);
  const snapshot = loadSnapshot();
  const cache = loadFundamentalsCache();
  const ledger = loadMarketDataFetchLedger();

  const candidates: MarketDataTarget[] = getResearchableStocks()
    .map((stock) => {
      const providerTicker = yahooTicker(stock.ticker, stock.market);
      const snapshotCap = snapshot?.quotes[providerTicker]?.marketCap ?? 0;
      const catalogCap = Number((stock as StockEntry & { marketCapUsd?: number }).marketCapUsd ?? 0);
      return {
        securityId: securityIdOf(stock.market, stock.ticker),
        ticker: stock.ticker,
        providerTicker,
        market: stock.market,
        country: stock.country,
        currency: stock.currency,
        priority: candidatePriority(stock, snapshotCap || catalogCap),
      };
    })
    .filter((target) => Boolean(target.providerTicker));

  const selectedUniverse = selectMarketDataTargets(candidates, { tickers, markets, country });
  const protectedCommercial = selectedUniverse.filter(
    (target) => fundamentalsLicense(cache.get(target.providerTicker)) === "commercial",
  );
  const pending = selectedUniverse
    .filter((target) => fundamentalsLicense(cache.get(target.providerTicker)) !== "commercial")
    .filter((target) => refresh || !isFundamentalsFresh(cache.get(target.providerTicker), refreshDays))
    .filter((target) => flag("retry-failed") || !shouldDeferMarketDataRetry(
      ledger,
      {
        dataset: "fundamentals",
        securityId: target.securityId,
        provider: "yahoo-development-quote-summary",
      },
      retryAfterHours,
    ))
    .slice(0, limit);
  const fresh = selectedUniverse.filter((target) =>
    isFundamentalsFresh(cache.get(target.providerTicker), refreshDays),
  ).length;

  console.log(
    `Fundamentals development batch: selected=${selectedUniverse.length} pending=${pending.length} fresh=${fresh} protected-commercial=${protectedCommercial.length} concurrency=${concurrency}`,
  );
  if (!hasExplicitUniverse) {
    console.log(`Default queue is priority-ranked across all markets and capped at ${limit}; use --country or --markets for a controlled universe.`);
  }
  if (dryRun || pending.length === 0) {
    console.log(
      JSON.stringify(
        {
          dryRun,
          selected: selectedUniverse.length,
          pending: pending.length,
          fresh,
          protectedCommercial: protectedCommercial.length,
          preview: pending.slice(0, 20).map((target) => target.securityId),
          commercialUse: "BLOCKED_DEVELOPMENT_ONLY",
        },
        null,
        2,
      ),
    );
    return;
  }

  const session = await openYahooSession();
  const results: Array<{ securityId: string; ok: boolean; coreFields?: number; error?: string }> = [];
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (cursor < pending.length) {
      const target = pending[cursor];
      cursor += 1;
      try {
        const fundamentals = await retryWithBackoff(
          () => fetchFundamentals(target.providerTicker, session, cache, { forceRefresh: true }),
          { attempts: 3, baseDelayMs: 1_500 },
        );
        if (!hasUsableFundamentals(fundamentals)) {
          recordMarketDataFetch(ledger, {
            dataset: "fundamentals",
            securityId: target.securityId,
            provider: "yahoo-development-quote-summary",
            providerTicker: target.providerTicker,
            status: "no_data",
            error: "financialData returned no usable fields",
          });
          results.push({ securityId: target.securityId, ok: false, error: "no usable fields" });
        } else {
          const coreFields = fundamentalsCoreFieldCount(fundamentals);
          recordMarketDataFetch(ledger, {
            dataset: "fundamentals",
            securityId: target.securityId,
            provider: "yahoo-development-quote-summary",
            providerTicker: target.providerTicker,
            status: "succeeded",
            rowCount: coreFields,
          });
          results.push({ securityId: target.securityId, ok: true, coreFields });
        }
      } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        recordMarketDataFetch(ledger, {
          dataset: "fundamentals",
          securityId: target.securityId,
          provider: "yahoo-development-quote-summary",
          providerTicker: target.providerTicker,
          status: "failed",
          error: message,
        });
        results.push({ securityId: target.securityId, ok: false, error: message });
      }
      completed += 1;
      if (completed % 10 === 0 || completed === pending.length) {
        saveFundamentalsCache(cache);
        saveMarketDataFetchLedger(ledger);
        const ok = results.filter((result) => result.ok).length;
        console.log(`  progress ${completed}/${pending.length} | ok=${ok} | no-data/failed=${results.length - ok}`);
      }
      await delay(delayMs);
    }
  });
  await Promise.all(workers);
  saveFundamentalsCache(cache);
  saveMarketDataFetchLedger(ledger);

  const ok = results.filter((result) => result.ok).length;
  console.log(
    JSON.stringify(
      {
        selected: selectedUniverse.length,
        fetched: pending.length,
        ok,
        noDataOrFailed: results.length - ok,
        cacheRows: cache.size,
        failures: results.filter((result) => !result.ok),
        commercialUse: "BLOCKED_DEVELOPMENT_ONLY",
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
