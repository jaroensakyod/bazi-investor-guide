/**
 * API handler: profile + chat (หัวใจของ web app)
 *
 * - POST /api/chat  { userId, message, useLlm? }
 *     → โหลด/สร้าง profile → คำนวณดวง → intent → LLM/tools → ตอบ
 * - POST /api/profile { userId, birthDate, birthTime, gender, province }
 *     → เก็บ user-store + คืน chartHash (คำนวณดวงครั้งเดียว)
 */
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { calculateBaziChart } from "../lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../lib/bazi/in-memory-repository";
import { detectIntent } from "../lib/chat/intents";
import { chatWithAssistant, fallbackAnswer } from "../lib/chat/assistant";
import { upsertUser, loadUser, type UserProfile, type BirthPayload } from "../lib/chat/user-store";
import { ok, err, type ApiResponse } from "./types";
import { getLlmConfig } from "./config";
import { logUsage } from "./usage";
import type { Locale } from "../lib/i18n/dictionary";

export type ChatReply = {
  reply: string;
  intent: string;
  llm: boolean;
  disclaimer: string;
  chartHash: string;
};

/** สร้าง/อัปเดต profile → คืน profile (ใช้ได้ทั้ง profile & chat route) */
export function handleProfile(body: Record<string, unknown>): ApiResponse<UserProfile> {
  const userId = String(body.userId ?? "");
  const birthDate = String(body.birthDate ?? "");
  const birthTime = String(body.birthTime ?? "");
  const gender = String(body.gender ?? "") as "male" | "female";
  const province = String(body.province ?? "Bangkok");
  if (!userId || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) || !/^\d{2}:\d{2}$/.test(birthTime) || !["male", "female"].includes(gender)) {
    return err("ต้องระบุ userId + birthDate(YYYY-MM-DD) + birthTime(HH:mm) + gender(male/female)");
  }
  const profile = upsertUser({ userId, birthDate, birthTime, gender, province });
  logUsage({ ts: new Date().toISOString(), userId, event: "profile" });
  return ok(profile);
}

/** คำนวณ state ดวงจาก profile (deterministic) */
export async function stateOfProfile(profile: UserProfile): Promise<CalculatedStateValue> {
  return calculateBaziChart(
    { birthDate: profile.birthDate, birthTime: profile.birthTime, gender: profile.gender, province: profile.province },
    createInMemoryKnowledgeRepository(),
  );
}

/** chat หลัก — ใช้ได้ทั้ง web/LINE/CLI (swap-able backend) */
export async function handleChat(body: Record<string, unknown>): Promise<ApiResponse<ChatReply>> {
  const userId = String(body.userId ?? "guest");
  const message = String(body.message ?? "").trim();
  if (!message) return err("message ว่าง");

  // 1. profile — ต้องมี (ไม่มี → บอกให้ลงทะเบียนก่อน)
  const profile = loadUser(userId);
  if (!profile) {
    return err("ยังไม่มีโปรไฟล์ — ลงทะเบียนวันเกิดก่อน (POST /api/profile)");
  }

  // 2. ดวง
  const state = await stateOfProfile(profile);

  // 2.5 จำภาษาที่ใช้ล่าสุด (dashboard ดูได้)
  const locale = (body.locale as Locale | undefined) ?? profile.locale ?? "th";
  if (locale !== profile.locale) {
    upsertUser({ ...profile, locale });
  }

  // 3. intent + compliance (advice_request → ตอบ compliance อย่างเดียว)
  const intent = detectIntent(message);
  let reply: string;
  let usedLlm = false;
  const cfg = getLlmConfig();
  if (intent.intent === "advice_request") {
    reply = fallbackAnswer(message, state, locale).text;
  } else if (body.useLlm !== false && cfg.enabled) {
    const r = await chatWithAssistant(message, state, { locale });
    usedLlm = r.usedLlm;
    reply = r.usedLlm ? r.text : `[โหมด fallback — LLM ไม่ว่าง]\n${r.text}`;
  } else {
    reply = fallbackAnswer(message, state, locale).text;
  }

  // 4. log
  logUsage({ ts: new Date().toISOString(), userId, event: "chat", intent: intent.intent, llm: usedLlm, msgLen: message.length });

  return ok({ reply, intent: intent.intent, llm: usedLlm, disclaimer: "⚠️ นี่คือบทวิเคราะห์อ้างอิงจากดวง ตลาด ข่าว แนวโน้ม — ไม่ใช่คำแนะนำการลงทุน", chartHash: profile.chartHash });
}
