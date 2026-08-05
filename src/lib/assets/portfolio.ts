/**
 * Portfolio Allocator — จัดพอร์ตตามธาตุ (บท 13): useful god + กำลังดวง → % ต่อธาตุ
 *
 * กฎ: กันชนปลอดภัย (ฝาก/บอนด์/ทอง) ตามกำลังดวง · ส่วนที่เหลือแจกธาตุที่ดวงต้องการ (ตัวแรก 1.5×)
 *      ส่วนเก็งกำไร (คริปโต/อนุพันธ์) เฉพาะดวงแข็ง วงเงินจำกัด
 */
import type { ThaiElement } from "../investor/stock-database";
import { getAssetsByElement, type AssetEntry } from "./asset-universe";
import type { StrengthBand } from "./asset-verdict";

export type AllocationRow = {
  element: ThaiElement;
  pct: number;
  assets: string[];
  note: string;
};

const SAFE_FLOOR: Record<StrengthBand, number> = { weak: 50, balanced: 30, strong: 20 };
const RISKY_CAP: Record<StrengthBand, number> = { weak: 0, balanced: 10, strong: 20 };
const SAFE_ASSETS = ["CASH_THB", "BND", "GC=F"]; // ฝาก/บอนด์/ทอง (tier safe)
const RISKY_ASSETS = ["BTC-USD", "S50Z26"]; // คริปโต/อนุพันธ์

/** ตัวอย่างสินทรัพย์ตามธาตุ + ระดับที่ดวงรับได้ */
export function exampleAssets(element: ThaiElement, strengthBand: StrengthBand, limit = 3): string[] {
  const allowed = strengthBand === "weak" ? new Set(["safe"]) : new Set(["safe", "medium"]);
  return getAssetsByElement(element)
    .filter((a) => allowed.has(a.riskTier) && a.ticker !== "CASH_THB")
    .slice(0, limit)
    .map((a) => a.ticker);
}

export function allocatePortfolio(ctx: {
  usefulElements: ThaiElement[];
  strengthBand: StrengthBand;
}): AllocationRow[] {
  const { usefulElements, strengthBand } = ctx;
  const safeFloor = SAFE_FLOOR[strengthBand];
  const riskyCap = RISKY_CAP[strengthBand];
  const rest = 100 - safeFloor - riskyCap;

  // แจก rest ให้ธาตุที่ดวงต้องการ (ตัวแรก 1.5×)
  const weights = usefulElements.map((_, i) => (i === 0 ? 1.5 : 1));
  const wSum = weights.reduce((a, b) => a + b, 0);
  const rows: AllocationRow[] = usefulElements.map((el, i) => ({
    element: el,
    pct: Math.round((rest * weights[i]) / wSum),
    assets: exampleAssets(el, strengthBand),
    note: i === 0 ? "ธาตุหลักของดวง — สัดส่วนสูงสุด" : "ธาตุรอง — เสริมสมดุล",
  }));

  // กันชนปลอดภัย
  rows.push({
    element: "น้ำ",
    pct: safeFloor,
    assets: SAFE_ASSETS,
    note: `กันชนปลอดภัย ${safeFloor}% — ฝาก/บอนด์/ทอง (ไม่แปรผันตามดวง — กันจังหวะเสีย)`,
  });

  // ส่วนเก็งกำไร (เฉพาะดวงแข็ง/สมดุล)
  if (riskyCap > 0) {
    rows.push({
      element: "ไฟ",
      pct: riskyCap,
      assets: RISKY_ASSETS,
      note: `ส่วนเก็งกำไร ${riskyCap}% — คริปโต/อนุพันธ์ เฉพาะดวง${strengthBand === "strong" ? "แข็ง" : "สมดุล"} วงเงินจำกัด`,
    });
  }

  // ปรับ rounding ให้รวม = 100 (แก้ที่ธาตุหลัก)
  const diff = 100 - rows.reduce((a, r) => a + r.pct, 0);
  if (diff !== 0 && usefulElements.length > 0) {
    const main = rows.find((r) => r.element === usefulElements[0]);
    if (main) main.pct += diff;
  }
  return rows;
}

/** รวม % = 100 เสมอ */
export function allocationTotal(rows: AllocationRow[]): number {
  return rows.reduce((a, r) => a + r.pct, 0);
}

export type { AssetEntry };
