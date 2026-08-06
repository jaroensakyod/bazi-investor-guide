/**
 * Full institution-style report — รวบรวมทุกมุม (deterministic ล้วน)
 * ใช้กับ PDF + หน้าเว็บรายงานฉบับเต็ม
 *
 * โครงสร้างเลียนแบบรายงานนักวิเคราะห์ (ตามแผน Phase 3):
 * 1. หน้าปก (หุ้น/ธาตุ/tier/วันที่)
 * 2. มุมมองดวง (verdict + เหตุผล + invest/avoid + ไทม์ไลน์)
 * 3. พื้นฐาน + Buffett checklist
 * 4. เดือนนี้ (ธาตุเดือน/ทิศเงิน/วันดี-เลี่ยง)
 * 5. หุ้นที่ตรงธาตุวันนี้ + สินทรัพย์เด่น
 */
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { generateReport, getFundamentals } from "@/lib/chat/tools";
import { monthInvestFit, stocksForDay } from "@/lib/fortune/investment-days";
import { getAssetVerdicts } from "@/lib/chat/tools";

export type FullReport = {
  meta: { ticker: string; name: string; element: string; tier: string; generatedAt: string; yearBE: number };
  verdict: {
    label: string;
    score: number;
    reasons: string[];
    invest: string[];
    avoid: string[];
    persona: string;
    timeline: Array<{ ageRange: string; verdict: string; advice: string }>;
  } | null;
  fundamentals: {
    roe: number | null;
    profitMargin: number | null;
    revenueGrowth: number | null;
    debtToEquity: number | null;
    buffettScore: number;
    checks: Array<{ label: string; status: "pass" | "warn" | "fail"; detail: string }>;
  } | null;
  month: {
    monthElement: string | null;
    yearElement: string | null;
    caishenDir: string | null;
    goodDays: Array<{ date: string; weekday: string }>;
    avoidDays: Array<{ date: string; weekday: string }>;
  } | null;
  dayStocks: Array<{ ticker: string; name: string; element: string; changePct: number | null }>;
  topAssets: Array<{ ticker: string; name: string; type: string; element: string; verdict: string; score: number }>;
  disclaimer: string;
};

type VerdictShape = NonNullable<FullReport["verdict"]> & {
  score: { verdict: string; score: number; reasons: string[] };
  persona: { emoji: string; name: string };
};

export function buildFullReport(ticker: string, state?: CalculatedStateValue): FullReport {
  const rep = generateReport(ticker, state);
  const fund = getFundamentals(ticker);
  const now = new Date();
  const v = rep.ok && rep.data && (rep.data as { verdict?: unknown }).verdict
    ? (rep.data as { verdict: VerdictShape }).verdict
    : null;
  const stock = (rep.ok && rep.data ? (rep.data as { stock: { ticker: string; name: string; element: string; tier: string } }).stock : { ticker, name: ticker, element: "-", tier: "-" });

  let month = null;
  let dayStocks: FullReport["dayStocks"] = [];
  let topAssets: FullReport["topAssets"] = [];
  if (state) {
    const m = monthInvestFit(state, now.getFullYear(), now.getMonth() + 1);
    month = { monthElement: m.monthElement, yearElement: m.yearElement, caishenDir: m.caishenDir, goodDays: m.goodDays, avoidDays: m.avoidDays };
    dayStocks = stocksForDay(state, now.toISOString().slice(0, 10), 5);
    const a = getAssetVerdicts(state, { limit: 5 });
    if (a.ok && a.data) topAssets = (a.data as { assets: FullReport["topAssets"] }).assets;
  }

  return {
    meta: { ...stock, generatedAt: now.toISOString().slice(0, 10), yearBE: now.getFullYear() + 543 },
    verdict: v
      ? {
          label: v.score.verdict,
          score: v.score.score,
          reasons: v.score.reasons,
          invest: v.invest,
          avoid: v.avoid,
          persona: `${v.persona.emoji} ${v.persona.name}`,
          timeline: v.timeline,
        }
      : null,
    fundamentals: fund.ok && fund.data && fund.data.hasData && fund.data.fundamentals
      ? {
          roe: fund.data.fundamentals.roe ?? null,
          profitMargin: fund.data.fundamentals.profitMargin ?? null,
          revenueGrowth: fund.data.fundamentals.revenueGrowth ?? null,
          debtToEquity: fund.data.fundamentals.debtToEquity ?? null,
          buffettScore: fund.data.buffettScore,
          checks: fund.data.buffett,
        }
      : null,
    month,
    dayStocks,
    topAssets,
    disclaimer: "⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน",
  };
}
