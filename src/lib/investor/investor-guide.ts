/**
 * Core engine "ดวงนักลงทุน" — pure + deterministic (ไม่มี DB/FS/side-effect)
 *
 * รับ CalculatedStateValue (จาก bazi engine) → ผลิต:
 *   1. resolveInvestElements   — ธาตุที่ควรลงทุน/เลี่ยง (useful god + ตาราง B + ธาตุลาภ)
 *   2. scoreStock              — verdict รายหุ้น (score 5 กฎ)
 *   3. resolveInvestorPersona  — การ์ดตัวตน 1 ใน 15 แบบ (5 ธาตุ × 3 กำลัง)
 *   4. buildInvestorTimeline   — ไทม์ไลน์วัยจรทั้งชีวิต (ลงทุน/เก็บ/เลี่ยง)
 *   5. resolveForexSuitability — forex เหมาะไหม (เงื่อนไข 3 ข้อ)
 *
 * กฎเหล็ก: deterministic 100% — เรียงลำดับด้วย index คงที่ ห้าม Map/Set iteration
 */
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  CONTROLS,
  GENERATES,
  STEM_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";
import {
  getEngineUsefulElements,
  getEngineStrengthBand,
  resolveDaYunReaction,
  type ThaiElement,
  type StrengthBand,
} from "@/lib/bazi/topic-knowledge-adapted";
import { resolveDisplayTwelveQiStage } from "@/lib/bazi/pillar-display";
import { doElementsTh, avoidElementsTh, careerBandFromScore, type ElementTh } from "@/lib/bazi/constants/career-finance-table";
import {
  QI_INVEST_STYLE_TH,
  WEALTH_QI_GOOD_FOR_INVEST,
  ELEMENT_BUSINESS_TH,
} from "@/lib/investor/investor-tables";

// ───────── Types ─────────

export type StockVerdict = "very-good" | "good" | "neutral" | "avoid";

export type StockScore = {
  ticker: string;
  name: string;
  business: string;
  elements: ThaiElement[];
  primaryElement: ThaiElement;
  score: number;
  verdict: StockVerdict;
  reasons: string[];
};

export type InvestorPhase = {
  ageRange: string;
  startAge: number;
  endAge: number;
  stem: string;
  branch: string;
  reaction: string;
  wealthQi: string;
  verdict: "invest" | "accumulate" | "avoid" | "no-risk";
  advice: string;
};

export type InvestorPersona = {
  element: ThaiElement;
  band: StrengthBand;
  name: string;
  emoji: string;
  strengths: string;
  weaknesses: string;
  style: string;
  allocation: string;
};

// ───────── 1. ธาตุที่ควรลงทุน ─────────

const EN_TO_TH: Record<string, ThaiElement> = {
  wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ",
};

/** day master element (ไทย) */
export function dayMasterElementTh(state: CalculatedStateValue): ThaiElement {
  const en = STEM_TO_ELEMENT[state.dayMaster as keyof typeof STEM_TO_ELEMENT];
  return EN_TO_TH[en] ?? "ไม้";
}

/** ธาตุลาภ = ธาตุที่ดิถีพิฆาต (财) */
export function wealthElementTh(state: CalculatedStateValue): ThaiElement {
  const dm = STEM_TO_ELEMENT[state.dayMaster as keyof typeof STEM_TO_ELEMENT];
  return EN_TO_TH[CONTROLS[dm] as keyof typeof CONTROLS] ?? "ไม้";
}

/** ธาตุถ่ายเท = ธาตุที่ดิถีก่อเกิด (食傷) */
export function outputElementTh(state: CalculatedStateValue): ThaiElement {
  const dm = STEM_TO_ELEMENT[state.dayMaster as keyof typeof STEM_TO_ELEMENT];
  return EN_TO_TH[GENERATES[dm] as keyof typeof GENERATES] ?? "ไม้";
}

