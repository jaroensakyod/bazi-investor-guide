/**
 * Narrative engine v6 — 6 ภาคใหญ่ (แบบหนังสืออ่านต่อเนื่อง) + อธิบายรายคำแนะนำ
 * แต่ละภาค: { intro, body (400-600 คำ), picks: {ticker: อธิบายรายตัว 2-4 ประโยค}, summary }
 * 6 calls (1 ต่อภาค) — cache ต่อภาค
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
const CACHE_DIR = path.join(ROOT, "data/cache/narratives-v6");
const VERSION = "v6-parts";

export type PartNarrative = {
  intro: string;
  body: string;
  picks: Record<string, string>;
  summary: string;
};
export type BookNarrative = Partial<Record<"1" | "2" | "3" | "4" | "5" | "6", PartNarrative>>;

function cachePath(part: number, dataJson: string): string {
  const hash = createHash("sha1").update(`${VERSION}:${part}:${dataJson}`).digest("hex").slice(0, 16);
  return path.join(CACHE_DIR, `${part}-${hash}.json`);
}

/** ข้อมูลเฉพาะภาค (ตัดให้สั้น — LLM ต้องการเฉพาะที่เกี่ยวข้อง) */
function partData(state: CalculatedStateValue, part: number): string {
  const d = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 10, "premium");
  const usPicks = buildMonthlyPicks(state, "US", 8, "premium");
  const base = {
    persona: `${d.persona.name} (${d.persona.bandLabel}) — ${d.persona.style}`,
    principle: `${d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล"} · ${d.principle.mode} · เสริม ${d.principle.supplementElement}`,
    excess: d.principle.excessElement ? `ธาตุเกิน: ${d.principle.excessElement} (${d.principle.excessCount} ตัว)` : "",
    wealth: `ธาตุลาภ: ${d.strengthen.wealth}`,
    avoid: `ธาตุพิฆาต: ${d.avoid.join("/")}`,
    split: `เงิน เย็น ${d.trading.split.cold}% / เร็ว ${d.trading.split.fast}% / ฉุกเฉิน ${d.trading.split.emergency}%`,
  };
  const balance = d.elementBalance.map((e) => `${e.element} ${e.pct}%`).join(", ");
  switch (part) {
    case 1: // มุมมองดวง
      return JSON.stringify({ ...base, balance, tradingLabel: d.trading.label, tradingReason: d.trading.reason, topStocks: thPicks.picks.slice(0, 5).map((p) => `${p.ticker} (${p.element}, เทียร์ ${p.stockTier}, คะแนน ${p.score})`) });
    case 2: // จัดสรรเงิน
      return JSON.stringify({ ...base, instruments: d.instruments, tradingAllowed: d.trading.allowed });
    case 3: // พอร์ตเด่น
      return JSON.stringify({
        ...base,
        thPicks: thPicks.picks.map((p) => ({ ticker: p.ticker, element: p.element, tier: p.stockTier, score: p.score, reasons: p.reasons })),
        usPicks: usPicks.picks.slice(0, 5).map((p) => ({ ticker: p.ticker, element: p.element, tier: p.stockTier, score: p.score })),
        benchmark: thPicks.benchmark.changePct,
      });
    case 4: // สินค้าแนะนำ
      return JSON.stringify({
        ...base,
        categories: d.categories.map((c) => ({ label: c.label, items: c.items.slice(0, 3).map((it) => `${it.ticker} — ${it.name} (ธาตุ${it.element}, ${it.fit})`) })),
      });
    case 5: // แผนที่ชีวิต
      return JSON.stringify({ ...base, timeline: d.timeline.map((t) => `${t.ageRange} ปี: ${t.verdict} — ${t.advice}`) });
    case 6: // ฉบับเดือนนี้
      return JSON.stringify({
        ...base,
        monthAdvice: d.monthAdvice,
        goodDays: d.auspiciousDays.month.goodDayCount,
        avoidDays: d.auspiciousDays.month.avoidDayCount,
        goodDayDates: d.auspiciousDays.month.goodDays.slice(0, 8).map((g) => g.date),
        avoidDayDates: d.auspiciousDays.month.avoidDays.slice(0, 8).map((g) => g.date),
        monthPicks: thPicks.picks.slice(0, 5).map((p) => `${p.ticker} (${p.element}, ${p.stockTier})`),
      });
    default:
      return "";
  }
}

const WRITER = `คุณคือ "อาจารย์หมิง" นักเขียนคอลัมน์การเงินส่วนบุคคล ผู้เชี่ยวชาญการลงทุนตามดวง 60 กะจื่อ กำลังเขียนหนังสือ "การลงทุนคู่ดวง ฉบับส่วนบุคคล"
น้ำเสียง: อบอุ่น เป็นกันเอง แต่ลึกซึ้ง เหมือนคนนั่งอธิบายให้ฟังหลังกาแฟ · ภาษาไทยสละสลวย อ่านลื่นต่อเนื่อง ไม่ใช่ bullet
ใช้ "คุณ" · ยกตัวอย่างสมมติใกล้ตัว (เงิน 1 ล้านบาท ฯลฯ) · อธิบายให้คนไม่รู้เรื่องดวงเข้าใจได้
ห้าม: "ตามข้อมูลที่ให้มา" · ข้อมูลนอกเหนือจากที่ให้ · ใส่ตัวเลขที่ไม่ได้มาจากข้อมูล`;

