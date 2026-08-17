/**
 * Resumable daily EOD fetch for a controlled research universe.
 *
 * Yahoo is a development-only adapter. The shared store keeps one compressed
 * series per security and this script refuses to contaminate commercial rows.
 *
 * Examples:
 *   npm run research:history -- --ticker=AAPL --market=NASDAQ
 *   npm run research:history -- --country=US --limit=100 --concurrency=3
 *   npm run research:history -- --markets=NASDAQ,NYSE --limit=250 --dry-run
 */
import type { StockEntry } from "../src/lib/investor/stock-database";
import { getResearchableStocks } from "../src/lib/investor/stock-database";
import { loadSnapshot } from "../src/lib/market/market-data";
import { yahooTicker } from "../src/lib/market/yahoo";
import {
  commaSeparatedSet,
  delay,
  isDateWithinDays,
  loadMarketDataFetchLedger,
  positiveInteger,
  recordMarketDataFetch,
  retryWithBackoff,
  saveMarketDataFetchLedger,
  selectMarketDataTargets,
  shouldDeferMarketDataRetry,
  type MarketDataTarget,
} from "../src/lib/research/market-data-batch";
import { loadStoredPriceSeries, saveStoredPriceSeries } from "../src/lib/research/price-series-store";
import { getSecurityBirth } from "../src/lib/research/security-event-repository";
import { securityIdOf } from "../src/lib/research/security-birth";
import { YahooDevelopmentHistoryProvider } from "../src/lib/research/yahoo-development-history";

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

function priorityOf(stock: StockEntry, marketCap: number): number {
  return tierWeight(stock) + (marketCap > 0 ? Math.log10(marketCap + 1) * 100 : 0) + (stock.isHighLiquidity ? 500 : 0);
}

function laterDate(left: string, right: string | null | undefined): string {
  return right && right > left ? right : left;
}

function overlapFrom(endAt: string): string {
  return new Date(Date.parse(endAt) - 10 * 86_400_000).toISOString().slice(0, 10);
}

function isTransient(error: unknown): boolean {
  const message = (error as Error)?.message ?? String(error);
  return /HTTP (429|5\d\d)|fetch failed|ECONN|ETIMEDOUT|ENOTFOUND/i.test(message);
}

