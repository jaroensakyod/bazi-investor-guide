/**
 * API handler: market/almanac/fortune/report — ครอบ tools ให้ frontend เรียก
 * ทุกตัว deterministic (tools) — LLM เฉพาะ chat route
 */
import { getTodayMovers } from "../lib/chat/tools";
import { getUpcomingIPOs } from "../lib/chat/tools";
import { getNewsImpact } from "../lib/chat/tools";
import { getTodayAlmanac } from "../lib/chat/tools";
import { getFortuneInvest } from "../lib/chat/tools";
import { loadUser, type UserProfile } from "../lib/chat/user-store";
import { ok, err, type ApiResponse, type Query } from "./types";
import { stateOfProfile } from "./chat";

function num(q: Query, name: string, dflt?: number): number | undefined {
  const v = q[name];
  if (v === undefined) return dflt;
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

export function handleMovers(q: Query): ApiResponse<unknown> {
  return ok(getTodayMovers({ market: q.market, limit: num(q, "limit", 10), direction: q.direction as "gainers" | "losers" | undefined }).data);
}

export function handleIpo(q: Query): ApiResponse<unknown> {
  return ok(getUpcomingIPOs({ market: q.market, limit: num(q, "limit", 10) }).data);
}

export function handleNews(q: Query): ApiResponse<unknown> {
  return ok(getNewsImpact({ query: q.query, market: q.market, limit: num(q, "limit", 8) }).data);
}

export function handleAlmanac(q: Query): ApiResponse<unknown> {
  return ok(getTodayAlmanac({ date: q.date }).data);
}

/** fortune ต้องมี profile (ดวงผู้ใช้) — scope: day/week/month · asset: stocks/land/ipo */
export async function handleFortune(q: Query): Promise<ApiResponse<unknown>> {
  const profile = loadUser(q.userId ?? "guest");
  if (!profile) return err("ยังไม่มีโปรไฟล์ — ลงทะเบียนก่อน (POST /api/profile)");
  const state = await stateOfProfile(profile);
  const res = getFortuneInvest(
    {
      scope: (q.scope as "day" | "week" | "month") ?? "day",
      asset: q.asset as "stocks" | "land" | "ipo" | undefined,
      date: q.date,
      year: num(q, "year"),
      month: num(q, "month"),
    },
    state,
  );
  return res.ok ? ok(res.data) : err(res.error ?? "fortune error");
}

export async function handleReport(q: Query): Promise<ApiResponse<unknown>> {
  const ticker = String(q.ticker ?? "").toUpperCase();
  if (!ticker) return err("ต้องระบุ ticker");
  const profile = loadUser(q.userId ?? "guest");
  const state = profile ? await stateOfProfile(profile) : undefined;
  const { generateReport } = await import("../lib/chat/tools");
  const res = generateReport(ticker, state);
  return res.ok ? ok(res.data) : err(res.error ?? "report error");
}

export type { UserProfile };
