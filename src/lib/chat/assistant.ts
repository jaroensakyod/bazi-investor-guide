/**
 * LLM Assistant — "นักวิเคราะห์การเงินคู่ดวง" (Task 1.5)
 *
 * - OpenAI-compatible function calling (DeepSeek/Nous/OpenAI ใช้ protocol เดียวกัน)
 * - กฎ (system prompt): ต้องเรียก tools ไม่เดา · disclaimer ทุกครั้ง · ภาษาไทย
 * - Fallback: LLM error → ตอบจาก tool ตรงๆ (graceful degradation — แชทไม่ตาย)
 * - ไม่มี key → โหมด template (tools ล้วน) เหมือน chat-demo เดิม
 *
 * รัน: npx tsx --env-file=.env scripts/chat-demo.ts --llm --birth ... --time ... --gender ...
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CalculatedStateValue } from "../bazi/schema-types";
import { detectIntent } from "./intents";
import { getTodayMovers, getUpcomingIPOs, getBaziVerdict, getFundamentals, getNewsImpact, searchStocks, generateReport, getTodayAlmanac, getFortuneInvest } from "./tools";
import { COMPLIANCE_NOTE } from "../fortune/investment-days";

const DISCLAIMER = "⚠️ แนวโน้มตามดวง + ข้อมูล (ไม่ใช่คำแนะนำการลงทุน)";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// ── env (โหลด .env ง่ายๆ — ไม่พึ่ง dotenv lib · ROOT-based ไม่ขึ้นกับ cwd) ──
function loadEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].trim();
  }
  return out;
}
const ENV: Record<string, string | undefined> = { ...loadEnv(), ...process.env };

export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  /** assistant message: tool_calls ที่ขอเรียก (OpenAI format) */
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  /** tool message: ตอบกลับ tool_call นั้น */
  tool_call_id?: string;
};

export type ToolCall = { id: string; name: string; args: string };

