import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  NASDAQ_LISTED_DIRECTORY_URL,
  OTHER_LISTED_DIRECTORY_URL,
  matchUsCatalogToNasdaqDirectory,
  parseNasdaqListedDirectory,
  parseOtherListedDirectory,
  parseUsCurrentVenueIdentityAliases,
} from "../src/lib/research/nasdaq-symbol-directory";
import { isUsListedCatalogMarket } from "../src/lib/research/sec-security-master";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "us-current-venues.json");
const DEFAULT_IDENTITY_ALIASES = path.join(ROOT, "data", "curated", "us-current-venue-identity-aliases.json");

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

async function loadText(inputArg: string, url: string): Promise<{ text: string; sha256: string }> {
  const input = arg(inputArg);
  const bytes = input ? readFileSync(path.resolve(input)) : await (async () => {
    const response = await fetch(url, {
      headers: { Accept: "text/plain", "User-Agent": "bazi-investor-guide-research/1.0" },
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Nasdaq Trader Symbol Directory HTTP ${response.status}`);
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length < 100 || data.length > 5_000_000) throw new Error(`Unexpected Symbol Directory size ${data.length}`);
    return data;
  })();
  return { text: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") };
}

const [nasdaq, other] = await Promise.all([
  loadText("nasdaq-input", NASDAQ_LISTED_DIRECTORY_URL),
  loadText("other-input", OTHER_LISTED_DIRECTORY_URL),
]);
const catalog = getGlobalStocks().filter(isResearchableStock).filter((stock) => isUsListedCatalogMarket(stock.market));
const directoryRows = [...parseNasdaqListedDirectory(nasdaq.text), ...parseOtherListedDirectory(other.text)];
const identityAliasInput = path.resolve(arg("identity-aliases-input") ?? DEFAULT_IDENTITY_ALIASES);
const identityAliases = existsSync(identityAliasInput)
  ? parseUsCurrentVenueIdentityAliases(JSON.parse(readFileSync(identityAliasInput, "utf8")) as unknown)
  : new Map();
const records = matchUsCatalogToNasdaqDirectory(catalog, directoryRows, identityAliases);
const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
const summary = {
  catalog: records.length,
  venueResolved: records.filter((record) => record.venueResolved).length,
  legacyCombinedCatalog: records.filter((record) => record.catalogMarket === "NYSE/NASDAQ").length,
  legacyCombinedResolved: records.filter((record) => record.catalogMarket === "NYSE/NASDAQ" && record.venueResolved).length,
  nasdaq: records.filter((record) => record.canonicalMarket === "NASDAQ" && record.venueResolved).length,
  nyseFamily: records.filter((record) => record.canonicalMarket === "NYSE" && record.venueResolved).length,
  exchangeMismatch: records.filter((record) => record.status === "exchange_mismatch").length,
  identityMismatch: records.filter((record) => record.status === "identity_mismatch").length,
  identityAliasesUsed: records.filter((record) => record.identityEvidenceUrl).length,
  ambiguous: records.filter((record) => record.status === "ambiguous").length,
  unmatched: records.filter((record) => record.status === "unmatched").length,
  unsupportedVenue: records.filter((record) => record.status === "unsupported_venue").length,
};
saveAtomic(output, {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: "Current official venue identity only; no listing or first-trading date is claimed.",
  rights: "Internal research use pending Nasdaq commercial data-rights review.",
  sources: [
    { name: "Nasdaq-listed Symbol Directory", url: NASDAQ_LISTED_DIRECTORY_URL, sha256: nasdaq.sha256 },
    { name: "Other exchange-listed Symbol Directory", url: OTHER_LISTED_DIRECTORY_URL, sha256: other.sha256 },
  ],
  summary,
  records,
});
console.log(JSON.stringify({ output, summary }, null, 2));
