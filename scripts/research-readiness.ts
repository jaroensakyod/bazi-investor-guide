import { buildResearchReadinessAudit } from "../src/lib/research/readiness-audit";

const audit = buildResearchReadinessAudit();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(audit, null, 2));
} else {
  console.log(`Research readiness — ${audit.generatedAt}`);
  console.log(`Universe catalog: ${audit.universe.total} rows · researchable ${audit.universe.researchableTotal} · historical inactive ${audit.universe.historicalInactive} · trading aliases ${audit.universe.tradingAliases}`);
  console.log(`Thailand: ${audit.universe.thaiResearchable}/${audit.universe.thai} current · foreign ${audit.universe.foreign} · ${audit.universe.markets} ตลาด`);
  console.log(`Latest quote: ${audit.coverage.latestQuote.count} (${audit.coverage.latestQuote.pct}%)`);
  console.log(
    `Fundamentals internal/dev: ${audit.coverage.fundamentals.count} (${audit.coverage.fundamentals.pct}%) · commercial ${audit.coverage.fundamentals.commercialCount} (${audit.coverage.fundamentals.commercialPct}%)`,
  );
  console.log(`Company origin date: ${audit.coverage.companyOriginDate.count} (${audit.coverage.companyOriginDate.pct}%)`);
  console.log(`Official listing date: ${audit.coverage.officialListingDate.count} (${audit.coverage.officialListingDate.pct}%)`);
  console.log(`Exact first-trade time: ${audit.coverage.exactFirstTradeTime.count} (${audit.coverage.exactFirstTradeTime.pct}%)`);
  console.log(
    `Daily EOD internal/dev: ${audit.coverage.dailyPriceSeries.securities} หลักทรัพย์ / ${audit.coverage.dailyPriceSeries.files} ไฟล์ (${audit.coverage.dailyPriceSeries.pct}%) · commercial ${audit.coverage.dailyPriceSeries.commercialSecurities} (${audit.coverage.dailyPriceSeries.commercialPct}%)`,
  );
  console.log(
    `Thai current ${audit.thaiCoverage.total}: company origin ${audit.thaiCoverage.companyOriginDate.count} (${audit.thaiCoverage.companyOriginDate.pct}%) · official listing ${audit.thaiCoverage.officialListingDate.count} (${audit.thaiCoverage.officialListingDate.pct}%) · fundamentals usable ${audit.thaiCoverage.fundamentals.count} (${audit.thaiCoverage.fundamentals.pct}%) / core ${audit.thaiCoverage.fundamentalsCore.count} (${audit.thaiCoverage.fundamentalsCore.pct}%) · EOD ${audit.thaiCoverage.dailyPriceSeries.count} (${audit.thaiCoverage.dailyPriceSeries.pct}%) · pattern-ready ${audit.thaiCoverage.patternEligible.count} (${audit.thaiCoverage.patternEligible.pct}%)`,
  );
  console.log(
    `Foreign ${audit.foreignCoverage.total}: company origin ${audit.foreignCoverage.companyOriginDate.count} (${audit.foreignCoverage.companyOriginDate.pct}%) · official listing ${audit.foreignCoverage.officialListingDate.count} (${audit.foreignCoverage.officialListingDate.pct}%) · provider candidates (quarantined) ${audit.foreignCoverage.providerDateCandidates.count} (${audit.foreignCoverage.providerDateCandidates.pct}%) · SEC identity ${audit.foreignCoverage.usSecIdentity.count}/${audit.foreignCoverage.usSecIdentity.usCatalog}`,
  );
  console.log(
    `US current venue: ${audit.foreignCoverage.usCurrentVenueIdentity.count}/${audit.foreignCoverage.usCurrentVenueIdentity.usCatalog} (${audit.foreignCoverage.usCurrentVenueIdentity.pctOfUsCatalog}%) · legacy NYSE/NASDAQ ${audit.foreignCoverage.usCurrentVenueIdentity.legacyCombinedResolved}/${audit.foreignCoverage.usCurrentVenueIdentity.legacyCombinedCatalog} (${audit.foreignCoverage.usCurrentVenueIdentity.legacyCombinedPct}%) · unresolved ${audit.foreignCoverage.usCurrentVenueIdentity.unresolved} · catalog mismatch ${audit.foreignCoverage.usCurrentVenueIdentity.exchangeMismatch}`,
  );
  console.log(
    `Foreign evidence ledger: classified ${audit.foreignCoverage.evidenceClassification.count}/${audit.foreignCoverage.total} (${audit.foreignCoverage.evidenceClassification.pct}%) · official date ${audit.foreignCoverage.evidenceClassification.officialDateAvailable}/${audit.foreignCoverage.total} · missing ${audit.foreignCoverage.evidenceClassification.missingOfficialDate} · unclassified ${audit.foreignCoverage.evidenceClassification.unclassified}`,
  );
  for (const pilot of audit.pilots) {
    console.log(
      `Pilot ${pilot.id}: quote ${pilot.latestQuote}/${pilot.total} · fundamentals ${pilot.fundamentals}/${pilot.total} · company origin ${pilot.companyOriginDate}/${pilot.total} · official listing ${pilot.officialListingDate}/${pilot.total} · EOD ${pilot.dailyPriceSeries}/${pilot.total} · pattern-ready ${pilot.patternEligible}/${pilot.total} · commercial=${pilot.commercialDataReady}`,
    );
  }
  for (const gate of audit.gates) console.log(`[${gate.status.toUpperCase()}] ${gate.id}: ${gate.detail}`);
}
