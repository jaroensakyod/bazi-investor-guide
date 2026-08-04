/**
 * เทสต์ Review Workflow — ซินแสตรวจธาตุหุ้น (export checklist → import ผลกลับ)
 */
import { describe, it, expect } from "vitest";
import { getThaiStocks, buildReviewChecklist, reviewChecklistToCsv, applyReviewResults, type StockEntry } from "@/lib/investor/stock-database";

describe("Review Workflow (ซินแสตรวจธาตุ)", () => {
  it("buildReviewChecklist: 1 แถว/หุ้น มีข้อมูลธุรกิจให้ซินแสเทียบครบ", () => {
    const rows = buildReviewChecklist(getThaiStocks());
    expect(rows.length).toBe(getThaiStocks().length);
    const kb = rows.find((r) => r.ticker === "KBANK");
    expect(kb?.business).toBeTruthy();
    expect(kb?.currentElements).toBe("น้ำ,ดิน");
    expect(kb?.currentPrimary).toBe("น้ำ");
  });

  it("reviewChecklistToCsv: มี header + ข้อมูล + คอลัมน์ให้กรอก (isCorrect)", () => {
    const csv = reviewChecklistToCsv(buildReviewChecklist(getThaiStocks().slice(0, 3)));
    expect(csv).toContain("ticker,name,business");
    expect(csv).toContain("isCorrect");
    expect(csv.split("\n").length).toBe(4); // header + 3 แถว
  });

  it("applyReviewResults: ยืนยัน (Y) → status=reviewed + reviewHistory approved", () => {
    const stocks: StockEntry[] = getThaiStocks().filter((s) => s.ticker === "KBANK").map((s) => ({ ...s, reviewHistory: [] }));
    const { updated, problems } = applyReviewResults(stocks, [{ ticker: "KBANK", isCorrect: "Y", note: "ธุรกิจธนาคาร = น้ำ ถูกต้อง" }], "ซินแสสมชาย");
    expect(problems).toEqual([]);
    expect(updated).toContain("KBANK (approved)");
    expect(stocks[0].status).toBe("reviewed");
    expect(stocks[0].reviewedBy).toBe("ซินแสสมชาย");
    expect(stocks[0].reviewHistory?.length).toBe(1);
    expect(stocks[0].reviewHistory?.[0].action).toBe("approved");
    expect(stocks[0].reviewHistory?.[0].afterPrimary).toBe("น้ำ");
  });

  it("applyReviewResults: แก้ (N) → เปลี่ยนธาตุ + reviewHistory changed + บันทึก before/after", () => {
    const stocks: StockEntry[] = getThaiStocks().filter((s) => s.ticker === "BEC").map((s) => ({ ...s, reviewHistory: [] }));
    const before = stocks[0].primaryElement;
    const { updated } = applyReviewResults(
      stocks,
      [{ ticker: "BEC", isCorrect: "N", correctedElements: "น้ำ,ไม้", correctedPrimary: "น้ำ", note: "ธุรกิจหลักคือทีวี/บันเทิง = น้ำ ไม่ใช่ไม้" }],
      "ซินแสสมชาย",
    );
    expect(updated).toContain("BEC (changed: ไม้ → น้ำ)");
    expect(stocks[0].primaryElement).toBe("น้ำ");
    expect(stocks[0].elements).toEqual(["น้ำ", "ไม้"]);
    expect(stocks[0].reviewHistory?.[0].action).toBe("changed");
    expect(stocks[0].reviewHistory?.[0].beforePrimary).toBe(before);
    expect(stocks[0].reviewHistory?.[0].afterPrimary).toBe("น้ำ");
    expect(stocks[0].sinsiNote).toContain("บันเทิง");
  });

  it("applyReviewResults: แก้แต่ธาตุไม่ถูกต้อง → problems (ไม่แก้ data)", () => {
    const stocks: StockEntry[] = getThaiStocks().filter((s) => s.ticker === "KBANK").map((s) => ({ ...s }));
    const before = stocks[0].primaryElement;
    const { updated, problems } = applyReviewResults(stocks, [{ ticker: "KBANK", isCorrect: "N", correctedElements: "xyz" }], "ซินแส");
    expect(problems.length).toBe(1);
    expect(updated).toEqual([]);
    expect(stocks[0].primaryElement).toBe(before); // ไม่ถูกแตะ
  });

  it("applyReviewResults: ticker ไม่มีในคลัง → problems", () => {
    const { updated, problems } = applyReviewResults(getThaiStocks(), [{ ticker: "XXXX", isCorrect: "Y" }], "ซินแส");
    expect(updated).toEqual([]);
    expect(problems).toContain("ไม่พบ ticker: XXXX");
  });
});
