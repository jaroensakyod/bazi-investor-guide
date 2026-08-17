import { describe, expect, it } from "vitest";
import { assessResearchCapability, validatePublicResearchText } from "../src/lib/research/research-policy";
import { evaluateUserAlert, validateUserAlert, type UserAlertRule } from "../src/lib/research/user-alerts";

describe("research-only compliance gate", () => {
  it("อนุญาตข้อเท็จจริง แต่บล็อก personalized timing", () => {
    expect(assessResearchCapability("historical_facts").publicReleaseAllowed).toBe(true);
    expect(assessResearchCapability("generic_screen").decision).toBe("internal_only");
    const timing = assessResearchCapability("personalized_trade_timing");
    expect(timing.decision).toBe("blocked");
    expect(timing.publicReleaseAllowed).toBe(false);
  });

  it("ไม่อนุญาตให้ใช้ BaZi ออก trade signal แม้อยู่ใน licensed mode", () => {
    expect(assessResearchCapability("bazi_trade_signal", "licensed_advisory").decision).toBe("blocked");
  });

  it("ตรวจจับภาษาสั่งธุรกรรมและการการันตี", () => {
    const violations = validatePublicResearchText("ควรซื้อ AAPL ตอนนี้ เป้าราคา 250 กำไรแน่นอน");
    expect(violations.map((item) => item.code)).toEqual(
      expect.arrayContaining(["transaction_directive", "price_target", "guaranteed_outcome"]),
    );
    expect(validatePublicResearchText("ราคาย้อนหลัง ณ วันที่ระบุและมีความไม่แน่นอน")).toEqual([]);
  });
});

describe("user-defined alerts", () => {
  const rule: UserAlertRule = {
    id: "alert-1",
    securityId: "NASDAQ:AAPL",
    kind: "price_below",
    threshold: 180,
    createdBy: "user",
    createdAt: "2026-08-08T00:00:00.000Z",
    enabled: true,
  };

  it("แจ้งเมื่อเข้าเงื่อนไขที่ผู้ใช้ตั้ง โดยไม่ออกคำสั่ง", () => {
    expect(validateUserAlert(rule)).toEqual([]);
    const result = evaluateUserAlert(rule, { price: 179 });
    expect(result.triggered).toBe(true);
    expect(result.action).toBe("review_user_condition");
  });

  it("ปฏิเสธ alert ที่ระบบสร้างแทนผู้ใช้", () => {
    expect(validateUserAlert({ ...rule, createdBy: "platform" as never })).toContain("เกณฑ์แจ้งเตือนต้องสร้างโดยผู้ใช้");
  });
});