/** ธาตุที่ควรลงทุน เรียงลำดับความเหมาะ (ใช้ในบท "ลงทุนอะไร") */
export function resolveInvestElements(state: CalculatedStateValue): { invest: ThaiElement[]; avoid: ThaiElement[] } {
  const useful = getEngineUsefulElements(state); // ธาตุที่ดวงต้องการ
  const dmTh = dayMasterElementTh(state);
  const monthStem = state.fourPillars.month.stem;
  const monthElement = (STEM_TO_ELEMENT[monthStem as keyof typeof STEM_TO_ELEMENT] ?? "wood") as keyof typeof GENERATES;
  const tableB = doElementsTh(dmTh as ElementTh, careerBandFromScore(state.strengthScore), EN_TO_TH[monthElement] as ElementTh);
  const avoid = avoidElementsTh(dmTh as ElementTh, careerBandFromScore(state.strengthScore)) as ThaiElement[];

  // เรียง: tableB[0] → tableB[1] → useful ที่เหลือ (dedupe คงลำดับ)
  const ordered: ThaiElement[] = [];
  const push = (e: ThaiElement) => {
    if (!ordered.includes(e)) ordered.push(e);
  };
  for (const e of tableB) push(e as ThaiElement);
  for (const e of useful) push(e);

  return { invest: ordered, avoid };
}

// ───────── 2. verdict รายหุ้น (score 5 กฎ) ─────────

/**
 * คะแนนหุ้น 1 ตัว เทียบกับดวง
 *  +3 useful god · +2 tableB อันดับ 1 · +1 tableB อันดับ 2+ · +2 ธาตุลาภ · -4 ธาตุต้องห้าม · +1 ธาตุรอง useful
 */
export function scoreStock(state: CalculatedStateValue, stock: {
  ticker: string;
  name: string;
  business: string;
  elements: ThaiElement[];
  primaryElement: ThaiElement;
}): StockScore {
  const { invest, avoid } = resolveInvestElements(state);
  const wealth = wealthElementTh(state);
  const band = getEngineStrengthBand(state);
  const weak = band === "weak" || band === "very-weak";
  // ธาตุเกินในดวง (มากสุด) — ดิถีอ่อน: อย่าเพิ่มธาตุเกิน (身弱财旺: ลาภเกิน = ดูดพลัง)
  const counts = (state.elementAnalysis.totalCounts ?? state.elementAnalysis.visibleCounts) as Record<string, number>;
  const EN2TH: Record<string, string> = { wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ" };
  const excessElement = Object.entries(counts).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0]?.[0];
  const excessTh = EN2TH[excessElement] ?? "";
  let score = 0;
  const reasons: string[] = [];

  if (avoid.includes(stock.primaryElement)) {
    score -= 4;
    reasons.push(`ธาตุ${stock.primaryElement} = ธาตุพิฆาตดวง ⛔ ควรเลี่ยง`);
  }
  if (invest[0] === stock.primaryElement) {
    score += 2;
    reasons.push(`ธาตุ${stock.primaryElement} = ธาตุที่ควรทำอันดับ 1 ของดวง`);
  } else if (invest.slice(1).includes(stock.primaryElement)) {
    score += 1;
    reasons.push(`ธาตุ${stock.primaryElement} = ธาตุที่ควรทำอันดับรอง`);
  }
  if (stock.primaryElement === wealth) {
    if (weak) {
      score -= 1; // 身弱财旺: ธาตุลาภมีเกินแล้ว — ไล่ลาภ = ดูดพลังดิถีอ่อน
      reasons.push(`ธาตุ${stock.primaryElement} = ธาตุลาภ แต่ดิถีอ่อน+${stock.primaryElement}เกิน (身弱财旺) ⚠️ อย่าไล่ลาภ ดูดพลัง`);
    } else {
      score += 2;
      reasons.push(`ธาตุ${stock.primaryElement} = ธาตุลาภ (ดาวเงินของดวง)`);
    }
  }
  if (excessTh && stock.primaryElement === excessTh && !invest.includes(stock.primaryElement) && !avoid.includes(stock.primaryElement)) {
    score -= 1; // ธาตุเกินในดวง — อย่าเพิ่ม (ยกเว้นธาตุที่ดวงต้องการ)
    reasons.push(`ธาตุ${stock.primaryElement} = มีเกินในดวง (${counts[excessElement]} ตัว) — อย่าเพิ่ม`);
  }
  for (const e of getEngineUsefulElements(state)) {
    if (stock.elements.includes(e) && e !== stock.primaryElement) {
      score += 1;
      reasons.push(`มีธาตุ${e} (useful god) เป็นธาตุรอง`);
      break;
    }
  }

  const verdict: StockVerdict = score >= 4 ? "very-good" : score >= 2 ? "good" : score >= 1 ? "neutral" : "avoid";
  return {
    ticker: stock.ticker,
    name: stock.name,
    business: stock.business,
    elements: stock.elements,
    primaryElement: stock.primaryElement,
    score,
    verdict,
    reasons: reasons.length > 0 ? reasons : ["ธาตุไม่โดดเด่น ไม่ผิดแต่ไม่พิเศษ"],
  };
}

