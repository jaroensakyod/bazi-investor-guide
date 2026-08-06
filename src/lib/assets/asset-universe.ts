/**
 * Asset Universe — สินทรัพย์ทุกประเภท (12+ type) โหลดจาก commodities.json + real-assets.json
 *
 * type ตาม data-spec: commodity/crypto/etf/reit/bond/deposit/forex/fund/derivative
 *   (+ real_asset/lottery ใน real-assets.json — Task 0.13)
 * tier: safe/medium/risky — ใช้กับ asset verdict (Task 0.11)
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ThaiElement } from "../investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export type AssetType =
  | "commodity"
  | "crypto"
  | "etf"
  | "reit"
  | "bond"
  | "deposit"
  | "forex"
  | "fund"
  | "derivative"
  | "real_asset"
  | "lottery"
  | "insurance";

export type AssetTier = "safe" | "medium" | "risky";

export type AssetEntry = {
  type: AssetType;
  /** ticker ที่ใช้กับ Yahoo (GC=F/BTC-USD/SPY/CPNREIT.BK) หรือ key ข้อมูลนิ่ง (CASH_THB) */
  ticker: string;
  name: string;
  nameEn?: string;
  country: string;
  market: string;
  currency: string;
  sector: string;
  /** คำอธิบายสินค้า (ธุรกิจ/ลักษณะ) */
  business?: string;
  elements: ThaiElement[];
  primaryElement: ThaiElement;
  elementReason: string;
  elementSource: string;
  riskTier: AssetTier;
  subtype?: string;
  note?: string;
  /** สิ่งที่ห้ามเด็ดขาด (ห้องแชร์/พนัน/ของปลอม) — verdict = avoid เสมอ */
  forbidden?: boolean;
  status: "draft" | "reviewed";
};

export type ForbiddenItem = {
  name: string;
  note: string;
  why: string;
};

let cache: AssetEntry[] | null = null;

/** โหลด asset ทั้งหมด (commodities + real-assets ถ้ามี) */
export function getAssets(): AssetEntry[] {
  if (cache) return cache;
  const out: AssetEntry[] = [];
  for (const f of ["commodities.json", "real-assets.json"]) {
    try {
      const db = JSON.parse(readFileSync(path.join(ROOT, "data/stocks", f), "utf8")) as { assets?: AssetEntry[] };
      if (Array.isArray(db.assets)) out.push(...db.assets);
    } catch {
      /* ไม่มีไฟล์/พัง — ข้าม */
    }
  }
  cache = out;
  return out;
}

export function getAsset(ticker: string): AssetEntry | null {
  return getAssets().find((a) => a.ticker === ticker) ?? null;
}

export function getAssetsByType(type: AssetType): AssetEntry[] {
  return getAssets().filter((a) => a.type === type);
}

export function getAssetsByElement(element: ThaiElement): AssetEntry[] {
  return getAssets().filter((a) => a.primaryElement === element);
}

/** สิ่งที่ห้ามเด็ดขาด (ห้องแชร์/แชร์ลูกโซ่/พนัน/ของปลอม) — เนื้อหาบท 9/22 */
export function getForbiddenAssets(): ForbiddenItem[] {
  try {
    const db = JSON.parse(readFileSync(path.join(ROOT, "data/stocks/real-assets.json"), "utf8")) as {
      forbidden?: ForbiddenItem[];
    };
    return db.forbidden ?? [];
  } catch {
    return [];
  }
}

/** reset cache (เทสต์ใช้) */
export function clearAssetCache(): void {
  cache = null;
}
