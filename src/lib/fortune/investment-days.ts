/**
 * Fortune × Investment — จับคู่ "ดวงรายวัน/เดือน × การลงทุน" (deterministic — LLM แค่ปากกา)
 *
 * แหล่งข้อมูล:
 *   - ปฏิทินโหราศาสตร์ (almanac — port จาก bazi-sft-dataset): ธาตุวัน/เดือน/ปี + ยาม/สี/ทิศ
 *   - ตาราง B "ธาตุที่ควรทำ" (career-finance-table): ดิถีวัน × กำลัง × ธาตุเดือน → ธาตุควรทำ
 *   - คลังหุ้น×ธาตุ + ราคา (snapshot) + IPO
 *
 * Compliance (กฎเหล็ก — ทุกคำตอบต้องลงท้าย):
 *   "⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน"
 */
import { buildAlmanacDay, checkHour } from "@/lib/bazi/almanac/almanac-engine";
import { elementThOfStem, doElementsTh, type ElementTh } from "@/lib/bazi/constants/career-finance-table";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { resolveInvestElements, resolveInvestorPersona } from "@/lib/investor/investor-guide";
import { getAllStocks } from "@/lib/investor/stock-database";
import { allocatePortfolio } from "@/lib/assets/portfolio";
import { loadSnapshot } from "@/lib/market/market-data";
import { yahooTicker } from "@/lib/market/yahoo";
import { upcomingIpos } from "@/lib/investor/ipo";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** คำย้ำ compliance — ใช้ลงท้ายทุกคำตอบ (ตามที่ผู้ใช้กำหนด) */
export const COMPLIANCE_NOTE = "⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน";

export type ElementTh2 = ElementTh;

function band3(band: string): "weak" | "balanced" | "veryStrong" {
  if (band === "weak") return "weak";
  if (band === "strong") return "veryStrong";
  return "balanced";
}

/** ธาตุไทยของวัน (จาก day pillar stem) */
export function dayElementOf(date: string): ElementTh | null {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  return elementThOfStem(buildAlmanacDay(y, m, d).dayPillar.stem);
}

/** fit วัน vs ดวงผู้ใช้: good (ธาตุวัน ∈ invest) / avoid (∈ avoid) / neutral */
export function dayFitForUser(state: CalculatedStateValue, date: string): "good" | "neutral" | "avoid" {
  const el = dayElementOf(date);
  if (!el) return "neutral";
  const { invest, avoid } = resolveInvestElements(state);
  if (avoid.includes(el)) return "avoid";
  if (invest.includes(el)) return "good";
  return "neutral";
}

/** ธาตุที่ควรทำวันนี้ (ตาราง B: ดิถีวัน × กำลังดวง × ธาตุเดือน) */
export function favorElementsToday(state: CalculatedStateValue, date: string): ElementTh[] {
  const d = buildAlmanacDay(...date.split("-").map(Number) as [number, number, number]);
  const dayEl = elementThOfStem(d.dayPillar.stem);
  const monthEl = elementThOfStem(d.monthPillar.stem);
  if (!dayEl || !monthEl) return [];
  const band = band3(resolveInvestorPersona(state).band);
  return doElementsTh(dayEl, band, monthEl);
}

/** หุ้นที่ "ตรงธาตุควรทำวันนี้" + ราคาจริง (top โดย |%เปลี่ยน|) */
export function stocksForDay(state: CalculatedStateValue, date: string, limit = 5) {
  const favor = favorElementsToday(state, date);
  if (favor.length === 0) return [];
  const snap = loadSnapshot();
  const rows = getAllStocks()
    .filter((s) => favor.includes(s.primaryElement))
    .map((s) => {
      const md = snap?.quotes[yahooTicker(s.ticker, s.market) ?? ""];
      return { ticker: s.ticker, name: s.name, element: s.primaryElement, changePct: md?.changePct ?? null };
    })
    .filter((r) => r.changePct !== null)
    .sort((a, b) => Math.abs((b.changePct ?? 0)) - Math.abs((a.changePct ?? 0)))
    .slice(0, limit);
  return rows;
}

