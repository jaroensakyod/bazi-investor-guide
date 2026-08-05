import { describe, it, expect } from "vitest";
import {
  getAssets,
  getAsset,
  getAssetsByType,
  getAssetsByElement,
  getForbiddenAssets,
  clearAssetCache,
} from "../src/lib/assets/asset-universe";

describe("asset universe — commodities.json + real-assets.json", () => {
  it("โหลดได้ ≥ 40 รายการ + ทุกตัวมี elementReason/primaryElement", () => {
    clearAssetCache();
    const assets = getAssets();
    expect(assets.length).toBeGreaterThanOrEqual(40);
    for (const a of assets) {
      expect(a.elementReason.length).toBeGreaterThan(10);
      expect(a.primaryElement).toBeTruthy();
      expect(a.elements).toContain(a.primaryElement);
    }
  });

  it("สินทรัพย์หลักธาตุถูกต้อง (data-spec)", () => {
    expect(getAsset("GC=F")?.primaryElement).toBe("ทอง");
    expect(getAsset("CL=F")?.primaryElement).toBe("ไฟ");
    expect(getAsset("BTC-USD")?.primaryElement).toBe("ไฟ");
    expect(getAsset("VNQ")?.primaryElement).toBe("ดิน");
    expect(getAsset("BND")?.primaryElement).toBe("น้ำ");
    expect(getAsset("USDTHB=X")?.primaryElement).toBe("น้ำ");
    expect(getAsset("GLD")?.riskTier).toBe("safe");
    expect(getAsset("S50Z26")?.riskTier).toBe("risky");
  });

  it("real assets — ของที่คนมองข้าม (Task 0.13)", () => {
    expect(getAsset("LAND")?.primaryElement).toBe("ดิน");
    expect(getAsset("RUBBER_FARM")?.primaryElement).toBe("ไม้"); // สวนยาง = ไม้ (ธาตุหายาก)
    expect(getAsset("AQUA_FARM")?.primaryElement).toBe("น้ำ");
    expect(getAsset("GOLD_BAR")?.riskTier).toBe("safe");
    expect(getAsset("AMULET")?.primaryElement).toBe("ดิน");
    expect(getAsset("GOV_LOTTERY_SAVINGS")?.primaryElement).toBe("น้ำ");
    expect(getAsset("FOREST")?.riskTier).toBe("risky");
  });

  it("สิ่งที่ห้ามเด็ดขาด ≥ 4 รายการ (ห้องแชร์/พนัน/ของปลอม)", () => {
    const forbidden = getForbiddenAssets();
    expect(forbidden.length).toBeGreaterThanOrEqual(4);
    expect(forbidden.some((f) => f.name.includes("ห้องแชร์"))).toBe(true);
    expect(forbidden.some((f) => f.name.includes("พนัน"))).toBe(true);
  });

  it("getAssetsByType / getAssetsByElement ทำงาน", () => {
    const cryptos = getAssetsByType("crypto");
    expect(cryptos.length).toBeGreaterThanOrEqual(2);
    const golds = getAssetsByElement("ทอง");
    expect(golds.length).toBeGreaterThanOrEqual(6);
    const woods = getAssetsByElement("ไม้"); // เดิมไม่มี ตอนนี้มี (สวนยาง/ป่า)
    expect(woods.length).toBeGreaterThanOrEqual(4);
  });

  it("ticker ไม่มี → null", () => {
    expect(getAsset("ZZZ")).toBeNull();
  });
});
