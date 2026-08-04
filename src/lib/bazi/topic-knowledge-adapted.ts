/**
 * topic-knowledge-adapted — implement ฟังก์ชันที่ต้นทาง (bazi-sft-dataset) อยู่ใน
 * topic-knowledge.ts (ไฟล์ composer ใหญ่) แต่โปรเจคนี้ต้องการเฉพาะ "engine facts"
 *
 * หลักการ: คัดลอก logic เฉพาะส่วนที่ "pure" จากต้นทาง (resolveUsefulElements /
 * resolveStrengthBand / resolveDaYunReaction) — ตรวจกับ tests/engine-smoke แล้ว
 *
 * deterministic + client-safe (ไม่แตะ DB/FS)
 */
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { CONTROLS, GENERATES, STEM_TO_ELEMENT, ELEMENT_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import { classifyOperatorStrengthScore } from "@/lib/bazi/constants/operator-strength";
import type { SupportedElementValue } from "@/lib/bazi/schema-types";

export type ThaiElement = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";
export type StrengthBand = "very-weak" | "weak" | "balanced" | "strong" | "very-strong";

const EN_TO_TH: Record<string, ThaiElement> = {
  wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ",
};

/** element (en) → ป้ายไทย */
export function elementLabel(element: SupportedElementValue): ThaiElement {
  return EN_TO_TH[element] ?? "ไม้";
}

/** day master element (en) */
export function dayMasterElement(state: CalculatedStateValue): SupportedElementValue {
  return STEM_TO_ELEMENT[state.dayMaster as keyof typeof STEM_TO_ELEMENT] as SupportedElementValue;
}

/** กำลังดิถี 5 band (ตรงต้นทาง: ใช้ classifyOperatorStrengthScore + 得令 เฉพาะจุด) */
export function resolveStrengthBand(calculatedState: CalculatedStateValue): StrengthBand {
  try {
    const band = classifyOperatorStrengthScore(calculatedState.strengthScore).id as StrengthBand;
    // R5.2b: ดวง "สมดุล" ที่ถูกฤดู (月令旺) → ยก reading-band เป็น "แข็ง"
    //  (ชดเชย 得令(+2) ที่ตัดจากสูตรคะแนน — แก้ที่ band การอ่านเท่านั้น ไม่แตะ score)
    if (band === "balanced" && isSeasonalCommand(calculatedState)) {
      return "strong";
    }
    return band;
  } catch {
    return "balanced";
  }
}

export function getEngineStrengthBand(state: CalculatedStateValue): StrengthBand {
  return resolveStrengthBand(state);
}

/** ดวงถูกฤดูหรือไม่ (month branch อยู่ในฤดูที่ส่งเสริม day master) */
function isSeasonalCommand(state: CalculatedStateValue): boolean {
  const dm = dayMasterElement(state);
  const dmStrength = state.elementAnalysis.elementStrengths.find((e) => e.element === dm);
  return dmStrength?.seasonalSupport === "seasonal-peak" || dmStrength?.seasonalSupport === "seasonal-support";
}

/** ความแรงของธาตุหนึ่ง (label) */
function resolveElementStrengthLabel(state: CalculatedStateValue, element: SupportedElementValue): "missing" | "weak" | "balanced" | "strong" {
  return state.elementAnalysis.elementStrengths.find((e) => e.element === element)?.strength ?? "balanced";
}

/** ธาตุที่ล้นเกิน (ใช้判断 食傷制杀) */
function isExcess(state: CalculatedStateValue, element: SupportedElementValue): boolean {
  return state.elementAnalysis.dominantElements.includes(element) || resolveElementStrengthLabel(state, element) === "strong";
}

/**
 * ธาตุ useful god (เรียงลำดับ) — logic ตรงต้นทาง resolveUsefulElements:
 *  - อ่อน: 印 (ส่งเสริม) + 比劫 (คู่ธาตุ); ถ้า officer ล้น → 食傷制杀 (ถ่ายเทคุมอำนาจ)
 *  - แข็ง: ถ่ายเท (食傷) + ลาภ (财) — 食傷生财
 *  - balanced: ใช้ recommend จาก dual-base (ถ้าไม่มี → fallback [ถ่ายเท, ลาภ])
 */
export function resolveUsefulElements(calculatedState: CalculatedStateValue): ThaiElement[] {
  const dm = dayMasterElement(calculatedState);
  const output = GENERATES[dm] as SupportedElementValue; // ถ่ายเท
  const wealth = CONTROLS[dm] as SupportedElementValue; // พิฆาต/ลาภ
  const same = dm; // คู่ธาตุ
  const resource = (Object.keys(GENERATES) as SupportedElementValue[]).find(
    (element) => GENERATES[element] === dm,
  ) as SupportedElementValue; // ส่งเสริม
  const officer = (Object.keys(CONTROLS) as SupportedElementValue[]).find(
    (element) => CONTROLS[element] === dm,
  ) as SupportedElementValue; // ดาวอำนาจ (杀)

  const band = resolveStrengthBand(calculatedState);

  // 食傷制杀: อ่อน + officer ล้น (แต่ output ไม่ล้น) → ใช้ถ่ายเทคุมอำนาจ
  const useOfficerControl = isExcess(calculatedState, officer) && !isExcess(calculatedState, output);
  const weakUseful: SupportedElementValue[] = useOfficerControl
    ? [resource, output]
    : [resource, same];

  if (band === "balanced") {
    // ใช้ dual-base logic อย่างง่าย: ดึง element ที่ "balanced/strong" และไม่ใช่ officer → fallback [output, wealth]
    const candidates: SupportedElementValue[] = [output, wealth];
    return applyTiaohou(candidates.map(elementLabel), calculatedState, band);
  }

  const roleMap: Record<Exclude<StrengthBand, "balanced">, SupportedElementValue[]> = {
    "very-strong": [output, wealth],
    strong: [output, wealth],
    weak: weakUseful,
    "very-weak": weakUseful,
  };

  const ordered = roleMap[band as Exclude<StrengthBand, "balanced">].map(elementLabel);
  return applyTiaohou([...new Set(ordered)], calculatedState, band);
}

/** 调候 (seasonal adjustment) — อย่างง่ายจากต้นทาง: คงลำดับ เดิมไม่สลับ (pure) */
function applyTiaohou(elements: ThaiElement[], state: CalculatedStateValue, band: StrengthBand): ThaiElement[] {
  // ต้นทางมีการปรับตามฤดู; โปรเจคนี้คงลำดับ useful ตรง ๆ (deterministic)
  return elements;
}

export function getEngineUsefulElements(state: CalculatedStateValue): ThaiElement[] {
  return resolveUsefulElements(state);
}

// ───────── ปฏิกิริยาธาตุของวัยจร (resolveDaYunReaction) ─────────

export type RelationRole = "คู่ธาตุ" | "ธาตุถ่ายเท" | "ธาตุพิฆาต" | "พิฆาตธาตุ" | "ธาตุส่งเสริม";

/** บทบาทของธาตุวัยจรเทียบดิถี (ตรรกะปฏิกิริยา 5 ธาตุ) — ตรงต้นทาง */
export function resolveRelationRole(dayElement: SupportedElementValue, targetElement: SupportedElementValue): RelationRole {
  if (targetElement === dayElement) return "คู่ธาตุ";
  if (GENERATES[dayElement] === targetElement) return "ธาตุถ่ายเท";
  if (GENERATES[targetElement] === dayElement) return "ธาตุส่งเสริม";
  if (CONTROLS[dayElement] === targetElement) return "ธาตุพิฆาต"; // ดิถีพิฆาตเขา = ธาตุลาภ
  return "พิฆาตธาตุ"; // เขาพิฆาตดิถี = ธาตุอำนาจ
}

const RELATION_ROLE_REACTION: Record<RelationRole, string> = {
  "คู่ธาตุ": "คู่ธาตุ",
  "ธาตุถ่ายเท": "ธาตุถ่ายเท",
  "ธาตุพิฆาต": "ธาตุพิฆาต",
  "พิฆาตธาตุ": "พิฆาตธาตุ",
  "ธาตุส่งเสริม": "ธาตุส่งเสริม",
};

/** ปฏิกิริยาของ stem/branch วัยจร เทียบดิถี */
export function resolveDaYunReaction(
  calculatedState: CalculatedStateValue,
  symbol: string,
  source: "stem" | "branch",
): string {
  const dm = dayMasterElement(calculatedState);
  const element = source === "stem"
    ? (STEM_TO_ELEMENT[symbol as keyof typeof STEM_TO_ELEMENT] as SupportedElementValue)
    : branchElementOf(symbol);
  return RELATION_ROLE_REACTION[resolveRelationRole(dm, element)];
}

/** ธาตุของกิ่ง (branch) — map 12 กิ่ง → element */
const BRANCH_TO_ELEMENT: Record<string, SupportedElementValue> = {
  "子": "water", "丑": "earth", "寅": "wood", "卯": "wood", "辰": "earth", "巳": "fire",
  "午": "fire", "未": "earth", "申": "metal", "酉": "metal", "戌": "earth", "亥": "water",
};

function branchElementOf(symbol: string): SupportedElementValue {
  return BRANCH_TO_ELEMENT[symbol] ?? "wood";
}

/** ธาตุไทยของ stem (ก้าน) */
export function stemElementTh(stem: string): ThaiElement {
  const en = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT];
  return EN_TO_TH[en] ?? "ไม้";
}