/** ภาพรวมเดือน: ธาตุเดือน/ปี + ทิศเงินเข้า + ธาตุควรทำ + วันดีทั้งเดือน */
export function monthInvestFit(state: CalculatedStateValue, year: number, month: number) {
  const d = buildAlmanacDay(year, month, 1);
  const monthEl = elementThOfStem(d.monthPillar.stem);
  const yearEl = elementThOfStem(d.yearPillar.stem);
  const { invest, avoid } = resolveInvestElements(state);
  const band = band3(resolveInvestorPersona(state).band);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const days: Array<{ date: string; weekday: string; dayElement: ElementTh | null; fit: "good" | "avoid" | "asset" | "neutral" }> = [];
  for (let dd = 1; dd <= daysInMonth; dd += 1) {
    const day = buildAlmanacDay(year, month, dd);
    const el = elementThOfStem(day.dayPillar.stem);
    let fit: "good" | "avoid" | "asset" | "neutral" = "neutral";
    if (el && avoid.includes(el)) fit = "avoid";
    else if (el && invest.includes(el)) fit = "good";
    days.push({ date: day.date, weekday: day.weekday, dayElement: el, fit });
  }
  const goodDays = days.filter((x) => x.fit === "good");
  const avoidDays = days.filter((x) => x.fit === "avoid");
  return {
    year, month, yearBE: year + 543,
    monthElement: monthEl, yearElement: yearEl,
    caishenDir: d.monthInfo.caishenDir, // ทิศเงินเข้าเดือนนี้
    lapDir: d.monthInfo.lapDir,
    userInvest: invest, userAvoid: avoid,
    goodDays: goodDays.slice(0, 5), avoidDays: avoidDays.slice(0, 3),
    goodDayCount: goodDays.length, avoidDayCount: avoidDays.length,
  };
}

/** วันเหมาะซื้อสินทรัพย์ตามธาตุ (เช่น ที่ดิน = ดิน) — วันธาตุตรงสินทรัพย์ + ไม่ขัดดวง */
export function luckyDaysForAsset(state: CalculatedStateValue, year: number, month: number, assetElement: ElementTh, limit = 5) {
  const { avoid } = resolveInvestElements(state);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: Array<{ date: string; weekday: string; dayElement: ElementTh; reason: string }> = [];
  for (let dd = 1; dd <= daysInMonth; dd += 1) {
    const day = buildAlmanacDay(year, month, dd);
    const el = elementThOfStem(day.dayPillar.stem);
    if (!el) continue;
    if (el === assetElement && !avoid.includes(el)) {
      out.push({ date: day.date, weekday: day.weekday, dayElement: el, reason: `วันธาตุ${el} ตรงธาตุของสินทรัพย์` });
    }
  }
  return out.slice(0, limit);
}

/** IPO ช่วงสัปดาห์ — จับคู่ดวง: ธาตุธุรกิจ (sector) + ธาตุวันเกิด (วันเข้าเทรด) เปรียบกับดวงผู้ใช้ */
export function ipoFitForWeek(state: CalculatedStateValue, fromDate: string, toDate: string, limit = 8) {
  const db = (() => {
    try {
      return JSON.parse(readFileSync(path.join(ROOT, "data/ipo.json"), "utf8")) as { entries?: Array<Record<string, unknown>> };
    } catch {
      return { entries: [] as Array<Record<string, unknown>> };
    }
  })();
  const { invest, avoid } = resolveInvestElements(state);
  const inRange = upcomingIpos(db.entries as Parameters<typeof upcomingIpos>[0]).filter(
    (e) => e.ipoDate >= fromDate && e.ipoDate <= toDate,
  );
  const rows = inRange.map((e) => {
    const bizEl = e.primaryElement ?? null; // ธาตุจาก sector (ถ้ามี)
    const birthEl = dayElementOf(e.ipoDate); // ธาตุวันเกิดบริษัท (วันเข้าเทรด)
    let fit: "good" | "neutral" | "avoid" = "neutral";
    if (bizEl && avoid.includes(bizEl)) fit = "avoid";
    else if (bizEl && invest.includes(bizEl)) fit = "good";
    else if (birthEl && avoid.includes(birthEl)) fit = "avoid";
    else if (birthEl && invest.includes(birthEl)) fit = "good";
    return {
      ticker: e.ticker, name: e.name, exchange: e.exchange, ipoDate: e.ipoDate,
      businessElement: bizEl, birthDayElement: birthEl,
      fit, // good = ตรงดวงผู้ใช้ · avoid = ขัดดวง
      fitNote: fit === "good" ? "ตรงดวง" : fit === "avoid" ? "ขัดดวง" : "กลางๆ",
    };
  });
  const sorted = [...rows].sort((a, b) => (a.fit === b.fit ? 0 : a.fit === "good" ? -1 : b.fit === "good" ? 1 : a.fit === "avoid" ? 1 : -1));
  return { fromDate, toDate, count: rows.length, userInvest: invest, userAvoid: avoid, entries: sorted.slice(0, limit) };
}

/** ฤกษ์ยามวันนี้ (ยามดี + ยามปัจจุบัน) */
export function todayHours(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return null;
  const day = buildAlmanacDay(y, m, d);
  const now = new Date();
  return {
    luckyHours: day.luckyHours.slice(0, 4).map((h) => ({ range: h.range, god: h.god, meaning: h.meaning })),
    currentHour: checkHour(y, m, d, now.getHours()),
  };
}