async function main(): Promise<void> {
  const refresh = flag("refresh");
  const dryRun = flag("dry-run");
  const refreshDays = positiveInteger(arg("refresh-days"), 7, 60);
  const retryAfterHours = positiveInteger(arg("retry-after-hours"), 24, 720);
  const concurrency = positiveInteger(arg("concurrency"), 3, 6);
  const delayMs = positiveInteger(arg("delay-ms"), 250, 10_000);
  const limit = positiveInteger(arg("limit"), 100, Number.MAX_SAFE_INTEGER);
  const years = positiveInteger(arg("years"), 5, 30);
  const tickers = commaSeparatedSet(arg("tickers") ?? arg("ticker"));
  const markets = commaSeparatedSet(arg("markets") ?? arg("market"));
  const country = arg("country")?.trim().toUpperCase();
  if (tickers.size === 0 && markets.size === 0 && !country) {
    throw new Error("Specify --ticker, --tickers, --market, --markets, or --country; a global unbounded EOD fetch is disabled.");
  }

  const provider = new YahooDevelopmentHistoryProvider();
  const ledger = loadMarketDataFetchLedger();
  const snapshot = loadSnapshot();
  const stocks = getResearchableStocks();
  const stockBySecurityId = new Map<string, StockEntry>();
  const candidates: MarketDataTarget[] = stocks
    .map((stock) => {
      const securityId = securityIdOf(stock.market, stock.ticker);
      stockBySecurityId.set(securityId, stock);
      const providerTicker = yahooTicker(stock.ticker, stock.market);
      const snapshotCap = snapshot?.quotes[providerTicker]?.marketCap ?? 0;
      const catalogCap = Number((stock as StockEntry & { marketCapUsd?: number }).marketCapUsd ?? 0);
      return {
        securityId,
        ticker: stock.ticker,
        providerTicker,
        market: stock.market,
        country: stock.country,
        currency: stock.currency,
        priority: priorityOf(stock, snapshotCap || catalogCap),
      };
    })
    .filter((target) => Boolean(target.providerTicker));

  const selectedUniverse = selectMarketDataTargets(candidates, { tickers, markets, country });
  const existingBySecurity = new Map(
    selectedUniverse.map((target) => [
      target.securityId,
      loadStoredPriceSeries({ securityId: target.securityId, timeframe: "1d", adjustment: "total_return" }),
    ]),
  );
  const protectedCommercial = selectedUniverse.filter(
    (target) => existingBySecurity.get(target.securityId)?.metadata.source.license === "commercial",
  );
  const fresh = selectedUniverse.filter((target) => {
    const existing = existingBySecurity.get(target.securityId);
    return Boolean(existing?.bars.length && isDateWithinDays(existing.endAt, refreshDays));
  }).length;
  const recentlyChecked = selectedUniverse.filter((target) => {
    const existing = existingBySecurity.get(target.securityId);
    return Boolean(existing?.bars.length && isDateWithinDays(existing.metadata.source.fetchedAt, refreshDays));
  }).length;
  const pending = selectedUniverse
    .filter((target) => existingBySecurity.get(target.securityId)?.metadata.source.license !== "commercial")
    .filter((target) => {
      const existing = existingBySecurity.get(target.securityId);
      return refresh
        || !existing?.bars.length
        || (
          !isDateWithinDays(existing.endAt, refreshDays)
          && !isDateWithinDays(existing.metadata.source.fetchedAt, refreshDays)
        );
    })
    .filter((target) => flag("retry-failed") || !shouldDeferMarketDataRetry(
      ledger,
      { dataset: "eod_1d", securityId: target.securityId, provider: provider.id },
      retryAfterHours,
    ))
    .slice(0, limit);

  console.log(
    `EOD development batch: selected=${selectedUniverse.length} pending=${pending.length} fresh=${fresh} recently-checked=${recentlyChecked} protected-commercial=${protectedCommercial.length} concurrency=${concurrency}`,
  );
  if (dryRun || pending.length === 0) {
    console.log(
      JSON.stringify(
        {
          dryRun,
          selected: selectedUniverse.length,
          pending: pending.length,
          fresh,
          recentlyChecked,
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

  const to = arg("to") ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const defaultFrom = arg("from") ?? new Date(Date.parse(to) - years * 365.25 * 86_400_000).toISOString().slice(0, 10);
  const results: Array<{
    securityId: string;
    ok: boolean;
    rows?: number;
    fetchedFrom?: string;
    endAt?: string | null;
    error?: string;
  }> = [];
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, pending.length) }, async () => {
    while (cursor < pending.length) {
      const target = pending[cursor];
      cursor += 1;
      const stock = stockBySecurityId.get(target.securityId) as StockEntry;
      const birth = getSecurityBirth(stock.market, stock.ticker);
      const existing = existingBySecurity.get(target.securityId);
      const listingFloor = birth.selectedEvent?.localDate;
      const historyFloor = laterDate(defaultFrom, listingFloor);
      const from = !refresh && existing?.endAt
        ? laterDate(historyFloor, overlapFrom(existing.endAt))
        : historyFloor;
      try {
        const series = await retryWithBackoff(
          () => provider.fetchSeries({
            securityId: target.securityId,
            ticker: target.providerTicker,
            exchange: target.market,
            currency: target.currency,
            timeframe: "1d",
            adjustment: "total_return",
            from,
            to,
          }),
          { attempts: 3, baseDelayMs: 1_000, shouldRetry: isTransient },
        );
        if (series.bars.length === 0) {
          recordMarketDataFetch(ledger, {
            dataset: "eod_1d",
            securityId: target.securityId,
            provider: provider.id,
            providerTicker: target.providerTicker,
            status: "no_data",
            error: "chart returned no daily bars",
          });
          results.push({ securityId: target.securityId, ok: false, fetchedFrom: from, error: "no daily bars" });
        } else {
          const stored = saveStoredPriceSeries(series.metadata, series.bars);
          recordMarketDataFetch(ledger, {
            dataset: "eod_1d",
            securityId: target.securityId,
            provider: provider.id,
            providerTicker: target.providerTicker,
            status: "succeeded",
            rowCount: stored.rowCount,
          });
          results.push({
            securityId: target.securityId,
            ok: true,
            rows: stored.rowCount,
            fetchedFrom: from,
            endAt: stored.endAt,
          });
        }
      } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        recordMarketDataFetch(ledger, {
          dataset: "eod_1d",
          securityId: target.securityId,
          provider: provider.id,
          providerTicker: target.providerTicker,
          status: "failed",
          error: message,
        });
        results.push({ securityId: target.securityId, ok: false, fetchedFrom: from, error: message });
      }
      completed += 1;
      saveMarketDataFetchLedger(ledger);
      if (completed % 20 === 0 || completed === pending.length) {
        const ok = results.filter((result) => result.ok).length;
        console.log(`  progress ${completed}/${pending.length} | ok=${ok} | no-data/failed=${results.length - ok}`);
      }
      await delay(delayMs);
    }
  });
  await Promise.all(workers);
  saveMarketDataFetchLedger(ledger);

  const ok = results.filter((result) => result.ok).length;
  console.log(
    JSON.stringify(
      {
        selected: selectedUniverse.length,
        fetched: pending.length,
        ok,
        noDataOrFailed: results.length - ok,
        failures: results.filter((result) => !result.ok),
        storage: "one gzip series per security; no per-user duplication",
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
