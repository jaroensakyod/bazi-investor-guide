import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendAuditEvent,
  auditLogFile,
  createAuditEvent,
  loadAuditEvents,
  verifyAuditChain,
  type AuditEvent,
  type AuditEventInput,
} from "../src/lib/trust/audit-log";
import { stableSha256 } from "../src/lib/research/canonical-json";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = mkdtempSync(path.join(tmpdir(), "bazi-audit-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function input(overrides: Partial<AuditEventInput> = {}): AuditEventInput {
  return {
    occurredAt: "2026-08-09T08:00:00.000Z",
    actor: "system",
    scope: "research",
    action: "snapshot.created",
    resourceId: "SET:ADVANC",
    versions: [{ component: "research-model", version: "stock-research-v1" }],
    inputHash: stableSha256({ input: 1 }),
    outputHash: stableSha256({ output: 1 }),
    evidenceIds: ["SET:ADVANC:market"],
    outcome: "success",
    reasons: [],
    metadata: { environment: "test" },
    ...overrides,
  };
}

describe("append-only audit log", () => {
  it("สร้าง hash chain ที่ตรวจสอบได้", () => {
    const first = createAuditEvent(input());
    const second = createAuditEvent(
      input({ occurredAt: "2026-08-09T08:01:00.000Z", action: "decision.created" }),
      first,
    );
    expect(second.previousEventHash).toBe(first.eventHash);
    expect(verifyAuditChain([first, second])).toEqual([]);
  });

  it("จับการแก้เนื้อหาย้อนหลัง", () => {
    const event = createAuditEvent(input());
    const tampered = { ...event, action: "tampered" } as AuditEvent;
    expect(verifyAuditChain([tampered]).some((problem) => problem.includes("eventHash"))).toBe(true);
  });

  it("append และอ่าน JSONL โดยไม่เขียนทับ event เดิม", () => {
    const root = temporaryDirectory();
    appendAuditEvent("profile_123", input(), root);
    appendAuditEvent(
      "profile_123",
      input({ occurredAt: "2026-08-09T08:02:00.000Z", scope: "decision", action: "decision.created" }),
      root,
    );
    const events = loadAuditEvents("profile_123", root);
    expect(events).toHaveLength(2);
    expect(verifyAuditChain(events)).toEqual([]);
    expect(readFileSync(auditLogFile("profile_123", root), "utf8").trim().split(/\r?\n/)).toHaveLength(2);
  });

  it("ปฏิเสธ metadata key ที่เสี่ยงเก็บ PII ดิบ", () => {
    expect(() => createAuditEvent(input({ metadata: { birthDate: "1993-11-24" } }))).toThrow(/PII/);
  });
});
