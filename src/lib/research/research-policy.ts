/**
 * Product guardrails for the current research-only operating model.
 *
 * This module is a code-level safety boundary, not a legal opinion.  A future
 * licensed mode still requires approval of the exact licence scope, workflow
 * and UI copy before a capability can be released.
 */

export type OperatingMode = "research_only" | "licensed_advisory";

export type ResearchCapability =
  | "historical_facts"
  | "generic_education"
  | "generic_screen"
  | "user_defined_alert"
  | "probabilistic_forecast"
  | "personalized_security_ranking"
  | "personalized_trade_timing"
  | "bazi_trade_signal"
  | "automated_execution";

export type CapabilityDecision = "allowed" | "allowed_with_controls" | "internal_only" | "blocked";

export type CapabilityAssessment = {
  capability: ResearchCapability;
  mode: OperatingMode;
  decision: CapabilityDecision;
  publicReleaseAllowed: boolean;
  legalReviewRequired: boolean;
  controls: string[];
  reason: string;
};

const BASE_CONTROLS = [
  "แสดง source, asOf, freshness และข้อจำกัดของข้อมูล",
  "ห้ามรับประกันผลตอบแทนหรืออ้างว่าสามารถหาจุดสูงสุดได้",
  "ห้ามใช้ถ้อยคำสั่งซื้อ ขาย หรือถือหลักทรัพย์",
];

export function assessResearchCapability(
  capability: ResearchCapability,
  mode: OperatingMode = "research_only",
): CapabilityAssessment {
  if (capability === "historical_facts" || capability === "generic_education") {
    return {
      capability,
      mode,
      decision: "allowed",
      publicReleaseAllowed: true,
      legalReviewRequired: false,
      controls: ["แสดงแหล่งข้อมูลและวันที่ของข้อมูล"],
      reason: "เป็นข้อมูลข้อเท็จจริงหรือความรู้ทั่วไปและไม่มีคำสั่งทำธุรกรรม",
    };
  }

  if (capability === "user_defined_alert") {
    return {
      capability,
      mode,
      decision: "allowed_with_controls",
      publicReleaseAllowed: true,
      legalReviewRequired: true,
      controls: [...BASE_CONTROLS, "เกณฑ์ราคา/ความเสี่ยงต้องถูกกำหนดโดยผู้ใช้ ไม่ใช่ระบบ"],
      reason: "แจ้งเฉพาะเงื่อนไขที่ผู้ใช้กำหนดเอง ไม่สร้างเกณฑ์หรือคำสั่งลงทุนแทนผู้ใช้ และต้องตรวจ flow จริงก่อนเปิดใช้",
    };
  }

  if (capability === "generic_screen") {
    const licensed = mode === "licensed_advisory";
    return {
      capability,
      mode,
      decision: licensed ? "allowed_with_controls" : "internal_only",
      publicReleaseAllowed: licensed,
      legalReviewRequired: true,
      controls: [...BASE_CONTROLS, "ใช้เกณฑ์เดียวกันกับผู้ใช้ทุกคน และไม่ปรับอันดับจากดวงหรือพอร์ตส่วนตัว"],
      reason: licensed
        ? "เปิดได้ต่อเมื่อผู้เชี่ยวชาญยืนยันว่าใบอนุญาตและ flow ครอบคลุม ranking/rating ที่แสดงจริง"
        : "การจัดอันดับหรือให้คะแนนหลักทรัพย์อาจเข้าข่ายกิจกรรมที่ต้องกำกับ จึงเป็นงานภายในจนกว่าจะผ่าน legal review/operating model",
    };
  }

  if (capability === "probabilistic_forecast") {
    return {
      capability,
      mode,
      decision: mode === "licensed_advisory" ? "allowed_with_controls" : "internal_only",
      publicReleaseAllowed: mode === "licensed_advisory",
      legalReviewRequired: true,
      controls: [
        ...BASE_CONTROLS,
        "ต้องมี out-of-sample evaluation, model version, sample size และ calibration",
        "แสดงเป็นช่วงความน่าจะเป็น ไม่แสดงราคาเป้าหมายแบบรับประกัน",
      ],
      reason:
        mode === "licensed_advisory"
          ? "ยังต้องผ่าน model governance และตรวจว่าขอบเขตใบอนุญาตครอบคลุม"
          : "ผลคาดการณ์แบบจ่ายเงินมีผลต่อการตัดสินใจสูง จึงเก็บเป็นงานวิจัยภายในจนกว่าจะผ่านกฎหมายและ validation",
    };
  }

  if (capability === "personalized_security_ranking" || capability === "personalized_trade_timing") {
    const licensed = mode === "licensed_advisory";
    return {
      capability,
      mode,
      decision: licensed ? "allowed_with_controls" : "blocked",
      publicReleaseAllowed: licensed,
      legalReviewRequired: true,
      controls: licensed
        ? [...BASE_CONTROLS, "ต้องมี suitability, authorization, conflict controls, audit log และผู้รับผิดชอบที่ได้รับอนุญาต"]
        : [...BASE_CONTROLS, "ต้องร่วมกับ/ดำเนินการผ่านผู้ประกอบธุรกิจที่ได้รับอนุญาตก่อนเปิดใช้"],
      reason: licensed
        ? "เปิดได้ต่อเมื่อผู้เชี่ยวชาญยืนยันขอบเขตใบอนุญาตและระบบกำกับครบ"
        : "คำแนะนำรายบุคคลหรือจังหวะซื้อขายเฉพาะหลักทรัพย์อยู่นอกขอบเขต research-only",
    };
  }

  if (capability === "bazi_trade_signal") {
    return {
      capability,
      mode,
      decision: "blocked",
      publicReleaseAllowed: false,
      legalReviewRequired: true,
      controls: ["BaZi แสดงได้เฉพาะความเข้ากันเชิงสัญลักษณ์และต้องไม่เปลี่ยน market score หรือคำสั่งธุรกรรม"],
      reason: "ไม่ควรใช้ข้อมูลดวงเป็นเหตุให้ซื้อหรือขายหลักทรัพย์ แม้ระบบส่วนอื่นจะอยู่ภายใต้ใบอนุญาต",
    };
  }

  return {
    capability,
    mode,
    decision: "blocked",
    publicReleaseAllowed: false,
    legalReviewRequired: true,
    controls: ["ต้องมีใบอนุญาต/พันธมิตร broker ที่ครอบคลุม execution และระบบควบคุมคำสั่ง"],
    reason: "ระบบปัจจุบันไม่ได้รับอนุญาตให้ส่งคำสั่งซื้อขายหรือจัดการบัญชีผู้ใช้",
  };
}

