import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { stableSha256 } from "./canonical-json";
import { validateResearchSnapshot, type ResearchSnapshot } from "./research-snapshot";
import { RESEARCH_SNAPSHOT_DIR } from "./research-snapshot-paths";

export const RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION = 1 as const;
export const RESEARCH_SNAPSHOT_INDEX_FILE = "_index.json";

const SnapshotIndexEntrySchema = z.object({
  snapshotId: z.string().regex(/^research_[a-f0-9]{24}$/),
  securityId: z.string().trim().min(1),
  createdAt: z.iso.datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  decisionId: z.string().regex(/^decision_[a-f0-9]{24}$/),
  status: z.enum(["research", "watch", "review", "avoid_for_now"]),
  confidenceScore: z.number().min(0).max(100),
  dataAsOf: z.string().refine((value) => Number.isFinite(Date.parse(value))).nullable(),
});

export const ResearchSnapshotIndexSchema = z.object({
  schemaVersion: z.literal(RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION),
  updatedAt: z.iso.datetime(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  entries: z.array(SnapshotIndexEntrySchema),
});

export type ResearchSnapshotIndexEntry = z.infer<typeof SnapshotIndexEntrySchema>;
export type ResearchSnapshotIndex = z.infer<typeof ResearchSnapshotIndexSchema>;

function sortedEntries(entries: readonly ResearchSnapshotIndexEntry[]): ResearchSnapshotIndexEntry[] {
  return [...entries].sort((left, right) =>
    left.securityId.localeCompare(right.securityId) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.snapshotId.localeCompare(right.snapshotId),
  );
}

function indexHash(entries: readonly ResearchSnapshotIndexEntry[]): string {
  return stableSha256(sortedEntries(entries));
}

export function snapshotIndexEntry(snapshot: ResearchSnapshot): ResearchSnapshotIndexEntry {
  return {
    snapshotId: snapshot.snapshotId,
    securityId: snapshot.securityId,
    createdAt: snapshot.createdAt,
    contentHash: snapshot.contentHash,
    decisionId: snapshot.decision.decisionId,
    status: snapshot.decision.status,
    confidenceScore: snapshot.decision.confidence.score,
    dataAsOf: snapshot.decision.provenance.dataAsOf,
  };
}

export function createResearchSnapshotIndex(
  snapshots: readonly ResearchSnapshot[],
  updatedAt = new Date().toISOString(),
): ResearchSnapshotIndex {
  for (const snapshot of snapshots) {
    const problems = validateResearchSnapshot(snapshot);
    if (problems.length > 0) throw new Error(problems.join("; "));
  }
  const byId = new Map<string, ResearchSnapshotIndexEntry>();
  for (const snapshot of snapshots) {
    const entry = snapshotIndexEntry(snapshot);
    const existing = byId.get(entry.snapshotId);
    if (existing && existing.contentHash !== entry.contentHash) throw new Error("snapshotId ชนกับ contentHash คนละชุด");
    byId.set(entry.snapshotId, entry);
  }
  const entries = sortedEntries([...byId.values()]);
  return {
    schemaVersion: RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION,
    updatedAt,
    contentHash: indexHash(entries),
    entries,
  };
}

export function validateResearchSnapshotIndex(index: ResearchSnapshotIndex): string[] {
  const parsed = ResearchSnapshotIndexSchema.safeParse(index);
  if (!parsed.success) return ["snapshot index schema ไม่ถูกต้อง"];
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of parsed.data.entries) {
    if (ids.has(entry.snapshotId)) problems.push("snapshotId ซ้ำใน index: " + entry.snapshotId);
    ids.add(entry.snapshotId);
  }
  if (parsed.data.contentHash !== indexHash(parsed.data.entries)) problems.push("snapshot index contentHash ไม่ตรงกับ entries");
  return problems;
}

export function researchSnapshotIndexFile(root = RESEARCH_SNAPSHOT_DIR): string {
  return path.join(root, RESEARCH_SNAPSHOT_INDEX_FILE);
}

export function saveResearchSnapshotIndex(index: ResearchSnapshotIndex, root = RESEARCH_SNAPSHOT_DIR): string {
  const problems = validateResearchSnapshotIndex(index);
  if (problems.length > 0) throw new Error(problems.join("; "));
  mkdirSync(root, { recursive: true });
  const file = researchSnapshotIndexFile(root);
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, JSON.stringify(index, null, 2) + "\n", "utf8");
  renameSync(temporary, file);
  return file;
}

export function loadResearchSnapshotIndex(root = RESEARCH_SNAPSHOT_DIR): ResearchSnapshotIndex | null {
  const file = researchSnapshotIndexFile(root);
  if (!existsSync(file)) return null;
  try {
    const index = JSON.parse(readFileSync(file, "utf8")) as ResearchSnapshotIndex;
    return validateResearchSnapshotIndex(index).length === 0 ? index : null;
  } catch {
    return null;
  }
}

function readSnapshotFile(file: string): ResearchSnapshot | null {
  try {
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as ResearchSnapshot;
    return validateResearchSnapshot(snapshot).length === 0 ? snapshot : null;
  } catch {
    return null;
  }
}

export function rebuildResearchSnapshotIndex(
  root = RESEARCH_SNAPSHOT_DIR,
  updatedAt = new Date().toISOString(),
): ResearchSnapshotIndex {
  mkdirSync(root, { recursive: true });
  const snapshots = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^research_[a-f0-9]{24}\.json$/.test(entry.name))
    .map((entry) => readSnapshotFile(path.join(root, entry.name)))
    .filter((snapshot): snapshot is ResearchSnapshot => snapshot !== null);
  const index = createResearchSnapshotIndex(snapshots, updatedAt);
  saveResearchSnapshotIndex(index, root);
  return index;
}

export function recordResearchSnapshotInIndex(
  snapshot: ResearchSnapshot,
  root = RESEARCH_SNAPSHOT_DIR,
  updatedAt = new Date().toISOString(),
): ResearchSnapshotIndex {
  const current = loadResearchSnapshotIndex(root) ?? rebuildResearchSnapshotIndex(root, updatedAt);
  const entry = snapshotIndexEntry(snapshot);
  const entries = current.entries.filter((item) => item.snapshotId !== entry.snapshotId);
  entries.push(entry);
  const next: ResearchSnapshotIndex = {
    schemaVersion: RESEARCH_SNAPSHOT_INDEX_SCHEMA_VERSION,
    updatedAt,
    contentHash: indexHash(entries),
    entries: sortedEntries(entries),
  };
  saveResearchSnapshotIndex(next, root);
  return next;
}

export function loadResearchSnapshotHistory(
  securityId: string,
  root = RESEARCH_SNAPSHOT_DIR,
): ResearchSnapshot[] {
  const index = loadResearchSnapshotIndex(root) ?? rebuildResearchSnapshotIndex(root);
  return index.entries
    .filter((entry) => entry.securityId === securityId)
    .map((entry) => readSnapshotFile(path.join(root, `${entry.snapshotId}.json`)))
    .filter((snapshot): snapshot is ResearchSnapshot => snapshot !== null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
