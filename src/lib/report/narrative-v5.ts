/**
 * Narrative engine v5 — หนังสือขาย 25 บท Unique (ไม่ใช่แยกย่อย)
 * Gen แบบ batch: 6 ภาค → 6 LLM calls → JSON {บท: เนื้อหา}
 * โทน: อบอุ่น เป็นกันเอง ลึกซึ้ง · ภาษาไทยสละสลวย · ใช้ "คุณ"
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
const NARR_DIR = path.join(ROOT, "data/cache/narratives-v5");

export type ChapterNarrative = Record<string, string>; // "1" → เนื้อหา, ...

function chapterCachePath(n: string, dataJson: string): string {
  const hash = createHash("sha1").update(`v5-book:${n}:${dataJson}`).digest("hex").slice(0, 16);
  return path.join(NARR_DIR, `${n}-${hash}.json`);
}

/** ข้อมูลย่อสำหรับ prompt (ทุกบทใช้ร่วม — เฉพาะส่วนที่เกี่ยวข้อง) */
function coreData(state: CalculatedStateValue, picks: ReturnType<typeof buildMonthlyPicks>): Record<string, unknown> {
  const d = buildPersonalDashboard(state);
  return {
    persona: { name: d.persona.name, emoji: d.persona.emoji, bandLabel: d.persona.bandLabel, style: d.persona.style, strengths: d.persona.strengths, weaknesses: d.persona.weaknesses },
    trading: { label: d.trading.label, split: d.trading.split, reason: d.trading.reason },
    principle: { band: d.principle.band, mode: d.principle.mode, desc: d.principle.desc, supplementElement: d.principle.supplementElement, outputElement: d.principle.outputElement, excessElement: d.principle.excessElement, excessCount: d.principle.excessCount, excessNote: d.principle.excessNote },
    strengthen: { element: d.strengthen.element, businessHint: d.strengthen.businessHint, wealth: d.strengthen.wealth },
    avoid: d.avoid,
    elementBalance: d.elementBalance,
    instruments: d.instruments,
    monthAdvice: { element: d.monthAdvice.element, fit: d.monthAdvice.fit, text: d.monthAdvice.text },
    goodDays: d.auspiciousDays.month.goodDayCount,
    avoidDays: d.auspiciousDays.month.avoidDayCount,
    goodDayDates: d.auspiciousDays.month.goodDays.slice(0, 5).map((g) => g.date),
    avoidDayDates: d.auspiciousDays.month.avoidDays.slice(0, 5).map((g) => g.date),
    timeline: d.timeline.map((t) => `${t.ageRange}:${t.verdict} — ${t.advice}`),
    topPicks: picks.picks.slice(0, 6).map((p) => `${p.ticker} (${p.element}, ${p.stockTier}, score ${p.score})`),
    categories: d.categories.slice(0, 5).map((c) => ({ label: c.label, items: c.items.slice(0, 3).map((it) => `${it.ticker} (${it.element}, ${it.fit})`) })),
  };
}

/** SYSTEM prompt: persona นักเขียน */
const BOOK_WRITER = `คุณคือ "อาจารย์หมิง" นักเขียนคอลัมน์การเงินส่วนบุคคล ผู้เชี่ยวชาญการลงทุนตามดวง 60 กะจื่อ เขียนหนังสือ "การลงทุนคู่ดวง ฉบับส่วนบุคคล"
น้ำเสียง: อบอุ่น เป็นกันเอง แต่ลึกซึ้ง (เหมือนมีคนนั่งอธิบายให้ฟังหลังกาแฟ) · ภาษาไทยสละสลวย อ่านแล้วรู้สึก "คนเขียนเก่งและใส่ใจ"
ใช้คำว่า "คุณ" แทนผู้อ่าน · ยกตัวอย่างจากชีวิตจริง · อธิบายให้คนไม่รู้เรื่องดวงเข้าใจได้
ห้าม: ใช้ภาษาหุ่นยนต์ ("ตามข้อมูลที่ให้มา...") · เขียน bullet point แห้งๆ · ใส่ข้อมูลที่ไม่ได้คำนวณจากดวงจริง`;