// ── Tool definitions (OpenAI function schema) ──
export const TOOL_DEFS = [
  { type: "function", function: { name: "getTodayMovers", description: "หุ้นเด่นวันนี้ (gainers/losers) — ใช้ตอบ 'หุ้นวันนี้ตัวไหนน่าสนใจ'", parameters: { type: "object", properties: { market: { type: "string", description: "TH/US/JP/..." }, limit: { type: "number" }, direction: { type: "string", enum: ["gainers", "losers"] } } } } },
  { type: "function", function: { name: "getUpcomingIPOs", description: "IPO ที่กำลังจะเข้าเทรด", parameters: { type: "object", properties: { market: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "getBaziVerdict", description: "verdict หุ้น vs ดวงผู้ใช้ (ธาตุที่ดวงต้องการ/เลี่ยง + คะแนน) — ใช้ตอบ 'หุ้นนี้กับดวงเราเป็นยังไง'", parameters: { type: "object", properties: { ticker: { type: "string", description: "เช่น KBANK/PTT/AAPL" } }, required: ["ticker"] } } },
  { type: "function", function: { name: "getFundamentals", description: "วิเคราะห์พื้นฐาน (ROE/กำไร/โต + Buffett score)", parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] } } },
  { type: "function", function: { name: "getNewsImpact", description: "ข่าว/เหตุการณ์ที่เกี่ยวข้อง (กรองคำถาม เช่น ทรัมป์/ภาษี/ทอง)", parameters: { type: "object", properties: { query: { type: "string" }, market: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "searchStocks", description: "ค้นหุ้นตามธาตุ/เซกเตอร์/คำ (เช่น 'หุ้นธาตุทองมีตัวไหนบ้าง')", parameters: { type: "object", properties: { element: { type: "string", enum: ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"] }, keyword: { type: "string" }, market: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "generateReport", description: "รายงานย่อหุ้น (ดวง + พื้นฐาน + Buffett)", parameters: { type: "object", properties: { ticker: { type: "string" } }, required: ["ticker"] } } },
  { type: "function", function: { name: "getTodayAlmanac", description: "ปฏิทิน/ดวงวันนี้ (สีมงคล ยามมงคล ทิศมงคล ขึ้นแรม ดาวประจำวัน) — ใช้ตอบ 'วันนี้ดวงเป็นยังไง/ฤกษ์/สีมงคล'", parameters: { type: "object", properties: { date: { type: "string", description: "YYYY-MM-DD (ไม่ส่ง = วันนี้)" } } } } },
  { type: "function", function: { name: "getFortuneInvest", description: "ดวง×การลงทุน: scope=day (ธาตุวันนี้+หุ้นที่ตรงธาตุ) / week (IPO ช่วงนี้ เหมาะกับดวงไหม — ธาตุธุรกิจ+ธาตุวันเกิด) / month (ธาตุเดือน+ทิศเงิน+วันดีทั้งเดือน + asset=land วันเหมาะซื้อที่ดิน)", parameters: { type: "object", properties: { scope: { type: "string", enum: ["day", "week", "month"] }, asset: { type: "string", enum: ["stocks", "land", "ipo"] }, date: { type: "string" }, year: { type: "number" }, month: { type: "number" } } } } },
] as const;

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.function.name);

/** รัน tool ตามชื่อ (จ่าย state ให้ verdict/report) */
export function runTool(name: string, args: Record<string, unknown>, state: CalculatedStateValue) {
  switch (name) {
    case "getTodayMovers": return getTodayMovers({ market: args.market as string | undefined, limit: args.limit as number | undefined, direction: args.direction as "gainers" | "losers" | undefined });
    case "getUpcomingIPOs": return getUpcomingIPOs({ market: args.market as string | undefined, limit: args.limit as number | undefined });
    case "getBaziVerdict": return getBaziVerdict(String(args.ticker ?? ""), state);
    case "getFundamentals": return getFundamentals(String(args.ticker ?? ""));
    case "getNewsImpact": return getNewsImpact({ query: args.query as string | undefined, market: args.market as string | undefined, limit: args.limit as number | undefined });
    case "searchStocks": return searchStocks({ element: args.element as "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ" | undefined, keyword: args.keyword as string | undefined, market: args.market as string | undefined, limit: args.limit as number | undefined });
    case "generateReport": return generateReport(String(args.ticker ?? ""), state);
    case "getTodayAlmanac": return getTodayAlmanac({ date: args.date as string | undefined });
    case "getFortuneInvest": return getFortuneInvest({ scope: args.scope as "day" | "week" | "month" | undefined, asset: args.asset as "stocks" | "land" | "ipo" | undefined, date: args.date as string | undefined, year: args.year as number | undefined, month: args.month as number | undefined }, state);
    default: return { ok: false, data: null, error: `tool ไม่รู้จัก: ${name}`, disclaimer: DISCLAIMER };
  }
}

export const SYSTEM_PROMPT = `คุณคือ "ผู้ช่วยการลงทุนคู่ดวง" — นักวิเคราะห์การเงิน + โหราศาสตร์จีน (八字) สำหรับคนไทย
กฎเหล็ก:
1. ตอบเป็นภาษาไทย อ่านง่าย กระชับ (3-6 บรรทัด) ใช้ emoji พอประมาณ
2. ต้องเรียก tools เพื่อเอาข้อมูลจริงเสมอ — ห้ามเดา/มโนตัวเลข ราคา verdict
3. ทุกคำตอบลงท้ายด้วย: ${COMPLIANCE_NOTE}
4. ถ้าผู้ใช้ขอ "คำแนะนำ" (ควรซื้อ/ซื้อเลย/แนะนำหน่อย/ช่วยตัดสินใจ) → ตอบเฉพาะ: "${COMPLIANCE_NOTE} — เราให้บทวิเคราะห์อ้างอิงจากดวง/ตลาด/ข่าว/แนวโน้ม ไม่แนะนำให้ลงทุนตาม" แล้วเสนอวิเคราะห์เชิงข้อมูลแทน (เช่น verdict/พื้นฐาน/ดวงรายวัน) โดยไม่บอกซื้อ/ขาย
5. ถ้า tool คืน ok:false ให้บอกว่า "ยังไม่มีข้อมูล" ตรงๆ อย่าเติมเอง`;

function parseToolCalls(msg: { tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }): ToolCall[] {
  return (msg.tool_calls ?? []).map((tc) => ({
    id: tc.id ?? `call_${Math.random().toString(36).slice(2, 8)}`,
    name: tc.function?.name ?? "",
    args: tc.function?.arguments ?? "{}",
  }));
}

async function callLLM(
  messages: ChatMessage[],
  tools: boolean,
): Promise<{ content: string | null; toolCalls: ToolCall[] }> {
  const key = ENV.LLM_API_KEY;
  if (!key) throw new Error("LLM_API_KEY ไม่มี — ใส่ใน .env (ดู .env.example)");
  const base = ENV.LLM_BASE_URL ?? "https://api.nousresearch.com/v1";
  const model = ENV.LLM_MODEL ?? "deepseek/deepseek-v4-flash-0731";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      tools: tools ? TOOL_DEFS as unknown as Record<string, unknown>[] : undefined,
      tool_choice: tools ? "auto" : undefined,
      temperature: 0.3,
      max_tokens: 800,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown } }>;
  };
  const msg = json.choices?.[0]?.message;
  if (!msg) throw new Error("LLM ตอบไม่มี choices");
  return {
    content: msg.content ?? null,
    toolCalls: parseToolCalls(msg as { tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> }),
  };
}

export type AssistantOptions = {
  /** ส่ง key ตรงๆ (เทสต์/CLI) — ถ้าไม่ส่ง อ่านจาก .env */
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  maxToolRounds?: number;
};

/**
 * แชทกับ LLM (tool calling loop) — fallback ไป template ถ้า LLM พัง
 * คืน { text, usedLlm, rounds, error? }
 */
export async function chatWithAssistant(
  userText: string,
  state: CalculatedStateValue,
  opts: AssistantOptions = {},
  history: ChatMessage[] = [],
): Promise<{ text: string; usedLlm: boolean; rounds: number; error?: string }> {
  if (opts.apiKey) ENV.LLM_API_KEY = opts.apiKey;
  if (opts.baseUrl) ENV.LLM_BASE_URL = opts.baseUrl;
  if (opts.model) ENV.LLM_MODEL = opts.model;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userText },
  ];
  const maxRounds = opts.maxToolRounds ?? 3;

  try {
    let rounds = 0;
    for (;;) {
      const { content, toolCalls } = await callLLM(messages, true);
      if (toolCalls.length === 0) {
        return { text: content ?? "(ว่าง)", usedLlm: true, rounds };
      }
      rounds++;
      if (rounds > maxRounds) return { text: content ?? "ขออภัย ยังสรุปไม่ได้", usedLlm: true, rounds };
      // assistant message ต้องมี tool_calls array (OpenAI format) — กัน provider reject
      messages.push({
        role: "assistant",
        content: null,
        tool_calls: toolCalls.map((tc) => ({ id: tc.id, type: "function" as const, function: { name: tc.name, arguments: tc.args } })),
      });
      for (const tc of toolCalls) {
        let result: unknown;
        try {
          result = runTool(tc.name, JSON.parse(tc.args || "{}"), state);
        } catch (e) {
          result = { ok: false, data: null, error: String(e) };
        }
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
  } catch (e) {
    // graceful degradation → template จาก tools (ไม่ตาย)
    const fallback = fallbackAnswer(userText, state);
    return { text: fallback.text, usedLlm: false, rounds: 0, error: (e as Error).message };
  }
}

/** ตอบ template จาก tools (LLM ล่ม/ไม่มี key) */
export function fallbackAnswer(userText: string, state: CalculatedStateValue): { text: string; intent: string } {
  const intent = detectIntent(userText);
  const fmt = (n: number | undefined, d = 2) => (typeof n === "number" ? n.toFixed(d) : "-");
  switch (intent.intent) {
    case "today_movers": {
      const r = getTodayMovers({ market: intent.market, limit: 5 });
      return { text: r.ok && r.data?.length ? `📈 หุ้นเด่นวันนี้:\n${r.data.map((m, i) => `${i + 1}. ${m.ticker} (${m.name}) ${(m.changePct ?? 0) >= 0 ? "+" : ""}${m.changePct ?? 0}% · ธาตุ${m.element}`).join("\n")}\n${DISCLAIMER}` : `ยังไม่มีข้อมูลราคาวันนี้ ${DISCLAIMER}`, intent: intent.intent };
    }
    case "upcoming_ipo": {
      const r = getUpcomingIPOs({ market: intent.market, limit: 5 });
      return { text: r.ok && r.data?.length ? `🚀 IPO กำลังจะเข้าเทรด:\n${r.data!.map((e, i) => `${i + 1}. ${e.ticker} ${e.name} — ${e.ipoDate} (${e.exchange})`).join("\n")}\n${DISCLAIMER}` : `ยังไม่มี IPO ใหม่ ${DISCLAIMER}`, intent: intent.intent };
    }
    case "stock_verdict": {
      if (!intent.ticker) return { text: `อยากรู้หุ้นตัวไหนคะ? ${DISCLAIMER}`, intent: intent.intent };
      const r = getBaziVerdict(intent.ticker, state);
      if (!r.ok || !r.data) return { text: r.error ?? "ไม่พบข้อมูล", intent: intent.intent };
      const d = r.data as { stock: { name: string; element: string }; score: { verdict: string; score: number }; invest: string[]; avoid: string[] };
      return { text: `${d.stock.name} (ธาตุ${d.stock.element}) กับดวงคุณ: ${d.score.verdict} (คะแนน ${d.score.score}) — ต้องการ ${d.invest.join(", ")} · เลี่ยง ${d.avoid.join(", ")}\n${DISCLAIMER}`, intent: intent.intent };
    }
    case "stock_analysis": {
      if (!intent.ticker) return { text: `อยากให้วิเคราะห์หุ้นตัวไหนคะ? ${DISCLAIMER}`, intent: intent.intent };
      const r = getFundamentals(intent.ticker);
      if (!r.ok || !r.data || !r.data.hasData) return { text: `ยังไม่มีข้อมูลพื้นฐานของ ${intent.ticker} ${DISCLAIMER}`, intent: intent.intent };
      const f = r.data.fundamentals!;
      return { text: `📊 ${intent.ticker}: ROE ${fmt(f.roe)}% · กำไรสุทธิ ${fmt(f.profitMargin)}% · โต ${fmt(f.revenueGrowth)}% · Buffett ${r.data.buffettScore}/10\n${DISCLAIMER}`, intent: intent.intent };
    }
    case "news_impact": {
      const r = getNewsImpact({ query: intent.matched[0], market: intent.market, limit: 3 });
      return { text: r.ok && r.data?.length ? `📰 ข่าวที่เกี่ยวข้อง:\n${r.data.map((n, i) => `${i + 1}. [${n.source}] ${n.title}`).join("\n")}\n${DISCLAIMER}` : `ยังไม่มีข่าวที่เกี่ยวข้อง ${DISCLAIMER}`, intent: intent.intent };
    }
    case "daily_fortune": {
      const r = getTodayAlmanac();
      if (!r.ok || !r.data) return { text: `ยังไม่มีข้อมูลปฏิทินวันนี้ ${COMPLIANCE_NOTE}`, intent: intent.intent };
      const d = r.data as { weekday: string; colors: Array<{ element: string; colors: string }>; luckyHours: Array<{ code: string; range: string }>; luckyDirection: string; jianchu: { name: string; meaning: string } | null };
      const colors = d.colors.map((c) => `${c.element}→${c.colors}`).join(" · ");
      const hours = d.luckyHours.slice(0, 3).map((h) => `${h.range}`).join(", ");
      return { text: `🗓️ วัน${d.weekday}${d.jianchu ? ` (${d.jianchu.name} — ${d.jianchu.meaning})` : ""}\n🎨 สีมงคล: ${colors}\n🧭 ทิศมงคล: ${d.luckyDirection}\n⏰ ยามดี: ${hours}\n${COMPLIANCE_NOTE}`, intent: intent.intent };
    }
    case "fortune_invest": {
      const lower = intent.matched.join(" ");
      const scope = lower.includes("เดือน") ? "month" : lower.includes("สัปดาห์") ? "week" : "day";
      const asset = lower.includes("ที่ดิน") ? "land" : scope === "week" ? "ipo" : undefined;
      const r = getFortuneInvest({ scope, asset }, state);
      if (!r.ok || !r.data) return { text: `ยังไม่มีข้อมูล ${COMPLIANCE_NOTE}`, intent: intent.intent };
      const d = r.data as { scope: string; dayElement?: string; favorElements?: string[]; stocks?: Array<{ ticker: string; changePct: number | null }>; monthElement?: string; caishenDir?: string; goodDays?: Array<{ date: string; weekday: string }>; luckyLandDays?: Array<{ date: string; weekday: string }>; ipo?: { entries: Array<{ ticker: string; name: string; fit: string }> } };
      if (d.scope === "month") {
        const days = (d.luckyLandDays ?? d.goodDays ?? []).slice(0, 4).map((x) => `${x.date} (${x.weekday})`).join(", ");
        return { text: `🗓️ เดือนนี้ ธาตุเดือน: ${d.monthElement} · ทิศเงินเข้า: ${d.caishenDir}\n📅 วันดี: ${days || "ไม่มีข้อมูล"}\n${COMPLIANCE_NOTE}`, intent: intent.intent };
      }
      if (d.scope === "week") {
        const list = (d.ipo?.entries ?? []).slice(0, 4).map((e) => `${e.ticker} ${e.name} — ${e.fit}`).join("\n");
        return { text: `🚀 IPO สัปดาห์นี้ (เทียบดวง):\n${list || "ไม่มี IPO ในช่วงนี้"}\n${COMPLIANCE_NOTE}`, intent: intent.intent };
      }
      const stocks = (d.stocks ?? []).slice(0, 4).map((s) => `${s.ticker} (${s.changePct ?? 0}%)`).join(", ");
      return { text: `🔮 วันนี้ธาตุ: ${d.dayElement} · ธาตุควรทำ: ${(d.favorElements ?? []).join(", ")}\n📈 หุ้นที่ตรงธาตุวันนี้: ${stocks || "ไม่มีข้อมูล"}\n${COMPLIANCE_NOTE}`, intent: intent.intent };
    }
    case "advice_request":
      return { text: `${COMPLIANCE_NOTE} — เราให้บทวิเคราะห์อ้างอิงจากดวง/ตลาด/ข่าว/แนวโน้ม ไม่แนะนำให้ลงทุนตาม ลองถามเป็นข้อมูลได้ เช่น "วันนี้ดวงกับหุ้นอะไร" หรือ "วิเคราะห์ KBANK"`, intent: intent.intent };
    default:
      return { text: `🙏 ลองถามได้เลย: "หุ้นวันนี้ตัวไหนเด่น" / "วิเคราะห์ KBANK" / "KBANK กับดวงเรา" / "ข่าวทรัมป์" / "มี IPO ไหม"\n${DISCLAIMER}`, intent: intent.intent };
  }
}