// ───────── 3. การ์ดตัวตน 15 แบบ (5 ธาตุ × 3 กำลัง) ─────────

const PERSONA_TABLE: Record<ThaiElement, Record<"weak" | "balanced" | "strong", InvestorPersona>> = {
  "ไม้": {
    weak: { element: "ไม้", band: "weak", name: "ต้นกล้า", emoji: "🌱", strengths: "อดทน สะสมทีละนิด เห็นการเติบโตระยะยาว", weaknesses: "แรงน้อย กลัวความเสี่ยงเกินเหตุ", style: "กองทุนรวม/หุ้นเติบโต สะสม DCA", allocation: "ออม 80% / เก็งกำไร 20%" },
    balanced: { element: "ไม้", band: "balanced", name: "ไม้ใหญ่", emoji: "🌳", strengths: "อดทน สะสมต่อเนื่อง เห็นการเติบโตระยะยาว", weaknesses: "ใจร้อนอยากโตเร็ว บางครั้งเสี่ยงเกินตัว", style: "กองทุน/หุ้นเติบโต 70% + เก็งกำไร 30%", allocation: "ยาว 70% / สั้น 30%" },
    strong: { element: "ไม้", band: "strong", name: "ป่าไม้", emoji: "🌲", strengths: "ขยายหลายทาง กล้าเสี่ยง ฟื้นตัวไว", weaknesses: "กระจายมากไป จับจุดเดียวไม่นิ่ง", style: "ลงทุนหลายธีม ขยายสาขา", allocation: "กระจาย 5-6 ธีม" },
  },
  "ไฟ": {
    weak: { element: "ไฟ", band: "weak", name: "ประกายไฟ", emoji: "✨", strengths: "เริ่มติดไฟ เรียนรู้ไว กระตือรือร้น", weaknesses: "แรงไม่พอ เป่าลมแรงไปดับ", style: "เริ่มเล็ก เก็งกำไรเฉพาะจังหวะดี", allocation: "ออม 70% / สั้น 30%" },
    balanced: { element: "ไฟ", band: "balanced", name: "เปลวไฟ", emoji: "🔥", strengths: "เก็งกำไรตามจังหวะ ไวต่อข่าว", weaknesses: "ใจร้อน ขาดวินัยตอนแพ้", style: "เทรดระยะสั้นตามจังหวะ + ถือแกนบางส่วน", allocation: "สั้น 50% / ยาว 50%" },
    strong: { element: "ไฟ", band: "strong", name: "ดวงอาทิตย์", emoji: "☀️", strengths: "เทรดหนัก ร้อนแรง กล้าได้กล้าเสีย", weaknesses: "เสี่ยงเกินตัว ตอนพีคอาจขาดทุนหนัก", style: "เทรดทุกจังหวะ หุ้นร้อนแรง", allocation: "สั้น 70% / ยาว 30%" },
  },
  "ดิน": {
    weak: { element: "ดิน", band: "weak", name: "ดินทราย", emoji: "🏜️", strengths: "ออมก่อน ปลอดภัยไว้ก่อน", weaknesses: "กลัวจนพลาดโอกาส", style: "ฝาก/บอนด์/อสังหาฯ ปลอดภัย", allocation: "ปลอดภัย 90% / เสี่ยง 10%" },
    balanced: { element: "ดิน", band: "balanced", name: "ทุ่งนา", emoji: "🌾", strengths: "อสังหา+ปันผล+เก็บออม มั่นคง", weaknesses: "ช้า ปรับตัวกับตลาดไวไม่ทัน", style: "อสังหาฯ/REIT + ปันผล + เงินฝาก", allocation: "อสังหา 50% / ปันผล 30% / เงินสด 20%" },
    strong: { element: "ดิน", band: "strong", name: "ภูเขา", emoji: "⛰️", strengths: "อสังหาขนาดใหญ่ ถือยาวแน่นหนา", weaknesses: "หนักไปทางทรัพย์สินเดียว", style: "อสังหาฯ ขนาดใหญ่/ที่ดิน ถือยาว", allocation: "อสังหา 80% / อื่น 20%" },
  },
  "ทอง": {
    weak: { element: "ทอง", band: "weak", name: "ทองคำแท่ง", emoji: "🪙", strengths: "ปลอดภัย เก็บได้ เน้นของมีค่า", weaknesses: "อนุรักษ์นิยมเกิน โตช้า", style: "ทอง/โลหะมีค่า + กองทุนปลอดภัย", allocation: "ทอง 60% / กองทุน 40%" },
    balanced: { element: "ทอง", band: "balanced", name: "เหล็กกล้า", emoji: "⚙️", strengths: "วางแผนแม่น เทค+ทองผสม", weaknesses: "ดื้อรั้นกับแผนที่ตั้งไว้", style: "เทค/หุ้นแม่นยำ + ทองคำกันความเสี่ยง", allocation: "เทค 50% / ทอง 30% / อื่น 20%" },
    strong: { element: "ทอง", band: "strong", name: "เพชร", emoji: "💎", strengths: "หุ้นเทครายตัว กล้าได้กล้าเสีย", weaknesses: "ขาดทุนครั้งเดียวหนัก", style: "หุ้นเทคเดี่ยว ลงทุนแม่นยำ", allocation: "หุ้นเทค 70% / อื่น 30%" },
  },
  "น้ำ": {
    weak: { element: "น้ำ", band: "weak", name: "หยดน้ำ", emoji: "💧", strengths: "ออมรายเดือน สม่ำเสมอ วินัยดี", weaknesses: "เงินน้อยไป ยังไม่กล้าเทรด", style: "ออมรายเดือน DCA กองทุน", allocation: "ออม 90% / สั้น 10%" },
    balanced: { element: "น้ำ", band: "balanced", name: "แม่น้ำ", emoji: "🌊", strengths: "การเงิน+เทรดตามกระแส ปรับตัวเก่ง", weaknesses: "ไหลตามกระแส ขาดจุดยืน", style: "หุ้นการเงิน + เทรดตามเทรนด์", allocation: "การเงิน 50% / เทรด 50%" },
    strong: { element: "น้ำ", band: "strong", name: "มหาสมุทร", emoji: "🌐", strengths: "ทุกจังหวะ ทุกตลาด เก่งทุกอย่าง", weaknesses: "กระจายเกิน ขาดโฟกัส", style: "ทุกตลาด ทุกสินทรัพย์ ตามจังหวะ", allocation: "โลก 40% / ไทย 30% / เทรด 30%" },
  },
};