const buildBatchPrompt = (part: number, coreStr: string): string => {
  const CHAPTERS: Record<number, string[]> = {
    1: [
      // ภาค 1: ดีเอ็นเอการเงิน (บท 1-5)
      "บทที่ 1: ธาตุลาภ — เงินของคุณมาจากไหน ในเมื่อเกิดมาไม่เท่ากัน",
      "บทที่ 2: กำลังดิถี — ทำไมบางคนรวยไว บางคนต้องค่อยเป็นค่อยไป",
      "บทที่ 3: คลังทรัพย์ — ทรัพย์สินแบบไหนที่ดวงของคุณ 'อุ้ม'",
      "บทที่ 4: จิตวิทยาเงิน — กับดักการเงินที่ซ่อนอยู่ในวันเกิดของคุณ",
      "บทที่ 5: การ์ดตัวตนนักลงทุน — คุณคือใครในโลกการลงทุน (สรุปภาพใหญ่)",
    ],
    2: [
      // ภาค 2: ลงทุนอะไร (บท 6-10)
      "บทที่ 6: เซกเตอร์/หุ้นที่ใช่ — จาก 5,958 บริษัท มีกี่ตัวที่ 'เกิดมาเพื่อคุณ'",
      "บทที่ 7: สินทรัพย์คู่ดวง — อสังหา ทองคำ เงินฝาก คริปโต ... อะไรกันแน่ที่ควรเก็บ",
      "บทที่ 8: ตลาดโลกที่ใช่ — 27 ประเทศ ตลาดไหนทิศทางเดียวกับดวงคุณ",
      "บทที่ 9: สิ่งต้องห้าม — กับดักที่คุณต้องเลี่ยง (แม้คนอื่นจะรวยจากมัน)",
      "บทที่ 10: เช็กลิสต์ศักดิ์สิทธิ์ — 30 ข้อที่ต้องผ่านก่อนกดซื้อ",
    ],
    3: [
      // ภาค 3: ลงทุนยังไง (บท 11-15)
      "บทที่ 11: สไตล์การลงทุนที่เกิดมาเพื่อคุณ — เทรดสั้น ถือยาว หรืออยู่เฉยๆ",
      "บทที่ 12: แบ่งเงินยังไงให้ดวงไม่พัง — ศาสตร์ 70:10:20 กับการเงินที่ยั่งยืน",
      "บทที่ 13: สร้างพอร์ตตามธาตุ — โดนัท 5 สี กับสมดุลที่ใช่",
      "บทที่ 14: DCA — ทยอยซื้อตามจังหวะดวง (ไม่ใช่ตามอารมณ์)",
      "บทที่ 15: ฟอเร็กซ์ คริปโต ของเสี่ยง — เล่นได้แค่ไหน ไม่ให้ดวงพัง",
    ],
    4: [
      // ภาค 4: ลงทุนเมื่อไหร่ (บท 16-20)
      "บทที่ 16: วัยจร 0-20 — สร้างนิสัยการเงินก่อนทุกอย่าง",
      "บทที่ 17: วัยจร 20-40 — ช่วงสะสมฐาน (ที่หลายคนพลาดเพราะใจร้อน)",
      "บทที่ 18: วัยจร 40-60 — จังหวะทองของชีวิต (รู้แล้วจะไม่พลาด)",
      "บทที่ 19: วัยจร 60-80 — รักษา resources ไว้ให้ถึงที่สุด",
      "บทที่ 20: Life Map — แผนที่ชีวิตทั้ง 80 ปี ในหน้าเดียว",
    ],
    5: [
      // ภาค 5: ป้องกัน (บท 21-23)
      "บทที่ 21: ผั่วไฉ่โข่ว — วันที่เงินรั่วไหล (รู้แล้วกันได้)",
      "บทที่ 22: คลังแตก — ช่วงที่ต้อง 'อยู่เฉยๆ' เพื่อรักษาเงินก้อน",
      "บทที่ 23: กฎเหล็ก 5 ข้อ — กติกาที่รักษาชีวิตการเงินของคุณ",
    ],
    6: [
      // ภาค 6: เสริม + สด (บท 24-26)
      "บทที่ 24: สี ทิศ เครื่องราง — อาวุธลับที่หลายคนมองข้าม",
      "บทที่ 25: เสริมตามวัย — วัยนี้ต้องพึ่งธาตุอะไรให้ดวงดี",
      "บทที่ 26: ฉบับเดือนนี้ — ของสดที่เปลี่ยนทุกเดือน (VIP เท่านั้น)",
    ],
  };

  const titles = CHAPTERS[part] ?? [];
  return `ข้อมูลผู้อ่าน (คำนวณจากดวงจริง — ห้ามเปลี่ยน):
${coreStr}

--- ภารกิจ ---
เขียน ${titles.length} บทความ แต่ละบทความ 300-450 คำ ภาษาไทยสละสลวย:
${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}

แต่ละบทความต้องมี:
1. เกริ่นนำ 1-2 ประโยค (ทำไมคุณต้องอ่านบทนี้ — เฉพาะเจาะจง ไม่ใช่ท่องจำ)
2. เนื้อหา (อธิบายหลักการ + ยกตัวอย่างสมมติที่ใกล้ตัว + ใส่ข้อมูลดวงจริงของผู้อ่าน)
3. "สิ่งที่คุณต้องทำจากบทนี้" 1-2 ประโยค (actionable)
4. บทความไม่ใช่ bullet — เป็น narrative ต่อเนื่อง อ่านเหมือนนั่งคุยกัน

ตอบเป็น JSON object เท่านั้น: {"1": "เนื้อหาบทความที่ 1", "2": "เนื้อหาบทความที่ 2", ...} — ใช้ key เป็นเลขบท (1-26)`;
};