export type PublicTextViolation = {
  code: "transaction_directive" | "guaranteed_outcome" | "exact_peak_claim" | "price_target";
  match: string;
};

const PUBLIC_TEXT_RULES: Array<{ code: PublicTextViolation["code"]; pattern: RegExp }> = [
  { code: "transaction_directive", pattern: /(?:ควร\s*(?:ซื้อ|ขาย|ถือ)|(?:ซื้อ|ขาย)\s*(?:เลย|ทันที|ตอนนี้)|buy\s+now|sell\s+now)/giu },
  { code: "guaranteed_outcome", pattern: /(?:กำไรแน่นอน|รับประกันผลตอบแทน|การันตี(?:กำไร|ผลตอบแทน)|guaranteed\s+return)/giu },
  { code: "exact_peak_claim", pattern: /(?:จุดสูงสุดแน่นอน|ขายได้ตรงจุดสูงสุด|ทำนายจุดสูงสุด|exact\s+(?:top|peak))/giu },
  { code: "price_target", pattern: /(?:เป้าราคา\s*[:=]?\s*\d|(?:ซื้อ|ขาย|เข้าที่|ออกที่)\s*[:=]?\s*\d|price\s+target\s*[:=]?\s*\d)/giu },
];

/** Validate generated/UI text before it is exposed in research-only mode. */
export function validatePublicResearchText(text: string): PublicTextViolation[] {
  const violations: PublicTextViolation[] = [];
  for (const rule of PUBLIC_TEXT_RULES) {
    rule.pattern.lastIndex = 0;
    for (const match of text.matchAll(rule.pattern)) {
      violations.push({ code: rule.code, match: match[0] });
    }
  }
  return violations;
}

export const RESEARCH_ONLY_DISCLOSURE =
  "ข้อมูลนี้เป็นเครื่องมือวิจัยและการศึกษา ไม่ใช่คำแนะนำให้ซื้อ ขาย หรือถือหลักทรัพย์ ผลลัพธ์มีความไม่แน่นอนและต้องตรวจสอบกับแหล่งข้อมูลล่าสุด";
