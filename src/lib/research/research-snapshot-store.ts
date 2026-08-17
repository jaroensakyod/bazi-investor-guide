import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validateResearchSnapshot, type ResearchSnapshot } from "./research-snapshot";
import { recordResearchSnapshotInIndex } from "./research-snapshot-index";
import { RESEARCH_SNAPSHOT_DIR } from "./research-snapshot-paths";

export { RESEARCH_SNAPSHOT_DIR } from "./research-snapshot-paths";

function safeSnapshotId(snapshotId: string): string {
  if (!/^research_[a-f0-9]{24}$/.test(snapshotId)) throw new Error("snapshotId ไม่ถูกต้อง");
  return snapshotId;
}

export function researchSnapshotFile(snapshotId: string, root = RESEARCH_SNAPSHOT_DIR): string {
  return path.join(root, `${safeSnapshotId(snapshotId)}.json`);
}

export function saveResearchSnapshot(snapshot: ResearchSnapshot, root = RESEARCH_SNAPSHOT_DIR): string {
  const problems = validateResearchSnapshot(snapshot);
  if (problems.length > 0) throw new Error(problems.join("; "));
  mkdirSync(root, { recursive: true });
  const file = researchSnapshotFile(snapshot.snapshotId, root);
  if (existsSync(file)) {
    const existing = loadResearchSnapshot(snapshot.snapshotId, root);
    if (!existing || existing.contentHash !== snapshot.contentHash) throw new Error("snapshotId ชนกับเนื้อหาคนละชุด");
    recordResearchSnapshotInIndex(existing, root);
    return file;
  }
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
  recordResearchSnapshotInIndex(snapshot, root);
  return file;
}

export function loadResearchSnapshot(snapshotId: string, root = RESEARCH_SNAPSHOT_DIR): ResearchSnapshot | null {
  const file = researchSnapshotFile(snapshotId, root);
  if (!existsSync(file)) return null;
  try {
    const snapshot = JSON.parse(readFileSync(file, "utf8")) as ResearchSnapshot;
    return validateResearchSnapshot(snapshot).length === 0 ? snapshot : null;
  } catch {
    return null;
  }
}
