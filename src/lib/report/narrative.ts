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

/** version ของ prompt — เปลี่ยนเมื่อแก้ prompt → cache เก่าถูกข้าม */
const PROMPT_VERSION = "v4-split";

export function narrativeCachePath(dataJson: string): string {
  const hash = createHash("sha1").update(`${PROMPT_VERSION}:${dataJson}`).digest("hex").slice(0, 16);
  return path.join(NARR_DIR, `${hash}.json`);
}

/** cache เก่า (ไม่มี version — รอบแรก) — ใช้เป็น fallback ถ้า LLM ล่ม */
function legacyCachePath(dataJson: string): string {
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

  // แยก 2 calls (บท 1-3 / บท 4-6+summary) — prompt สั้นลง → provider 503/content-null น้อยลง
  const buildPrompt = (which: "A" | "B") => {
    const head = `คุณคือนักวิเคราะห์การเงินระดับสถาบัน เขียนรายงาน "การลงทุนคู่ดวง" ฉบับเดือน (ภาษาไทย มืออาชีพ อ่านง่าย ฟังดูเป็นมนุษย์ ไม่ใช่หุ่นยนต์)

ข้อมูลจริงที่คำนวณแล้ว (deterministic จากตำรา 60 กะจื่อ + ตลาดจริง) — ห้ามเปลี่ยน/ตัดสินใหม่ ใช้ตามนี้เท่านั้น:
${dataJson}

เขียน ${which === "A" ? "3 หัวข้อ" : "4 หัวข้อ"} **แต่ละหัวข้อ 5-7 ประโยค** (ละเอียด เข้าใจลึก):
- "ทำไม" (เหตุผลจากดวง/ข้อมูลนี้) · "เพื่ออะไร" (ใช้ทำอะไร) · "ดี-ไม่ดี" (ข้อดี/ข้อควรระวัง เจาะตัวเลขจริง) · "แล้วยังไง" (ขั้นตอนถัดไปที่ทำได้ทันที)
`;
    if (which === "A") {
      return head + `1. มุมมองดวง: กำลังดิถีหมายความว่าอย่างไรสำหรับการลงทุน — อธิบาย 身弱财旺 (ถ้ามี) ให้เข้าใจว่าทำไมห้ามไล่ลาภ
2. การจัดสรรเงิน: ทำไมต้องสัดส่วนนี้ เจาะแต่ละกอง (เย็น/เร็ว/ฉุกเฉิน) ว่าควรดูแลยังไง วงเงินเท่าไหร่
3. พอร์ตเด่น: อธิบายหุ้นกลุ่ม VIP/PRO ว่าแต่ละตัวธุรกิจอะไร ทำไมตรงดวง ควรเข้าอย่างไร (DCA/ก้อน) ระวังอะไร

ตอบเป็น JSON เท่านั้น: {"1":"...","2":"...","3":"..."}`;
    }
    return head + `4. สินค้าแนะนำ: อธิบาย ตรงดวง/ดูดพลัง/ขัดดวง ให้ชัด + ยกตัวอย่างสินค้าจริงจากข้อมูล + ควรปรับพอร์ตยังไง
5. แผนที่ชีวิต: อธิบายช่วงวัยสำคัญ (ช่วงทอง/ช่วงต้องระวัง) เจาะ 3-4 ช่วงที่สำคัญสุดของคนนี้ ว่าควรเตรียมตัวยังไง
6. วันมงคล: อธิบายวิธีใช้จริง (ซื้อก้อน/ขาย/เซ็นสัญญา) + ธาตุเดือนนี้หนุนหรือขัด ควรปรับน้ำหนักพอร์ตยังไง
summary: สรุป 3-4 ประโยค ว่าเจ้าของดวงนี้ควรทำอะไร 3 อันดับแรก (เฉพาะเจาะจง ไม่ใช่คำแนะนำทั่วๆ ไป)

ตอบเป็น JSON เท่านั้น: {"4":"...","5":"...","6":"...","summary":"..."}`;
  };
  const callOnce = async (which: "A" | "B"): Promise<Record<string, string>> => {
    let lastErr: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const raw = await chatComplete([{ role: "system", content: "คุณเขียนภาษาไทย มืออาชีพ อ่านง่าย ตอบ JSON เท่านั้น" }, { role: "user", content: buildPrompt(which) }], { maxTokens: 5000, temperature: 0.5, timeoutMs: opts?.timeoutMs ?? 150000 });
        return extractJson(raw);
      } catch (e) {
        lastErr = e as Error;
        if (attempt < 3) await new Promise((r) => setTimeout(r, 4000 * attempt));
      }
    }
    throw lastErr ?? new Error("narrative call failed");
  };
  let narrative: Narrative;
  try {
    const [partA, partB] = await Promise.all([callOnce("A"), callOnce("B")]);
    narrative = { ...partA, ...partB } as Narrative;
  } catch {
    // LLM ล่ม → ลอง cache เก่า (v1/v2 — ยังมีประโยชน์กว่า fallback เปล่า)
    const legacy = legacyCachePath(dataJson);
    if (existsSync(legacy)) {
      try {
        return JSON.parse(readFileSync(legacy, "utf8")) as Narrative;
      } catch {
        /* ignore */
      }
    }
    throw new Error("narrative generation failed (LLM down)");
  }

  try {
    mkdirSync(NARR_DIR, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(narrative, null, 2), "utf8");
  } catch {
    /* cache ล้มเหลวไม่เป็นไร */
  }
  return narrative;
}
