/**
 * Hidden Gems — "หุ้นใต้ผืนน้ำ" (2 แกน: คนไม่เห็น × คุณภาพดี)
 *
 * underwaterScore: ใต้ผืนน้ำแค่ไหน (0-100) — ไม่ติดดัชนี + cap กลาง-เล็ก + สภาพคล่องไม่หนาแน่น + ไม่มีกระแส
 * riskTier: 🟢 ปลอดภัย / 🟡 ลุ้นได้ / 🔴 ระวัง — กัน "ไม่เสี่ยงเกินไป" ตามกำลังดวง
 *
 * กฎ: ข้อมูลไม่ครบ (ไม่มี fundamentals/ราคา) → ไม่ขึ้น 🟢/🟡 (ไม่เดา) · 🔴 = watchlist เท่านั้น
 */
import type { StockEntry, ThaiElement } from "../investor/stock-database";
import type { MarketData } from "./market-data";
import type { Fundamentals } from "./fundamentals";
import { buffettChecks, buffettScore } from "../report/buffett-checks";
import { yahooTicker } from "./yahoo";

export type StrengthBand = "weak" | "balanced" | "strong";
export type RiskTier = "safe" | "medium" | "risky";

export type HiddenGem = {
  ticker: string;
  name: string;
  market: string;
  country: string;
  sector: string;
  element: ThaiElement;
  underwaterScore: number; // 0-100
  underwaterParts: { notTopIndex: number; midSmallCap: number; lowLiquidity: number; unloved: number };
  tier: RiskTier;
  buffettScore: number;
  price?: number;
  changePct?: number;
  pe?: number;
  marketCap?: number;
  reasons: string[]; // "ทำไมคนยังไม่เห็น" + "ทำไมปลอดภัย"
};

const TOP_TIERS = new Set(["SET50", "SET100", "mega", "large"]);
const LIQUID_VOLUME = 2_000_000;

/** คะแนน "ใต้ผืนน้ำ" (0-100) — ยิ่งสูง ยิ่งไม่มีใครมอง */
export function underwaterScoreOf(stock: StockEntry, md: MarketData | null): { score: number; parts: HiddenGem["underwaterParts"] } {
  const parts = { notTopIndex: 0, midSmallCap: 0, lowLiquidity: 0, unloved: 0 };
  // 1. ไม่ติดดัชนีหลัก
  if (!TOP_TIERS.has(stock.tier)) parts.notTopIndex = 30;
  // 2. cap กลาง-เล็ก (ไทย: <100B THB · โลก: <20B USD)
  const cap = md?.marketCap;
  if (cap !== undefined) {
    const isTh = stock.market === "SET" || stock.market === "mai";
    if (isTh ? cap < 100e9 : cap < 20e9) parts.midSmallCap = 30;
  } else if (!TOP_TIERS.has(stock.tier)) {
    parts.midSmallCap = 30; // ไม่มีราคา แต่ไม่ใช่ตัวท็อป → ถือว่าเล็ก
  }
  // 3. สภาพคล่องไม่หนาแน่น
  const vol = md?.avgVolume;
  if (vol !== undefined && vol < LIQUID_VOLUME) parts.lowLiquidity = 20;
  else if (vol === undefined && !TOP_TIERS.has(stock.tier)) parts.lowLiquidity = 20;
  // 4. ไม่มีกระแส (PE สูง/ติดลบ/ไม่มี — คนไม่มอง)
  const pe = md?.pe;
  if (pe === undefined || pe <= 0 || pe > 30) parts.unloved = 20;
  return { score: parts.notTopIndex + parts.midSmallCap + parts.lowLiquidity + parts.unloved, parts };
}

/** ระดับความเสี่ยง — 🔴 ไม่แนะนำเด็ดขาด (watchlist) */
export function riskTierOf(stock: StockEntry, md: MarketData | null, fund?: Fundamentals | null): RiskTier {
  if (!fund) return "risky"; // ไม่มีข้อมูลพื้นฐาน → ไม่เดา
  const score = buffettScore(buffettChecks(fund));
  const isTh = stock.market === "SET" || stock.market === "mai";
  const cap = md?.marketCap;
  const liquid = (md?.avgVolume ?? 0) >= 500_000;
  const bigEnough = cap === undefined ? false : isTh ? cap >= 10e9 : cap >= 2e9;
  if (score >= 8 && liquid && bigEnough) return "safe";
  if (score >= 6) return "medium"; // กำไรบวก/โต แต่เล็กหรือหนี้กลาง
  return "risky";
}

