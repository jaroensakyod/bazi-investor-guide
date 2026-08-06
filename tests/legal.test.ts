import { describe, it, expect } from "vitest";
import { LEGAL, legalCompleteness } from "../src/lib/legal/content";

describe("เอกสารทางกฎหมาย (policy)", () => {
  it("ครบ 4 หมวด × 3 ภาษา + เนื้อหาพอสมควร", () => {
    const c = legalCompleteness();
    for (const sec of ["disclaimer", "risk", "terms", "privacy"] as const) {
      for (const loc of ["th", "zh", "en"] as const) {
        expect(c[sec][loc], `${sec}/${loc}`).toBeGreaterThan(150); // ≥150 ตัวอักษรต่อหมวด (จีน/ย่อหน้าสั้น)
      }
    }
  });

  it("ทุกหมวดมีหัวข้อ + อย่างน้อย 3 ย่อหน้า (ไทย)", () => {
    for (const sec of ["disclaimer", "risk", "terms", "privacy"] as const) {
      expect(LEGAL[sec].th.length).toBeGreaterThanOrEqual(1);
      expect(LEGAL[sec].th[0].h.length).toBeGreaterThan(3);
      expect(LEGAL[sec].th[0].p.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("ทุกภาษามีจำนวนย่อหน้าเท่ากัน (เนื้อหาครบทั้ง 3 ภาษา)", () => {
    for (const sec of ["disclaimer", "risk", "terms", "privacy"] as const) {
      const n = LEGAL[sec].th[0].p.length;
      expect(LEGAL[sec].zh[0].p.length).toBe(n);
      expect(LEGAL[sec].en[0].p.length).toBe(n);
    }
  });

  it("มีคำเตือน 'ไม่ใช่คำแนะนำการลงทุน' ใน disclaimer ทุกภาษา", () => {
    const zh = LEGAL.disclaimer.zh[0].p.join(" ");
    const en = LEGAL.disclaimer.en[0].p.join(" ");
    expect(zh).toContain("建议");
    expect(en.toLowerCase()).toContain("recommendation");
    expect(LEGAL.disclaimer.th[0].p.join(" ")).toContain("คำแนะนำ");
  });
});
