/**
 * Match the US-listed catalog to the SEC's current ticker/CIK/exchange map.
 * This source proves current identity/venue only; it does not provide an IPO,
 * exchange-admission or first-trading date.
 *
 * SEC asks automated clients to identify a company and contact email:
 *   SEC_USER_AGENT="Company Name admin@example.com" npm run research:stage-sec-master
 * A previously downloaded official file can be supplied with --input=...
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  SEC_TICKER_EXCHANGE_URL,
  isAcceptableSecUserAgent,
  isUsListedCatalogMarket,
  matchUsCatalogToSec,
  parseSecTickerExchange,
} from "../src/lib/research/sec-security-master";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "us-sec-security-master.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function saveAtomic(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
}

async function loadPayload(): Promise<{ bytes: Buffer; sourceUrl: string }> {
  const input = arg("input");
  if (input) {
    const absolute = path.resolve(input);
    return { bytes: readFileSync(absolute), sourceUrl: SEC_TICKER_EXCHANGE_URL };
  }

  const userAgent = String(arg("user-agent") ?? process.env.SEC_USER_AGENT ?? "").trim();
  if (!isAcceptableSecUserAgent(userAgent)) {
    throw new Error(
      "Set SEC_USER_AGENT to an organization name plus a real monitored contact email before automated SEC access, or pass --input=<official JSON>",
    );
  }
  const response = await fetch(SEC_TICKER_EXCHANGE_URL, {
    headers: {
      "User-Agent": userAgent,
      "Accept-Encoding": "gzip, deflate",
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`SEC ticker map HTTP ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), sourceUrl: response.url || SEC_TICKER_EXCHANGE_URL };
}

const { bytes, sourceUrl } = await loadPayload();
const payload = JSON.parse(bytes.toString("utf8")) as unknown;
const secRows = parseSecTickerExchange(payload);
const catalog = getGlobalStocks()
  .filter(isResearchableStock)
  .filter((stock) => isUsListedCatalogMarket(stock.market));
const records = matchUsCatalogToSec(catalog, secRows);
const generatedAt = new Date().toISOString();
const matched = records.filter((record) => !["ambiguous", "unmatched"].includes(record.matchStatus));
const summary = {
  catalog: records.length,
  matched: matched.length,
  unmatched: records.filter((record) => record.matchStatus === "unmatched").length,
  ambiguous: records.filter((record) => record.matchStatus === "ambiguous").length,
  exchangeMismatch: records.filter((record) => record.matchStatus === "exchange_mismatch").length,
  catalogMigrationNeeded: records.filter((record) => record.catalogMigrationNeeded).length,
  secRows: secRows.length,
};
const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);

saveAtomic(output, {
  schemaVersion: 1,
  generatedAt,
  source: {
    name: "U.S. Securities and Exchange Commission ticker/exchange associations",
    authority: "regulator",
    url: sourceUrl,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    displayRights: "allowed",
    scopeWarning: "SEC states that it periodically updates the associations but does not guarantee accuracy or scope",
  },
  policy: {
    providesCurrentIdentity: true,
    providesListingDate: false,
    canonicalVenueMigrationAutomatic: false,
  },
  summary,
  records,
});
console.log(JSON.stringify({ output, summary }, null, 2));
