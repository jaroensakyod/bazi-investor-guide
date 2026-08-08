/**
 * พอร์ตเด่นรายเดือน (สไตล์ ProPicks AI) — deterministic ล้วน
 *
 * จุดต่างจาก investing.com: คัดโดย "ดวง×หุ้น" (scoreStock) + พื้นฐาน + โมเมนตัม
 * แต่ละตัวมีเหตุผล "ทำไมถึงถูกเลือก" แบบโปร่งใส (ธาตุ/ROE/Buffett/โมเมนตัม)
 *
 * ⚠️ ไม่ปลอมผลตอบแทนย้อนหลัง — แสดงแค่: พอร์ตเดือนนี้ + เทียบ benchmark วันนี้ + methodology
 */
import { scoreStock } from "../investor/investor-guide";
import { buffettChecks, buffettScore } from "../report/buffett-checks";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { getAllStocks } from "../investor/stock-database";
import { loadFundamentalsCache } from "../market/fundamentals";
import { classifyStockTier, visibleTiers, TIER_META, type StockTier, type UnlockLevel, type TierInput } from "../investor/stock-tiers";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

export type PickMarket = "TH" | "US" | "MID";

export type MonthlyPick = {
  ticker: string;
  name: string;
  business: string;
  description?: string;
  market: string;
  sector: string;
  element: string;
  elementReason: string;
  tier: string;
  riskTier?: "safe" | "medium" | "risky";
  isHighLiquidity: boolean;
  stockTier: StockTier;
  unlock: UnlockLevel;
  score: number; // composite (ธาตุ×2 + พื้นฐาน + โมเมนตัม)
  elementScore: number; // เฉพาะธาตุ (scoreStock)
  price: number | null;
  changePct: number | null;
  valuation: {
    pe: number | null;
    pbv: number | null;
    dividendYield: number | null;
    marketCap: number | null;
    high52w: number | null;
    low52w: number | null;
    currency: string | null;
  };
  evidence: {
    businessSource: string | null;
    businessUrl: string | null;
    elementSource: string | null;
    reviewStatus: string;
    reviewedBy: string | null;
    reviewedAt: string | null;
  };
  reasons: string[];
  fundamentals: {
    roe: number | null;
    buffett: number | null;
    profitMargin: number | null;
    revenueGrowth: number | null;
    debtToEquity: number | null;
    currentRatio: number | null;
    sector: string | null;
    industry: string | null;
  } | null;
};

