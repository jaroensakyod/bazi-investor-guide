/**
 * Seed one tracked research pilot with development-only Yahoo fundamentals/EOD.
 * Production must replace this adapter with a commercially licensed provider.
 *
 * Examples:
 *   npm run research:seed-pilot
 *   npm run research:seed-pilot -- --pilot=us10-official-v1
 */
import { getAllStocks } from "../src/lib/investor/stock-database";
import { fetchFundamentals, loadFundamentalsCache, saveFundamentalsCache } from "../src/lib/market/fundamentals";
import { openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import { RESEARCH_PILOT_UNIVERSES, TH10_RESEARCH_PILOT } from "../src/lib/research/pilot-universe";
import { saveStoredPriceSeries } from "../src/lib/research/price-series-store";
import { YahooDevelopmentHistoryProvider } from "../src/lib/research/yahoo-development-history";

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

async function retry<T>(label: string, task: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await delay(attempt * 1_000);
    }
  }
  throw new Error(`${label}: ${(lastError as Error)?.message ?? String(lastError)}`);
}

const provider = new YahooDevelopmentHistoryProvider();
const requestedPilot = arg("pilot") ?? TH10_RESEARCH_PILOT.id;
const pilot = RESEARCH_PILOT_UNIVERSES.find((candidate) => candidate.id === requestedPilot);
if (!pilot) {
  throw new Error(`Unknown pilot '${requestedPilot}'. Available: ${RESEARCH_PILOT_UNIVERSES.map((item) => item.id).join(", ")}`);
}
const fundamentals = loadFundamentalsCache();
const stocks = getAllStocks();
const to = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const defaultFrom = new Date(Date.parse(to) - 5 * 365.25 * 86_400_000).toISOString().slice(0, 10);
let yahooSession: Awaited<ReturnType<typeof openYahooSession>> | null = null;
const results: Array<Record<string, unknown>> = [];

for (const item of pilot.securities) {
  const stock = stocks.find(
    (candidate) => candidate.ticker.toUpperCase() === item.ticker && candidate.market.toUpperCase() === item.market,
  );
  if (!stock) {
    results.push({ securityId: item.securityId, ok: false, error: "ไม่พบใน stock catalog" });
    continue;
  }

  const providerTicker = yahooTicker(stock.ticker, stock.market);
  try {
    const series = await retry(item.securityId, () =>
      provider.fetchSeries({
        securityId: item.securityId,
        ticker: providerTicker,
        exchange: stock.market,
        currency: stock.currency,
        timeframe: "1d",
        adjustment: "total_return",
        from: item.historyFrom ?? defaultFrom,
        to,
      }),
    );
    const stored = saveStoredPriceSeries(series.metadata, series.bars);

    const existing = fundamentals.get(providerTicker);
    const hasUsableFundamentals = existing
      && [existing.roe, existing.profitMargin, existing.revenueGrowth, existing.debtToEquity].some((value) => value !== undefined);
    if (!hasUsableFundamentals) {
      yahooSession ??= await openYahooSession();
      await retry(`${item.securityId} fundamentals`, () => fetchFundamentals(providerTicker, yahooSession as NonNullable<typeof yahooSession>, fundamentals));
      saveFundamentalsCache(fundamentals);
    }

    results.push({
      securityId: item.securityId,
      ok: true,
      rows: stored.rowCount,
      startAt: stored.startAt,
      endAt: stored.endAt,
      historyFromPolicy: item.historyFrom ?? defaultFrom,
    });
  } catch (error) {
    results.push({ securityId: item.securityId, ok: false, error: (error as Error).message });
  }
  await delay(400);
}

saveFundamentalsCache(fundamentals);
console.log(
  JSON.stringify(
    {
      warning: "Yahoo seed เป็น development-only ห้ามใช้ paid/public production",
      pilot: pilot.id,
      results,
    },
    null,
    2,
  ),
);
