/**
 * API handler: dashboard ผู้เข้าใช้ (admin)
 * - GET /api/dashboard → สรุปผู้ใช้ + usage (intents/LLM/24h)
 */
import { readdirSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ROOT_DIR, getLlmConfig } from "./config";
import { usageSummary, type UsageSummary } from "./usage";
import { ok, type ApiResponse } from "./types";
import type { UserProfile } from "../lib/chat/user-store";

export type DashboardData = {
  users: Array<{ userId: string; birthDate: string; gender: string; createdAt: string; locale: string }>;
  usage: UsageSummary;
  llmEnabled: boolean;
};

export function handleDashboard(): ApiResponse<DashboardData> {
  const dir = path.join(ROOT_DIR, "data/users");
  const users: DashboardData["users"] = [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      try {
        const p = JSON.parse(readFileSync(path.join(dir, f), "utf8")) as UserProfile;
        users.push({ userId: p.userId, birthDate: p.birthDate, gender: p.gender, createdAt: p.createdAt, locale: p.locale });
      } catch {
        /* ข้ามไฟล์เสีย */
      }
    }
  }
  users.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return ok({ users, usage: usageSummary(), llmEnabled: getLlmConfig().enabled });
}
