import type { StockEntry } from "../investor/stock-database";
import { foreignDateSourcePolicy, type ForeignDateSourceStatus } from "./foreign-date-source-policy";
import type { UsCurrentVenueResolution } from "./nasdaq-symbol-directory";
import { resolveSecurityBirth, securityIdOf, type SecurityEvent, type SecurityEventKind } from "./security-birth";

export const FOREIGN_DATE_COVERAGE_SCHEMA_VERSION = 1 as const;

export const FOREIGN_DATE_EVIDENCE_STATUSES = [
  "official_date_available",
  "licensed_source_required",
  "catalog_venue_resolution_required",
  "issuer_or_exchange_research_required",
  "manual_official_research_required",
  "source_discovery_required",
  "provider_candidate_requires_official_verification",
  "official_adapter_no_match",
  "unclassified",
] as const;

export type ForeignDateEvidenceStatus = typeof FOREIGN_DATE_EVIDENCE_STATUSES[number];

export type ForeignDateCoverageRecord = {
  securityId: string;
  ticker: string;
  name: string;
  market: string;
  status: ForeignDateEvidenceStatus;
  classified: boolean;
  reason: string;
  recommendedAction: string;
  sourcePolicyStatus: ForeignDateSourceStatus | null;
  officialSourceUrl: string | null;
  resolvedCurrentMarket: string | null;
  currentVenueName: string | null;
  currentVenueEvidenceSource: string | null;
  currentVenueEvidenceUrl: string | null;
  venueTimeZone: string | null;
  officialDate: string | null;
  officialEventKind: SecurityEventKind | null;
  officialEvidenceSource: string | null;
  officialEvidenceUrl: string | null;
  exactFirstTradeTimeAvailable: boolean;
  companyOriginDate: string | null;
  providerCandidateQuarantined: boolean;
  commercialReadiness: "display_allowed" | "derived_only" | "rights_review_required" | "source_acquisition_required";
};

export type ForeignDateCoverageLedger = {
  schemaVersion: typeof FOREIGN_DATE_COVERAGE_SCHEMA_VERSION;
  generatedAt: string;
  total: number;
  classified: number;
  classifiedPct: number;
  unclassified: number;
  officialDateAvailable: number;
  missingOfficialDate: number;
  exactFirstTradeTimeAvailable: number;
  byStatus: Array<{ status: ForeignDateEvidenceStatus; count: number; pct: number }>;
  byMarket: Array<{
    market: string;
    total: number;
    classified: number;
    officialDateAvailable: number;
    byStatus: Partial<Record<ForeignDateEvidenceStatus, number>>;
  }>;
  records: ForeignDateCoverageRecord[];
};

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 10_000) / 100;
}

function unresolvedStatus(
  policyStatus: ForeignDateSourceStatus | null,
  providerCandidate: boolean,
): Pick<ForeignDateCoverageRecord, "status" | "reason" | "recommendedAction"> {
  switch (policyStatus) {
    case "licensed_feed_required":
      return {
        status: "licensed_source_required",
        reason: "The dependable official/exchange field is available through a licensed data product, not an approved public bulk source.",
        recommendedAction: "Acquire and review the relevant exchange/reference-data licence, then import through a licensed adapter.",
      };
    case "catalog_venue_resolution_required":
      return {
        status: "catalog_venue_resolution_required",
        reason: "The catalog does not yet identify one exact listing venue, so a venue-specific birth event cannot be attached safely.",
        recommendedAction: "Resolve the current venue and security identity before researching the venue-specific listing event.",
      };
    case "current_identity_only":
      return {
        status: "issuer_or_exchange_research_required",
        reason: "The official source confirms current identity but does not provide a dependable first-trading date.",
        recommendedAction: "Research issuer filings or exchange notices for this exact security; do not infer from current identity.",
      };
    case "official_source_manual_retrieval_required":
      return {
        status: "manual_official_research_required",
        reason: "An official source exists but cannot yet be retrieved safely and reproducibly by the automated adapter.",
        recommendedAction: "Retrieve and review the official record manually or obtain an approved bulk-delivery route.",
      };
    case "official_source_discovery_pending":
      return {
        status: "source_discovery_required",
        reason: "No dependable official source workflow has been confirmed for this exact market/security.",
        recommendedAction: "Complete official-source discovery and rights review before promoting any date.",
      };
    case "official_adapter_ready":
      return providerCandidate
        ? {
          status: "provider_candidate_requires_official_verification",
          reason: "A provider candidate exists, but the official adapter did not confirm the exact security/date.",
          recommendedAction: "Use the candidate only as a research lead and verify it against exchange, regulator, or issuer evidence.",
        }
        : {
          status: "official_adapter_no_match",
          reason: "The official adapter ran, but no unambiguous day-level record was matched to this exact security.",
          recommendedAction: "Review aliases, share classes, blank official fields, and historical exchange notices manually.",
        };
    default:
      return {
        status: "unclassified",
        reason: "No explicit market source policy covers this security.",
        recommendedAction: "Add and review a market source policy before researching or displaying a date.",
      };
  }
}

function commercialReadiness(event: SecurityEvent | null): ForeignDateCoverageRecord["commercialReadiness"] {
  if (!event) return "source_acquisition_required";
  if (event.evidence.displayRights === "allowed") return "display_allowed";
  if (event.evidence.displayRights === "derived_only") return "derived_only";
  return "rights_review_required";
}

