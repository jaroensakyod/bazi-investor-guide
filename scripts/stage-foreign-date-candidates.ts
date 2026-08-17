/**
 * Stage Yahoo firstTradeDateMilliseconds for foreign securities as a review
 * queue only. This output must never be imported into data/security-events.json.
 *
 * Examples:
 *   npm run research:stage-foreign-date-candidates
 *   npm run research:stage-foreign-date-candidates -- --markets=NASDAQ,NYSE --limit=100
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import { fetchQuotes, openYahooSession, yahooTicker } from "../src/lib/market/yahoo";
import { buildYahooDateCandidate } from "../src/lib/research/provider-date-candidate";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "foreign-provider-date-candidates.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function positiveInteger(value: string | undefined, fallback: number, maximum: number): number {
  const parsed = Math.floor(Number(value ?? fallback));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, maximum) : fallback;
}

function saveAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

const requestedMarkets = new Set(
  String(arg("markets") ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean),
);
const limit = positiveInteger(arg("limit"), Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
const delayMs = positiveInteger(arg("delay-ms"), 800, 10_000);
const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
const stocks = getGlobalStocks()
  .filter(isResearchableStock)
  .filter((stock) => requestedMarkets.size === 0 || requestedMarkets.has(stock.market.toUpperCase()))
  .slice(0, limit);
const providerSymbols = [...new Set(stocks.map((stock) => yahooTicker(stock.ticker, stock.market)).filter(Boolean))];

console.log(`Staging provider date candidates for ${stocks.length} foreign securities (${providerSymbols.length} Yahoo symbols)`);
const session = await openYahooSession();
const quotes = await fetchQuotes(providerSymbols, session, 25, delayMs, {
  onProgress(done, total) {
    if (done === total || done % 250 === 0) console.log(`  quote metadata ${done}/${total}`);
  },
});
const generatedAt = new Date().toISOString();
const nowMs = Date.parse(generatedAt);
const records = stocks.map((stock) => {
  const providerTicker = yahooTicker(stock.ticker, stock.market);
  return buildYahooDateCandidate(stock, providerTicker, quotes.get(providerTicker), nowMs);
});
const summary = {
  total: records.length,
  candidate: records.filter((record) => record.status === "candidate").length,
  missing: records.filter((record) => record.status === "missing").length,
  rejected: records.filter((record) => record.status === "rejected").length,
  byMarket: Object.fromEntries(
    [...new Set(records.map((record) => record.market))].sort().map((market) => {
      const marketRecords = records.filter((record) => record.market === market);
      return [market, {
        total: marketRecords.length,
        candidate: marketRecords.filter((record) => record.status === "candidate").length,
      }];
    }),
  ),
};

saveAtomic(output, {
  schemaVersion: 1,
  generatedAt,
  source: {
    name: "Yahoo Finance quote metadata",
    authority: "secondary",
    rightsStatus: "development_only_not_for_paid_or_public_production",
    field: "firstTradeDateMilliseconds",
  },
  policy: {
    canonicalImportAllowed: false,
    timeUsable: false,
    purpose: "Prioritization queue for exchange/issuer verification only",
  },
  summary,
  records,
});
console.log(JSON.stringify({ output, summary }, null, 2));

