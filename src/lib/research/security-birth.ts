/**
 * Canonical security-event model.
 *
 * A company, an ADR and each cross-listing are different securities.  The
 * system therefore keys events by exchange + ticker and never invents a time
 * when an official source only provides a date.
 */

export const SECURITY_EVENT_SCHEMA_VERSION = 1 as const;

export type SecurityEventKind =
  | "incorporation"
  | "exchange_admission"
  | "first_trading_day"
  | "first_trade"
  | "relisting"
  | "merger_successor";

export type EvidenceAuthority =
  | "exchange"
  | "regulator"
  | "issuer"
  | "issuer_filing"
  | "company_registry"
  | "licensed_market_data"
  | "secondary"
  | "unknown";

export type EvidenceVerification = "verified" | "reported" | "unverified";
export type TimePrecision = "second" | "minute" | "session" | "unknown";

export type SecurityEventSourceEvidence = {
  authority: EvidenceAuthority;
  sourceName: string;
  sourceUrl?: string;
  retrievedAt?: string;
  verification: EvidenceVerification;
  /** Whether source terms allow displaying raw data or derived output only. */
  displayRights?: "allowed" | "derived_only" | "unknown";
};

export type SecurityEventEvidence = SecurityEventSourceEvidence & {
  /** Additional official records required to establish identity continuity, such as a ticker rename. */
  supportingSources?: SecurityEventSourceEvidence[];
};

export type SecurityEvent = {
  schemaVersion: typeof SECURITY_EVENT_SCHEMA_VERSION;
  securityId: string;
  kind: SecurityEventKind;
  /** Calendar date at the listing venue, not UTC date. */
  localDate: string;
  /** Null means unknown. It must never be filled with the market open by default. */
  localTime: string | null;
  timePrecision: TimePrecision;
  /** IANA time zone, for example America/New_York or Asia/Hong_Kong. */
  timeZone: string;
  exchange?: string;
  venueCity?: string;
  venueCountry?: string;
  evidence: SecurityEventEvidence;
  note?: string;
};

export type SecurityBirthGrade = "A" | "B" | "C" | "D";

export type SecurityBirthResolution = {
  securityId: string;
  grade: SecurityBirthGrade;
  status: "exact_first_trade" | "official_date_only" | "context_date_only" | "unavailable";
  calculationMode: "four_pillars" | "three_pillars_with_time_sensitivity" | "business_context_only" | "business_element_only";
  selectedEvent: SecurityEvent | null;
  timeKnown: boolean;
  scenarioCount: 0 | 12;
  limitations: string[];
};

const LISTING_KINDS = new Set<SecurityEventKind>([
  "exchange_admission",
  "first_trading_day",
  "first_trade",
  "relisting",
]);

const OFFICIAL_AUTHORITIES = new Set<EvidenceAuthority>([
  "exchange",
  "regulator",
  "issuer",
  "issuer_filing",
  "licensed_market_data",
]);

const EVENT_KINDS = new Set<SecurityEventKind>([
  "incorporation",
  "exchange_admission",
  "first_trading_day",
  "first_trade",
  "relisting",
  "merger_successor",
]);
const EVIDENCE_AUTHORITIES = new Set<EvidenceAuthority>([
  "exchange",
  "regulator",
  "issuer",
  "issuer_filing",
  "company_registry",
  "licensed_market_data",
  "secondary",
  "unknown",
]);
const EVIDENCE_VERIFICATIONS = new Set<EvidenceVerification>(["verified", "reported", "unverified"]);
const TIME_PRECISIONS = new Set<TimePrecision>(["second", "minute", "session", "unknown"]);

const KIND_PRIORITY: Record<SecurityEventKind, number> = {
  first_trade: 600,
  first_trading_day: 500,
  exchange_admission: 450,
  relisting: 400,
  merger_successor: 250,
  incorporation: 100,
};

const AUTHORITY_PRIORITY: Record<EvidenceAuthority, number> = {
  exchange: 70,
  regulator: 65,
  licensed_market_data: 60,
  issuer: 57,
  issuer_filing: 55,
  company_registry: 50,
  secondary: 10,
  unknown: 0,
};

export function securityIdOf(market: string, ticker: string): string {
  const normalizedMarket = market.trim().toUpperCase();
  const normalizedTicker = ticker.trim().toUpperCase();
  if (!normalizedMarket || !normalizedTicker) throw new Error("market และ ticker ห้ามว่าง");
  return `${normalizedMarket}:${normalizedTicker}`;
}

function validIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validLocalTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59 && Number(match[3] ?? 0) <= 59;
}

function validTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function validateSecurityEvent(event: SecurityEvent): string[] {
  const problems: string[] = [];
  if (event.schemaVersion !== SECURITY_EVENT_SCHEMA_VERSION) problems.push("schemaVersion ไม่รองรับ");
  if (typeof event.securityId !== "string" || !/^[^:]+:.+$/.test(event.securityId)) problems.push("securityId ต้องอยู่ในรูป MARKET:TICKER");
  if (!EVENT_KINDS.has(event.kind)) problems.push("kind ไม่รองรับ");
  if (typeof event.localDate !== "string" || !validIsoDate(event.localDate)) problems.push("localDate ต้องเป็นวันที่จริงรูปแบบ YYYY-MM-DD");
  if (typeof event.timeZone !== "string" || !validTimeZone(event.timeZone)) problems.push("ต้องระบุ IANA timeZone ที่ถูกต้อง");
  if (!TIME_PRECISIONS.has(event.timePrecision)) problems.push("timePrecision ไม่รองรับ");
  if (event.localTime !== null && (typeof event.localTime !== "string" || !validLocalTime(event.localTime))) {
    problems.push("localTime ต้องเป็น HH:mm หรือ HH:mm:ss");
  }
  if (event.localTime === null && event.timePrecision !== "unknown" && event.timePrecision !== "session") {
    problems.push("ไม่มี localTime แต่ timePrecision ระบุว่าละเอียดกว่าที่มี");
  }
  if (event.localTime !== null && event.timePrecision === "unknown") problems.push("มี localTime แต่ไม่ระบุ precision");
  if (!event.evidence || typeof event.evidence !== "object") {
    problems.push("ต้องระบุ evidence");
  } else {
    if (!EVIDENCE_AUTHORITIES.has(event.evidence.authority)) problems.push("evidence authority ไม่รองรับ");
    if (!EVIDENCE_VERIFICATIONS.has(event.evidence.verification)) problems.push("evidence verification ไม่รองรับ");
    if (typeof event.evidence.sourceName !== "string" || !event.evidence.sourceName.trim()) problems.push("ต้องระบุชื่อแหล่งข้อมูล");
    if (event.evidence.supportingSources !== undefined) {
      if (!Array.isArray(event.evidence.supportingSources)) {
        problems.push("supportingSources ต้องเป็น array");
      } else {
        event.evidence.supportingSources.forEach((source, index) => {
          if (!source || typeof source !== "object") {
            problems.push(`supportingSources[${index}] ไม่ถูกต้อง`);
            return;
          }
          if (!EVIDENCE_AUTHORITIES.has(source.authority)) problems.push(`supportingSources[${index}] authority ไม่รองรับ`);
          if (!EVIDENCE_VERIFICATIONS.has(source.verification)) problems.push(`supportingSources[${index}] verification ไม่รองรับ`);
          if (typeof source.sourceName !== "string" || !source.sourceName.trim()) {
            problems.push(`supportingSources[${index}] ต้องระบุชื่อแหล่งข้อมูล`);
          }
        });
      }
    }
  }
  return problems;
}

function eventScore(event: SecurityEvent): number {
  const verified = event.evidence.verification === "verified" ? 30 : event.evidence.verification === "reported" ? 10 : 0;
  const exactTime = event.localTime && (event.timePrecision === "minute" || event.timePrecision === "second") ? 40 : 0;
  return KIND_PRIORITY[event.kind] + AUTHORITY_PRIORITY[event.evidence.authority] + verified + exactTime;
}

function isExactVerifiedFirstTrade(event: SecurityEvent): boolean {
  return (
    event.kind === "first_trade" &&
    event.localTime !== null &&
    (event.timePrecision === "minute" || event.timePrecision === "second") &&
    event.evidence.verification === "verified" &&
    OFFICIAL_AUTHORITIES.has(event.evidence.authority)
  );
}

/**
 * Select the strongest reproducible event for one security.
 * Invalid records are ignored and surfaced as limitations; no fallback time is
 * ever introduced.
 */
export function resolveSecurityBirth(securityId: string, events: readonly SecurityEvent[]): SecurityBirthResolution {
  const matching = events.filter((event) => event.securityId === securityId);
  const valid: SecurityEvent[] = [];
  const limitations: string[] = [];

  for (const event of matching) {
    const problems = validateSecurityEvent(event);
    if (problems.length === 0) valid.push(event);
    else limitations.push(`ข้าม ${event.kind}: ${problems.join(", ")}`);
  }

  valid.sort((a, b) => eventScore(b) - eventScore(a));
  const selected = valid[0] ?? null;

  if (!selected) {
    return {
      securityId,
      grade: "D",
      status: "unavailable",
      calculationMode: "business_element_only",
      selectedEvent: null,
      timeKnown: false,
      scenarioCount: 0,
      limitations: [...limitations, "ยังไม่มีวันหรือเวลาที่ตรวจสอบย้อนกลับได้"],
    };
  }

  if (isExactVerifiedFirstTrade(selected)) {
    return {
      securityId,
      grade: "A",
      status: "exact_first_trade",
      calculationMode: "four_pillars",
      selectedEvent: selected,
      timeKnown: true,
      scenarioCount: 0,
      limitations,
    };
  }

  if (LISTING_KINDS.has(selected.kind) && OFFICIAL_AUTHORITIES.has(selected.evidence.authority)) {
    const selectedLimitations = [...limitations];
    if (selected.localTime === null) selectedLimitations.push("แหล่งทางการยืนยันวัน แต่ไม่ยืนยันเวลา first trade");
    else selectedLimitations.push("มีเวลาอ้างอิง แต่ยังไม่ผ่านเกณฑ์ exact verified first trade");
    return {
      securityId,
      grade: "B",
      status: "official_date_only",
      calculationMode: "three_pillars_with_time_sensitivity",
      selectedEvent: selected,
      timeKnown: false,
      scenarioCount: 12,
      limitations: selectedLimitations,
    };
  }

  return {
    securityId,
    grade: "C",
    status: "context_date_only",
    calculationMode: "business_context_only",
    selectedEvent: selected,
    timeKnown: false,
    scenarioCount: 0,
    limitations: [...limitations, "ข้อมูลนี้ใช้เป็นบริบทธุรกิจเท่านั้น ไม่ใช้สร้างเสาเวลา"],
  };
}
