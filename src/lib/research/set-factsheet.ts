import type { SecurityEvent } from "./security-birth";
import { SECURITY_EVENT_SCHEMA_VERSION, securityIdOf } from "./security-birth";

export type ParsedFactsheetDate =
  | { precision: "day"; raw: string; isoDate: string }
  | { precision: "year"; raw: string; year: number }
  | { precision: "missing"; raw: string | null }
  | { precision: "invalid"; raw: string };

export type SetFactsheetExtraction = {
  ticker: string;
  market: string;
  securityId: string;
  sourceUrl: string;
  retrievedAt: string;
  establishment: ParsedFactsheetDate;
  listing: ParsedFactsheetDate;
  events: SecurityEvent[];
  warnings: string[];
  lineageReviewReasons: string[];
};

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function fieldValue(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<label[^>]*>\\s*${escaped}\\s*</label>\\s*<span[^>]*>([\\s\\S]*?)</span>`,
    "i",
  ).exec(html);
  return match ? decodeHtml(match[1]) : null;
}

function validIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseSetFactsheetDate(rawValue: string | null): ParsedFactsheetDate {
  const raw = rawValue?.trim() ?? null;
  if (!raw || raw === "-" || /^n\/?a$/i.test(raw)) return { precision: "missing", raw };

  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const isoDate = validIsoDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
    return isoDate ? { precision: "day", raw, isoDate } : { precision: "invalid", raw };
  }

  const words = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(raw);
  if (words) {
    const month = MONTHS[words[2].toLowerCase()];
    const isoDate = month ? validIsoDate(Number(words[3]), month, Number(words[1])) : null;
    return isoDate ? { precision: "day", raw, isoDate } : { precision: "invalid", raw };
  }

  if (/^\d{4}$/.test(raw)) {
    const year = Number(raw);
    if (year >= 1800 && year <= 2200) return { precision: "year", raw, year };
  }

  return { precision: "invalid", raw };
}

function eventFor(
  input: Pick<SetFactsheetExtraction, "ticker" | "market" | "securityId" | "sourceUrl" | "retrievedAt">,
  kind: "incorporation" | "exchange_admission",
  localDate: string,
): SecurityEvent {
  return {
    schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
    securityId: input.securityId,
    kind,
    localDate,
    localTime: null,
    timePrecision: "unknown",
    timeZone: "Asia/Bangkok",
    exchange: input.market,
    venueCity: "Bangkok",
    venueCountry: "TH",
    evidence: {
      authority: "exchange",
      sourceName: `SET Factsheet — ${input.ticker}`,
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      verification: "verified",
      displayRights: "unknown",
    },
    ...(kind === "exchange_admission"
      ? { note: "วันที่จดทะเบียนกับ ตลท.; ไม่ใช่ timestamp ของ first trade" }
      : {}),
  };
}

export function extractSetFactsheet(input: {
  ticker: string;
  market: string;
  html: string;
  sourceUrl: string;
  retrievedAt: string;
  catalogFoundedYear?: number;
}): SetFactsheetExtraction {
  const ticker = input.ticker.trim().toUpperCase();
  const market = input.market.trim().toUpperCase();
  const securityId = securityIdOf(market, ticker);
  const establishment = parseSetFactsheetDate(fieldValue(input.html, "Establish Date"));
  const listing = parseSetFactsheetDate(fieldValue(input.html, "Listed Date"));
  const base = { ticker, market, securityId, sourceUrl: input.sourceUrl, retrievedAt: input.retrievedAt };
  const events: SecurityEvent[] = [];
  const warnings: string[] = [];
  const lineageReviewReasons: string[] = [];

  if (establishment.precision === "day") events.push(eventFor(base, "incorporation", establishment.isoDate));
  else if (establishment.precision === "year") {
    warnings.push(`SET ระบุวันก่อตั้งเพียงปี ${establishment.year}; ไม่สร้างวันที่สมมติ`);
  } else if (establishment.precision === "invalid") {
    warnings.push(`อ่านวันก่อตั้งไม่ได้: ${establishment.raw}`);
  } else {
    warnings.push("ไม่พบวันก่อตั้งใน factsheet");
  }

  if (listing.precision === "day") events.push(eventFor(base, "exchange_admission", listing.isoDate));
  else if (listing.precision === "year") {
    warnings.push(`SET ระบุวันเข้าตลาดเพียงปี ${listing.year}; ไม่สร้างวันที่สมมติ`);
  } else if (listing.precision === "invalid") {
    warnings.push(`อ่านวันเข้าตลาดไม่ได้: ${listing.raw}`);
  } else {
    warnings.push("ไม่พบวันเข้าตลาดใน factsheet");
  }

  if (
    establishment.precision === "day" &&
    listing.precision === "day" &&
    establishment.isoDate === listing.isoDate
  ) {
    lineageReviewReasons.push("วันก่อตั้งตรงกับวันเข้าตลาด อาจเป็น NewCo/บริษัทผู้สืบทอดจากการควบรวม");
  }
  if (
    input.catalogFoundedYear &&
    establishment.precision === "day" &&
    input.catalogFoundedYear < Number(establishment.isoDate.slice(0, 4))
  ) {
    lineageReviewReasons.push(
      `ปีเริ่มธุรกิจใน catalog (${input.catalogFoundedYear}) เก่ากว่าวันก่อตั้งนิติบุคคลปัจจุบัน (${establishment.isoDate})`,
    );
  }

  return { ...base, establishment, listing, events, warnings, lineageReviewReasons };
}