/**
 * ไอเดีย 1: ผูก "วันธาตุตรง" กับพอร์ตจัดสรร (บท 13)
 * สำหรับแต่ละธาตุในพอร์ต: นับวันธาตุตรง (dayEl == el) + วันตรงดวง (dayEl ∈ invest) ทั้งเดือน
 * → hint: โฟกัส (ตรงธาตุ ≥6 วัน) / ปกติ (2-5) / ชะลอ (≤1 หรือ el ∈ avoid)
 */
export function monthPortfolioGuide(state: CalculatedStateValue, year: number, month: number) {
  const { invest, avoid } = resolveInvestElements(state);
  const persona = resolveInvestorPersona(state);
  const allocation = allocatePortfolio({ usefulElements: invest, strengthBand: persona.band as "weak" | "balanced" | "strong" });
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const counts = new Map<string, { direct: number; good: number }>();
  for (const row of allocation) counts.set(row.element, { direct: 0, good: 0 });
  for (let dd = 1; dd <= daysInMonth; dd += 1) {
    const el = elementThOfStem(buildAlmanacDay(year, month, dd).dayPillar.stem);
    if (!el) continue;
    for (const row of allocation) {
      const c = counts.get(row.element)!;
      if (el === row.element) c.direct += 1;
      if (invest.includes(el)) c.good += 1;
    }
  }

  const rows = allocation.map((row) => {
    const c = counts.get(row.element)!;
    let hint: "โฟกัส" | "ปกติ" | "ชะลอ" = "ปกติ";
    if (avoid.includes(row.element)) hint = "ชะลอ";
    else if (c.direct >= 6) hint = "โฟกัส";
    else if (c.direct <= 1) hint = "ชะลอ";
    return { element: row.element, pct: row.pct, directDays: c.direct, goodDays: c.good, hint, assets: row.assets };
  });

  const focus = rows.filter((r) => r.hint === "โฟกัส").map((r) => r.element);
  const slow = rows.filter((r) => r.hint === "ชะลอ").map((r) => r.element);
  return {
    year, month, yearBE: year + 543,
    rows,
    focusElements: focus, slowElements: slow,
    summary: focus.length
      ? `เดือนนี้เอื้อธาตุ ${focus.join("+")} มากสุด (วันตรงธาตุเยอะ)${slow.length ? ` · แนะนำชะลอ ${slow.join("+")}` : ""}`
      : `เดือนนี้ไม่มีธาตุไหนโดดเด่นเป็นพิเศษ${slow.length ? ` · ควรชะลอ ${slow.join("+")}` : ""}`,
    compliance: COMPLIANCE_NOTE,
  };
}

/**
 * ไอเดีย 2: รายงาน "ฤกษ์รายสัปดาห์" (7 วัน) — ไม่ต้องใช้ดวงผู้ใช้ (ใช้กับ cron/digest ได้)
 * แต่ละวัน: ธาตุวัน · 建除 · สีมงคล · ยามดี 2 ช่วง · วันสำคัญ · ดาวเด่น
 */
export function weeklyAlmanacReport(fromDate: string, days = 7) {
  const start = new Date(`${fromDate}T00:00:00Z`);
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    const dt = new Date(start.getTime() + i * 86400000);
    const y = dt.getUTCFullYear();
    const m = dt.getUTCMonth() + 1;
    const d = dt.getUTCDate();
    const day = buildAlmanacDay(y, m, d);
    const el = elementThOfStem(day.dayPillar.stem);
    const goodStars = day.dayStars.filter((s) => s.polarity === "good").length;
    rows.push({
      date: day.date,
      weekday: day.weekday,
      dayElement: el,
      jianchu: day.jianchu,
      colors: day.colors.map((c) => `${c.element}→${c.colors}`).join(" · "),
      luckyHours: day.luckyHours.slice(0, 2).map((h) => `${h.range} (${h.god})`),
      specialDays: day.specialDays.map((s) => s.name),
      goodStars,
    });
  }
  // วันเด่น = ยามมงคล ≥4 ช่วง หรือ ดาวดี ≥2
  const highlight = rows.filter((r) => r.luckyHours.length >= 2 && (r.goodStars >= 2 || (r.jianchu?.name ?? "").includes("建")));
  return {
    fromDate,
    days: rows,
    highlightDays: highlight.map((r) => ({ date: r.date, weekday: r.weekday, dayElement: r.dayElement, why: "ยามดี+ดาวเด่น" })),
    compliance: COMPLIANCE_NOTE,
  };
}
