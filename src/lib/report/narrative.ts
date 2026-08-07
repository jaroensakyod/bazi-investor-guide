/**
 * Narrative engine — LLM เขียนคำอธิบายรายงาน PDF (ภาษาไทย มืออาชีพ)
 * อธิบาย "ทำไม · เพื่ออะไร · ดี-ไม่ดี · แล้วยังไง" ต่อ section — จากข้อมูล deterministic เท่านั้น
 * (LLM ห้ามตัดสินธาตุ/verdict ใหม่ — ใช้ข้อมูลที่ให้เท่านั้น · cache ต่อเนื้อหาดวง)
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CalculatedStateValue } from "../bazi/schema-types";
import { chatComplete } from "../chat/assistant";
import { buildPersonalDashboard } from "../portfolio/personal-dashboard";
import { buildMonthlyPicks } from "../picks/monthly-picks";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const NARR_DIR = path.join(ROOT, "data/cache/narratives");

export type Narrative = Partial<Record<"1" | "2" | "3" | "4" | "5" | "6" | "summary", string>>;

export function narrativeCachePath(dataJson: string): string {
  const hash = createHash("sha1").update(dataJson).digest("hex").slice(0, 16);
  return path.join(NARR_DIR, `${hash}.json`);
}

function extractJson(text: string): Narrative {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("LLM ตอบไม่เป็น JSON");
  return JSON.parse(raw.slice(start, end + 1)) as Narrative;
}

/** สร้างคำอธิบาย 6 sections + สรุป — LLM (cache ตามเนื้อหาดวง → สร้างซ้ำเร็ว/ออฟไลน์ได้) */
export async function generateReportNarrative(state: CalculatedStateValue, opts?: { force?: boolean; timeoutMs?: number }): Promise<Narrative> {
  const d = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 5, "premium");
  const data = {
    persona: { name: d.persona.name, bandLabel: d.persona.bandLabel, style: d.persona.style },
    trading: { label: d.trading.label, split: d.trading.split },
    principle: { band: d.principle.band, mode: d.principle.mode, desc: d.principle.desc, supplementElement: d.principle.supplementElement, excessElement: d.principle.excessElement, excessCount: d.principle.excessCount },
    strengthen: { element: d.strengthen.element, businessHint: d.strengthen.businessHint, wealth: d.strengthen.wealth },
    avoid: d.avoid,
    monthAdvice: { element: d.monthAdvice.element, fit: d.monthAdvice.fit, text: d.monthAdvice.text },
    goodDays: d.auspiciousDays.month.goodDayCount,
    avoidDays: d.auspiciousDays.month.avoidDayCount,
    timeline: d.timeline.map((t) => `${t.ageRange}:${t.verdict}`),
    topPicks: thPicks.picks.slice(0, 5).map((p) => `${p.ticker}(${p.element},${p.stockTier})`),
  };
  const dataJson = JSON.stringify(data);

  const cacheFile = narrativeCachePath(dataJson);
  if (!opts?.force && existsSync(cacheFile)) {
    try {
      return JSON.parse(readFileSync(cacheFile, "utf8")) as Narrative;
    } catch {
      /* cache เสีย → สร้างใหม่ */
    }
  }

  const prompt = `คุณคือนักวิเคราะห์การเงินระดับสถาบัน เขียนคำอธิบายรายงาน "การลงทุนคู่ดวง" (ภาษาไทย มืออาชีพ อ่านง่าย ฟังดูเป็นมนุษย์ ไม่ใช่หุ่นยนต์)

ข้อมูลจริงที่คำนวณแล้ว (deterministic จากตำรา 60 กะจื่อ + ตลาดจริง) — ห้ามเปลี่ยน/ตัดสินใหม่ ใช้ตามนี้เท่านั้น:
${dataJson}

เขียน 7 ข้อ แต่ละข้อ 3-5 ประโยค อธิบายให้คนอ่านเข้าใจว่า:
- "ทำไม" (เหตุผลจากดวง/ข้อมูลนี้) · "เพื่ออะไร" (ใช้ทำอะไร) · "ดี-ไม่ดี" (ข้อดี/ข้อควรระวัง) · "แล้วยังไง" (ขั้นตอนถัดไปที่ควรทำ)

1. มุมมองดวง: กำลังดิถีหมายความว่าอย่างไรสำหรับการลงทุนของเจ้าของดวงนี้
2. การจัดสรรเงิน: ทำไมต้องสัดส่วนนี้ และแต่ละกองควรดูแลยังไง
3. พอร์ตเด่น: หุ้นที่คัดมา (เทียร์ VIP/PRO/FREE/INFO) หมายความว่าอะไร ควรใช้ยังไง ระวังอะไร
4. สินค้าแนะนำ: คำว่า ตรงดวง/ดูดพลัง/ขัดดวง หมายถึงอะไร และควรทำอะไรกับแต่ละกลุ่ม
5. แผนที่ชีวิต: อ่านยังไง ช่วงทองสำคัญตรงไหน จะใช้วางแผนการเงินยังไง
6. วันมงคล/ระวัง: ใช้ประโยชน์ยังไงในชีวิตจริง

ตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น): {"1":"...","2":"...","3":"...","4":"...","5":"...","6":"...","summary":"สรุป 2-3 ประโยคว่าเจ้าของดวงนี้ควรทำอะไรเป็นอันดับแรก"}`;

  // retry 3 รอบ (provider บางครั้ง 503/timeout) — สำเร็จรอบเดียว = cache ถาวรต่อดวง
  let raw = "";
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      raw = await chatComplete([{ role: "system", content: "คุณเขียนภาษาไทย มืออาชีพ อ่านง่าย ตอบ JSON เท่านั้น" }, { role: "user", content: prompt }], { maxTokens: 6000, temperature: 0.5, timeoutMs: opts?.timeoutMs ?? 150000 });
      break;
    } catch (e) {
      lastErr = e as Error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 4000 * attempt));
    }
  }
  if (!raw) throw lastErr ?? new Error("narrative generation failed");
  const narrative = extractJson(raw);

  try {
    mkdirSync(NARR_DIR, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(narrative, null, 2), "utf8");
  } catch {
    /* cache ล้มเหลวไม่เป็นไร */
  }
  return narrative;
}
