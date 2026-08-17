export type UserAlertKind = "price_above" | "price_below" | "drawdown_from_anchor" | "volatility_above";

export type UserAlertRule = {
  id: string;
  securityId: string;
  kind: UserAlertKind;
  threshold: number;
  /** Required for drawdown_from_anchor. */
  anchorPrice?: number;
  createdBy: "user";
  createdAt: string;
  enabled: boolean;
};

export type UserAlertContext = {
  price: number;
  annualizedVolatilityPct?: number;
};

export type UserAlertEvaluation = {
  alertId: string;
  triggered: boolean;
  observedValue: number | null;
  message: string;
  /** Alerts notify about a user-authored condition; they never issue an order. */
  action: "review_user_condition";
};

export function validateUserAlert(rule: UserAlertRule): string[] {
  const problems: string[] = [];
  if (!rule.id.trim()) problems.push("id ห้ามว่าง");
  if (!rule.securityId.includes(":")) problems.push("securityId ต้องอยู่ในรูป MARKET:TICKER");
  if (!Number.isFinite(rule.threshold) || rule.threshold <= 0) problems.push("threshold ต้องมากกว่า 0");
  if (rule.kind === "drawdown_from_anchor" && (!Number.isFinite(rule.anchorPrice) || Number(rule.anchorPrice) <= 0)) {
    problems.push("drawdown_from_anchor ต้องมี anchorPrice มากกว่า 0");
  }
  if (rule.kind === "drawdown_from_anchor" && rule.threshold > 100) problems.push("drawdown threshold ต้องไม่เกิน 100%");
  if (rule.createdBy !== "user") problems.push("เกณฑ์แจ้งเตือนต้องสร้างโดยผู้ใช้");
  if (!Number.isFinite(Date.parse(rule.createdAt))) problems.push("createdAt ต้องเป็น ISO timestamp");
  return problems;
}

export function evaluateUserAlert(rule: UserAlertRule, context: UserAlertContext): UserAlertEvaluation {
  const problems = validateUserAlert(rule);
  if (problems.length > 0) throw new Error(problems.join("; "));
  if (!Number.isFinite(context.price) || context.price <= 0) throw new Error("price ต้องมากกว่า 0");

  if (!rule.enabled) {
    return { alertId: rule.id, triggered: false, observedValue: null, message: "การแจ้งเตือนถูกปิดอยู่", action: "review_user_condition" };
  }

  if (rule.kind === "price_above") {
    return {
      alertId: rule.id,
      triggered: context.price >= rule.threshold,
      observedValue: context.price,
      message: `ราคาปัจจุบัน ${context.price} เทียบกับเกณฑ์ที่คุณตั้ง ${rule.threshold}`,
      action: "review_user_condition",
    };
  }
  if (rule.kind === "price_below") {
    return {
      alertId: rule.id,
      triggered: context.price <= rule.threshold,
      observedValue: context.price,
      message: `ราคาปัจจุบัน ${context.price} เทียบกับเกณฑ์ที่คุณตั้ง ${rule.threshold}`,
      action: "review_user_condition",
    };
  }
  if (rule.kind === "volatility_above") {
    const observed = context.annualizedVolatilityPct ?? null;
    return {
      alertId: rule.id,
      triggered: observed !== null && observed >= rule.threshold,
      observedValue: observed,
      message: observed === null ? "ยังไม่มีข้อมูลความผันผวนเพียงพอ" : `ความผันผวน ${observed}% เทียบกับเกณฑ์ที่คุณตั้ง ${rule.threshold}%`,
      action: "review_user_condition",
    };
  }

  const anchor = rule.anchorPrice as number;
  const drawdown = Math.max(0, ((anchor - context.price) / anchor) * 100);
  return {
    alertId: rule.id,
    triggered: drawdown >= rule.threshold,
    observedValue: Math.round(drawdown * 100) / 100,
    message: `ราคาลดจากจุดอ้างอิงที่คุณตั้ง ${Math.round(drawdown * 100) / 100}% เทียบกับเกณฑ์ ${rule.threshold}%`,
    action: "review_user_condition",
  };
}

