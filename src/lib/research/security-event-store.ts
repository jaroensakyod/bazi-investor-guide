import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECURITY_EVENT_SCHEMA_VERSION, validateSecurityEvent, type SecurityEvent } from "./security-birth";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
export const SECURITY_EVENT_FILE = path.join(ROOT, "data/security-events.json");

export type SecurityEventFile = {
  schemaVersion: typeof SECURITY_EVENT_SCHEMA_VERSION;
  updatedAt: string | null;
  events: SecurityEvent[];
};

export function loadSecurityEventFile(file = SECURITY_EVENT_FILE): SecurityEventFile {
  if (!existsSync(file)) return { schemaVersion: SECURITY_EVENT_SCHEMA_VERSION, updatedAt: null, events: [] };
  const data = JSON.parse(readFileSync(file, "utf8")) as SecurityEventFile;
  if (data.schemaVersion !== SECURITY_EVENT_SCHEMA_VERSION || !Array.isArray(data.events)) {
    throw new Error(`security-event file schema ไม่รองรับ: ${data.schemaVersion}`);
  }
  return data;
}

function identity(event: SecurityEvent): string {
  return [event.securityId, event.kind, event.localDate, event.localTime ?? "", event.evidence.authority, event.evidence.sourceName].join("|");
}

export function mergeSecurityEvents(current: readonly SecurityEvent[], incoming: readonly SecurityEvent[]): SecurityEvent[] {
  const byIdentity = new Map(current.map((event) => [identity(event), event]));
  for (const event of incoming) {
    const problems = validateSecurityEvent(event);
    if (problems.length > 0) throw new Error(`${event.securityId}/${event.kind}: ${problems.join(", ")}`);
    byIdentity.set(identity(event), event);
  }
  return [...byIdentity.values()].sort(
    (a, b) => a.securityId.localeCompare(b.securityId) || a.localDate.localeCompare(b.localDate) || a.kind.localeCompare(b.kind),
  );
}

export type SecurityEventDateConflict = {
  securityId: string;
  kind: SecurityEvent["kind"];
  incomingDate: string;
  existingDates: string[];
};

export type ConflictSafeSecurityEventMerge = {
  events: SecurityEvent[];
  added: number;
  alreadyPresent: number;
  refreshed: number;
  correctedDates: number;
  conflicts: SecurityEventDateConflict[];
};

/**
 * Merge a staged official-data refresh without silently overwriting unrelated
 * evidence. A caller may name exact superseded source URLs; only events whose
 * entire same-security/same-kind conflict comes from those URLs can be
 * refreshed or date-corrected automatically.
 */
export function mergeSecurityEventsConflictSafe(
  current: readonly SecurityEvent[],
  incoming: readonly SecurityEvent[],
  options: { supersededSourceUrls?: readonly string[] } = {},
): ConflictSafeSecurityEventMerge {
  const supersededSourceUrls = new Set(options.supersededSourceUrls ?? []);
  const merged = [...current];
  let added = 0;
  let alreadyPresent = 0;
  let refreshed = 0;
  let correctedDates = 0;
  const conflicts: SecurityEventDateConflict[] = [];

  for (const event of incoming) {
    const problems = validateSecurityEvent(event);
    if (problems.length > 0) throw new Error(`${event.securityId}/${event.kind}: ${problems.join(", ")}`);

    const sameKindIndexes = merged.flatMap((item, index) =>
      item.securityId === event.securityId && item.kind === event.kind ? [index] : [],
    );
    if (sameKindIndexes.length === 0) {
      merged.push(event);
      added += 1;
      continue;
    }

    const sameDateIndexes = sameKindIndexes.filter((index) => merged[index].localDate === event.localDate);
    const supersededIndexes = sameKindIndexes.filter((index) => {
      const sourceUrl = merged[index].evidence.sourceUrl;
      return sourceUrl !== undefined && supersededSourceUrls.has(sourceUrl);
    });

    if (sameDateIndexes.length > 0) {
      if (supersededIndexes.length === 0) {
        alreadyPresent += 1;
        continue;
      }
      for (const index of [...supersededIndexes].sort((a, b) => b - a)) merged.splice(index, 1);
      merged.push(event);
      refreshed += 1;
      continue;
    }

    if (supersededIndexes.length === sameKindIndexes.length) {
      for (const index of [...supersededIndexes].sort((a, b) => b - a)) merged.splice(index, 1);
      merged.push(event);
      refreshed += 1;
      correctedDates += 1;
      continue;
    }

    conflicts.push({
      securityId: event.securityId,
      kind: event.kind,
      incomingDate: event.localDate,
      existingDates: [...new Set(sameKindIndexes.map((index) => merged[index].localDate))],
    });
  }

  return {
    events: mergeSecurityEvents([], merged),
    added,
    alreadyPresent,
    refreshed,
    correctedDates,
    conflicts,
  };
}

export function saveSecurityEventFile(events: readonly SecurityEvent[], file = SECURITY_EVENT_FILE): SecurityEventFile {
  const canonical = mergeSecurityEvents([], events);
  const data: SecurityEventFile = {
    schemaVersion: SECURITY_EVENT_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    events: canonical,
  };
  mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  renameSync(temporary, file);
  return data;
}
