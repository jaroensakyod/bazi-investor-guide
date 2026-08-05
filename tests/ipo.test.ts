import { describe, it, expect } from "vitest";
import { mergeIpos, upcomingIpos, markListed, sectorToElement, parseSaDate, type IpoEntry } from "../src/lib/investor/ipo";

function mk(partial: Partial<IpoEntry>): IpoEntry {
  return {
    ticker: "X",
    name: "X Corp",
    market: "TWSE",
    country: "TW",
    exchange: "TWSE",
    ipoDate: "2026-08-20",
    source: "test",
    status: "upcoming",
    fetchedAt: "2026-08-05T00:00:00Z",
    ...partial,
  };
}

describe("mergeIpos — dedupe ticker+exchange", () => {
  it("ตัวใหม่ชนะ + นับ added/updated", () => {
    const existing = [mk({ ticker: "A", exchange: "TWSE", ipoDate: "2026-08-20" })];
    const incoming = [
      mk({ ticker: "A", exchange: "TWSE", ipoDate: "2026-08-21" }), // อัปเดตวัน
      mk({ ticker: "B", exchange: "TWSE", ipoDate: "2026-09-01" }), // ใหม่
    ];
    const { entries, added, updated } = mergeIpos(existing, incoming);
    expect(added).toBe(1);
    expect(updated).toBe(1);
    expect(entries.length).toBe(2);
    expect(entries.find((e) => e.ticker === "A")?.ipoDate).toBe("2026-08-21");
  });
});

describe("upcomingIpos + markListed", () => {
  const entries = [
    mk({ ticker: "P1", ipoDate: "2026-08-01" }), // ผ่านไปแล้ว
    mk({ ticker: "P2", ipoDate: "2026-08-20" }),
    mk({ ticker: "P3", ipoDate: "2026-09-15" }),
  ];
  it("กรองเฉพาะยังไม่เข้าเทรด เรียงวัน", () => {
    const up = upcomingIpos(entries, "2026-08-05");
    expect(up.map((e) => e.ticker)).toEqual(["P2", "P3"]);
  });
  it("markListed: วันที่ผ่าน → listed", () => {
    const after = markListed(entries, "2026-08-05");
    expect(after.find((e) => e.ticker === "P1")?.status).toBe("listed");
    expect(after.find((e) => e.ticker === "P2")?.status).toBe("upcoming");
  });
});

describe("parseSaDate — วันที่จาก StockAnalysis", () => {
  it("รูปแบบปกติ", () => {
    expect(parseSaDate("Aug 5, 2026")).toBe("2026-08-05");
    expect(parseSaDate("Dec 31, 2026")).toBe("2026-12-31");
    expect(parseSaDate("Jan 1, 2027")).toBe("2027-01-01");
  });
  it("เดือนไม่รู้จัก/format เพี้ยน → \"\"", () => {
    expect(parseSaDate("Foo 5, 2026")).toBe("");
    expect(parseSaDate("5 Aug 2026")).toBe("");
    expect(parseSaDate("")).toBe("");
  });
});

describe("sectorToElement — auto map sector→ธาตุ (ไม่เดา)", () => {
  it("GICS รู้จัก", () => {
    expect(sectorToElement("Banks")).toBe("น้ำ");
    expect(sectorToElement("Technology")).toBe("ทอง");
    expect(sectorToElement("Real Estate")).toBe("ดิน");
    expect(sectorToElement("Energy")).toBe("ไฟ");
  });
  it("TradingView taxonomy รู้จัก", () => {
    expect(sectorToElement("Major Banks")).toBe("น้ำ");
    expect(sectorToElement("Electronic Technology")).toBe("ทอง");
    expect(sectorToElement("Realty")).toBe("ดิน");
  });
  it("ไม่รู้จัก → null (ไม่เดา)", () => {
    expect(sectorToElement("Quantum Computing")).toBeNull();
    expect(sectorToElement(null)).toBeNull();
  });
});
