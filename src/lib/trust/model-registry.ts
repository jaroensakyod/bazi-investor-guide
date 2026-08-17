import { DECISION_PROTOCOL_VERSION } from "../decision/decision-object";
import { BAZI_COMPATIBILITY_MODEL_VERSION } from "../research/bazi-compatibility";
import { PATTERN_MODEL_VERSION } from "../research/pattern-engine";
import { STOCK_RESEARCH_MODEL_VERSION } from "../research/stock-research";

export type ModelReleaseStatus = "production" | "controlled_preview" | "internal_only" | "blocked";

export type ModelCard = {
  id: string;
  version: string;
  name: string;
  kind: "decision_protocol" | "research_scoring" | "historical_observation" | "personal_reflection";
  releaseStatus: ModelReleaseStatus;
  intendedUse: string[];
  prohibitedUse: string[];
  validation: string[];
  limitations: string[];
  owner: string;
  reviewedAt: string;
};

export const MODEL_REGISTRY: readonly ModelCard[] = [
  {
    id: "decision-protocol",
    version: DECISION_PROTOCOL_VERSION,
    name: "Decision Protocol",
    kind: "decision_protocol",
    releaseStatus: "controlled_preview",
    intendedUse: [
      "แปลง assessment เป็นคำตอบ หลักฐาน ความไม่แน่นอน และงานทบทวน",
      "สร้าง contract กลางให้เว็บ API และ PDF",
    ],
    prohibitedUse: ["ออกคำสั่งทำธุรกรรม", "รับประกันผลตอบแทน", "แทน suitability assessment"],
    validation: ["schema validation", "claim-to-evidence integrity", "public-language guardrail", "content hash"],
    limitations: ["มี profile และ portfolio contract แล้ว แต่ personalization pipeline และ production persistence ยังไม่ผ่าน release gate"],
    owner: "Product Trust",
    reviewedAt: "2026-08-09",
  },
  {
    id: "stock-research",
    version: STOCK_RESEARCH_MODEL_VERSION,
    name: "Generic Stock Research",
    kind: "research_scoring",
    releaseStatus: "internal_only",
    intendedUse: ["จัดโครงข้อมูลพื้นฐานและ pattern สำหรับการวิจัยทั่วไป", "ระบุข้อมูลที่ยังขาด"],
    prohibitedUse: ["personalized ranking", "คำสั่งซื้อขาย", "อ้างจุดสูงสุดหรือต่ำสุด"],
    validation: ["deterministic unit tests", "sector-aware metric rules", "data coverage checks"],
    limitations: ["peer-normalized valuation ยังไม่พร้อม", "ข้อมูลตลาดส่วนใหญ่ยังเป็น development-only"],
    owner: "Research",
    reviewedAt: "2026-08-09",
  },
  {
    id: "trend-observation",
    version: PATTERN_MODEL_VERSION,
    name: "Historical Trend Observation",
    kind: "historical_observation",
    releaseStatus: "internal_only",
    intendedUse: ["อธิบายแนวโน้มและความเสี่ยงจากราคาในอดีต", "สร้าง baseline สำหรับ walk-forward evaluation"],
    prohibitedUse: ["ทำนายราคาจุดเดียว", "แสดงเป็น guaranteed forecast", "เผยแพร่ก่อนผ่าน out-of-sample gate"],
    validation: ["minimum sample checks", "walk-forward evaluation hooks", "drawdown and volatility tests"],
    limitations: ["ยังไม่ผ่าน calibration และ independent model review", "ไม่รวม transaction costs ในผล observation ปัจจุบัน"],
    owner: "Quant Research",
    reviewedAt: "2026-08-09",
  },
  {
    id: "bazi-personal-lens",
    version: BAZI_COMPATIBILITY_MODEL_VERSION,
    name: "BaZi Personal Decision Lens",
    kind: "personal_reflection",
    releaseStatus: "controlled_preview",
    intendedUse: ["สะท้อนความสนใจและอคติส่วนบุคคล", "สร้าง behavior guardrail"],
    prohibitedUse: ["เปลี่ยน market score", "สร้าง trade signal", "อ้างความเหมาะสมของหลักทรัพย์"],
    validation: ["affectsMarketScore=false contract", "separation regression tests", "non-transaction language"],
    limitations: ["เป็นกรอบการตีความเชิงสัญลักษณ์ ไม่ใช่หลักฐานการคาดการณ์ราคา"],
    owner: "Personal Lens",
    reviewedAt: "2026-08-09",
  },
] as const;

export function getModelCard(version: string): ModelCard | null {
  return MODEL_REGISTRY.find((card) => card.version === version) ?? null;
}

export function validateModelRegistry(cards: readonly ModelCard[] = MODEL_REGISTRY): string[] {
  const problems: string[] = [];
  const versions = new Set<string>();
  for (const card of cards) {
    if (!card.id.trim()) problems.push("model card ไม่มี id");
    if (!card.version.trim()) problems.push((card.id || "unknown") + " ไม่มี version");
    if (versions.has(card.version)) problems.push("model version ซ้ำ: " + card.version);
    versions.add(card.version);
    if (card.intendedUse.length === 0) problems.push(card.version + " ไม่มี intendedUse");
    if (card.prohibitedUse.length === 0) problems.push(card.version + " ไม่มี prohibitedUse");
    if (card.validation.length === 0) problems.push(card.version + " ไม่มี validation");
    if (card.limitations.length === 0) problems.push(card.version + " ไม่มี limitations");
    if (!Number.isFinite(Date.parse(card.reviewedAt))) problems.push(card.version + " reviewedAt ไม่ถูกต้อง");
  }
  return problems;
}
