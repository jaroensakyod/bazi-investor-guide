/**
 * พอร์ตเด่นรายเดือน (สไตล์ ProPicks AI) — deterministic ล้วน
 *
 * จุดต่างจาก investing.com: คัดโดย "ดวง×หุ้น" (scoreStock) + พื้นฐาน + โมเมนตัม
 * แต่ละตัวมีเหตุผล "ทำไมถึงถูกเลือก" แบบโปร่งใส (ธาตุ/ROE/Buffett/โมเมนตัม)
 *
 * ⚠️ ไม่ปลอมผลตอบแทนย้อนหลัง — แสดงแค่: พอร์ตเดือนนี้ + เทียบ benchmark วันนี้ + methodology
 */
import { scoreStock } from "../investor/investor-guide";
import { getFundamentals } from "../chat/tools";
import { buffettChecks, buffettScore } from "../report/buffett-checks";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { getAllStocks } from "../investor/stock-database";
import { loadFundamentalsCache } from "../market/fundamentals";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

export type PickMarket = "TH" | "US" | "MID";

export type MonthlyPick = {
  ticker: string;
  name: string;
  market: string;
  element: string;
  tier: string;
  score: number; // composite (ธาตุ×2 + พื้นฐาน + โมเมนตัม)
  elementScore: number; // เฉพาะธาตุ (scoreStock)
  price: number | null;
  changePct: number | null;
  reasons: string[];
  fundamentals: { roe: number | null; buffett: number | null } | null;
};

const MARKET_SCOPES: Record<PickMarket, { markets: string[]; tiers?: string[]; benchmark: string; benchmarkName: string; label: string; desc: string }> = {
  TH: { markets: ["SET", "mai"], benchmark: "^SET.BK", benchmarkName: "SET Index", label: "TH10 — เหนือ SET", desc: "10 หุ้นไทยเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  US: { markets: ["NYSE", "NASDAQ", "NYSE/NASDAQ"], benchmark: "^GSPC", benchmarkName: "S&P 500", label: "US10 — เหนือ S&P 500", desc: "10 หุ้นสหรัฐเด่นประจำเดือน คัดโดย ดวง×หุ้น + พื้นฐาน" },
  MID: { markets: ["SET", "mai"], tiers: ["mid", "small"], benchmark: "^SET.BK", benchmarkName: "SET Index", label: "MID10 — หุ้นกลางไทย", desc: "10 หุ้นขนาดกลางไทยเด่น (mid/small) — โตในประเทศ+ภูมิภาค" },
};

export function buildMonthlyPicks(state: CalculatedStateValue, market: PickMarket = "TH", limit = 10) {
  const cfg = MARKET_SCOPES[market];
  const snap = loadSnapshot();
  const fundCache = loadFundamentalsCache();
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
      if (f) {
        const bf = buffettScore(buffettChecks(f));
        const roe = f.roe;
        score += bf / 5; // Buffett 0-10 → +0..+2
        if (roe != null) score += roe >= 15 ? 1 : roe >= 8 ? 0.5 : 0;
        reasons.push(`พื้นฐาน: ROE ${roe != null ? `${roe}%` : "-"} · Buffett ${bf}/10`);
        fundInfo = { roe: roe ?? null, buffett: bf };
      }
      const chg = md?.changePct ?? null;
      if (chg != null) {
        score += Math.max(-1, Math.min(1, chg / 5)); // โมเมนตัมวันนี้ +-1
        reasons.push(`โมเมนตัมวันนี้ ${chg >= 0 ? "+" : ""}${chg}%`);
      }
      return { ticker: s.ticker, name: s.name, market: s.market, element: s.primaryElement, tier: s.tier, score: Math.round(score * 10) / 10, elementScore: es.score, price: md?.price ?? null, changePct: chg, reasons, fundamentals: fundInfo };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const bench = snap?.quotes[cfg.benchmark];
  const meta = snap?.updatedAt ?? null;
  return {
    market,
    label: cfg.label,
    desc: cfg.desc,
    benchmark: { symbol: cfg.benchmark, name: cfg.benchmarkName, changePct: bench?.changePct ?? null, price: bench?.price ?? null },
    updatedAt: meta,
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
  return buildMonthlyPicks(state, market ?? "TH", limit ?? 10);
}