/** การ์ดตัวตน 1 ใน 15 แบบ (band: very-weak→weak, very-strong→strong) */
export function resolveInvestorPersona(state: CalculatedStateValue): InvestorPersona {
  const element = dayMasterElementTh(state);
  const band = getEngineStrengthBand(state);
  const bucket: "weak" | "balanced" | "strong" = band === "very-weak" || band === "weak" ? "weak" : band === "very-strong" || band === "strong" ? "strong" : "balanced";
  return PERSONA_TABLE[element][bucket];
}

// ───────── 4. ไทม์ไลน์วัยจรทั้งชีวิต ─────────

/** วัยจรแต่ละช่วง → verdict ลงทุน/เก็บ/เลี่ยง (Source4 §6 + 12 เชี่ยงแซธาตุลาภ) */
export function buildInvestorTimeline(state: CalculatedStateValue, opts?: { split5?: boolean }): InvestorPhase[] {
  const split5 = opts?.split5 ?? false;
  const band = getEngineStrengthBand(state);
  const weak = band === "weak" || band === "very-weak";
  const wealth = wealthElementTh(state);
  const goodRoles = weak ? ["คู่ธาตุ", "ธาตุส่งเสริม"] : ["ธาตุถ่ายเท", "ธาตุลาภ"];

  // สร้าง phase 1 ช่วง (10 ปี หรือ 5 ปี) จากบทบาทธาตุต้น/ธาตุกิ่งของวัยจร
  const phaseOf = (entry: (typeof state.daYun)[number], role: string, start: number, end: number): InvestorPhase => {
    // เชี่ยงแซของธาตุลาภในวัยนี้ (ใช้กิ่งวัยจรเทียบดิถี → stage)
    const wealthQi = resolveDisplayTwelveQiStage(state.dayMaster, entry.branch) ?? "";
    const wealthQiGood = WEALTH_QI_GOOD_FOR_INVEST.includes(wealthQi);
    const wealthQiBad = wealthQi === "ซี่" || wealthQi === "เจ๊าะ";
    const isGood = goodRoles.includes(role);
    let verdict: InvestorPhase["verdict"];
    let advice: string;

    if (wealthQiBad) {
      verdict = "no-risk";
      advice = `ธาตุลาภ (${wealth}) อยู่ในเชี่ยงแซ ${wealthQi} ⚠️ ห้ามเสี่ยง งดลงทุนก้อน เก็บเงินสด/กันสำรอง`;
    } else if (isGood && wealthQiGood) {
      verdict = "invest";
      advice = `วัยจร${role} หนุน + ธาตุลาภเชี่ยงแซ ${wealthQi} → เหมาะลงทุน ริเริ่มก่อเกิดลาภ`;
    } else if (isGood) {
      verdict = "accumulate";
      advice = `วัยจร${role} ดี แต่เชี่ยงแซธาตุลาภ ${wealthQi} กลาง → เก็บสะสม DCA ไม่เสี่ยงก้อน`;
    } else {
      verdict = "avoid";
      advice = `วัยจร${role} ไม่หนุน → หลีกเลี่ยงการเสี่ยง เน้นถือเงินสด/กันสำรอง`;
    }

    return {
      ageRange: `${start}–${end}`,
      startAge: start,
      endAge: end,
      stem: entry.stem,
      branch: entry.branch,
      reaction: role,
      wealthQi,
      verdict,
      advice,
    };
  };

  return state.daYun.flatMap((entry) => {
    const stemRole = resolveDaYunReaction(state, entry.stem, "stem");
    const branchRole = resolveDaYunReaction(state, entry.branch, "branch");
    if (split5) {
      // แยก 10 ปี → 2 ช่วง 5 ปี: ครึ่งแรก = ธาตุต้น (ปีก้าน) · ครึ่งหลัง = ธาตุกิ่ง
      return [phaseOf(entry, stemRole, entry.startAge, entry.startAge + 4), phaseOf(entry, branchRole, entry.startAge + 5, entry.endAge)];
    }
    const role = goodRoles.includes(stemRole) || goodRoles.includes(branchRole) ? (goodRoles.includes(stemRole) ? stemRole : branchRole) : (goodRoles.includes(stemRole) ? stemRole : branchRole);
    return [phaseOf(entry, role, entry.startAge, entry.endAge)];
  });
}