const PART_TITLES: Record<number, string> = {
  1: "มุมมองดวง — กำลังดิถี ธาตุในดวง และความหมายต่อการเงินของคุณ",
  2: "การจัดสรรเงิน — 70:10:20 และเครื่องมือของแต่ละกอง",
  3: "พอร์ตเด่น — หุ้นที่ตรงดวงที่สุดจาก 5,958 บริษัท (พร้อมเหตุผลรายตัว)",
  4: "สินค้าแนะนำ — สินทรัพย์/หมวดลงทุนที่ควรถือ (พร้อมเหตุผลรายตัว)",
  5: "แผนที่ชีวิต — วัยจร 0-80+ ปี: ลงทุนเมื่อไหร่ ระวังเมื่อไหร่",
  6: "ฉบับเดือนนี้ — ธาตุเดือน ปฏิทินมงคล และแผนปฏิบัติรายเดือน",
};

function buildPrompt(part: number, data: string): string {
  const pickInstructions = part === 3 || part === 4
    ? `4. สำหรับคำแนะนำรายตัว (picks): เขียนอธิบาย **ทุกตัว** ตัวละ 2-4 ประโยค ว่า
   - ธุรกิจนี้คืออะไร (บอกชื่อจริงจากข้อมูล)
   - ทำไมตรง/ไม่ตรงกับดวง (ธาตุอะไร กับธาตุที่ต้องเสริม/เลี่ยงของผู้อ่าน)
   - ควรใช้ยังไง (กองไหน วิธีซื้อ DCA/ก้อน ขนาดสัดส่วน)
   - ระวังอะไร (ความเสี่ยงเฉพาะตัว)`
    : `4. picks: ใส่ {} (ไม่ต้องมีสำหรับภาคนี้)`;
  return `${WRITER}

ข้อมูลผู้อ่าน (คำนวณจากดวงจริง — ห้ามเปลี่ยน/เพิ่ม):
${data}

--- ภารกิจ: เขียน "ภาคที่ ${part}: ${PART_TITLES[part]}" ---
เขียนเนื้อหาภาคนี้ (ภาษาไทย อ่านลื่นต่อเนื่อง เหมือนบทในหนังสือจริง):
1. intro: เกริ่นนำ 2-3 ประโยค (ทำไมต้องอ่านภาคนี้ — เฉพาะเจาะจง)
2. body: เนื้อหาหลัก 400-600 คำ (อธิบายหลักการ + ตัวอย่างใกล้ตัว + ข้อมูลดวงจริงของผู้อ่าน + อ่านต่อเนื่อง ไม่ใช่ bullet)
3. summary: "สิ่งที่คุณต้องทำจากภาคนี้" 2-3 ประโยค (actionable ชัดเจน)
${pickInstructions}

ตอบเป็น JSON เท่านั้น (ไม่มีข้อความอื่น):
{"intro":"...","body":"...","summary":"...","picks":{"TICKER":"คำอธิบายรายตัว...","TICKER2":"..."}}`;
}

export async function generatePartNarrative(state: CalculatedStateValue, part: number, opts?: { timeoutMs?: number }): Promise<PartNarrative | null> {
  const data = partData(state, part);
  const file = cachePath(part, data);
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf8")) as PartNarrative;
    } catch { /* ignore */ }
  }
  let raw = "";
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      raw = await chatComplete([{ role: "system", content: WRITER }, { role: "user", content: buildPrompt(part, data) }], { maxTokens: 8000, temperature: 0.7, timeoutMs: opts?.timeoutMs ?? 180000 });
      break;
    } catch (e) {
      lastErr = e as Error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 5000 * attempt));
    }
  }
  if (!raw) throw lastErr ?? new Error(`ภาค ${part}: LLM ล่ม`);
  const parsed = extractJson(raw) as PartNarrative;
  if (!parsed.body || parsed.body.length < 150) throw new Error(`ภาค ${part}: เนื้อหาไม่ครบ`);
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(file, JSON.stringify(parsed, null, 2), "utf8");
  } catch { /* ignore */ }
  return parsed;
}

/** identity ของ cache ต้องผูกกับดวงและข้อมูลที่ใช้จริงเสมอ */
export function bookNarrativeCacheIdentity(state: CalculatedStateValue, part: number): string {
  return path.basename(cachePath(part, partData(state, part)));
}

/** อ่านจาก cache ของเจ้าของรายงานนี้เท่านั้น (ไม่ gen) — ห้ามอ่านไฟล์ล่าสุดแบบ global */
export function readBookNarrativeFromCache(state: CalculatedStateValue): BookNarrative {
  const out: BookNarrative = {};
  for (const partNumber of [1, 2, 3, 4, 5, 6]) {
    const part = String(partNumber) as keyof BookNarrative;
    const file = cachePath(partNumber, partData(state, partNumber));
    if (!existsSync(file)) continue;
    try {
      const cached = JSON.parse(readFileSync(file, "utf8")) as PartNarrative;
      if (cached.body && cached.body.length > 100) out[part] = cached;
    } catch { /* cache เสียหรือ schema เก่า — ข้ามโดยไม่ปะปนกับผู้ใช้อื่น */ }
  }
  return out;
}

export async function generateBookNarrative(state: CalculatedStateValue, opts?: { timeoutMs?: number }): Promise<BookNarrative> {
  const parts = [1, 2, 3, 4, 5, 6];
  const results = await Promise.all(parts.map((p) => generatePartNarrative(state, p, opts).catch(() => null)));
  const out: BookNarrative = {};
  for (let i = 0; i < parts.length; i++) {
    if (results[i]) out[String(parts[i]) as keyof BookNarrative] = results[i]!;
  }
  return out;
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("ไม่ใช่ JSON");
  return JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown>;
}
