import { describe, it, expect } from "vitest";
import { assetVerdict, type AssetVerdictCtx } from "../src/lib/assets/asset-verdict";
import { allocatePortfolio, allocationTotal, exampleAssets } from "../src/lib/assets/portfolio";
import { getAsset, clearAssetCache, type AssetEntry } from "../src/lib/assets/asset-universe";

function ctx(partial: Partial<AssetVerdictCtx> = {}): AssetVerdictCtx {
  return { usefulElements: ["ทอง", "น้ำ"], avoidElements: ["ไม้"], strengthBand: "balanced", ...partial };
}

describe("assetVerdict — สินทรัพย์ vs ดวง", () => {
  it("ทอง (ธาตุทอง ∈ useful) → good (3 คะแนน ยังไม่ถึง very-good 4+)", () => {
    const v = assetVerdict(getAsset("GC=F")!, ctx());
    expect(v.verdict).toBe("good");
    expect(v.score).toBe(3);
    expect(v.reasons.some((r) => r.includes("ดวงต้องการ"))).toBe(true);
  });

  it("ทอง + วันนี้บวก → very-good (คะแนน 4)", () => {
    const v = assetVerdict(getAsset("GLD")!, ctx({ changePct: 2.5 }));
    expect(v.score).toBe(4);
    expect(v.verdict).toBe("very-good");
  });

  it("ธาตุ avoid → avoid เสมอ (แม้ momentum บวก)", () => {
    // ไม่มี asset ธาตุไม้ในคลัง → สร้าง fake asset ทดสอบ logic ล้วน
    const fakeWood: AssetEntry = {
      type: "etf",
      ticker: "FAKEWOOD",
      name: "ไม้เทียม",
      country: "TH",
      market: "SET",
      currency: "THB",
      sector: "เทสต์",
      elements: ["ไม้"],
      primaryElement: "ไม้",
      elementReason: "เทสต์",
      elementSource: "test",
      riskTier: "safe",
      status: "draft",
    };
    const v = assetVerdict(fakeWood, ctx({ changePct: 5 }));
    expect(v.verdict).toBe("avoid");
    expect(v.score).toBeLessThanOrEqual(-4 + 1); // -4 avoid + momentum
  });

  it("คริปโต (🔴) + ดวงอ่อน → capped ไม่แนะนำ", () => {
    const v = assetVerdict(getAsset("BTC-USD")!, ctx({ strengthBand: "weak" }));
    expect(v.cappedByStrength).toBe(true);
    expect(v.verdict).not.toBe("very-good");
  });

  it("คริปโต + ดวงแข็ง → ยัง capped (🔴 ไม่มี verdict ให้ใคร ตามดีไซน์)", () => {
    const v = assetVerdict(getAsset("BTC-USD")!, ctx({ strengthBand: "strong", usefulElements: ["ไฟ", "ทอง"] }));
    expect(v.cappedByStrength).toBe(true); // 🔴 = watchlist เท่านั้น ทุกดวง
    expect(v.verdict).toBe("neutral"); // 3 (ตรงดวง) - 0 → neutral (ไม่แนะนำเต็มที่)
  });

  it("สิ่งที่ห้าม (forbidden) → avoid เสมอ ไม่ต้องคิดธาตุ", () => {
    const fakeForbidden: AssetEntry = {
      type: "real_asset",
      ticker: "FAKESCAM",
      name: "ห้องแชร์",
      country: "TH",
      market: "REAL",
      currency: "THB",
      sector: "ต้องห้าม",
      elements: ["น้ำ"],
      primaryElement: "น้ำ",
      elementReason: "เทสต์",
      elementSource: "test",
      riskTier: "safe",
      forbidden: true,
      status: "draft",
    };
    const v = assetVerdict(fakeForbidden, ctx({ usefulElements: ["น้ำ"] }));
    expect(v.verdict).toBe("avoid");
    expect(v.score).toBe(-10);
  });

  it("ไม่มีข้อมูล momentum → ไม่พัง", () => {
    const v = assetVerdict(getAsset("BND")!, ctx({ changePct: undefined }));
    expect(v.verdict).toBeTruthy();
  });
});

describe("allocatePortfolio — จัดพอร์ตตามธาตุ (บท 13)", () => {
  it("รวม 100 เสมอ ทุกกำลังดวง + มีกันชนปลอดภัย", () => {
    for (const band of ["weak", "balanced", "strong"] as const) {
      clearAssetCache();
      const rows = allocatePortfolio({ usefulElements: ["ทอง", "น้ำ"], strengthBand: band });
      expect(allocationTotal(rows)).toBe(100);
      expect(rows.some((r) => r.assets.includes("CASH_THB"))).toBe(true);
    }
  });

  it("ดวงอ่อน → ไม่มีส่วนเก็งกำไร (คริปโต)", () => {
    const rows = allocatePortfolio({ usefulElements: ["ทอง", "น้ำ"], strengthBand: "weak" });
    expect(rows.every((r) => !r.assets.includes("BTC-USD"))).toBe(true);
  });

  it("ดวงแข็ง → มีส่วนเก็งกำไรจำกัด (ไม่เกิน 20%)", () => {
    const rows = allocatePortfolio({ usefulElements: ["ทอง", "น้ำ"], strengthBand: "strong" });
    const risky = rows.find((r) => r.assets.includes("BTC-USD"));
    expect(risky).toBeDefined();
    expect(risky!.pct).toBeLessThanOrEqual(20);
  });

  it("ธาตุหลักได้สัดส่วนสูงสุด", () => {
    const rows = allocatePortfolio({ usefulElements: ["ทอง", "น้ำ"], strengthBand: "balanced" });
    const gold = rows.find((r) => r.element === "ทอง");
    const water = rows.find((r) => r.element === "น้ำ");
    expect(gold!.pct).toBeGreaterThan(water!.pct);
  });

  it("exampleAssets กรองตามกำลังดวง (weak → เฉพาะ safe)", () => {
    clearAssetCache();
    const weak = exampleAssets("ทอง", "weak");
    const strong = exampleAssets("ทอง", "strong");
    expect(weak.length).toBeGreaterThanOrEqual(1);
    expect(strong.length).toBeGreaterThanOrEqual(weak.length);
  });
});