// ───────── 5. Forex เหมาะไหม (เงื่อนไข 3 ข้อ) ─────────

export function resolveForexSuitability(state: CalculatedStateValue): {
  suitable: boolean;
  conditions: Array<{ ok: boolean; text: string }>;
} {
  const useful = getEngineUsefulElements(state);
  const band = getEngineStrengthBand(state);
  const weak = band === "weak" || band === "very-weak";
  const outputQi = resolveDisplayTwelveQiStage(state.dayMaster, state.fourPillars.hour.branch) ?? "";
  const style = QI_INVEST_STYLE_TH[outputQi];

  const conditions = [
    { ok: useful.includes("น้ำ"), text: "ธาตุน้ำ (การเงิน/เก็งกำไร) เป็นธาตุที่ดวงต้องการ" },
    { ok: !weak, text: "ดวงไม่ very-weak (มีแรงแบกความเสี่ยง)" },
    { ok: style && style.horizon !== "avoid", text: `เชี่ยงแซธาตุถ่ายเท ${outputQi} = ${style?.style ?? "ไม่ระบุ"} (ไม่ใช่ช่วงห้ามเสี่ยง)` },
  ];

  return {
    suitable: conditions.every((c) => c.ok),
    conditions,
  };
}

/** ธาตุที่ควรเลี่ยง (ใช้ในบท "สิ่งต้องห้าม") */
export function avoidElementsThPublic(state: CalculatedStateValue): ThaiElement[] {
  return avoidElementsTh(dayMasterElementTh(state) as ElementTh, careerBandFromScore(state.strengthScore)) as ThaiElement[];
}

/** ตัวอย่างคำอธิบายธุรกิจตามธาตุ (ใช้หน้า "สินค้าตามธาตุ") */
export function elementBusinessHint(element: ThaiElement): string {
  return ELEMENT_BUSINESS_TH[element];
}