export function buildForeignDateCoverageLedger(
  stocks: readonly Pick<StockEntry, "ticker" | "name" | "market">[],
  events: readonly SecurityEvent[],
  providerCandidateIds: ReadonlySet<string> = new Set<string>(),
  generatedAt = new Date().toISOString(),
  currentVenueResolutions: ReadonlyMap<string, UsCurrentVenueResolution> = new Map(),
): ForeignDateCoverageLedger {
  if (!Number.isFinite(Date.parse(generatedAt))) throw new Error("Foreign date coverage ledger has an invalid generatedAt");
  const eventsBySecurityId = new Map<string, SecurityEvent[]>();
  for (const event of events) {
    const current = eventsBySecurityId.get(event.securityId) ?? [];
    current.push(event);
    eventsBySecurityId.set(event.securityId, current);
  }
  const seen = new Set<string>();
  const records = stocks.map((stock): ForeignDateCoverageRecord => {
    const securityId = securityIdOf(stock.market, stock.ticker);
    if (seen.has(securityId)) throw new Error(`Duplicate foreign securityId in coverage ledger: ${securityId}`);
    seen.add(securityId);
    const market = stock.market.trim().toUpperCase();
    const catalogPolicy = foreignDateSourcePolicy(market);
    const currentVenue = currentVenueResolutions.get(securityId) ?? null;
    const currentVenuePolicy = currentVenue ? foreignDateSourcePolicy(currentVenue.canonicalMarket) : null;
    const policy = market === "NYSE/NASDAQ" && currentVenue
      ? currentVenuePolicy ?? catalogPolicy
      : catalogPolicy;
    const currentVenueIdentityOnly = Boolean(market === "NYSE/NASDAQ" && currentVenue && !currentVenuePolicy);
    const securityEvents = eventsBySecurityId.get(securityId) ?? [];
    const birth = resolveSecurityBirth(securityId, securityEvents);
    const selected = birth.grade === "A" || birth.grade === "B" ? birth.selectedEvent : null;
    const providerCandidate = providerCandidateIds.has(securityId);
    const incorporation = securityEvents
      .filter((event) => event.kind === "incorporation")
      .sort((a, b) => a.localDate.localeCompare(b.localDate))[0] ?? null;
    const unresolvedPolicyStatus = currentVenueIdentityOnly
      ? "current_identity_only"
      : policy?.status === "official_adapter_ready" && policy.unresolvedAfterAdapter
        ? policy.unresolvedAfterAdapter
        : policy?.status ?? null;
    const unresolved = unresolvedStatus(unresolvedPolicyStatus, providerCandidate);
    const status: ForeignDateEvidenceStatus = selected ? "official_date_available" : unresolved.status;
    return {
      securityId,
      ticker: stock.ticker.trim().toUpperCase(),
      name: stock.name,
      market,
      status,
      classified: status !== "unclassified",
      reason: selected
        ? "A verified official security date is available; any missing exact time remains explicitly unknown."
        : currentVenue
          ? `The official current venue is resolved as ${currentVenue.currentExchange}, but that identity source does not provide a first-trading date. ${unresolved.reason}`
          : unresolved.reason,
      recommendedAction: selected
        ? "Retain provenance, monitor source changes, and complete commercial display-rights review."
        : unresolved.recommendedAction,
      sourcePolicyStatus: currentVenueIdentityOnly ? "current_identity_only" : policy?.status ?? null,
      officialSourceUrl: currentVenue?.sourceUrl ?? policy?.officialSourceUrl ?? null,
      resolvedCurrentMarket: currentVenue?.canonicalMarket ?? null,
      currentVenueName: currentVenue?.currentExchange ?? null,
      currentVenueEvidenceSource: currentVenue?.sourceName ?? null,
      currentVenueEvidenceUrl: currentVenue?.sourceUrl ?? null,
      venueTimeZone: policy?.timeZone ?? null,
      officialDate: selected?.localDate ?? null,
      officialEventKind: selected?.kind ?? null,
      officialEvidenceSource: selected?.evidence.sourceName ?? null,
      officialEvidenceUrl: selected?.evidence.sourceUrl ?? null,
      exactFirstTradeTimeAvailable: birth.grade === "A",
      companyOriginDate: incorporation?.localDate ?? null,
      providerCandidateQuarantined: providerCandidate,
      commercialReadiness: commercialReadiness(selected),
    };
  }).sort((a, b) => a.securityId.localeCompare(b.securityId));

  const total = records.length;
  const classified = records.filter((record) => record.classified).length;
  const officialDateAvailable = records.filter((record) => record.status === "official_date_available").length;
  const exactFirstTradeTimeAvailable = records.filter((record) => record.exactFirstTradeTimeAvailable).length;
  const byStatus = FOREIGN_DATE_EVIDENCE_STATUSES.map((status) => {
    const count = records.filter((record) => record.status === status).length;
    return { status, count, pct: pct(count, total) };
  });
  const marketMap = new Map<string, ForeignDateCoverageLedger["byMarket"][number]>();
  for (const record of records) {
    const current = marketMap.get(record.market) ?? {
      market: record.market,
      total: 0,
      classified: 0,
      officialDateAvailable: 0,
      byStatus: {},
    };
    current.total += 1;
    if (record.classified) current.classified += 1;
    if (record.status === "official_date_available") current.officialDateAvailable += 1;
    current.byStatus[record.status] = (current.byStatus[record.status] ?? 0) + 1;
    marketMap.set(record.market, current);
  }

  return {
    schemaVersion: FOREIGN_DATE_COVERAGE_SCHEMA_VERSION,
    generatedAt: new Date(generatedAt).toISOString(),
    total,
    classified,
    classifiedPct: pct(classified, total),
    unclassified: total - classified,
    officialDateAvailable,
    missingOfficialDate: total - officialDateAvailable,
    exactFirstTradeTimeAvailable,
    byStatus,
    byMarket: [...marketMap.values()].sort((a, b) => b.total - a.total || a.market.localeCompare(b.market)),
    records,
  };
}