/** เรียงหุ้นใต้ผืนน้ำ — element ตรง usefulElements มาก่อน แล้ว underwater สูงก่อน */
export function rankHiddenGems(opts: {
  stocks: StockEntry[];
  quotes: Record<string, MarketData>; // key = yahoo ticker
  fundamentals?: Map<string, Fundamentals>;
  usefulElements?: ThaiElement[];
  strengthBand?: StrengthBand;
  market?: string;
  limit?: number;
}): HiddenGem[] {
  const { stocks, quotes, fundamentals = new Map(), usefulElements, strengthBand, market, limit = 20 } = opts;
  // ดวงอ่อน → เห็นแค่ 🟢 · ดวงสมดุล/แข็ง → 🟢+🟡 · 🔴 ไม่มี verdict ให้ใคร
  const allowed = new Set<RiskTier>(strengthBand === "weak" ? ["safe"] : ["safe", "medium"]);

  const gems: HiddenGem[] = [];
  for (const s of stocks) {
    if (market && !s.market.toUpperCase().includes(market.toUpperCase()) && s.country.toUpperCase() !== market.toUpperCase()) continue;
    const yt = yahooTicker(s.ticker, s.market);
    const md = quotes[yt] ?? null;
    const fund = fundamentals.get(yt);
    const { score, parts } = underwaterScoreOf(s, md);
    if (score < 40) continue; // ยังไม่ "ใต้ผืนน้ำ" พอ
    const tier = riskTierOf(s, md, fund);
    if (tier === "risky" || !allowed.has(tier)) continue; // 🔴/เกินกำลังดวง → ไม่โชว์ verdict
    if (usefulElements && !usefulElements.includes(s.primaryElement)) continue;
    const bs = fund ? buffettScore(buffettChecks(fund)) : 0;
    const reasons = buildReasons(parts, tier, bs, fund);
    gems.push({
      ticker: s.ticker,
      name: s.name,
      market: s.market,
      country: s.country,
      sector: s.sector,
      element: s.primaryElement,
      underwaterScore: score,
      underwaterParts: parts,
      tier,
      buffettScore: bs,
      price: md?.price,
      changePct: md?.changePct,
      pe: md?.pe,
      marketCap: md?.marketCap,
      reasons,
    });
  }
  gems.sort((a, b) => {
    const fitA = usefulElements?.includes(a.element) ? 1 : 0;
    const fitB = usefulElements?.includes(b.element) ? 1 : 0;
    if (fitA !== fitB) return fitB - fitA;
    return b.underwaterScore - a.underwaterScore;
  });
  return gems.slice(0, limit);
}

function buildReasons(parts: HiddenGem["underwaterParts"], tier: RiskTier, bs: number, fund?: Fundamentals | null): string[] {
  const reasons: string[] = [];
  if (parts.notTopIndex) reasons.push("ไม่ติดดัชนีหลัก — อยู่นอกเรดาร์กองทุน");
  if (parts.midSmallCap) reasons.push("ขนาดกลาง-เล็ก — ยังไม่มีใครสะสม");
  if (parts.lowLiquidity) reasons.push("สภาพคล่องไม่หนาแน่น — ข่าวน้อย");
  if (parts.unloved) reasons.push("PE ไม่โดดเด่น/ไม่มีข้อมูล — ถูกมองข้าม");
  if (fund) {
    if (fund.roe !== undefined && fund.roe >= 15) reasons.push(`ROE ${fund.roe}% — ทำกำไรจากทุนเก่ง`);
    if (fund.revenueGrowth !== undefined && fund.revenueGrowth > 0) reasons.push(`รายได้โต ${fund.revenueGrowth}%`);
    if (tier === "safe") reasons.push("ผ่านเกณฑ์คุณภาพครบ (Buffett ≥ 8/10) + สภาพคล่องพอ");
  }
  return reasons;
}
