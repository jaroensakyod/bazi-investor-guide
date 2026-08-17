/**
 * Seed one compressed 5-year daily series per current Thai security.
 * Development only: Yahoo data must be replaced by a licensed EOD provider
 * before any paid/public release.
 */
import { getResearchableThaiStocks } from "../src/lib/investor/stock-database";
import { yahooTicker } from "../src/lib/market/yahoo";
import { getSecurityBirth } from "../src/lib/research/security-event-repository";
import { loadStoredPriceSeries, saveStoredPriceSeries } from "../src/lib/research/price-series-store";
import { YahooDevelopmentHistoryProvider } from "../src/lib/research/yahoo-development-history";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Math.floor(Number(value ?? fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry<T>(task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 1_000);
    }
  }
  throw lastError;
}

function laterDate(left: string, right: string | null | undefined): string {
  return right && right > left ? right : left;
}

async function main(): Promise<void> {
  const refresh = flag("refresh");
  const concurrency = positiveInteger(arg("concurrency"), 3, 6);
  const delayMs = positiveInteger(arg("delay-ms"), 250, 10_000);
  const limit = positiveInteger(arg("limit"), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const requestedTickers = new Set(
    String(arg("tickers") ?? "")
      .split(",")
      .map((ticker) => ticker.trim().toUpperCase())
      .filter(Boolean),
  );
  const to = arg("to") ?? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const defaultFrom = arg("from") ?? new Date(Date.parse(to) - 5 * 365.25 * 86_400_000).toISOString().slice(0, 10);
  const provider = new YahooDevelopmentHistoryProvider();
  const stocks = getResearchableThaiStocks()
    .filter((stock) => requestedTickers.size === 0 || requestedTickers.has(stock.ticker.toUpperCase()))
    .slice(0, limit);
  const targets = stocks.filter((stock) => {
    if (refresh) return true;
    const birth = getSecurityBirth(stock.market, stock.ticker);
    return !loadStoredPriceSeries({ securityId: birth.securityId, timeframe: "1d", adjustment: "total_return" });
  });

  console.log(`Thai EOD development seed: ${targets.length} fetch / ${stocks.length} selected · concurrency=${concurrency}`);
  const results: Array<{
    securityId: string;
    ok: boolean;
    rows?: number;
    from?: string;
    endAt?: string | null;
    error?: string;
  }> = [];
  let cursor = 0;
  let completed = 0;
  const workers = Array.from({ length: Math.min(concurrency, Math.max(targets.length, 1)) }, async () => {
    while (cursor < targets.length) {
      const stock = targets[cursor];
      cursor += 1;
      const birth = getSecurityBirth(stock.market, stock.ticker);
      const providerTicker = yahooTicker(stock.ticker, stock.market);
      const from = laterDate(defaultFrom, birth.selectedEvent?.localDate);
      try {
        const series = await retry(() =>
          provider.fetchSeries({
            securityId: birth.securityId,
            ticker: providerTicker,
            exchange: stock.market,
            currency: stock.currency,
            timeframe: "1d",
            adjustment: "total_return",
            from,
            to,
          }),
        );
        if (series.bars.length === 0) throw new Error("ไม่มี daily bars");
        const stored = saveStoredPriceSeries(series.metadata, series.bars);
        results.push({ securityId: birth.securityId, ok: true, rows: stored.rowCount, from, endAt: stored.endAt });
      } catch (error) {
        results.push({ securityId: birth.securityId, ok: false, from, error: (error as Error)?.message ?? String(error) });
      }
      completed += 1;
      if (completed % 20 === 0 || completed === targets.length) {
        const ok = results.filter((result) => result.ok).length;
        console.log(`  progress ${completed}/${targets.length} · ok=${ok} · failed=${results.length - ok}`);
      }
      await delay(delayMs);
    }
  });
  await Promise.all(workers);

  const ok = results.filter((result) => result.ok).length;
  const failed = results.filter((result) => !result.ok);
  console.log(
    JSON.stringify(
      {
        selected: stocks.length,
        fetched: targets.length,
        ok,
        skippedCached: stocks.length - targets.length,
        failed,
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
