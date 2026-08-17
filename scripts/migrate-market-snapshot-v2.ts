/** One-time, idempotent migration for dividend-yield normalization v2. */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  MARKET_CACHE_DIR,
  MARKET_NORMALIZATION_VERSION,
  upgradeMarketSnapshot,
  type MarketSnapshot,
} from "../src/lib/market/market-data";

let migrated = 0;
let alreadyCurrent = 0;
for (const entry of readdirSync(MARKET_CACHE_DIR, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
  const file = path.join(MARKET_CACHE_DIR, entry.name);
  const snapshot = JSON.parse(readFileSync(file, "utf8")) as MarketSnapshot;
  if ((snapshot.normalizationVersion ?? 1) >= MARKET_NORMALIZATION_VERSION) {
    alreadyCurrent += 1;
    continue;
  }
  const upgraded = upgradeMarketSnapshot(snapshot);
  writeFileSync(file, `${JSON.stringify(upgraded, null, 1)}\n`, "utf8");
  migrated += 1;
}

console.log(JSON.stringify({ migrated, alreadyCurrent, normalizationVersion: MARKET_NORMALIZATION_VERSION }, null, 2));
