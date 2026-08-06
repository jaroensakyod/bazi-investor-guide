/**
 * Tool layer — 7 tools ที่แชท (และ LLM) ใช้ตอบคำถาม
 *
 * ทุก tool คืน `{ ok, data, disclaimer }` มาตรฐาน — LLM เอา data ไปเขียนคำตอบ
 * "ไม่เดา": ข้อมูลจากคลัง/cache/JSON จริงทั้งหมด — tool ไม่มีข้อมูล = ok:false (ไม่ปั้น)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CalculatedStateValue } from "../bazi/schema-types";
import { getAllStocks, type StockEntry, type ThaiElement } from "../investor/stock-database";
import { resolveInvestElements, resolveInvestorPersona, buildInvestorTimeline, scoreStock } from "../investor/investor-guide";
import { loadSnapshot, type MarketSnapshot } from "../market/market-data";
import { topMovers, type MoverRow } from "../market/movers";
import { loadFundamentalsCache, type Fundamentals } from "../market/fundamentals";
import { buffettChecks, buffettScore, type BuffettCheck } from "../report/buffett-checks";
import { filterNewsByKeywords, filterNewsByMarket, type NewsItem } from "../market/news";
import { yahooTicker } from "../market/yahoo";
import { upcomingIpos, type IpoEntry } from "../investor/ipo";
import { buildAlmanacDay, checkHour } from "../bazi/almanac/almanac-engine";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DISCLAIMER = "⚠️ แนวโน้มตามดวง + ข้อมูล (ไม่ใช่คำแนะนำการลงทุน)";

export type ToolResult<T> = {
  ok: boolean;
  data: T | null;
  error?: string;
  disclaimer: string;
};

function fail(error: string): ToolResult<never> {
  return { ok: false, data: null, error, disclaimer: DISCLAIMER };
}
function ok<T>(data: T): ToolResult<T> {
  return { ok: true, data, disclaimer: DISCLAIMER };
}

// ── helpers ──
export function findStock(ticker: string): StockEntry | undefined {
  const t = ticker.trim().toUpperCase();
  return getAllStocks().find((s) => String(s.ticker).toUpperCase() === t || String(s.ticker).toUpperCase() === t + ".BK");
}

function loadJson<T>(rel: string): T | null {
  try {
    return JSON.parse(readFileSync(path.join(ROOT, rel), "utf8")) as T;
  } catch {
    return null;
  }
}

// ── 1. หุ้นเด่นวันนี้ ──
export function getTodayMovers(opts: {
  market?: string;
  limit?: number;
  direction?: "gainers" | "losers";
} = {}): ToolResult<MoverRow[]> {
  const snap: MarketSnapshot | null = loadSnapshot();
  if (!snap) return fail("ยังไม่มีข้อมูลราคาวันนี้ — รัน scripts/fetch-market-data.ts ก่อน");
  return ok(topMovers(snap, { market: opts.market, limit: opts.limit ?? 10, direction: opts.direction }));
}

// ── 2. IPO กำลังจะเข้า ──
export function getUpcomingIPOs(opts: { market?: string; limit?: number } = {}): ToolResult<IpoEntry[]> {
  const db = loadJson<{ entries?: IpoEntry[] }>("data/ipo.json");
  if (!db?.entries?.length) return fail("ยังไม่มีข้อมูล IPO");
  let list = upcomingIpos(db.entries);
  if (opts.market) {
    const m = opts.market.toUpperCase();
    list = list.filter((e) => e.market?.toUpperCase().includes(m) || e.country?.toUpperCase() === m);
  }
  return ok(list.slice(0, opts.limit ?? 10));
}

// ── 3. verdict หุ้น × ดวง (ต้องมี chart state) ──
export function getBaziVerdict(ticker: string, state: CalculatedStateValue): ToolResult<object> {
  const stock = findStock(ticker);
  if (!stock) return fail(`ไม่พบหุ้น "${ticker}" ในคลัง`);
  const { invest, avoid } = resolveInvestElements(state);
  const score = scoreStock(state, {
    ticker: stock.ticker,
    name: stock.name,
    business: stock.business,
    elements: stock.elements,
    primaryElement: stock.primaryElement,
  });
  const persona = resolveInvestorPersona(state);
  const timeline = buildInvestorTimeline(state);
  return ok({
    stock: { ticker: stock.ticker, name: stock.name, element: stock.primaryElement, elementReason: stock.elementReason },
    invest,
    avoid,
    score,
    persona: { emoji: persona.emoji, name: persona.name, band: persona.band },
    timeline: timeline.slice(0, 2),
  });
}

// ── 4. วิเคราะห์พื้นฐาน + Buffett checklist ──
export function getFundamentals(ticker: string): ToolResult<{ fundamentals: Fundamentals | null; buffett: BuffettCheck[]; buffettScore: number; hasData: boolean }> {
  const stock = findStock(ticker);
  if (!stock) return fail(`ไม่พบหุ้น "${ticker}" ในคลัง`);
  const cache = loadFundamentalsCache();
  const yt = yahooTicker(stock.ticker, stock.market);
  const fund = yt ? cache.get(yt) ?? null : null;
  if (!fund) {
    return ok({ fundamentals: null, buffett: [], buffettScore: 0, hasData: false });
  }
  const checks = buffettChecks(fund);
  return ok({ fundamentals: fund, buffett: checks, buffettScore: buffettScore(checks), hasData: true });
}

// ── 5. ข่าว/เหตุการณ์ กระทบยังไง ──
export function getNewsImpact(opts: { query?: string; market?: string; limit?: number } = {}): ToolResult<NewsItem[]> {
  const db = loadJson<{ items?: NewsItem[] }>("data/news.json");
  if (!db?.items?.length) return fail("ยังไม่มีข้อมูลข่าว — รัน scripts/fetch-news.ts ก่อน");
  let items = db.items;
  if (opts.market) items = filterNewsByMarket(items, opts.market.toUpperCase(), 1000);
  if (opts.query) items = filterNewsByKeywords(items, opts.query.split(/\s+/).filter(Boolean), 50);
  return ok(items.slice(0, opts.limit ?? 8));
}

// ── 6. ค้นหุ้น (ธาตุ/เซกเตอร์/คำ) ──
export function searchStocks(opts: { element?: ThaiElement; sector?: string; keyword?: string; market?: string; limit?: number } = {}): ToolResult<Array<Pick<StockEntry, "ticker" | "name" | "primaryElement" | "tier" | "market">>> {
  let list = getAllStocks();
  if (opts.element) list = list.filter((s) => s.primaryElement === opts.element);
  if (opts.sector) list = list.filter((s) => String(s.sector ?? "").toLowerCase().includes(opts.sector!.toLowerCase()));
  if (opts.market) {
    const m = opts.market.toUpperCase();
    list = list.filter((s) => s.country.toUpperCase() === m || s.market.toUpperCase().includes(m));
  }
  if (opts.keyword) {
    const k = opts.keyword.toLowerCase();
    list = list.filter((s) => String(s.business).toLowerCase().includes(k) || String(s.name).toLowerCase().includes(k) || String(s.ticker).toLowerCase().includes(k));
  }
  return ok(
    list.slice(0, opts.limit ?? 15).map((s) => ({ ticker: s.ticker, name: s.name, primaryElement: s.primaryElement, tier: s.tier, market: s.market })),
  );
}

// ── 8. ปฏิทิน/ดวงวันนี้ (almanac — port จาก bazi-sft-dataset) ──
export function getTodayAlmanac(opts: { date?: string } = {}): ToolResult<object> {
  const now = new Date();
  const [y, m, d] = opts.date ? opts.date.split("-").map(Number) : [now.getFullYear(), now.getMonth() + 1, now.getDate()];
  if (!y || !m || !d) return fail("date ต้องเป็น YYYY-MM-DD");
  const day = buildAlmanacDay(y, m, d);
  const hour = checkHour(y, m, d, now.getHours());
  const badStars = day.dayStars.filter((s) => s.polarity === "bad").slice(0, 3);
  return ok({
    date: day.date,
    yearBE: day.yearBE,
    weekday: day.weekday,
    pillars: { day: day.dayPillar.ganzhi, month: day.monthPillar.ganzhi, year: day.yearPillar.ganzhi },
    jianchu: day.jianchu,
    deity: day.deity,
    colors: day.colors.map((c) => ({ element: c.element, colors: c.colors })),
    luckyDirection: day.luckyDirection,
    asura: day.asura,
    luckyHours: day.luckyHours.slice(0, 4),
    currentHour: hour,
    gates: day.gates.slice(0, 3),
    dayStars: day.dayStars.slice(0, 5),
    badStars,
    thaiLunar: day.thaiLunar,
    specialDays: day.specialDays.map((s) => s.name),
    solarTerm: day.solarTerm?.name ?? null,
    monthInfo: { deity: day.monthInfo.deity, caishenDir: day.monthInfo.caishenDir, lapDir: day.monthInfo.lapDir, asuraDir: day.monthInfo.asuraDir },
  });
}

// ── 7. รายงาน (ฉบับย่อตอนนี้ — ฉบับเต็ม Phase 3) ──
export function generateReport(ticker: string, state?: CalculatedStateValue): ToolResult<object> {
  const stock = findStock(ticker);
  if (!stock) return fail(`ไม่พบหุ้น "${ticker}" ในคลัง`);
  const verdict = state ? getBaziVerdict(ticker, state) : null;
  const fund = getFundamentals(ticker);
  return ok({
    stock: { ticker: stock.ticker, name: stock.name, element: stock.primaryElement, tier: stock.tier },
    verdict: verdict?.ok ? verdict.data : null,
    buffett: fund.ok && fund.data ? { score: fund.data.buffettScore, checks: fund.data.buffett } : null,
    note: "รายงานฉบับเต็ม (สไตล์สถาบัน) — Phase 3",
  });
}
