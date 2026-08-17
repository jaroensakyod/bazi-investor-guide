import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import {
  getAllStocks,
  getGlobalStocks,
  getResearchableStocks,
  getResearchableThaiStocks,
  getThaiStocks,
  isResearchableStock,
} from "../investor/stock-database";
import {
  fundamentalsLicense,
  hasUsableFundamentals,
  loadFundamentalsCache,
} from "../market/fundamentals";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { PRICE_SERIES_CACHE_DIR } from "./price-series-store";
import { loadStoredPriceSeries } from "./price-series-store";
import { getSecurityBirth, getSecurityEventFileStatus, getSecurityEvents } from "./security-event-repository";
import { RESEARCH_PILOT_UNIVERSES } from "./pilot-universe";
import { buildForeignDateCoverageLedger, type ForeignDateEvidenceStatus } from "./foreign-date-coverage-ledger";
import { currentVenueResolutionsFromSnapshot } from "./nasdaq-symbol-directory";

export type ResearchReadinessAudit = {
  generatedAt: string;
  universe: {
    total: number;
    researchableTotal: number;
    inactive: number;
    historicalInactive: number;
    tradingAliases: number;
    thai: number;
    thaiResearchable: number;
    foreign: number;
    markets: number;
  };
  coverage: {
    latestQuote: { count: number; pct: number };
    fundamentals: { count: number; pct: number; commercialCount: number; commercialPct: number };
    businessEvidence: { count: number; pct: number };
    companyOriginDate: { count: number; pct: number };
    officialListingDate: { count: number; pct: number };
    exactFirstTradeTime: { count: number; pct: number };
    dailyPriceSeries: {
      securities: number;
      files: number;
      pct: number;
      commercialSecurities: number;
      commercialPct: number;
    };
  };
  thaiCoverage: {
    total: number;
    companyOriginDate: { count: number; pct: number };
    officialListingDate: { count: number; pct: number };
    exactFirstTradeTime: { count: number; pct: number };
    fundamentals: { count: number; pct: number };
    fundamentalsCore: { count: number; pct: number };
    fundamentalsSparse: number;
    dailyPriceSeries: { count: number; pct: number };
    patternEligible: { count: number; pct: number };
  };
  foreignCoverage: {
    total: number;
    companyOriginDate: { count: number; pct: number };
    officialListingDate: { count: number; pct: number };
    exactFirstTradeTime: { count: number; pct: number };
    evidenceClassification: {
      count: number;
      pct: number;
      unclassified: number;
      officialDateAvailable: number;
      missingOfficialDate: number;
      byStatus: Array<{ status: ForeignDateEvidenceStatus; count: number; pct: number }>;
    };
    providerDateCandidates: { count: number; pct: number; generatedAt: string | null };
    usSecIdentity: { count: number; pctOfUsCatalog: number; usCatalog: number; generatedAt: string | null };
    usCurrentVenueIdentity: {
      count: number;
      pctOfUsCatalog: number;
      usCatalog: number;
      unresolved: number;
      legacyCombinedCatalog: number;
      legacyCombinedResolved: number;
      legacyCombinedPct: number;
      exchangeMismatch: number;
      generatedAt: string | null;
    };
    byMarket: Array<{
      market: string;
      total: number;
      officialListingDate: number;
      providerDateCandidates: number;
    }>;
  };
  securityEvents: ReturnType<typeof getSecurityEventFileStatus>;
  pilots: Array<{
    id: string;
    name: string;
    total: number;
    latestQuote: number;
    fundamentals: number;
    companyOriginDate: number;
    officialListingDate: number;
    dailyPriceSeries: number;
    patternEligible: number;
    commercialDataReady: boolean;
  }>;
  gates: Array<{
    id: string;
    status: "ready" | "partial" | "blocked" | "deferred";
    detail: string;
  }>;
  nextActions: string[];
};

function pct(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 10_000) / 100;
}

