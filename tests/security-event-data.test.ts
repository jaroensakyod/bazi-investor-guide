import { describe, expect, it } from "vitest";
import { TH10_RESEARCH_PILOT, US10_RESEARCH_PILOT } from "../src/lib/research/pilot-universe";
import { getGlobalStocks, getResearchableThaiStocks, isResearchableStock } from "../src/lib/investor/stock-database";
import { getSecurityBirth, getSecurityEvents } from "../src/lib/research/security-event-repository";
import { validateSecurityEvent } from "../src/lib/research/security-birth";

describe("curated TH10 security events", () => {
  it("ผ่าน schema validation และมีแหล่งอ้างอิงทุก event", () => {
    const events = getSecurityEvents();
    expect(events.length).toBeGreaterThanOrEqual(19);
    for (const event of events) {
      expect(validateSecurityEvent(event)).toEqual([]);
      expect(event.evidence.sourceUrl).toMatch(/^https:\/\//);
    }
  });

  it("TH10 รู้วันทางการแต่ไม่แต่งเวลา first trade", () => {
    for (const item of TH10_RESEARCH_PILOT.securities) {
      const birth = getSecurityBirth(item.market, item.ticker);
      expect(birth.grade, item.securityId).toBe("B");
      expect(birth.selectedEvent?.localTime, item.securityId).toBeNull();
      expect(birth.scenarioCount, item.securityId).toBe(12);
    }
  });

  it("หุ้นไทยปัจจุบันทุกตัวมีวันเข้าตลาดทางการโดยไม่แต่งเวลา", () => {
    const currentThai = getResearchableThaiStocks();
    expect(currentThai).toHaveLength(265);
    for (const stock of currentThai) {
      const birth = getSecurityBirth(stock.market, stock.ticker);
      expect(birth.grade, birth.securityId).toBe("B");
      expect(birth.selectedEvent?.localTime, birth.securityId).toBeNull();
      expect(birth.selectedEvent?.evidence.sourceUrl, birth.securityId).toMatch(/^https:\/\//);
    }
  });

  it("Bursa Malaysia ปัจจุบันทุกตัวมีวันเข้าตลาดทางการและ provenance ครบ", () => {
    const bursaStocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "BURSA");
    expect(bursaStocks).toHaveLength(117);
    for (const stock of bursaStocks) {
      const birth = getSecurityBirth(stock.market, stock.ticker);
      expect(birth.grade, birth.securityId).toBe("B");
      expect(birth.selectedEvent?.localTime, birth.securityId).toBeNull();
      expect(birth.selectedEvent?.evidence.authority, birth.securityId).toBe("exchange");
      expect(birth.selectedEvent?.evidence.sourceUrl, birth.securityId).toMatch(/^https:\/\/www\.bursamalaysia\.com\//);
    }
  });

  it("B3 canonical securities ทุกตัวมีวันทางการ ส่วน odd-lot aliases ไม่ถูกนับซ้ำ", () => {
    const b3Stocks = getGlobalStocks().filter(isResearchableStock).filter((stock) => stock.market === "BOVESPA");
    expect(b3Stocks).toHaveLength(101);
    for (const stock of b3Stocks) {
      const birth = getSecurityBirth(stock.market, stock.ticker);
      expect(birth.grade, birth.securityId).toBe("B");
      expect(birth.selectedEvent?.localTime, birth.securityId).toBeNull();
      expect(birth.selectedEvent?.evidence.authority, birth.securityId).toBe("exchange");
    }
  });

  it("US10 has issuer-backed dates with no invented first-trade time", () => {
    for (const item of US10_RESEARCH_PILOT.securities) {
      const birth = getSecurityBirth(item.market, item.ticker);
      expect(birth.grade, item.securityId).toBe("B");
      expect(birth.selectedEvent?.localTime, item.securityId).toBeNull();
      expect(["issuer", "issuer_filing"]).toContain(birth.selectedEvent?.evidence.authority);
      expect(birth.selectedEvent?.evidence.sourceUrl, item.securityId).toMatch(/^https:\/\//);
    }
  });
});
