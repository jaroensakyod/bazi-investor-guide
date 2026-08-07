import { calculateBaziChart } from "../bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../bazi/in-memory-repository";
import { resolveInvestorPersona, resolveInvestElements, wealthElementTh, elementBusinessHint, outputElementTh, buildInvestorTimeline } from "../investor/investor-guide";
import { loadSnapshot } from "../market/market-data";
import { yahooTicker } from "../market/yahoo";
import { getAllStocks } from "../investor/stock-database";
import { loadFundamentalsCache } from "../market/fundamentals";
import { buffettChecks, buffettScore } from "../report/buffett-checks";
import { getAssets } from "../assets/asset-universe";
import { classifyIpoElement, elementFitForUser, type IpoRow } from "../market/ipo-elements";
import { classifyStockTier, TIER_META, type StockTier } from "../investor/stock-tiers";
import { readFileSync } from "node:fs";
import { dayFitForUser, monthInvestFit, dayElementOf } from "../fortune/investment-days";
import { buildAlmanacDay } from "../bazi/almanac/almanac-engine";
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

  // ── 2.5 ธาตุเกิน (มากสุดในดวง) — ใช้ปรับคำแนะนำเครื่องมือ/สินค้า ──
  const excessElement = [...elementBalance].sort((a, b) => b.count - a.count)[0].element;
  const excessCount = [...elementBalance].sort((a, b) => b.count - a.count)[0].count;
  const excessNote =
    excessElement === wealth
      ? `ธาตุลาภ=${wealth} มีเกิน(${excessCount} ตัว) + ดิถีอ่อน (身弱财旺) → อย่าไล่ลาภ${wealth}เพิ่ม เน้นเสริม${strengthenEl}ก่อน ลาภจะตามมาเอง`
      : `ธาตุ${excessElement} มีเกิน(${excessCount} ตัว) → ไม่ควรเพิ่ม${excessElement} เน้นสมดุลด้วย${strengthenEl}`;

  // ── 3. เครื่องมือรายหมวด (fix ตามหลักซินแส — ปรับตามธาตุเกินของแต่ละดวง) ──
  const coldList = [`กองทุนรวม/ETF หุ้นปันผล (ธาตุ${strengthenEl})`, `หุ้นเสริมธาตุ${strengthenEl}รายตัว`];
  coldList.push(
    excessElement === "น้ำ" ? "เงินฝาก/บอนด์อายุสั้น (เลี่ยงน้ำเพิ่ม — ดวงน้ำเกิน)" : "บอนด์/พันธบัตร (น้ำ)",
    "ทองคำแท่ง (ทอง)",
    "REIT/อสังหาฯ (ดิน)",
  );
  const instruments = {
    emergency: ["เงินฝากออมทรัพย์", "กองทุนตลาดเงิน (K-CASH)", "สลากออมสิน"],
    cold: coldList,
    fast: ["หุ้นรายตัวเก็งกำไร", "คริปโต (ไฟ)", "ฟิวเจอร์ส/อนุพันธ์ (เลเวอเรจ)", "เทรดทองออนไลน์"],
  };

  // ── 4. สินค้าแนะนำครบทุกหมวด (พร้อมโครง paywall อนาคต — unlock: free/pro/premium) ──
  // fit ตามกำลังดิถี: good=ธาตุเสริม · avoid=ธาตุพิฆาต · drain=ดูดพลัง (ดวงอ่อน: 食伤/财
  // ระบายกำลังของดิถีอ่อน — อย่าเพิ่ม) · neutral=กลาง
  const fitOf = (el: string): "good" | "neutral" | "avoid" | "drain" => {
    if ((avoid as string[]).includes(el)) return "avoid";
    if ((invest as string[]).includes(el)) return "good";
    if (band === "weak") return "drain"; // ดิถีอ่อน: ธาตุที่ไม่ใช่คู่ธาตุ/ส่งเสริม = ดูดพลัง
    return "neutral";
  };
  const assetsOf = getAssets();
  const mdOf = (ticker: string) => snap?.quotes[ticker];
  const scoreOf = (md: { changePct?: number | null } | undefined, f?: unknown): number => {
    let s = 0;
    if (f) s += buffettScore(buffettChecks(f as never)) / 4; // 0..2.5
    if (md?.changePct != null) s += Math.max(-1, Math.min(1, md.changePct / 5));
    return Math.round(s * 10) / 10;
  };
  // เทียร์หุ้น/สินทรัพย์ (Hormozi) — fit จากดวง + พื้นฐาน + ขนาด + โมเมนตัม
  const tierOf = (fit: "good" | "neutral" | "avoid" | "drain", f: unknown | undefined, capTier: string | undefined, changePct: number | null): StockTier => {
    const bf = f ? buffettScore(buffettChecks(f as never)) : null;
    const roe = f ? (f as { roe?: number }).roe ?? null : null;
    return classifyStockTier({ fit, roe, buffett: bf, capTier, changePct }).tier;
  };
  const ASSET_CAP: Record<string, string> = { safe: "mega", balanced: "large", growth: "mid", risky: "small" };
  const assetRow = (a: (typeof assetsOf)[number], unlock: string) => {
    const md = mdOf(a.ticker);
    const fit = fitOf(a.primaryElement);
    const tier = tierOf(fit, undefined, ASSET_CAP[a.riskTier] ?? "mid", md?.changePct ?? null);
    return { ticker: a.ticker, name: a.name, element: a.primaryElement, fit, riskTier: a.riskTier, price: md?.price ?? null, changePct: md?.changePct ?? null, unlock, stockTier: tier, tierUnlock: TIER_META[tier].unlock };
  };
  const stockRow = (s: { ticker: string; name: string; market: string; primaryElement: string; tier: string }, unlock: string) => {
    const yt = yahooTicker(s.ticker, s.market) ?? "";
    const md = snap?.quotes[yt];
    const f = fundCache.get(yt);
    const fit = fitOf(s.primaryElement);
    const tier = tierOf(fit, f, s.tier, md?.changePct ?? null);
    return { ticker: s.ticker, name: s.name, market: s.market, element: s.primaryElement, fit, riskTier: s.tier, price: md?.price ?? null, changePct: md?.changePct ?? null, score: scoreOf(md, f), unlock, stockTier: tier, tierUnlock: TIER_META[tier].unlock };
  };
  const allStocks = getAllStocks();
  const byEl = (el: string) => allStocks.filter((s) => s.primaryElement === el);
  const inMarkets = (list: typeof allStocks, mk: string[]) => list.filter((s) => mk.includes(s.market));
  const top = <T,>(list: T[], n: number): T[] => list.slice(0, n);
  const sortByScore = <T,>(list: Array<T & { score?: number }>) => [...list].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const sTh = top(sortByScore(inMarkets(byEl(strengthenEl), ["SET", "mai"]).map((s) => stockRow(s, "pro"))), 3);
  const sGlobal = top(sortByScore(inMarkets(byEl(strengthenEl), ["NYSE", "NASDAQ", "NYSE/NASDAQ", "HOSE", "TSE", "KRX", "TWSE", "SSE", "SZSE"]).map((s) => stockRow(s, "pro"))), 3);
  const etfFund = top(assetsOf.filter((a) => (a.type === "etf" || a.type === "fund") && a.primaryElement === strengthenEl).map((a) => assetRow(a, "pro")), 3);
  const goldMetal = top(assetsOf.filter((a) => a.type === "commodity" && ["โลหะมีค่า", "โลหะอุตสาหกรรม"].includes(a.sector ?? "")).map((a) => assetRow(a, "free")), 3);
  const energy = top(assetsOf.filter((a) => a.type === "commodity" && (a.sector ?? "").includes("พลังงาน")).map((a) => assetRow(a, "pro")), 3);
  const crypto = top(assetsOf.filter((a) => a.type === "crypto").map((a) => assetRow(a, "premium")), 3);
  const bond = top(assetsOf.filter((a) => a.type === "bond").map((a) => assetRow(a, "free")), 3);
  const reitProp = top(assetsOf.filter((a) => (a.type === "reit" || (a.type === "real_asset" && (a.sector ?? "").includes("อสังหา")))).map((a) => assetRow(a, "free")), 3);
  const emergency = top(assetsOf.filter((a) => a.type === "deposit" || a.type === "lottery" || a.ticker === "CASH_THB").map((a) => assetRow(a, "free")), 2);
  const realEstate = top(assetsOf.filter((a) => a.type === "real_asset" && a.primaryElement === "ดิน" && (a.sector ?? "").includes("อสังหา")).map((a) => assetRow(a, "pro")), 3);
  // IPO ใหม่ที่เหมาะดวง (ธาตุ ∈ invest) — ใช้ classifyIpoElement จากชื่อบริษัท
  let ipoRows: IpoRow[] = [];
  try {
    const ipoDb = JSON.parse(readFileSync("data/ipo.json", "utf8")) as { entries?: IpoRow[] };
    ipoRows = ipoDb.entries ?? [];
  } catch {
    ipoRows = [];
  }
  const ipoList = ipoRows
    .filter((e) => (invest as string[]).includes(classifyIpoElement(e).element))
    .map((e) => {
      const { element, reason } = classifyIpoElement(e);
      const fit = elementFitForUser(state, element);
      const tier = tierOf(fit, undefined, "small", null);
      return { ticker: e.ticker, name: e.name, element, fit, riskTier: "ipo", price: null, changePct: null, unlock: "pro", ipoDate: e.ipoDate ?? "", stockTier: tier, tierUnlock: TIER_META[tier].unlock };
    })
    .slice(0, 3);

  const categories = [
    { id: "stocks_th", label: "หุ้นไทยเสริมธาตุ", unlock: "pro", items: sTh },
    { id: "stocks_global", label: "หุ้นต่างประเทศเสริมธาตุ", unlock: "pro", items: sGlobal },
    { id: "etf_fund", label: "กองทุน/ETF เสริมธาตุ", unlock: "pro", items: etfFund },
    { id: "gold_metal", label: "ทอง/โลหะมีค่า", unlock: "free", items: goldMetal },
    { id: "energy", label: "พลังงาน (น้ำมัน/ก๊าซ)", unlock: "pro", items: energy },
    { id: "bond", label: "พันธบัตร/ตราสารหนี้", unlock: "free", items: bond },
    { id: "reit_property", label: "REIT/อสังหาปล่อยเช่า", unlock: "free", items: reitProp },
    { id: "emergency", label: "เงินฝาก/สลาก (ฉุกเฉิน)", unlock: "free", items: emergency },
    { id: "real_estate", label: "ที่ดิน/อสังหาจริง", unlock: "pro", items: realEstate },
    { id: "crypto", label: "คริปโต (เก็งกำไร — ดิถีอ่อนระวัง)", unlock: "premium", items: crypto },
    { id: "ipo", label: "IPO ใหม่ (เหมาะดวง)", unlock: "pro", items: ipoList },
  ];

  // ── 6. วันมงคล/วันระวัง (ของใครของมัน — เทียบธาตุวันกับดวง) ──
  const next14: Array<{ date: string; weekday: string; dayElement: string | null; fit: "good" | "neutral" | "avoid" }> = [];
  for (let i = 0; i < 14; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const al = buildAlmanacDay(d.getFullYear(), d.getMonth() + 1, d.getDate());
    next14.push({ date: iso, weekday: al.weekday, dayElement: dayElementOf(iso), fit: dayFitForUser(state, iso) });
  }
  const now = new Date();
  const month = monthInvestFit(state, now.getFullYear(), now.getMonth() + 1);

  // ── 7. หลักการแข็ง-อ่อน (ซินแส: แข็งเกิน→ถ่ายเท เอาออก · อ่อนขาด→เสริม) + ไทม์ไลน์ + ธาตุเดือน ──
  const outputEl = outputElementTh(state);
  const principle = {
    band,
    mode: band === "weak" ? "เสริม" : band === "strong" ? "ถ่ายเท" : "สมดุล",
    desc:
      band === "weak"
        ? `ดิถีอ่อน/ธาตุขาด → ใช้หลัก "เสริม" (คู่ธาตุ + ธาตุส่งเสริม) — เสริมธาตุ ${strengthenEl}`
        : band === "strong"
          ? `ดิถีแข็งเกินไป → ใช้หลัก "ถ่ายเท" (ธาตุระบายออก เอาออก) — ถ่ายเทธาตุ ${outputEl}`
          : `ดิถีสมดุล → ใช้ทั้ง "ถ่ายเท" (ธาตุ ${outputEl}) และ "ธาตุลาภ" (${wealth})`,
    outputElement: outputEl,
    supplementElement: strengthenEl,
    excessElement,
    excessCount,
    excessNote,
  };
  const timeline = buildInvestorTimeline(state, { split5: true }) // ทุก 5 ปี (ต้น/กิ่ง)
    .filter((p) => p.endAge >= 15 && p.startAge <= 80) // วัย 15–80
    .map((p) => ({ ageRange: p.ageRange, verdict: p.verdict, reaction: p.reaction, advice: p.advice }));
  const monthEl = month.monthElement;
  const monthFit = monthEl ? ((avoid as string[]).includes(monthEl) ? "avoid" : (invest as string[]).includes(monthEl) ? "good" : "neutral") : "neutral";
  const monthAdvice = {
    element: monthEl,
    fit: monthFit,
    text:
      monthFit === "good"
        ? `เดือนนี้ธาตุ${monthEl} = ตรงดวง → เหมาะเริ่มลงทุน/ทำตามแผน`
        : monthFit === "avoid"
          ? `เดือนนี้ธาตุ${monthEl} = ขัดดวง ⚠️ → เลี่ยงเสี่ยง เน้นสะสมเงินเย็น อย่าลงทุนก้อน`
          : `เดือนนี้ธาตุ${monthEl} = กลาง → ค่อยๆ สะสม ไม่เร่ง`,
  };

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
    categories,
    principle,
    timeline,
    monthAdvice,
    auspiciousDays: {
      next14,
      month: {
        monthElement: month.monthElement,
        yearElement: month.yearElement,
        caishenDir: month.caishenDir,
        goodDays: month.goodDays,
        avoidDays: month.avoidDays,
        goodDayCount: month.goodDayCount,
        avoidDayCount: month.avoidDayCount,
      },
    },
    disclaimer: "บทวิเคราะห์อ้างอิงจากดวง (ดิถี/ธาตุ) + ตลาด + แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน",
  };
}

export async function personalDashboardFor(birth: { birthDate: string; birthTime: string; gender: "male" | "female"; province: string }) {
  const state = await calculateBaziChart(birth, createInMemoryKnowledgeRepository());
  return buildPersonalDashboard(state);
}
