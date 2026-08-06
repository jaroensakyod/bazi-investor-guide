import { calculateBaziChart } from "../bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../bazi/in-memory-repository";
import { resolveInvestorPersona, resolveInvestElements, wealthElementTh, elementBusinessHint } from "../investor/investor-guide";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { getAllStocks } from "../investor/stock-database";
import { loadFundamentalsCache } from "../market/fundamentals";
import { buffettChecks, buffettScore } from "../report/buffett-checks";
import { getAssets } from "../assets/asset-universe";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

const ELEMENT_ORDER = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] as const;

export function buildPersonalDashboard(state: CalculatedStateValue) {
  const persona = resolveInvestorPersona(state);
  const { invest, avoid } = resolveInvestElements(state);
  const wealth = wealthElementTh(state);
  const snap = loadSnapshot();
  const fundCache = loadFundamentalsCache();

  // ── 1. ธาตุในดวง (นับจาก 8 ตัวอักษรในดวง — visibleCounts) ──
  const counts = (state.elementAnalysis.totalCounts ?? state.elementAnalysis.visibleCounts) as Record<string, number>;
  const total = Math.max(1, Object.values(counts).reduce((a, b) => a + (b ?? 0), 0));
  const EN2TH: Record<string, string> = { wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ" };
  const elementBalance = ELEMENT_ORDER.map((el) => {
    const key = Object.keys(EN2TH).find((k) => EN2TH[k] === el) ?? el;
    const cnt = counts[key] ?? 0;
    const s = state.elementAnalysis.elementStrengths.find((e) => e.element === key)?.strength ?? "balanced";
    return { element: el, strength: s, count: cnt, pct: Math.round((cnt / total) * 100) };
  });
  const strongest = [...elementBalance].sort((a, b) => b.count - a.count)[0];
  const strengthenEl = invest[0];

  // ── 2. เทรดได้/ไม่ได้ + เงินเร็ว/เงินเย็น (ตามกำลังดิถี) ──
  const band = persona.band as "weak" | "balanced" | "strong";
  const trading = {
    weak: {
      allowed: "no" as const,
      label: "เทรดไม่ได้",
      reason: "ดิถีอ่อน — พลังไม่พอรับความผันผวนระยะสั้น เทรด/เก็งกำไร มักเจ้ง (ขาดทุน) เหมาะลงทุนระยะยาวสะสม (เงินเย็น) + หุ้นเสริมธาตุ",
      split: { emergency: 20, cold: 70, fast: 10 },
    },
    balanced: {
      allowed: "limited" as const,
      label: "เทรดได้จำกัด",
      reason: "ดิถีสมดุล — เทรดได้บ้างแต่จำกัดวงเงิน เน้นลงทุนระยะยาวเป็นหลัก + เก็งกำไรเล็กน้อย",
      split: { emergency: 20, cold: 60, fast: 20 },
    },
    strong: {
      allowed: "yes" as const,
      label: "เทรดได้",
      reason: "ดิถีแข็ง — รับความผันผวนได้ดี เทรดระยะสั้น/เก็งกำไรได้ แต่ต้องมีวินัยตัดขาดทุน",
      split: { emergency: 20, cold: 50, fast: 30 },
    },
  }[band];

  // ── 3. เครื่องมือรายหมวด (fix ตามหลักซินแส) ──
  const instruments = {
    emergency: ["เงินฝากออมทรัพย์", "กองทุนตลาดเงิน (K-CASH)", "สลากออมสิน"],
    cold: [
      `กองทุนรวม/ETF หุ้นปันผล (ธาตุ${strengthenEl})`,
      `หุ้นเสริมธาตุ${strengthenEl}รายตัว`,
      "บอนด์/พันธบัตร (น้ำ)",
      "ทองคำแท่ง (ทอง)",
      `REIT/อสังหาฯ (ดิน)`,
    ],
    fast: ["หุ้นรายตัวเก็งกำไร", "คริปโต (ไฟ)", "ฟิวเจอร์ส/อนุพันธ์ (เลเวอเรจ)", "เทรดทองออนไลน์"],
  };

  // ── 4. หุ้นเสริมธาตุ (top 5 ของธาตุที่ควรทำ) ──
  const topStocks = getAllStocks()
    .filter((s) => s.primaryElement === strengthenEl)
    .map((s) => {
      const yt = yahooTicker(s.ticker, s.market) ?? "";
      const md = snap?.quotes[yt];
      const f = fundCache.get(yt);
      let score = 0;
      if (f) score += buffettScore(buffettChecks(f)) / 2; // 0..5
      if (md?.changePct != null) score += Math.max(-1, Math.min(1, md.changePct / 5));
      return { ticker: s.ticker, name: s.name, market: s.market, price: md?.price ?? null, changePct: md?.changePct ?? null, score: Math.round(score * 10) / 10 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // ── 5. สินทรัพย์เด่น (ธาตุที่ควรทำ + tier ปลอดภัย/กลาง ก่อน) ──
  const topAssets = getAssets()
    .filter((a) => a.primaryElement === strengthenEl && a.riskTier !== "risky")
    .map((a) => {
      const md = snap?.quotes[a.ticker];
      return { ticker: a.ticker, name: a.name, type: a.type, riskTier: a.riskTier, price: md?.price ?? null, changePct: md?.changePct ?? null };
    })
    .slice(0, 5);

  return {
    persona: {
      element: persona.element,
      band,
      bandLabel: band === "weak" ? "ดิถีอ่อน" : band === "balanced" ? "ดิถีสมดุล" : "ดิถีแข็ง",
      name: persona.name,
      emoji: persona.emoji,
      strengths: persona.strengths,
      weaknesses: persona.weaknesses,
      style: persona.style,
      allocation: persona.allocation,
    },
    elementBalance,
    strongestElement: { element: strongest.element, count: strongest.count },
    strengthen: { element: strengthenEl, businessHint: elementBusinessHint(strengthenEl), wealth },
    avoid,
    trading,
    instruments,
    topStocks,
    topAssets,
    disclaimer: "บทวิเคราะห์อ้างอิงจากดวง (ดิถี/ธาตุ) + ตลาด + แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function personalDashboardFor(birth: { birthDate: string; birthTime: string; gender: "male" | "female"; province: string }) {
  const state = await calculateBaziChart(birth, createInMemoryKnowledgeRepository());
  return buildPersonalDashboard(state);
}
