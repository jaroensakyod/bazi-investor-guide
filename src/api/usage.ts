/**
 * Usage log — บันทึกการใช้งาน (dashboard ผู้เข้าใช้)
 * ไฟล์: data/usage.jsonl (1 บรรทัด/1 event — append-only, ไม่ lock)
 */
import { existsSync, mkdirSync, appendFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT_DIR } from "./config";

const FILE = path.join(ROOT_DIR, "data/usage.jsonl");

export type UsageEvent = {
  ts: string; // ISO
  userId: string;
  event: "chat" | "profile" | "report" | "dashboard";
  intent?: string;
  llm?: boolean;
  /** ความยาวข้อความ (กันสแปม) */
  msgLen?: number;
};

export function logUsage(e: UsageEvent): void {
  try {
    mkdirSync(path.dirname(FILE), { recursive: true });
    appendFileSync(FILE, JSON.stringify(e) + "\n", "utf8");
  } catch {
    /* log พังไม่ควรฆ่า request */
  }
}

export type UsageSummary = {
  totalEvents: number;
  uniqueUsers: number;
  byIntent: Record<string, number>;
  llmCalls: number;
  last24h: number;
};

export function usageSummary(): UsageSummary {
  try {
    if (!existsSync(FILE)) return { totalEvents: 0, uniqueUsers: 0, byIntent: {}, llmCalls: 0, last24h: 0 };
    const lines = readUsageLines();
    const users = new Set<string>();
    const byIntent: Record<string, number> = {};
    let llmCalls = 0;
    let last24h = 0;
    const cutoff = Date.now() - 24 * 3600 * 1000;
    for (const e of lines) {
      users.add(e.userId);
      if (e.intent) byIntent[e.intent] = (byIntent[e.intent] ?? 0) + 1;
      if (e.llm) llmCalls += 1;
      if (new Date(e.ts).getTime() >= cutoff) last24h += 1;
    }
    return { totalEvents: lines.length, uniqueUsers: users.size, byIntent, llmCalls, last24h };
  } catch {
    return { totalEvents: 0, uniqueUsers: 0, byIntent: {}, llmCalls: 0, last24h: 0 };
  }
}

export function readUsageLines(): UsageEvent[] {
  if (!existsSync(FILE)) return [];
  return readFileSync(FILE, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l) as UsageEvent;
      } catch {
        return null;
      }
    })
    .filter((x): x is UsageEvent => x !== null);
}