function countDailySeriesCoverage(root: string): { securities: number; files: number; commercialSecurities: number } {
  if (!existsSync(root)) return { securities: 0, files: 0, commercialSecurities: 0 };
  let files = 0;
  const securities = new Set<string>();
  const commercialSecurities = new Set<string>();
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.startsWith("1d-") && entry.name.endsWith(".json.gz")) {
        files += 1;
        const securityId = path.relative(root, path.dirname(full));
        securities.add(securityId);
        try {
          const compact = JSON.parse(gunzipSync(readFileSync(full)).toString("utf8")) as {
            metadata?: { source?: { license?: string } };
          };
          if (compact.metadata?.source?.license === "commercial") commercialSecurities.add(securityId);
        } catch {
          // Corrupt files remain visible in the file count but never pass the commercial gate.
        }
      }
    }
  }
  return { securities: securities.size, files, commercialSecurities: commercialSecurities.size };
}

function loadOptionalJson<T>(file: string): T | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export function buildResearchReadinessAudit(): ResearchReadinessAudit {
  const generatedAt = new Date().toISOString();
  const catalog = getAllStocks();
  const all = getResearchableStocks();
  const tradingAliases = catalog.filter((stock) => stock.securityStatus === "trading_alias").length;
  const thaiCatalog = getThaiStocks();
  const thai = getResearchableThaiStocks();
  const foreign = getGlobalStocks().filter(isResearchableStock);
  const snapshot = loadSnapshot();
  const fundamentals = loadFundamentalsCache();
  let quoteCount = 0;
  let fundamentalCount = 0;
  let fundamentalCommercialCount = 0;
  let businessEvidenceCount = 0;
  let companyOriginDateCount = 0;
  let officialDateCount = 0;
  let exactTimeCount = 0;

  for (const stock of all) {
    const quoteKey = yahooTicker(stock.ticker, stock.market) ?? "";
    if (snapshot?.quotes[quoteKey]?.price) quoteCount += 1;
    const f = fundamentals.get(quoteKey);
    if (hasUsableFundamentals(f)) {
      fundamentalCount += 1;
      if (fundamentalsLicense(f) === "commercial") fundamentalCommercialCount += 1;
    }
    if (stock.businessEvidence?.source) businessEvidenceCount += 1;
    const birth = getSecurityBirth(stock.market, stock.ticker);
    const events = getSecurityEvents(birth.securityId);
    if (events.some((event) => event.kind === "incorporation" || event.kind === "merger_successor")) {
      companyOriginDateCount += 1;
    }
    if (birth.grade === "A" || birth.grade === "B") officialDateCount += 1;
    if (birth.grade === "A") exactTimeCount += 1;
  }

  const dailySeries = countDailySeriesCoverage(PRICE_SERIES_CACHE_DIR);
  const listingPct = pct(officialDateCount, all.length);
  const seriesPct = pct(dailySeries.securities, all.length);
  const fundamentalPct = pct(fundamentalCount, all.length);
  const fundamentalCommercialPct = pct(fundamentalCommercialCount, all.length);
  const seriesCommercialPct = pct(dailySeries.commercialSecurities, all.length);
  let thaiCompanyOriginDate = 0;
  let thaiOfficialListingDate = 0;
  let thaiExactFirstTradeTime = 0;
  let thaiFundamentals = 0;
  let thaiFundamentalsCore = 0;
  let thaiFundamentalsSparse = 0;
  let thaiDailyPriceSeries = 0;
  let thaiPatternEligible = 0;
  for (const stock of thai) {
    const quoteKey = yahooTicker(stock.ticker, stock.market) ?? "";
    const f = fundamentals.get(quoteKey);
    if (f) {
      const coreFieldCount = [f.roe, f.profitMargin, f.revenueGrowth, f.debtToEquity].filter(
        (value) => value !== undefined,
      ).length;
      if (coreFieldCount > 0) thaiFundamentals += 1;
      if (coreFieldCount >= 3) thaiFundamentalsCore += 1;
      else if (coreFieldCount > 0) thaiFundamentalsSparse += 1;
    }
    const birth = getSecurityBirth(stock.market, stock.ticker);
    const events = getSecurityEvents(birth.securityId);
    if (events.some((event) => event.kind === "incorporation" || event.kind === "merger_successor")) {
      thaiCompanyOriginDate += 1;
    }
    if (birth.grade === "A" || birth.grade === "B") thaiOfficialListingDate += 1;
    if (birth.grade === "A") thaiExactFirstTradeTime += 1;
    const thaiSeries =
      loadStoredPriceSeries({ securityId: birth.securityId, timeframe: "1d", adjustment: "total_return" }) ||
      loadStoredPriceSeries({ securityId: birth.securityId, timeframe: "1d", adjustment: "split_adjusted" }) ||
      loadStoredPriceSeries({ securityId: birth.securityId, timeframe: "1d", adjustment: "raw" });
    if (thaiSeries) {
      thaiDailyPriceSeries += 1;
      if (thaiSeries.bars.length >= 252) thaiPatternEligible += 1;
    }
  }
  const dataRoot = path.dirname(path.dirname(PRICE_SERIES_CACHE_DIR));
  const providerCandidateFile = loadOptionalJson<{
    generatedAt?: string;
    records?: Array<{ securityId?: string; status?: string }>;
  }>(path.join(dataRoot, "staging", "foreign-provider-date-candidates.json"));
  const providerCandidateIds = new Set(
    (providerCandidateFile?.records ?? [])
      .filter((record) => record.status === "candidate" && record.securityId)
      .map((record) => record.securityId as string),
  );
  const currentVenueFile = loadOptionalJson<unknown>(path.join(dataRoot, "staging", "us-current-venues.json"));
  let currentVenueResolutions = new Map();
  try {
    if (currentVenueFile) currentVenueResolutions = currentVenueResolutionsFromSnapshot(currentVenueFile);
  } catch {
    currentVenueResolutions = new Map();
  }
  const foreignDateLedger = buildForeignDateCoverageLedger(
    foreign,
    getSecurityEvents(),
    providerCandidateIds,
    generatedAt,
    currentVenueResolutions,
  );
  const secMasterFile = loadOptionalJson<{
    generatedAt?: string;
    records?: Array<{ matchStatus?: string }>;
  }>(path.join(dataRoot, "staging", "us-sec-security-master.json"));
  const usCatalog = foreign.filter((stock) =>
    ["NYSE/NASDAQ", "NYSE", "NASDAQ"].includes(stock.market.toUpperCase()),
  ).length;
  const usSecIdentityCount = (secMasterFile?.records ?? []).filter(
    (record) => record.matchStatus && !["unmatched", "ambiguous"].includes(record.matchStatus),
  ).length;
  const currentVenueGeneratedAt = currentVenueFile && typeof currentVenueFile === "object"
    ? String((currentVenueFile as { generatedAt?: unknown }).generatedAt ?? "") || null
    : null;
  const currentVenueSummary = currentVenueFile && typeof currentVenueFile === "object"
    ? (currentVenueFile as {
        summary?: {
          legacyCombinedCatalog?: unknown;
          legacyCombinedResolved?: unknown;
          exchangeMismatch?: unknown;
        };
      }).summary
    : undefined;
  const legacyCombinedCatalog = typeof currentVenueSummary?.legacyCombinedCatalog === "number"
    ? currentVenueSummary.legacyCombinedCatalog
    : 0;
  const legacyCombinedResolved = typeof currentVenueSummary?.legacyCombinedResolved === "number"
    ? currentVenueSummary.legacyCombinedResolved
    : 0;
  const currentVenueExchangeMismatch = typeof currentVenueSummary?.exchangeMismatch === "number"
    ? currentVenueSummary.exchangeMismatch
    : 0;
  let foreignCompanyOriginDate = 0;
  let foreignOfficialListingDate = 0;
  let foreignExactFirstTradeTime = 0;
  const foreignByMarket = new Map<string, { total: number; officialListingDate: number; providerDateCandidates: number }>();
  for (const stock of foreign) {
    const birth = getSecurityBirth(stock.market, stock.ticker);
    const events = getSecurityEvents(birth.securityId);
    if (events.some((event) => event.kind === "incorporation" || event.kind === "merger_successor")) {
      foreignCompanyOriginDate += 1;
    }
    if (birth.grade === "A" || birth.grade === "B") foreignOfficialListingDate += 1;
    if (birth.grade === "A") foreignExactFirstTradeTime += 1;
    const current = foreignByMarket.get(stock.market) ?? { total: 0, officialListingDate: 0, providerDateCandidates: 0 };
    current.total += 1;
    if (birth.grade === "A" || birth.grade === "B") current.officialListingDate += 1;
    if (providerCandidateIds.has(birth.securityId)) current.providerDateCandidates += 1;
    foreignByMarket.set(stock.market, current);
  }
  const pilots = RESEARCH_PILOT_UNIVERSES.map((pilot) => {
    let latestQuote = 0;
    let pilotFundamentals = 0;
    let companyOriginDate = 0;
    let officialListingDate = 0;
    let dailyPriceSeries = 0;
    let patternEligible = 0;
    for (const item of pilot.securities) {
      const stock = all.find(
        (candidate) => candidate.ticker.toUpperCase() === item.ticker && candidate.market.toUpperCase() === item.market,
      );
      if (!stock) continue;
      const quoteKey = yahooTicker(stock.ticker, stock.market);
      if (snapshot?.quotes[quoteKey]?.price) latestQuote += 1;
      const f = fundamentals.get(quoteKey);
      if (f && [f.roe, f.profitMargin, f.revenueGrowth, f.debtToEquity].some((value) => value !== undefined)) {
        pilotFundamentals += 1;
      }
      const birth = getSecurityBirth(stock.market, stock.ticker);
      if (getSecurityEvents(birth.securityId).some((event) => event.kind === "incorporation" || event.kind === "merger_successor")) {
        companyOriginDate += 1;
      }
      if (birth.grade === "A" || birth.grade === "B") officialListingDate += 1;
      const series = loadStoredPriceSeries({ securityId: birth.securityId, timeframe: "1d", adjustment: "total_return" });
      if (series && series.bars.length > 0) dailyPriceSeries += 1;
      if (series && series.bars.length >= 252) patternEligible += 1;
    }
    return {
      id: pilot.id,
      name: pilot.name,
      total: pilot.securities.length,
      latestQuote,
      fundamentals: pilotFundamentals,
      companyOriginDate,
      officialListingDate,
      dailyPriceSeries,
      patternEligible,
      commercialDataReady: false,
    };
  });

  return {
    generatedAt,
    universe: {
      total: catalog.length,
      researchableTotal: all.length,
      inactive: catalog.length - all.length,
      historicalInactive: catalog.length - all.length - tradingAliases,
      tradingAliases,
      thai: thaiCatalog.length,
      thaiResearchable: thai.length,
      foreign: foreign.length,
      markets: new Set(catalog.map((stock) => stock.market)).size,
    },
    coverage: {
      latestQuote: { count: quoteCount, pct: pct(quoteCount, all.length) },
      fundamentals: {
        count: fundamentalCount,
        pct: fundamentalPct,
        commercialCount: fundamentalCommercialCount,
        commercialPct: fundamentalCommercialPct,
      },
      businessEvidence: { count: businessEvidenceCount, pct: pct(businessEvidenceCount, all.length) },
      companyOriginDate: { count: companyOriginDateCount, pct: pct(companyOriginDateCount, all.length) },
      officialListingDate: { count: officialDateCount, pct: listingPct },
      exactFirstTradeTime: { count: exactTimeCount, pct: pct(exactTimeCount, all.length) },
      dailyPriceSeries: {
        securities: dailySeries.securities,
        files: dailySeries.files,
        pct: seriesPct,
        commercialSecurities: dailySeries.commercialSecurities,
        commercialPct: seriesCommercialPct,
      },
    },
    thaiCoverage: {
      total: thai.length,
      companyOriginDate: { count: thaiCompanyOriginDate, pct: pct(thaiCompanyOriginDate, thai.length) },
      officialListingDate: { count: thaiOfficialListingDate, pct: pct(thaiOfficialListingDate, thai.length) },
      exactFirstTradeTime: { count: thaiExactFirstTradeTime, pct: pct(thaiExactFirstTradeTime, thai.length) },
      fundamentals: { count: thaiFundamentals, pct: pct(thaiFundamentals, thai.length) },
      fundamentalsCore: { count: thaiFundamentalsCore, pct: pct(thaiFundamentalsCore, thai.length) },
      fundamentalsSparse: thaiFundamentalsSparse,
      dailyPriceSeries: { count: thaiDailyPriceSeries, pct: pct(thaiDailyPriceSeries, thai.length) },
      patternEligible: { count: thaiPatternEligible, pct: pct(thaiPatternEligible, thai.length) },
    },
    foreignCoverage: {
      total: foreign.length,
      companyOriginDate: { count: foreignCompanyOriginDate, pct: pct(foreignCompanyOriginDate, foreign.length) },
      officialListingDate: { count: foreignOfficialListingDate, pct: pct(foreignOfficialListingDate, foreign.length) },
      exactFirstTradeTime: { count: foreignExactFirstTradeTime, pct: pct(foreignExactFirstTradeTime, foreign.length) },
      evidenceClassification: {
        count: foreignDateLedger.classified,
        pct: foreignDateLedger.classifiedPct,
        unclassified: foreignDateLedger.unclassified,
        officialDateAvailable: foreignDateLedger.officialDateAvailable,
        missingOfficialDate: foreignDateLedger.missingOfficialDate,
        byStatus: foreignDateLedger.byStatus,
      },
      providerDateCandidates: {
        count: providerCandidateIds.size,
        pct: pct(providerCandidateIds.size, foreign.length),
        generatedAt: providerCandidateFile?.generatedAt ?? null,
      },
      usSecIdentity: {
        count: usSecIdentityCount,
        pctOfUsCatalog: pct(usSecIdentityCount, usCatalog),
        usCatalog,
        generatedAt: secMasterFile?.generatedAt ?? null,
      },
      usCurrentVenueIdentity: {
        count: currentVenueResolutions.size,
        pctOfUsCatalog: pct(currentVenueResolutions.size, usCatalog),
        usCatalog,
        unresolved: Math.max(0, usCatalog - currentVenueResolutions.size),
        legacyCombinedCatalog,
        legacyCombinedResolved,
        legacyCombinedPct: pct(legacyCombinedResolved, legacyCombinedCatalog),
        exchangeMismatch: currentVenueExchangeMismatch,
        generatedAt: currentVenueGeneratedAt,
      },
      byMarket: [...foreignByMarket.entries()]
        .map(([market, value]) => ({ market, ...value }))
        .sort((a, b) => b.total - a.total || a.market.localeCompare(b.market)),
    },
    securityEvents: getSecurityEventFileStatus(),
    pilots,
    gates: [
      {
        id: "security-master",
        status: listingPct >= 80 ? "ready" : listingPct >= 20 ? "partial" : "blocked",
        detail: `วันเข้าตลาดจากหลักฐานทางการ ${officialDateCount}/${all.length}`,
      },
      {
        id: "thai-security-master",
        status: pct(thaiOfficialListingDate, thai.length) >= 95 ? "ready" : pct(thaiOfficialListingDate, thai.length) >= 80 ? "partial" : "blocked",
        detail: `หุ้นไทยปัจจุบันมีวันเข้าตลาดทางการ ${thaiOfficialListingDate}/${thai.length}; ตัด ticker เก่า ${thaiCatalog.length - thai.length} ตัวออกจากงานวิจัยปัจจุบัน`,
      },
      {
        id: "thai-development-data",
        status:
          pct(thaiOfficialListingDate, thai.length) >= 95 &&
          pct(thaiFundamentalsCore, thai.length) >= 90 &&
          pct(thaiDailyPriceSeries, thai.length) >= 95 &&
          pct(thaiPatternEligible, thai.length) >= 90
            ? "ready"
            : "partial",
        detail: `internal/dev: listing ${thaiOfficialListingDate}/${thai.length}, core fundamentals ${thaiFundamentalsCore}/${thai.length}, EOD ${thaiDailyPriceSeries}/${thai.length}, pattern-ready ${thaiPatternEligible}/${thai.length}`,
      },
      {
        id: "thai-commercial-data",
        status: "blocked",
        detail: "ข้อมูล SET factsheet ยังไม่ยืนยันสิทธิ์แสดงผลเชิงพาณิชย์ และ Yahoo fundamentals/EOD เป็น development-only",
      },
      {
        id: "foreign-security-master",
        status: foreignOfficialListingDate >= foreign.length * 0.8
          ? "ready"
          : foreignOfficialListingDate > 0
            ? "partial"
            : "blocked",
        detail: `foreign official listing ${foreignOfficialListingDate}/${foreign.length}; quarantined provider candidates ${providerCandidateIds.size}/${foreign.length}; US current venue ${currentVenueResolutions.size}/${usCatalog}; SEC identity snapshot ${usSecIdentityCount}/${usCatalog}`,
      },
      {
        id: "foreign-date-evidence-ledger",
        status: foreignDateLedger.unclassified > 0
          ? "blocked"
          : foreignDateLedger.officialDateAvailable === foreign.length
            ? "ready"
            : "partial",
        detail: `จัดหมวดเส้นทางหลักฐานครบ ${foreignDateLedger.classified}/${foreign.length} แต่มีวันทางการจริง ${foreignDateLedger.officialDateAvailable}/${foreign.length}; ยังขาด ${foreignDateLedger.missingOfficialDate} ตัว`,
      },
      {
        id: "market-fundamentals",
        status: fundamentalPct >= 70 ? "ready" : fundamentalPct >= 20 ? "partial" : "blocked",
        detail: `internal/dev fundamentals ที่ใช้ประเมินได้ ${fundamentalCount}/${all.length}; commercial ${fundamentalCommercialCount}/${all.length}`,
      },
      {
        id: "pattern-backtest",
        status: seriesPct >= 70 ? "ready" : seriesPct > 0 ? "partial" : "blocked",
        detail: `internal/dev daily series ${dailySeries.securities}/${all.length} หลักทรัพย์ (${dailySeries.files} ไฟล์); commercial ${dailySeries.commercialSecurities}/${all.length}`,
      },
      {
        id: "commercial-market-data",
        status:
          fundamentalCommercialPct >= 70 && seriesCommercialPct >= 70
            ? "ready"
            : "blocked",
        detail: `paid/public gate: fundamentals ${fundamentalCommercialCount}/${all.length}, EOD ${dailySeries.commercialSecurities}/${all.length}; ต้องมี provenance และสิทธิ์เชิงพาณิชย์ที่ยืนยันแล้ว`,
      },
      {
        id: "research-compliance",
        status: "partial",
        detail: "มี capability gate/text validator และแยก BaZi จาก market score แล้ว แต่ legacy personalized picks/report ยังต้องย้ายและผ่าน legal review",
      },
      {
        id: "pdf-renderer",
        status: "deferred",
        detail: "รอ canonical research snapshot และ data coverage ผ่านเกณฑ์ก่อน",
      },
    ],
    nextActions: [
      "ตรวจ foreign provider-date candidates กับ exchange/issuer แล้ว promote เฉพาะหลักฐานทางการ; ห้าม import candidate อัตโนมัติ",
      "ทำสัญญา provider ที่อนุญาต paid PDF/public display แล้วรัน licensed pilot Fundamentals + EOD อย่างน้อย 10 ตลาด",
      "เติมวัน first trading day จากตลาดทางการ โดยเริ่มหุ้นที่มีผู้ใช้และสภาพคล่องสูง",
      "เพิ่ม peer-normalized valuation และ sector-specific fundamental rules",
      "รัน walk-forward evaluation ต่อหุ้น/ตลาด และเก็บเฉพาะ summary กับ audit checkpoints",
      "ให้ทนายตลาดทุนตรวจหน้าจอและถ้อยคำก่อนเปิด generic ranking แบบเสียเงิน",
      "สร้าง PDF จาก ResearchSnapshot เดียวหลัง gate ข้างต้นผ่าน",
    ],
  };
}
