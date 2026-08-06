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

  it("IPO ไทย (SET API) — จำแนกจากชื่อไทย/ธุรกิจ", () => {
    // ปาล์ม/สวน = ไม้ · REIT = ดิน · เครื่องดื่ม = น้ำ · bio power = ไฟ · อาหารสัตว์ = ดิน
    expect(classifyIpoElement({ ticker: "PHAT", name: "บริษัท กลุ่มภัทร จำกัด (มหาชน)", business: "ธุรกิจสกัดน้ำมันปาล์มดิบ" }).element).toBe("ไม้");
    expect(classifyIpoElement({ ticker: "ONYXRT", name: "ทรัสต์เพื่อการลงทุนในสิทธิการเช่าอสังหาริมทรัพย์ออนิกซ์", business: "ลงทุนในสิทธิการเช่าที่ดิน อาคาร โรงแรม" }).element).toBe("ดิน");
    expect(classifyIpoElement({ ticker: "TNCC", name: "บริษัท ไทยน้ำทิพย์ คอร์ปอเรชั่น จำกัด (มหาชน)", business: "จัดจำหน่ายเครื่องดื่ม Coca-Cola" }).element).toBe("น้ำ");
    expect(classifyIpoElement({ ticker: "TEBP", name: "บริษัท ไทยอีสเทิร์น ไบโอ พาวเวอร์ จำกัด (มหาชน)", business: "ผลิตไฟฟ้าจากก๊าซชีวภาพ" }).element).toBe("ไฟ");
    expect(classifyIpoElement({ ticker: "PETPAL", name: "บริษัท เพ็ทพัล โปรดักส์ จำกัด (มหาชน)", business: "ผลิตอาหารสัตว์เลี้ยง" }).element).toBe("ดิน");
    // ระวังคำซ้อน: พัทยา ≠ ยา (โรงแรมอมารี พัทยา ต้องไม่เป็นไฟ) · Thai ≠ ai
    expect(classifyIpoElement({ ticker: "X", name: "บริษัท โรงแรมอมารี พัทยา จำกัด (มหาชน)", business: "ให้บริการโรงแรม" }).element).toBe("น้ำ");
    expect(classifyIpoElement({ ticker: "TIPAK", name: "Thai Packaging Industry", business: "บรรจุภัณฑ์กระดาษลูกฟูก" }).element).toBe("ไม้");
  });
});
