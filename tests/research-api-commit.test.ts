import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { handleResearch } from "../src/api/market";
import { loadAuditEvents } from "../src/lib/trust/audit-log";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe("research API commit boundary", () => {
  it("preview ไม่เขียนไฟล์ แต่ commit บันทึก snapshot และ audit ที่ไม่เก็บ PII", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "bazi-research-api-"));
    temporaryDirectories.push(root);
    const snapshotRoot = path.join(root, "snapshots");
    const auditRoot = path.join(root, "audit");
    const generatedAt = "2026-08-09T09:00:00.000Z";

    const preview = await handleResearch(
      { ticker: "AAPL", market: "NASDAQ" },
      { requestKind: "preview", releaseUse: "internal_research", snapshotRoot, auditRoot, generatedAt },
    );
    expect(preview.ok).toBe(true);
    expect(existsSync(snapshotRoot)).toBe(false);
    expect(existsSync(auditRoot)).toBe(false);

    const committed = await handleResearch(
      { ticker: "AAPL", market: "NASDAQ" },
      { requestKind: "commit", releaseUse: "internal_research", snapshotRoot, auditRoot, generatedAt },
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;
    const data = committed.data as {
      persistence: { committed: boolean; snapshotId: string; auditEventId: string };
      snapshot: { contentHash: string };
    };
    expect(data.persistence.committed).toBe(true);
    expect(data.persistence.snapshotId).toMatch(/^research_/);
    expect(data.persistence.auditEventId).toMatch(/^audit_/);

    const events = loadAuditEvents("research-NASDAQ:AAPL", auditRoot);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "commit_research_snapshot",
      outputHash: data.snapshot.contentHash,
      outcome: "success",
    });
    expect(events[0].inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(Object.keys(events[0].metadata).join(" ")).not.toMatch(/birth|email|phone|address/i);
    expect(events[0].metadata).not.toHaveProperty("userId");
  });

  it("production commit fail closed แม้เปิด endpoint แล้ว", async () => {
    const result = await handleResearch(
      { ticker: "AAPL", market: "NASDAQ" },
      { requestKind: "commit", releaseUse: "paid_report", environment: "production", auditReady: false },
    );
    expect(result.ok).toBe(false);
  });
});
