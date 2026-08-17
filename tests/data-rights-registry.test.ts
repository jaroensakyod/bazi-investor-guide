import { describe, expect, it } from "vitest";
import {
  DATA_RIGHTS_REGISTRY,
  assessDatasetUse,
  validateDataRightsRegistry,
  type DatasetRights,
} from "../src/lib/trust/data-rights-registry";

describe("data-rights registry", () => {
  it("registry หลักไม่มี policy contradiction", () => {
    expect(DATA_RIGHTS_REGISTRY.length).toBeGreaterThanOrEqual(5);
    expect(validateDataRightsRegistry()).toEqual([]);
  });

  it("fail closed สำหรับ dataset ที่ไม่รู้จักและ development data ใน production", () => {
    expect(assessDatasetUse("missing", "paid_report").allowed).toBe(false);
    expect(assessDatasetUse("yahoo-development-market", "derived_metrics").allowed).toBe(false);
    expect(
      assessDatasetUse("yahoo-development-market", "derived_metrics", { environment: "development" }).allowed,
    ).toBe(true);
  });

  it("บังคับ runtime gates ก่อนใช้ official facts ใน paid report", () => {
    const blocked = assessDatasetUse("official-security-events", "paid_report");
    expect(blocked.allowed).toBe(false);
    expect(blocked.missingGates).toEqual(["source_attribution", "legal_review"]);

    const approved = assessDatasetUse("official-security-events", "paid_report", {
      satisfiedGates: ["source_attribution", "legal_review"],
    });
    expect(approved.allowed).toBe(true);
  });

  it("ตรวจ entry ที่อนุญาตและห้าม use เดียวกัน", () => {
    const invalid: DatasetRights = {
      ...DATA_RIGHTS_REGISTRY[0],
      datasetId: "invalid",
      prohibitedUses: ["paid_report"],
    };
    expect(validateDataRightsRegistry([invalid]).some((problem) => problem.includes("allowed/prohibited"))).toBe(true);
  });
});
