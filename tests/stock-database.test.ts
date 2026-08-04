/**
 * เทสต์คลังหุ้น — ตรวจความถูกต้องของ data (กฎเหล็ก: ทุกตัวต้องมี elementReason ฯลฯ)
 */
import { describe, it, expect } from "vitest";
import { getThaiStocks, validateStocks } from "@/lib/investor/stock-database";

describe("คลังหุ้นไทย (thailand.json)", () => {
  it("มีหุ้นอย่างน้อย 40 ตัว (SET50 ชุดแรก)", () => {
    const stocks = getThaiStocks();
    expect(stocks.length).toBeGreaterThanOrEqual(40);
  });

  it("validate ผ่าน: ไม่มี ticker ซ้ำ / elementReason หาย / primaryElement ผิด", () => {
    const problems = validateStocks(getThaiStocks());
    expect(problems).toEqual([]);
  });

  it("ทุกตัวมี primaryElement อยู่ใน elements + ธาตุถูกต้อง", () => {
    for (const s of getThaiStocks()) {
      expect(s.elements).toContain(s.primaryElement);
    }
  });

  it("ทุกตัวมี business + elementReason (กฎเหล็ก data spec)", () => {
    for (const s of getThaiStocks()) {
      expect(s.business.length).toBeGreaterThan(10);
      expect(s.elementReason.length).toBeGreaterThan(10);
    }
  });

  it("หุ้นตัวอย่างที่รู้จักมีธาตุถูกต้อง (KBANK=น้ำ, PTT=ไฟ, SCC=ดิน, DELTA=ทอง, ADVANC=ไม้)", () => {
    const byTicker = new Map(getThaiStocks().map((s) => [s.ticker, s]));
    expect(byTicker.get("KBANK")?.primaryElement).toBe("น้ำ");
    expect(byTicker.get("PTT")?.primaryElement).toBe("ไฟ");
    expect(byTicker.get("SCC")?.primaryElement).toBe("ดิน");
    expect(byTicker.get("DELTA")?.primaryElement).toBe("ทอง");
    expect(byTicker.get("ADVANC")?.primaryElement).toBe("ไม้");
  });
});