async function genPart(part: number, state: CalculatedStateValue, opts?: { timeoutMs?: number }): Promise<ChapterNarrative> {
  const picks = buildMonthlyPicks(state, "TH", 5, "premium");
  const core = coreData(state, picks);
  const coreStr = JSON.stringify(core, null, 2);
  const dataJson = coreStr;

  // ตรวจ cache รายบทก่อน — ข้ามบทที่ cache แล้ว
  const result: ChapterNarrative = {};
  const titles = (() => {
    const m: Record<number, number[]> = { 1: [1, 2, 3, 4, 5], 2: [6, 7, 8, 9, 10], 3: [11, 12, 13, 14, 15], 4: [16, 17, 18, 19, 20], 5: [21, 22, 23], 6: [24, 25, 26] };
    return m[part] ?? [];
  })();
  let missing = false;
  for (const n of titles) {
    const f = chapterCachePath(String(n), dataJson);
    if (existsSync(f)) {
      try {
        const cached = JSON.parse(readFileSync(f, "utf8"));
        result[String(n)] = cached.text;
      } catch { /* ignore */ }
    } else {
      missing = true;
    }
  }
  if (!missing) return result;

  // LLM gen
  const prompt = buildBatchPrompt(part, coreStr);
  let raw = "";
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      raw = await chatComplete([{ role: "system", content: BOOK_WRITER }, { role: "user", content: prompt }], { maxTokens: 8000, temperature: 0.7, timeoutMs: opts?.timeoutMs ?? 180000 });
      break;
    } catch (e) {
      lastErr = e as Error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  if (!raw) throw lastErr ?? new Error(`ภาค ${part}: LLM ล่ม`);

  // parse JSON
  const parsed = extractJson(raw) as Record<string, string>;
  for (const [k, v] of Object.entries(parsed)) {
    if (v && v.length > 50) {
      result[k] = v;
      try {
        mkdirSync(NARR_DIR, { recursive: true });
        writeFileSync(chapterCachePath(k, dataJson), JSON.stringify({ text: v }), "utf8");
      } catch { /* ignore */ }
    }
  }
  return result;
}

function extractJson(text: string): Record<string, string> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("ไม่ใช่ JSON");
  return JSON.parse(raw.slice(start, end + 1));
}

/** 入口 — gen ทุกภาค (parallel) + merge */
export async function generateBookNarrative(state: CalculatedStateValue, opts?: { timeoutMs?: number }): Promise<ChapterNarrative> {
  const parts = [1, 2, 3, 4, 5, 6];
  const results = await Promise.all(parts.map((p) => genPart(p, state, opts).catch(() => ({} as ChapterNarrative))));
  const merged: ChapterNarrative = {};
  for (const r of results) {
    for (const [k, v] of Object.entries(r)) {
      if (v) merged[k] = v;
    }
  }
  return merged;
}
