import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import { scoreStock } from "../investor/investor-guide";
import type { StockEntry } from "../investor/stock-database";

export const BAZI_COMPATIBILITY_MODEL_VERSION = "bazi-symbolic-compatibility-v1" as const;

export type BaziCompatibility = {
  modelVersion: typeof BAZI_COMPATIBILITY_MODEL_VERSION;
  framework: "bazi_symbolic_compatibility";
  band: "high" | "moderate" | "neutral" | "low";
  symbolicScore: number;
  businessElement: string;
  explanations: string[];
  affectsMarketScore: false;
  permittedUse: "reflection_and_behavior_only";
  disclaimer: string;
};

/**
 * Adapter around the legacy element calculation.  It deliberately removes
 * investment-action language and cannot be combined into the market score.
 */
export function buildBaziCompatibility(state: CalculatedStateValue, stock: StockEntry): BaziCompatibility {
  const legacy = scoreStock(state, {
    ticker: stock.ticker,
    name: stock.name,
    business: stock.business,
    elements: stock.elements,
    primaryElement: stock.primaryElement,
  });
  const band: BaziCompatibility["band"] =
    legacy.verdict === "very-good" ? "high" : legacy.verdict === "good" ? "moderate" : legacy.verdict === "neutral" ? "neutral" : "low";

  const explanationByBand: Record<BaziCompatibility["band"], string[]> = {
    high: [
      `ธาตุธุรกิจ ${stock.primaryElement} สอดคล้องกับองค์ประกอบสนับสนุนในกรอบ BaZi ของผู้ใช้`,
      "ใช้เพื่อสังเกตความสนใจและอคติส่วนตัว ไม่ใช่หลักฐานว่าราคาจะเพิ่มขึ้น",
    ],
    moderate: [
      `ธาตุธุรกิจ ${stock.primaryElement} มีองค์ประกอบที่สัมพันธ์กับกรอบ BaZi บางส่วน`,
      "ต้องประเมินคุณภาพกิจการ ราคา และความเสี่ยงแยกต่างหาก",
    ],
    neutral: [
      `ธาตุธุรกิจ ${stock.primaryElement} ไม่มีความสัมพันธ์เชิงสัญลักษณ์ที่เด่นชัด`,
      "ผลระดับกลางไม่ใช่เหตุสนับสนุนหรือคัดค้านหลักทรัพย์",
    ],
    low: [
      `ธาตุธุรกิจ ${stock.primaryElement} ซ้ำกับองค์ประกอบที่กรอบ BaZi มองว่าตึงหรือไม่สมดุล`,
      "นี่เป็นข้อสังเกตด้านพฤติกรรมเท่านั้น ไม่ใช่เหตุให้ทำธุรกรรม",
    ],
  };

  return {
    modelVersion: BAZI_COMPATIBILITY_MODEL_VERSION,
    framework: "bazi_symbolic_compatibility",
    band,
    symbolicScore: legacy.score,
    businessElement: stock.primaryElement,
    explanations: explanationByBand[band],
    affectsMarketScore: false,
    permittedUse: "reflection_and_behavior_only",
    disclaimer: "ความเข้ากันนี้เป็นการตีความเชิงสัญลักษณ์ ไม่ใช่ความเหมาะสมในการลงทุนและไม่ทำนายราคาหลักทรัพย์",
  };
}
