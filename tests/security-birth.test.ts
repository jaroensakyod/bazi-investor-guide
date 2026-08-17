import { describe, expect, it } from "vitest";
import {
  resolveSecurityBirth,
  securityIdOf,
  type SecurityEvent,
} from "../src/lib/research/security-birth";
import {
  mergeSecurityEvents,
  mergeSecurityEventsConflictSafe,
} from "../src/lib/research/security-event-store";

function event(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    schemaVersion: 1,
    securityId: "NASDAQ:TEST",
    kind: "first_trading_day",
    localDate: "2024-01-15",
    localTime: null,
    timePrecision: "unknown",
    timeZone: "America/New_York",
    exchange: "NASDAQ",
    evidence: {
      authority: "exchange",
      sourceName: "Official exchange notice",
      verification: "verified",
      displayRights: "allowed",
    },
    ...overrides,
  };
}

describe("security birth provenance", () => {
  it("ใช้ exact first trade ที่ยืนยันแล้วเป็น grade A", () => {
    const result = resolveSecurityBirth("NASDAQ:TEST", [
      event({ kind: "first_trade", localTime: "11:07:23", timePrecision: "second" }),
    ]);
    expect(result.grade).toBe("A");
    expect(result.timeKnown).toBe(true);
    expect(result.calculationMode).toBe("four_pillars");
  });

  it("วันทางการที่ไม่มีเวลาเป็น grade B และไม่เติมเวลาเปิดตลาด", () => {
    const result = resolveSecurityBirth("NASDAQ:TEST", [event()]);
    expect(result.grade).toBe("B");
    expect(result.selectedEvent?.localTime).toBeNull();
    expect(result.scenarioCount).toBe(12);
    expect(result.timeKnown).toBe(false);
  });

  it("วันก่อตั้งใช้เป็นบริบทเท่านั้น", () => {
    const result = resolveSecurityBirth("NASDAQ:TEST", [
      event({
        kind: "incorporation",
        evidence: { authority: "company_registry", sourceName: "Registry", verification: "verified" },
      }),
    ]);
    expect(result.grade).toBe("C");
    expect(result.calculationMode).toBe("business_context_only");
  });

  it("ไม่ปะปน cross-listing และไม่มีข้อมูลคือ grade D", () => {
    expect(securityIdOf("nyse", "baba")).toBe("NYSE:BABA");
    const result = resolveSecurityBirth("HKEX:9988.HK", [event({ securityId: "NYSE:BABA" })]);
    expect(result.grade).toBe("D");
    expect(result.selectedEvent).toBeNull();
  });

  it("merge event แบบ idempotent", () => {
    const first = event();
    expect(mergeSecurityEvents([first], [first])).toHaveLength(1);
    expect(mergeSecurityEvents([], [event({ securityId: "HKEX:9988.HK" }), first]).map((item) => item.securityId)).toEqual([
      "HKEX:9988.HK",
      "NASDAQ:TEST",
    ]);
  });

  it("refreshes an explicitly superseded source and corrects its date without opening a general overwrite path", () => {
    const oldUrl = "https://exchange.example/recent-only.csv";
    const current = event({
      localDate: "2025-12-01",
      evidence: {
        authority: "exchange",
        sourceName: "Official reference",
        sourceUrl: oldUrl,
        verification: "verified",
        displayRights: "unknown",
      },
    });
    const corrected = event({
      localDate: "2014-10-27",
      evidence: {
        authority: "exchange",
        sourceName: "Official reference",
        sourceUrl: "https://exchange.example/full-current.csv",
        verification: "verified",
        displayRights: "unknown",
      },
    });
    const result = mergeSecurityEventsConflictSafe([current], [corrected], {
      supersededSourceUrls: [oldUrl],
    });
    expect(result).toMatchObject({ added: 0, refreshed: 1, correctedDates: 1, conflicts: [] });
    expect(result.events).toHaveLength(1);
    expect(result.events[0].localDate).toBe("2014-10-27");

    const blocked = mergeSecurityEventsConflictSafe([current], [corrected]);
    expect(blocked.conflicts).toHaveLength(1);
    expect(blocked.events[0].localDate).toBe("2025-12-01");
  });

  it("ปฏิเสธวันที่และเขตเวลาที่ดูคล้ายถูกต้องแต่ใช้จริงไม่ได้", () => {
    const invalid = resolveSecurityBirth("NASDAQ:TEST", [event({ localDate: "2026-02-30", timeZone: "US/Nowhere" })]);
    expect(invalid.grade).toBe("D");
    expect(invalid.limitations.join(" ")).toContain("IANA timeZone");
  });
});
