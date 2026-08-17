import type { EvidenceAuthority } from "./security-birth";

export type ForeignDateSourceStatus =
  | "official_adapter_ready"
  | "current_identity_only"
  | "licensed_feed_required"
  | "official_source_manual_retrieval_required"
  | "official_source_discovery_pending"
  | "catalog_venue_resolution_required";

export type ForeignDateSourcePolicy = {
  market: string;
  marketName: string;
  timeZone: string;
  status: ForeignDateSourceStatus;
  /** Terminal route for an exact security still unmatched after the public adapter ran. */
  unresolvedAfterAdapter?: Exclude<ForeignDateSourceStatus, "official_adapter_ready">;
  preferredAuthority: EvidenceAuthority;
  officialSourceUrl: string | null;
  note: string;
};

/** One explicit policy per foreign market currently present in data/stocks/global.json. */
export const FOREIGN_DATE_SOURCE_POLICIES: readonly ForeignDateSourcePolicy[] = [
  {
    market: "ASX",
    marketName: "Australian Securities Exchange",
    timeZone: "Australia/Sydney",
    status: "official_adapter_ready",
    preferredAuthority: "licensed_market_data",
    officialSourceUrl: "https://www.asx.com.au/markets/trade-our-cash-market/directory.html",
    note: "ASX-hosted Company Directory CSV exposes Listing date; the page attributes market data to LSEG Data & Analytics and Morningstar, so commercial reuse remains license-gated.",
  },
  {
    market: "BIST",
    marketName: "Borsa Istanbul",
    timeZone: "Europe/Istanbul",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.borsaistanbul.com/en/market-data",
    note: "Borsa Istanbul's current First Trading Date and Price workbook exposes First Code, Current Code, Listing Date and First Trading Day. Exact current codes are promoted with their official .E or .G suffix preserved; commercial use remains blocked pending a Borsa Istanbul data-distribution agreement review.",
  },
  {
    market: "BMV",
    marketName: "Bolsa Mexicana de Valores",
    timeZone: "America/Mexico_City",
    status: "licensed_feed_required",
    preferredAuthority: "licensed_market_data",
    officialSourceUrl: "https://www.bmv.com.mx/es/emisoras/informacion-de-emisoras",
    note: "BMV's public issuer profiles expose Fecha de Constitucion and Fecha de listado en BMV for individual issues, while BMV sells database and web-service delivery. A vetted bulk workflow and commercial reuse right require a BMV data agreement; no unofficial mirror or inferred date is promoted.",
  },
  {
    market: "BOVESPA",
    marketName: "B3 / Bovespa",
    timeZone: "America/Sao_Paulo",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://sistemaswebb3-listados.b3.com.br/listedCompaniesPage/?language=en-us",
    note: "B3 Listed Companies exposes issuer-level dateListing, while GetDetail confirms exact share codes. Odd-lot aliases ending in F are excluded as duplicate trading segments; the issuer date is not claimed as a share-class first-trading day.",
  },
  {
    market: "BURSA",
    marketName: "Bursa Malaysia",
    timeZone: "Asia/Kuala_Lumpur",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.bursamalaysia.com/sites/5d809dcf39fba22790cad230/assets/6814a336e6414a4b168c007b/isinequity_as_of__30_Aor_2025.pdf",
    note: "Bursa's official ISIN equity PDF exposes Stock Name (Short), ISIN and Listing Date. The local extractor verifies the PDF hash and promotes only one exact short-name match; acquisition may still require an interactive/manual download because of Bursa's anti-bot layer, and commercial reuse remains blocked pending a Bursa terms review.",
  },
  {
    market: "EPA",
    marketName: "Euronext Paris",
    timeZone: "Europe/Paris",
    status: "licensed_feed_required",
    preferredAuthority: "licensed_market_data",
    officialSourceUrl: "https://live.euronext.com/en/datashop/reference-data",
    note: "The public Euronext directory confirms ISIN and symbol, but ListingStartDate is part of licensed Advanced Reference Data. Public product pages do not expose a dependable equity admission date.",
  },
  {
    market: "HKEX",
    marketName: "Hong Kong Exchanges and Clearing",
    timeZone: "Asia/Hong_Kong",
    status: "official_adapter_ready",
    preferredAuthority: "licensed_market_data",
    officialSourceUrl: "https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities/Equities-Quote",
    note: "HKEX-hosted Equities Quote profiles expose Listing Date through the page's public data API. The profile explicitly says it is supplied by Refinitiv, so commercial display remains blocked pending HKEX/Refinitiv licence review; blank dates stay unresolved.",
  },
  {
    market: "HOSE",
    marketName: "Vietnam exchange bucket (HOSE and HNX)",
    timeZone: "Asia/Ho_Chi_Minh",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.hsx.vn/vi/quan-ly-niem-yet/co-phieu",
    note: "The legacy catalog code HOSE contains both HOSE and HNX stocks. Exact symbols are matched against both official current directories, and the actual exchange is preserved on each security event.",
  },
  {
    market: "IDX",
    marketName: "Indonesia Stock Exchange",
    timeZone: "Asia/Jakarta",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.idx.co.id/en/listed-companies/company-profiles",
    note: "IDX Listed Company Profiles exposes Tanggal Pencatatan for the current issuer directory; the compact snapshot stores only exact catalog matches instead of all source rows.",
  },
  {
    market: "JSE",
    marketName: "Johannesburg Stock Exchange",
    timeZone: "Africa/Johannesburg",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://clientportal.jse.co.za/companies-and-financial-instruments",
    note: "The official JSE Client Portal SharesService exposes current instrument AlphaCode, ISIN and ListingDate. Promotion requires exact ticker, exact normalized issuer identity and one ISIN/date. JSE's disclaimer prohibits commercial product use without express written permission, so commercial delivery remains blocked.",
  },
  {
    market: "KRX",
    marketName: "Korea Exchange",
    timeZone: "Asia/Seoul",
    status: "official_adapter_ready",
    unresolvedAfterAdapter: "official_source_manual_retrieval_required",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://kind.krx.co.kr/corpgeneral/corpList.do?method=loadInitPage",
    note: "Official KRX KIND listed-company download exposes company-root security code, market and listing date in one bulk file. Preferred-share classes still unmatched there require a user-authorized KRX Data Marketplace/Open API session; KRX terms prohibit unauthorized automated collection.",
  },
  {
    market: "KSE",
    marketName: "Pakistan Stock Exchange (legacy catalog code KSE)",
    timeZone: "Asia/Karachi",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.psx.com.pk/psx/resources-and-tools/listings/listings-history",
    note: "Official PSX annual equity-listing workbooks expose Date of Formal Listing from 2000 onward. Exact history symbols are preferred; older symbol-less rows are promoted only through an unambiguous exact legal-name match against the current official PSX directory. For remaining current symbols, an exact-symbol PSX company profile is accepted only when its business description states a day-precision listing date; month/year-only wording is not expanded into a guessed day.",
  },
  {
    market: "LSE",
    marketName: "London Stock Exchange",
    timeZone: "Europe/London",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.londonstockexchange.com/help/whats-issuer-profile-our-story",
    note: "Official LSE instrument reference data exposes listingadmissiondate (Admission date) by exact TIDM.",
  },
  {
    market: "NASDAQ",
    marketName: "Nasdaq Stock Market",
    timeZone: "America/New_York",
    status: "licensed_feed_required",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://classic.nasdaqtrader.com/Trader.aspx?id=DailyListPD",
    note: "Nasdaq Daily List contains new listings and First Date Traded, but historical access is a subscription product.",
  },
  {
    market: "NSE",
    marketName: "National Stock Exchange of India",
    timeZone: "Asia/Kolkata",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.nseindia.com/static/market-data/securities-available-for-trading",
    note: "Official equity, REIT and InvIT CSV files contain DATE OF LISTING; controlled ticker normalization is required.",
  },
  {
    market: "NYSE",
    marketName: "New York Stock Exchange",
    timeZone: "America/New_York",
    status: "current_identity_only",
    preferredAuthority: "issuer_filing",
    officialSourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json",
    note: "SEC provides current ticker/CIK/exchange identity, not first-trading dates; listing dates require issuer/exchange evidence or a licensed feed.",
  },
  {
    market: "NYSE/NASDAQ",
    marketName: "Unresolved US venue in legacy catalog",
    timeZone: "America/New_York",
    status: "catalog_venue_resolution_required",
    preferredAuthority: "regulator",
    officialSourceUrl: "https://www.sec.gov/files/company_tickers_exchange.json",
    note: "Resolve the current venue through the SEC identity stage before attaching venue-specific events.",
  },
  {
    market: "PSE",
    marketName: "Philippine Stock Exchange",
    timeZone: "Asia/Manila",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://edge.pse.com.ph/companyDirectory/form.do",
    note: "PSE EDGE Company List exposes official Listing Date in a paginated directory; exact-symbol matching avoids borrowing a common-share date for a preferred-share class.",
  },
  {
    market: "SGX",
    marketName: "Singapore Exchange",
    timeZone: "Asia/Singapore",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.sgx.com/stock-exchange/corporate-information",
    note: "SGX Corporate Information exposes issuer-level Listed Date & Board history. Only exact catalog mappings with day precision are promoted; missing dates and the unverified Z77 alias remain unresolved.",
  },
  {
    market: "SSE",
    marketName: "Shanghai Stock Exchange",
    timeZone: "Asia/Shanghai",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.sse.com.cn/assortment/stock/list/share/",
    note: "Official SSE current security lists expose LIST_DATE for Main Board A-shares, STAR and B-shares.",
  },
  {
    market: "SWX",
    marketName: "SIX Swiss Exchange",
    timeZone: "Europe/Zurich",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.six-group.com/en/market-data/shares/ipo-history.html",
      note: "SIX IPO History exposes First Listing Date from 2001 onward, while current Blue-Chip, Domestic, Foreign and Sponsored Foreign Shares FQS reference tables expose venue-specific First Trading Date by symbol, ISIN and trading currency. Exact symbols are promoted only after selecting the exact catalog currency; CHF and USD trading lines sharing one symbol are kept distinct.",
  },
  {
    market: "SZSE",
    marketName: "Shenzhen Stock Exchange",
    timeZone: "Asia/Shanghai",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.szse.cn/market/product/stock/list/index.html",
    note: "Official SZSE A-share list exposes listing dates through the paginated ShowReport API and XLSX download.",
  },
  {
    market: "TADAWUL",
    marketName: "Saudi Exchange",
    timeZone: "Asia/Riyadh",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.saudiexchange.sa/wps/portal/saudiexchange/trading/participants-directory/issuer-directory?locale=en",
    note: "Saudi Exchange issuer links map exact symbols to official Company Profiles containing Listing Date, Date Established and ISIN; profiles with '/' instead of a date remain unresolved.",
  },
  {
    market: "TSE",
    marketName: "Tokyo Stock Exchange",
    timeZone: "Asia/Tokyo",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.jpx.co.jp/english/listing/co-search/01.html",
    note: "JPX Listed Company Search exposes official establishment and listing dates; the fetcher stores compact normalized records, not raw detail HTML.",
  },
  {
    market: "TSX",
    marketName: "Toronto Stock Exchange",
    timeZone: "America/Toronto",
    status: "official_adapter_ready",
    unresolvedAfterAdapter: "licensed_feed_required",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.tsx.com/en/listings/current-market-statistics",
    note: "The official current TSX issuer workbook exposes issuer-level Listing Date. Dates are promoted only when the exact issuer root is also an exact current tradable instrument in the official directory; class, unit and preferred-share tickers do not inherit the issuer-root date. The complete public New Company Listings bulletin archive available from 2014 onward was also checked; remaining exact share-class dates require licensed reference data or pre-2014 issuer/exchange research. The workbook's copyright notice requires written consent before commercial redistribution or sale.",
  },
  {
    market: "TWSE",
    marketName: "Taiwan Stock Exchange",
    timeZone: "Asia/Taipei",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://openapi.twse.com.tw/v1/opendata/t187ap03_L",
    note: "TWSE company-basic OpenAPI contains establishment and listing dates. Exact preferred-share gaps are filled only by reviewed exact-security rows from TWSE's ISIN Query by Classification; no exact first-trade time is provided.",
  },
  {
    market: "XETR",
    marketName: "Xetra / Frankfurt Stock Exchange",
    timeZone: "Europe/Berlin",
    status: "official_adapter_ready",
    preferredAuthority: "exchange",
    officialSourceUrl: "https://www.cashmarket.deutsche-boerse.com/cash-en/Data-Tech/statistics/New-Companies",
    note: "Deutsche Börse Primary Market Statistics exposes new-company First Trading Day history, while the current All Tradable Instruments reference exposes venue-instrument First Trading Date. Primary Market history is preferred; the current active exact-symbol/ISIN record is a fallback and is never described as incorporation date, guaranteed original IPO date, or exact first-trade time.",
  },
] as const;

export function foreignDateSourcePolicy(market: string): ForeignDateSourcePolicy | null {
  const normalized = market.trim().toUpperCase();
  return FOREIGN_DATE_SOURCE_POLICIES.find((policy) => policy.market === normalized) ?? null;
}
