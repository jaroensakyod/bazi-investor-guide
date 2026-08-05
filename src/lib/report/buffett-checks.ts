/**
 * Buffett Checklist — ตัวกรองคุณภาพสไตล์ Warren Buffett
 *
 * ใช้กับ: รายงานสถาบัน (ส่วนที่ 4) + hidden gems (กัน "หุ้นใต้น้ำที่แย่จริง")
 * ข้อมูลจำกัด (Yahoo) → ใช้ proxy: ROE, D/E, margin, revenue growth, net margin
 */
import type { Fundamentals } from "../market/fundamentals";

export type CheckStatus = "pass" | "warn" | "fail";
export type BuffettCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
};

export function buffettChecks(f: Fundamentals): BuffettCheck[] {
  const out: BuffettCheck[] = [];

  // 1. ผลตอบแทนผู้ถือหุ้น (ROE ≥ 15%)
  if (f.roe !== undefined) {
    out.push({
      id: "roe",
      label: "ROE ≥ 15% (ทำกำไรจากทุนเก่ง)",
      status: f.roe >= 15 ? "pass" : f.roe >= 10 ? "warn" : "fail",
      detail: `ROE ${f.roe}%`,
    });
  } else {
    out.push({ id: "roe", label: "ROE ≥ 15%", status: "fail", detail: "ไม่มีข้อมูล" });
  }

  // 2. หนี้ไม่สูง (D/E < 0.5)
  if (f.debtToEquity !== undefined) {
    out.push({
      id: "debt",
      label: "หนี้ D/E < 0.5 (ปลอดภัย)",
      status: f.debtToEquity < 50 ? "pass" : f.debtToEquity < 100 ? "warn" : "fail",
      detail: `D/E ${f.debtToEquity}%`,
    });
  } else {
    out.push({ id: "debt", label: "หนี้ D/E < 0.5", status: "fail", detail: "ไม่มีข้อมูล" });
  }

  // 3. อัตรากำไรขั้นต้น (gross margin ≥ 20%)
  if (f.grossMargin !== undefined) {
    out.push({
      id: "margin",
      label: "Gross margin ≥ 20% (ได้เปรียบต้นทุน)",
      status: f.grossMargin >= 20 ? "pass" : f.grossMargin >= 10 ? "warn" : "fail",
      detail: `Gross margin ${f.grossMargin}%`,
    });
  } else {
    out.push({ id: "margin", label: "Gross margin ≥ 20%", status: "fail", detail: "ไม่มีข้อมูล" });
  }

  // 4. รายได้โต (revenue growth > 0)
  if (f.revenueGrowth !== undefined) {
    out.push({
      id: "growth",
      label: "รายได้โต YoY (ไม่หดตัว)",
      status: f.revenueGrowth > 0 ? "pass" : "fail",
      detail: `Revenue growth ${f.revenueGrowth}%`,
    });
  } else {
    out.push({ id: "growth", label: "รายได้โต YoY", status: "fail", detail: "ไม่มีข้อมูล" });
  }

  // 5. กำไรสุทธิเป็นบวก
  if (f.profitMargin !== undefined) {
    out.push({
      id: "profit",
      label: "กำไรสุทธิเป็นบวก (ไม่ใช่หุ้นขาดทุน)",
      status: f.profitMargin > 0 ? "pass" : "fail",
      detail: `Net margin ${f.profitMargin}%`,
    });
  } else {
    out.push({ id: "profit", label: "กำไรสุทธิเป็นบวก", status: "fail", detail: "ไม่มีข้อมูล" });
  }

  return out;
}

/** นับคะแนน: pass=2, warn=1, fail=0 → 0-10 */
export function buffettScore(checks: BuffettCheck[]): number {
  return checks.reduce((sum, c) => sum + (c.status === "pass" ? 2 : c.status === "warn" ? 1 : 0), 0);
}
