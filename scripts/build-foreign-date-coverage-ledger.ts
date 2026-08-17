import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import { buildForeignDateCoverageLedger } from "../src/lib/research/foreign-date-coverage-ledger";
import { currentVenueResolutionsFromSnapshot } from "../src/lib/research/nasdaq-symbol-directory";
import { loadSecurityEventFile } from "../src/lib/research/security-event-store";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUTPUT = path.join(ROOT, "data", "staging", "foreign-date-coverage-ledger.json");
const DEFAULT_PROVIDER_INPUT = path.join(ROOT, "data", "staging", "foreign-provider-date-candidates.json");
const DEFAULT_VENUE_INPUT = path.join(ROOT, "data", "staging", "us-current-venues.json");

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

function loadProviderCandidateIds(file: string): Set<string> {
  if (!existsSync(file)) return new Set<string>();
  const payload = JSON.parse(readFileSync(file, "utf8")) as {
    records?: Array<{ securityId?: unknown; status?: unknown }>;
  };
  return new Set(
    (payload.records ?? [])
      .filter((record) => record.status === "candidate" && typeof record.securityId === "string")
      .map((record) => String(record.securityId)),
  );
}

function main(): void {
  const output = path.resolve(arg("output") ?? DEFAULT_OUTPUT);
  const providerInput = path.resolve(arg("provider-input") ?? DEFAULT_PROVIDER_INPUT);
  const venueInput = path.resolve(arg("venue-input") ?? DEFAULT_VENUE_INPUT);
  const stocks = getGlobalStocks().filter(isResearchableStock);
  const events = loadSecurityEventFile().events;
  const providerCandidateIds = loadProviderCandidateIds(providerInput);
  const currentVenueResolutions = existsSync(venueInput)
    ? currentVenueResolutionsFromSnapshot(JSON.parse(readFileSync(venueInput, "utf8")) as unknown)
    : new Map();
  const ledger = buildForeignDateCoverageLedger(stocks, events, providerCandidateIds, new Date().toISOString(), currentVenueResolutions);
  saveAtomic(output, ledger);
  console.log(JSON.stringify({
    output,
    providerInput: existsSync(providerInput) ? providerInput : null,
    venueInput: existsSync(venueInput) ? venueInput : null,
    currentVenueResolved: currentVenueResolutions.size,
    total: ledger.total,
    classified: ledger.classified,
    classifiedPct: ledger.classifiedPct,
    unclassified: ledger.unclassified,
    officialDateAvailable: ledger.officialDateAvailable,
    missingOfficialDate: ledger.missingOfficialDate,
    exactFirstTradeTimeAvailable: ledger.exactFirstTradeTimeAvailable,
    byStatus: ledger.byStatus,
  }, null, 2));
}

main();
