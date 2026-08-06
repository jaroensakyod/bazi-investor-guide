import { describe, it, expect } from "vitest";
import { classifyIpoElement } from "../src/lib/market/ipo-elements";

describe("จำแนกธาตุ IPO (deterministic จากชื่อ)", () => {
  it("ยา/ชีวภาพ = ไฟ · พลังงาน = ไฟ", () => {
    expect(classifyIpoElement({ ticker: "ATTO", name: "Attovia Therapeutics, Inc." }).element).toBe("ไฟ");
    expect(classifyIpoElement({ ticker: "BLSM", name: "BlossomHill Therapeutics, Inc." }).element).toBe("ไฟ");
    expect(classifyIpoElement({ ticker: "FOIL", name: "Londian Wason New Energy Tech Inc." }).element).toBe("ไฟ");
  });

  it("การเงิน/SPAC/ขนส่ง = น้ำ", () => {
    expect(classifyIpoElement({ ticker: "TCGX", name: "TCGX Acquisition Corp." }).element).toBe("น้ำ");
    expect(classifyIpoElement({ ticker: "OCLT", name: "OceanLight Acquisition Corporation" }).element).toBe("น้ำ");
    expect(classifyIpoElement({ ticker: "PHAX", name: "Phalanx Acquisition Corp I" }).element).toBe("น้ำ");
  });

  it("tech = ทอง · อสังหา/เกษตร = ดิน · สิ่งพิมพ์ = ไม้", () => {
    expect(classifyIpoElement({ ticker: "X", name: "Quantum Data Systems, Inc." }).element).toBe("ทอง");
    expect(classifyIpoElement({ ticker: "Y", name: "Prime Real Estate Holdings" }).element).toBe("ดิน");
    expect(classifyIpoElement({ ticker: "Z", name: "Asia Media Publishing Group" }).element).toBe("ไม้");
  });

  it("ทุก entry มีเหตุผล + อยู่ใน 5 ธาตุ", () => {
    for (const name of ["Attovia Therapeutics, Inc.", "OceanLight Acquisition Corporation", "Quantum Data Systems, Inc."]) {
      const { element, reason } = classifyIpoElement({ ticker: "X", name });
      expect(["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"]).toContain(element);
      expect(reason.length).toBeGreaterThan(5);
    }
  });
});
