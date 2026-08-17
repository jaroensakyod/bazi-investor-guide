import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_FILE = path.join(ROOT, "data", "stocks", "global.json");
const B3_TRADING_MANUAL_URL =
  "https://www.b3.com.br/data/files/3A/84/39/0C/7DBEE8100E866AE8AC094EA8/MPO%20de%20Negociacao%20da%20B3.pdf";

type CatalogStock = Record<string, unknown> & {
  ticker: string;
  market: string;
};

type CatalogPayload = {
  stocks: CatalogStock[];
  [key: string]: unknown;
};

function saveAtomic(file: string, payload: CatalogPayload): void {
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

function main(): void {
  const payload = JSON.parse(readFileSync(CATALOG_FILE, "utf8")) as CatalogPayload;
  if (!Array.isArray(payload.stocks)) throw new Error("Global catalog is missing stocks");

  const original = JSON.stringify(payload);
  const keys = new Set(payload.stocks.map((stock) =>
    `${stock.market.trim().toUpperCase()}:${stock.ticker.trim().toUpperCase()}`,
  ));
  let aliases = 0;
  let canonicalized = 0;

  const stocks = payload.stocks.map((stock): CatalogStock => {
    const market = stock.market.trim().toUpperCase();
    const ticker = stock.ticker.trim().toUpperCase();
    if (market !== "BOVESPA" || !ticker.endsWith("F")) return stock;

    const canonicalTicker = ticker.slice(0, -1);
    const evidence = { source: "B3 Trading Procedures Manual — odd-lot ticker suffix F", url: B3_TRADING_MANUAL_URL };
    if (keys.has(`${market}:${canonicalTicker}`)) {
      aliases += 1;
      return {
        ...stock,
        securityStatus: "trading_alias",
        canonicalTicker,
        statusReason: `${ticker} is the B3 odd-lot trading code for canonical security ${canonicalTicker}, not a separate listed security.`,
        statusEvidence: evidence,
      };
    }

    canonicalized += 1;
    const next: CatalogStock = {
      ...stock,
      ticker: canonicalTicker,
      statusReason: `Catalog identifier corrected from odd-lot code ${ticker} to canonical B3 security code ${canonicalTicker}.`,
      statusEvidence: evidence,
    };
    delete next.securityStatus;
    delete next.canonicalTicker;
    return next;
  });

  const seen = new Set<string>();
  for (const stock of stocks) {
    const key = `${stock.market.trim().toUpperCase()}:${stock.ticker.trim().toUpperCase()}`;
    if (seen.has(key)) throw new Error(`B3 normalization would create duplicate ${key}`);
    seen.add(key);
  }

  const nextPayload = { ...payload, stocks };
  const changed = original !== JSON.stringify(nextPayload);
  if (changed) saveAtomic(CATALOG_FILE, nextPayload);
  console.log(JSON.stringify({ file: CATALOG_FILE, changed, aliases, canonicalized }, null, 2));
}

main();