const MARKET_SCOPES: Record<PickMarket, { markets: string[]; tiers?: string[]; benchmark: string; benchmarkName: string; label: string; desc: string }> = {
  TH: { markets: ["SET", "mai"], benchmark: "^SET.BK", benchmarkName: "SET Index", label: "TH30 — เหนือ SET", desc: "30 หุ้นไทยเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  US: { markets: ["NYSE", "NASDAQ", "NYSE/NASDAQ"], benchmark: "^GSPC", benchmarkName: "S&P 500", label: "US30 — เหนือ S&P 500", desc: "30 หุ้นสหรัฐเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  MID: { markets: ["SET", "mai"], tiers: ["mid", "small"], benchmark: "^SET.BK", benchmarkName: "SET Index", label: "MID30 — หุ้นกลางไทย", desc: "30 หุ้นขนาดกลางไทยเด่น (mid/small) — โตในประเทศ+ภูมิภาค" },
};

export function buildMonthlyPicks(state: CalculatedStateValue, market: PickMarket = "TH", limit = 30, unlock: UnlockLevel = "free") {
  const cfg = MARKET_SCOPES[market];
  const snap = loadSnapshot();
  const fundCache = loadFundamentalsCache();
  const visible = visibleTiers(unlock);
  const stocks = getAllStocks()
    .filter((s) => cfg.markets.includes(s.market))
    .filter((s) => !cfg.tiers || (cfg.tiers.includes(s.tier) || s.growthStage === "mid" || s.growthStage === "small"))
    .map((s) => {
      const es = scoreStock(state, { ticker: s.ticker, name: s.name, business: s.business, elements: s.elements, primaryElement: s.primaryElement });
      const md = snap?.quotes[yahooTicker(s.ticker, s.market) ?? ""];
      const f = fundCache.get(yahooTicker(s.ticker, s.market) ?? "");
      let score = es.score * 2; // ธาตุ×ดวง = หัวใจ (ถ่วง 2 เท่า)
      const reasons = [...es.reasons];
      let fundInfo: MonthlyPick["fundamentals"] = null;
      let roe: number | null = null;
      let bf = 0;
      if (f) {
        bf = buffettScore(buffettChecks(f));
        roe = f.roe ?? null;
        score += bf / 5; // Buffett 0-10 → +0..+2
        if (roe != null) score += roe >= 15 ? 1 : roe >= 8 ? 0.5 : 0;
        reasons.push(`พื้นฐาน: ROE ${roe != null ? `${roe}%` : "-"} · Buffett ${bf}/10`);
        fundInfo = {
          roe: roe ?? null,
          buffett: bf,
          profitMargin: f.profitMargin ?? null,
          revenueGrowth: f.revenueGrowth ?? null,
          debtToEquity: f.debtToEquity ?? null,
          currentRatio: f.currentRatio ?? null,
          sector: f.sector ?? null,
          industry: f.industry ?? null,
        };
      }
      const chg = md?.changePct ?? null;
      if (chg != null) {
        score += Math.max(-1, Math.min(1, chg / 5)); // โมเมนตัมวันนี้ +-1
        reasons.push(`โมเมนตัมวันนี้ ${chg >= 0 ? "+" : ""}${chg}%`);
      }
      // เทียร์หุ้น (Hormozi ladder): fit จาก verdict ของ scoreStock (very-good/good/neutral/avoid)
      const fitOf: TierInput["fit"] = es.verdict === "very-good" || es.verdict === "good" ? "good" : es.verdict === "neutral" ? "neutral" : "avoid";
      const tiered = classifyStockTier({ fit: fitOf, roe, buffett: bf || null, capTier: s.tier, changePct: chg });
      return {
        ticker: s.ticker,
        name: s.name,
        business: s.business,
        description: s.description,
        market: s.market,
        sector: s.sector,
        element: s.primaryElement,
        elementReason: s.elementReason,
        tier: s.tier,
        riskTier: s.riskTier,
        isHighLiquidity: s.isHighLiquidity,
        stockTier: tiered.tier,
        unlock: TIER_META[tiered.tier].unlock,
        score: Math.round(score * 10) / 10,
        elementScore: es.score,
        price: md?.price ?? null,
        changePct: chg,
        valuation: {
          pe: md?.pe ?? null,
          pbv: md?.pbv ?? null,
          dividendYield: md?.dividendYield ?? null,
          marketCap: md?.marketCap ?? null,
          high52w: md?.high52w ?? null,
          low52w: md?.low52w ?? null,
          currency: md?.currency ?? s.currency ?? null,
        },
        evidence: {
          businessSource: s.businessEvidence?.source ?? null,
          businessUrl: s.businessEvidence?.url ?? s.website ?? null,
          elementSource: s.elementSource ?? null,
          reviewStatus: s.status,
          reviewedBy: s.reviewedBy ?? null,
          reviewedAt: s.reviewedAt ?? null,
        },
        reasons,
        fundamentals: fundInfo,
      };
    })
    .filter((p) => visible.includes(p.stockTier))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const bench = snap?.quotes[cfg.benchmark];
  const meta = snap?.updatedAt ?? null;
  const tierCounts: Record<string, number> = { gold: 0, silver: 0, bronze: 0, base: 0 };
  for (const p of stocks) tierCounts[p.stockTier] += 1;
  return {
    market,
    label: cfg.label,
    desc: cfg.desc,
    benchmark: { symbol: cfg.benchmark, name: cfg.benchmarkName, changePct: bench?.changePct ?? null, price: bench?.price ?? null },
    updatedAt: meta,
    unlock,
    tierCounts,
    picks: stocks,
    methodology: [
      "คัดจากหุ้นในคลัง (TH: SET+mai / US: NYSE+NASDAQ) เรียงตามคะแนนรวม",
      "คะแนน = ธาตุตรงดวง×2 (scoreStock: ธาตุที่ควรทำ/ธาตุลาภ/ธาตุพิฆาต) + พื้นฐาน (ROE/Buffett) + โมเมนตัมวันนี้",
      "อัปเดตตามรอบข้อมูล (cron รายวัน) — เปลี่ยนพอร์ตทุกเดือนตามธาตุเดือน",
    ],
    disclaimer: "บทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม และข้อมูลพื้นฐาน — ไม่ใช่คำแนะนำการลงทุน · ผลในอดีตไม่รับประกันอนาคต",
  };
}

/** ใช้ใน API + แชท */
export function picksForUser(state: CalculatedStateValue, market?: PickMarket, limit?: number) {
  return buildMonthlyPicks(state, market ?? "TH", limit ?? 30);
}
