import { describe, it, expect } from "vitest";
import { classifyStockTier, visibleTiers, TIER_META, TIER_ORDER } from "../src/lib/investor/stock-tiers";

describe("ระบบเทียร์หุ้น (Hormozi ladder)", () => {
  it("gold = ตรงดวง + พื้นฐานแกร่ง + ใหญ่ + โมเมนตัม → unlock premium", () => {
    const r = classifyStockTier({ fit: "good", roe: 20, buffett: 8, capTier: "mega", changePct: 1.5 });
    expect(r.tier).toBe("gold");
    expect(TIER_META.gold.unlock).toBe("premium");
  });

  it("silver = ตรงดวง + พื้นฐานดี (แต่ไม่มีโมเมนตัม/เล็ก) → unlock pro", () => {
    const r = classifyStockTier({ fit: "good", roe: 18, buffett: 7, capTier: "mid", changePct: -2 });
    expect(r.tier).toBe("silver");
    expect(TIER_META.silver.unlock).toBe("pro");
  });

  it("bronze = ตรงดวงอย่างเดียว → ฟรี", () => {
    const r = classifyStockTier({ fit: "good", roe: null, buffett: null, capTier: "small", changePct: null });
    expect(r.tier).toBe("bronze");
    expect(TIER_META.bronze.unlock).toBe("free");
  });

  it("avoid (ธาตุขัดดวง) → base เสมอ แม้พื้นฐานดี", () => {
    const r = classifyStockTier({ fit: "avoid", roe: 30, buffett: 9, capTier: "mega", changePct: 5 });
    expect(r.tier).toBe("base");
  });

  it("fit null (ไม่มีบริบทดวง) → ใช้พื้นฐานล้วน ไม่เป็น gold โดยไม่มี fit", () => {
    const r = classifyStockTier({ fit: null, roe: 25, buffett: 9, capTier: "mega", changePct: 3 });
    expect(r.tier).toBe("silver"); // พื้นฐานแกร่ง+ใหญ่+โมเมนตัม = 4 → silver (ไม่ถึง gold ที่ต้อง fit good)
  });

  it("visibleTiers: ฟรีเห็น bronze/base · pro +silver · premium ทั้งหมด", () => {
    expect(visibleTiers("free")).toEqual(["bronze", "base"]);
    expect(visibleTiers("pro")).toEqual(["silver", "bronze", "base"]);
    expect(visibleTiers("premium")).toEqual(TIER_ORDER);
  });
});
