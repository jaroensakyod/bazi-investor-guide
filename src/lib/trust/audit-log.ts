import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { sanitizeUserId } from "../chat/user-store";
import { stableSha256 } from "../research/canonical-json";

export const AUDIT_EVENT_SCHEMA_VERSION = 1 as const;

const AuditMetadataValueSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
const VersionStampSchema = z.object({ component: z.string().trim().min(1), version: z.string().trim().min(1) });

export const AuditEventSchema = z.object({
  schemaVersion: z.literal(AUDIT_EVENT_SCHEMA_VERSION),
  eventId: z.string().regex(/^audit_[a-f0-9]{24}$/),
  eventHash: z.string().regex(/^[a-f0-9]{64}$/),
  previousEventHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  occurredAt: z.iso.datetime(),
  actor: z.enum(["system", "user", "reviewer"]),
  scope: z.enum(["decision", "research", "ai_generation", "model_evaluation", "release_gate", "profile", "portfolio"]),
  action: z.string().trim().min(1),
  resourceId: z.string().trim().min(1),
  versions: z.array(VersionStampSchema),
  inputHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  outputHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  evidenceIds: z.array(z.string().trim().min(1)),
  outcome: z.enum(["success", "blocked", "failed"]),
  reasons: z.array(z.string().trim().min(1)),
  metadata: z.record(z.string(), AuditMetadataValueSchema),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventInput = Omit<
  AuditEvent,
  "schemaVersion" | "eventId" | "eventHash" | "previousEventHash"
>;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const AUDIT_LOG_DIR = path.join(ROOT, "data/audit-log");

const FORBIDDEN_METADATA_KEY = /(?:birth|email|phone|address|full.?name|raw.?prompt|passport|national.?id)/i;

function hashPayload(event: Omit<AuditEvent, "eventId" | "eventHash">): string {
  return stableSha256(event);
}

function storedEventHash(event: AuditEvent): string {
  return stableSha256(
    Object.fromEntries(Object.entries(event).filter(([key]) => key !== "eventId" && key !== "eventHash")),
  );
}

function semanticProblems(event: AuditEvent): string[] {
  const problems: string[] = [];
  const components = new Set<string>();
  for (const stamp of event.versions) {
    if (components.has(stamp.component)) problems.push(`${event.eventId}: version component ซ้ำ: ${stamp.component}`);
    components.add(stamp.component);
  }
  const evidenceIds = new Set<string>();
  for (const evidenceId of event.evidenceIds) {
    if (evidenceIds.has(evidenceId)) problems.push(`${event.eventId}: evidenceId ซ้ำ: ${evidenceId}`);
    evidenceIds.add(evidenceId);
  }
  for (const key of Object.keys(event.metadata)) {
    if (FORBIDDEN_METADATA_KEY.test(key)) problems.push(`${event.eventId}: metadata key เสี่ยงเก็บ PII: ${key}`);
  }
  if (event.outcome !== "success" && event.reasons.length === 0) {
    problems.push(`${event.eventId}: blocked/failed ต้องมี reason`);
  }
  return problems;
}

export function createAuditEvent(input: AuditEventInput, previous: AuditEvent | null = null): AuditEvent {
  const base = {
    schemaVersion: AUDIT_EVENT_SCHEMA_VERSION,
    previousEventHash: previous?.eventHash ?? null,
    ...input,
  } as const;
  const eventHash = hashPayload(base);
  const event: AuditEvent = { ...base, eventId: `audit_${eventHash.slice(0, 24)}`, eventHash };
  const parsed = AuditEventSchema.safeParse(event);
  if (!parsed.success) throw new Error("audit event schema ไม่ถูกต้อง: " + parsed.error.issues[0]?.message);
  const problems = semanticProblems(parsed.data);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return parsed.data;
}

export function verifyAuditChain(events: readonly AuditEvent[]): string[] {
  const problems: string[] = [];
  let previous: AuditEvent | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const candidate = events[index];
    const parsed = AuditEventSchema.safeParse(candidate);
    if (!parsed.success) {
      problems.push(`event ${index}: schema ไม่ถูกต้อง`);
      previous = null;
      continue;
    }
    const event = parsed.data;
    const expectedPrevious = previous?.eventHash ?? null;
    if (event.previousEventHash !== expectedPrevious) problems.push(`${event.eventId}: previousEventHash ไม่ต่อเนื่อง`);
    const expectedHash = storedEventHash(event);
    if (event.eventHash !== expectedHash) problems.push(`${event.eventId}: eventHash ไม่ตรงกับเนื้อหา`);
    if (event.eventId !== `audit_${expectedHash.slice(0, 24)}`) problems.push(`${event.eventId}: eventId ไม่ตรงกับ hash`);
    if (previous && Date.parse(event.occurredAt) < Date.parse(previous.occurredAt)) {
      problems.push(`${event.eventId}: occurredAt ย้อนเวลากว่า event ก่อนหน้า`);
    }
    problems.push(...semanticProblems(event));
    previous = event;
  }
  return problems;
}

export function auditLogFile(streamId: string, root = AUDIT_LOG_DIR): string {
  return path.join(root, sanitizeUserId(streamId) + ".jsonl");
}

export function loadAuditEvents(streamId: string, root = AUDIT_LOG_DIR): AuditEvent[] {
  const file = auditLogFile(streamId, root);
  if (!existsSync(file)) return [];
  const lines = readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  const events = lines.map((line, index) => {
    try {
      return AuditEventSchema.parse(JSON.parse(line));
    } catch {
      throw new Error(`audit log บรรทัด ${index + 1} ไม่ถูกต้อง`);
    }
  });
  const problems = verifyAuditChain(events);
  if (problems.length > 0) throw new Error(problems.join("; "));
  return events;
}

/** Single-process preview store. Production must add database locking/transactions. */
export function appendAuditEvent(
  streamId: string,
  input: AuditEventInput,
  root = AUDIT_LOG_DIR,
): AuditEvent {
  mkdirSync(root, { recursive: true });
  const existing = loadAuditEvents(streamId, root);
  const event = createAuditEvent(input, existing.at(-1) ?? null);
  appendFileSync(auditLogFile(streamId, root), JSON.stringify(event) + "\n", "utf8");
  return event;
}
