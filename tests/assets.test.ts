import { describe, it, expect } from "vitest";
import { getAssets, getAsset, getAssetsByType, getAssetsByElement, clearAssetCache } from "../src/lib/assets/asset-universe";

describe("asset universe — commodities.json + real-assets.json", () => {
  it("โหลดได้ ≥ 25 รายการ + ทุกตัวมี elementReason/primaryElement", () => {
    clearAssetCache();
    const assets = getAssets();
    expect(assets.length).toBeGreaterThanOrEqual(25);
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

  it("getAssetsByType / getAssetsByElement ทำงาน", () => {
    const cryptos = getAssetsByType("crypto");
    expect(cryptos.length).toBeGreaterThanOrEqual(2);
    const golds = getAssetsByElement("ทอง");
    expect(golds.length).toBeGreaterThanOrEqual(5);
  });

  it("ticker ไม่มี → null", () => {
    expect(getAsset("ZZZ")).toBeNull();
  });
});
