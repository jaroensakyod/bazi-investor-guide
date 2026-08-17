import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getGlobalStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import {
  matchBursaListingDates,
  parseBursaIsinEquitySnapshot,
} from "../src/lib/research/bursa-isin-equity";
import {
  matchBursaListingAnnouncements,
  parseBursaListingAnnouncementSnapshot,
} from "../src/lib/research/bursa-listing-announcements";
import {
  loadSecurityEventFile,
  mergeSecurityEvents,
  saveSecurityEventFile,
} from "../src/lib/research/security-event-store";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_INPUT = path.join(ROOT, "data", "staging", "bursa-listing-dates.json");
const DEFAULT_SUPPLEMENTAL_INPUT = path.join(ROOT, "data", "curated", "bursa-listing-announcements.json");

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function main(): void {
  const input = path.resolve(arg("input") ?? DEFAULT_INPUT);
  const supplementalInput = path.resolve(arg("supplemental-input") ?? DEFAULT_SUPPLEMENTAL_INPUT);
  const apply = flag("apply");
  const snapshot = parseBursaIsinEquitySnapshot(JSON.parse(readFileSync(input, "utf8")) as unknown);
  const announcements = parseBursaListingAnnouncementSnapshot(
    JSON.parse(readFileSync(supplementalInput, "utf8")) as unknown,
  );
  const stocks = getGlobalStocks()
    .filter(isResearchableStock)
    .filter((stock) => stock.market === "BURSA");
  const pdfMatches = matchBursaListingDates(stocks, snapshot);
  const supplementalMatches = matchBursaListingAnnouncements(stocks, announcements, snapshot);
  const baseEvents = pdfMatches.flatMap((match) => match.events);
  const baseBySecurityId = new Map(baseEvents.map((event) => [event.securityId, event]));
  for (const match of supplementalMatches.filter((record) => record.status === "matched")) {
    const existing = baseBySecurityId.get(match.securityId);
    if (existing && existing.localDate !== match.listingDate) {
      throw new Error(`Bursa official sources disagree for ${match.securityId}: ${existing.localDate} vs ${match.listingDate}`);
    }
  }
  const supplementalEvents = supplementalMatches
    .flatMap((match) => match.events)
    .filter((event) => !baseBySecurityId.has(event.securityId));
  const events = [...baseEvents, ...supplementalEvents];
  const coveredSecurityIds = new Set(events.map((event) => event.securityId));
  const unresolved = stocks.filter((stock) => !coveredSecurityIds.has(`BURSA:${stock.ticker.trim().toUpperCase()}`));
  const ambiguous = [
    ...pdfMatches.filter((record) => record.status === "ambiguous"),
    ...supplementalMatches.filter((record) => record.status === "ambiguous"),
  ];
  const invalid = [
    ...pdfMatches.filter((record) => record.status === "invalid"),
    ...supplementalMatches.filter((record) => record.status === "invalid"),
  ];
  const summary = {
    input,
    supplementalInput,
    sourceAsOf: snapshot.sourceAsOf,
    pdfSha256: snapshot.pdfSha256,
    catalog: stocks.length,
    matched: coveredSecurityIds.size,
    pdfMatched: baseEvents.length,
    supplementalMatched: supplementalEvents.length,
    unmatched: unresolved.length,
    ambiguous: ambiguous.length,
    invalid: invalid.length,
    unmatchedTickers: unresolved.map((stock) => stock.ticker),
  };
  if (summary.ambiguous > 0 || summary.invalid > 0) {
    console.log(JSON.stringify({ ...summary, applied: false }, null, 2));
    throw new Error("Bursa import stopped because ambiguous or invalid catalog matches require review");
  }
  if (!apply) {
    console.log(JSON.stringify({ ...summary, applied: false, previewEvents: events.length }, null, 2));
    return;
  }

  const current = loadSecurityEventFile();
  const merged = mergeSecurityEvents(current.events, events);
  saveSecurityEventFile(merged);
  console.log(JSON.stringify({
    ...summary,
    applied: true,
    incomingEvents: events.length,
    addedEvents: merged.length - current.events.length,
    totalEvents: merged.length,
  }, null, 2));
}

main();
