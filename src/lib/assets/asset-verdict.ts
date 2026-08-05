/**
 * Asset Verdict — สินทรัพย์ X ดีกับดวงเรายังไง (ธาตุ fit + สภาพตลาด + tier ความเสี่ยง)
 *
 * ต่อยอด scoreStock เดิม: useful god +3 · avoid -4 · secondary useful +1
 * + สภาพตลาด (momentum) + tier gate ตามกำลังดวง (🔴 = เกินกำลัง → ตัด verdict)
 */
import type { ThaiElement } from "../investor/stock-database";
import type { AssetEntry, AssetTier } from "./asset-universe";

export type StrengthBand = "weak" | "balanced" | "strong";
export type AssetVerdictLabel = "very-good" | "good" | "neutral" | "avoid";

export type AssetVerdictCtx = {
  usefulElements: ThaiElement[];
  avoidElements: ThaiElement[];
  strengthBand: StrengthBand;
  /** % เปลี่ยนวันนี้ (จาก snapshot) — ไม่มี = ไม่คิด momentum */
  changePct?: number;
};

export type AssetVerdict = {
  score: number;
  verdict: AssetVerdictLabel;
  reasons: string[];
  /** ถูกจำกัดเพราะเกินกำลังดวง (🔴 + ดวงอ่อน/สมดุล) */
  cappedByStrength?: boolean;
};

const TIER_LIMIT: Record<StrengthBand, AssetTier[]> = {
  weak: ["safe"], // ดวงอ่อน → เฉพาะปลอดภัย
  balanced: ["safe", "medium"],
  strong: ["safe", "medium"], // 🔴 ไม่มี verdict ให้ใคร
};

export function assetVerdict(asset: AssetEntry, ctx: AssetVerdictCtx): AssetVerdict {
  const { usefulElements, avoidElements, strengthBand, changePct } = ctx;
  const reasons: string[] = [];
  let score = 0;

  // 0. สิ่งที่ห้ามเด็ดขาด (ห้องแชร์/พนัน/ของปลอม) — ไม่ต้องคิดอะไรอีก
  if (asset.forbidden) {
    return {
      score: -10,
      verdict: "avoid",
      reasons: ["⛔ สิ่งนี้ห้ามลงทุนเด็ดขาด (ฉ้อโกง/ผิดกฎหมาย/ไม่ใช่การลงทุน) — ดูบท 9/22"],
      cappedByStrength: false,
    };
  }

  // 1. ธาตุ fit (หัวใจ — deterministic เหมือน scoreStock)
  if (usefulElements.includes(asset.primaryElement)) {
    score += 3;
    reasons.push(`ธาตุ${asset.primaryElement} = ธาตุที่ดวงต้องการ ✅`);
  }
  if (avoidElements.includes(asset.primaryElement)) {
    score -= 4;
    reasons.push(`⚠️ ธาตุ${asset.primaryElement} = ธาตุที่ดวงควรเลี่ยง (พิฆาต)`);
  }
  for (const sec of asset.elements) {
    if (sec !== asset.primaryElement && usefulElements.includes(sec)) {
      score += 1;
      reasons.push(`ธาตุรอง ${sec} ยังช่วยเสริมดวง`);
    }
  }

  // 2. สภาพตลาด (momentum — ข้อมูลวันนี้ ไม่ใช่คำทำนาย)
  if (changePct !== undefined) {
    if (changePct >= 1) {
      score += 1;
      reasons.push(`วันนี้ +${changePct}% — มีโมเมนตัม`);
    } else if (changePct <= -2) {
      score -= 1;
      reasons.push(`วันนี้ ${changePct}% — กำลังอ่อน`);
    }
  }

  // 3. tier gate ตามกำลังดวง — 🔴/เกินระดับ → ตัด verdict (ไม่แนะนำ)
  const allowed = TIER_LIMIT[strengthBand];
  let cappedByStrength: boolean | undefined;
  if (!allowed.includes(asset.riskTier)) {
    cappedByStrength = true;
    reasons.push(
      asset.riskTier === "risky"
        ? `ระดับเสี่ยง 🔴 (${asset.type}) — เกินกำลังดวง${strengthBand === "weak" ? "อ่อน" : ""} ไม่แนะนำ`
        : `ระดับเสี่ยง ${asset.riskTier} — เกินระดับที่ดวง${strengthBand === "weak" ? "อ่อน" : ""}รับได้`,
    );
  }

  // verdict mapping
  let verdict: AssetVerdictLabel;
  if (avoidElements.includes(asset.primaryElement)) verdict = "avoid";
  else if (cappedByStrength) verdict = score >= 3 ? "neutral" : "avoid";
  else if (score >= 4) verdict = "very-good";
  else if (score >= 2) verdict = "good";
  else if (score >= 1) verdict = "neutral";
  else verdict = "avoid";

  return { score, verdict, reasons, cappedByStrength };
}
