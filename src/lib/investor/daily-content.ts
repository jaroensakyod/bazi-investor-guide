/**
 * Daily Content Generator — "คอนเทนต์รายวัน" สำหรับช่องทางขาย (LINE group / TikTok / IG)
 *
 * แนวคิด: แต่ละวัน = วันจร (liu nian day) มีธาตุของวัน → เสนอหุ้น/กลุ่มที่ "ธาตุตรงกับวันนี้"
 * → คนดูได้ทั้งความบันเทิงสายมู + หุ้น ในโพสต์เดียว → เก็บรายละเอียดครบ (schema ใหญ่)
 *
 * deterministic 100% — เลือกหุ้นด้วย seed จากวันที่ (ไม่มีสุ่ม) → รันซ้ำได้ผลเดิม
 * pure (ไม่แตะ DB/FS) — รับ stocks เข้ามาเป็น argument
 */
import { buildCurrentReferenceSolar } from "@/lib/bazi/symbolic-engine.birth";
import { STEM_TO_ELEMENT, BRANCH_LABELS_TH } from "@/lib/bazi/symbolic-engine.constants";
import type { StockEntry } from "@/lib/investor/stock-database";
import { ELEMENT_BUSINESS_TH } from "@/lib/investor/investor-tables";

// ───────── Types ─────────

export type DailyContentType = "stock-of-day" | "element-of-day" | "theme-of-day" | "knowledge-tip";

export type DailyContentEntry = {
  /** วันที่ (YYYY-MM-DD — ตามเวลากรุงเทพฯ) */
  date: string;
  /** วันจร: ก้าน+กิ่ง (เช่น 甲子) */
  dayGanzhi: string;
  /** ธาตุของวันนี้ (จากก้านวันจร) */
  dayElement: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";
  /** ประเภทคอนเทนต์ */
  type: DailyContentType;
  /** พาดหัว (hook — ใช้ในโซเชียล) */
  headline: string;
  /** เนื้อหาหลัก (ร้อยแก้ว) */
  body: string;
  /** หุ้นที่เสนอในโพสต์นี้ (ticker + ชื่อ + ธาตุ) */
  featuredStocks: Array<{ ticker: string; name: string; element: string; reason: string }>;
  /** ธีมที่เกี่ยวข้อง */
  relatedThemes: string[];
  /** แฮชแท็ก */
  hashtags: string[];
  /** CTA (ชวนเข้ากลุ่ม LINE) */
  callToAction: string;
  /** เกร็ดความรู้โหราศาสตร์ประจำโพสต์ */
  trivia: string;
  /** สถานะ: draft → scheduled → published */
  status: "draft" | "scheduled" | "published";
};

// ───────── ตัวช่วย ─────────

type ThaiElement = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

/** seed ตัวเลขจากวันที่ (deterministic — ใช้วันที่เลือกหุ้น) */
function dateSeed(dateStr: string): number {
  const digits = dateStr.replace(/\D/g, "");
  let sum = 0;
  for (const ch of digits) sum = (sum * 31 + ch.charCodeAt(0)) % 100000;
  return sum;
}

/** ธาตุของก้าน (stem) */
function stemElement(stem: string): ThaiElement {
  const en = STEM_TO_ELEMENT[stem as keyof typeof STEM_TO_ELEMENT] as keyof typeof ELEMENT_BUSINESS_TH;
  const map: Record<string, ThaiElement> = { wood: "ไม้", fire: "ไฟ", earth: "ดิน", metal: "ทอง", water: "น้ำ" };
  return map[en] ?? "ไม้";
}

/** หาวันจรของวันนี้ (ตามเวลากรุงเทพฯ) — ใช้ buildCurrentReferenceSolar ของ engine */
export function getTodayInfo(): { date: string; dayGanzhi: string; dayElement: ThaiElement } {
  const solar = buildCurrentReferenceSolar();
  const lunar = solar.getLunar();
  const eightChar = lunar.getEightChar();
  const dayGanzhi = eightChar.getDay();
  const stem = dayGanzhi.charAt(0);
  return {
    date: `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`,
    dayGanzhi,
    dayElement: stemElement(stem),
  };
}

/** seed-deterministic pick: เลือก index จาก array ด้วย seed */
function pickBySeed<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ───────── เนื้อหา 4 ประเภท ─────────

/** ① หุ้นประจำวัน — เสนอหุ้น 1 ตัวที่ธาตุตรงกับวันนี้ */
export function buildStockOfDay(stocks: StockEntry[], date: string, dayGanzhi: string, dayElement: ThaiElement): DailyContentEntry {
  const candidates = stocks.filter((s) => s.primaryElement === dayElement);
  const pool = candidates.length > 0 ? candidates : stocks;
  const stock = pickBySeed(pool, dateSeed(date));

  return {
    date,
    dayGanzhi,
    dayElement,
    type: "stock-of-day",
    headline: `วันนี้ธาตุ${dayElement}กำลังมาแรง 🔥 หุ้นตัวนี้เข้าธาตุวันนี้เป๊ะ!`,
    body: `วันนี้วันจร ${dayGanzhi} (ธาตุ${dayElement}) — ${ELEMENT_BUSINESS_TH[dayElement]}\n\nหุ้นเด่นประจำวัน: **${stock.ticker} ${stock.name}**\nธุรกิจ: ${stock.business}\nธาตุ: ${stock.primaryElement} (${stock.elementReason})\n\nถ้าดวงคุณต้องการธาตุ${dayElement} (ธาตุที่ควรลงทุน) ตัวนี้น่าสนใจเข้าพอร์ต!`,
    featuredStocks: [{ ticker: stock.ticker, name: stock.name, element: stock.primaryElement, reason: stock.elementReason }],
    relatedThemes: stock.theme,
    hashtags: [`#หุ้นวันนี้`, `#ธาตุ${dayElement}`, `#ดวงนักลงทุน`, `#${stock.ticker}`],
    callToAction: "อยากรู้ว่าดวงคุณควรลงทุนธาตุอะไร? 👉 กดเข้ากลุ่ม LINE รับ 10 หุ้นแรกที่เหมาะกับดวงคุณ ฟรี!",
    trivia: `เกร็ด: วันจร ${dayGanzhi} — ก้าน ${dayGanzhi.charAt(0)} (${dayElement}) · กิ่ง ${dayGanzhi.charAt(1)} (${BRANCH_LABELS_TH[dayGanzhi.charAt(1) as keyof typeof BRANCH_LABELS_TH] ?? ""})`,
    status: "draft",
  };
}

/** ② ธาตุประจำวัน — เสนอทั้งกลุ่มหุ้นของธาตุวันนี้ */
export function buildElementOfDay(stocks: StockEntry[], date: string, dayGanzhi: string, dayElement: ThaiElement): DailyContentEntry {
  const group = stocks.filter((s) => s.primaryElement === dayElement).slice(0, 8);

  return {
    date,
    dayGanzhi,
    dayElement,
    type: "element-of-day",
    headline: `กลุ่มธาตุ${dayElement} วันนี้มาแรง! มีหุ้นอะไรบ้าง 🤔`,
    body: `วันนี้วันจร ${dayGanzhi} (ธาตุ${dayElement}) — ${ELEMENT_BUSINESS_TH[dayElement]}\n\nหุ้นในกลุ่มธาตุ${dayElement} (${group.length} ตัว):\n${group.map((s) => `• ${s.ticker} ${s.name} (${s.business})`).join("\n")}\n\nธาตุ${dayElement} เหมาะกับคนที่ดวงต้องการธาตุนี้!`,
    featuredStocks: group.map((s) => ({ ticker: s.ticker, name: s.name, element: s.primaryElement, reason: s.elementReason })),
    relatedThemes: ["กลุ่มธาตุ", `ธาตุ${dayElement}`],
    hashtags: [`#กลุ่มธาตุ${dayElement}`, `#หุ้นไทย`, `#ดวงนักลงทุน`],
    callToAction: "เช็คเลยว่าดวงคุณต้องการธาตุอะไร? 👉 เข้ากลุ่ม LINE รับการ์ด 'คุณเป็นนักลงทุนธาตุไหน?' ฟรี!",
    trivia: `เกร็ด: ${ELEMENT_BUSINESS_TH[dayElement]}`,
    status: "draft",
  };
}

/** ③ ธีมประจำวัน — ธีมที่เกี่ยวข้องกับธาตุวันนี้ */
export function buildThemeOfDay(stocks: StockEntry[], themes: Array<{ id: string; name: string; elements: string[] }>, date: string, dayGanzhi: string, dayElement: ThaiElement): DailyContentEntry {
  const matched = themes.filter((t) => t.elements.includes(dayElement));
  const theme = pickBySeed(matched.length > 0 ? matched : themes, dateSeed(date));
  const themeStocks = stocks.filter((s) => s.theme.includes(theme.id)).slice(0, 6);

  return {
    date,
    dayGanzhi,
    dayElement,
    type: "theme-of-day",
    headline: `ธีม "${theme.name}" มาแรงวันนี้ (ธาตุ${dayElement}) 🚀`,
    body: `ธีม${theme.name} กำลังมา — ธาตุหลัก ${theme.elements.join("/")} ตรงกับธาตุวันนี้ (${dayElement})!\n\nหุ้นในธีมนี้:\n${themeStocks.map((s) => `• ${s.ticker} ${s.name} (ธาตุ${s.primaryElement})`).join("\n")}\n\nคนที่ดวงต้องการธาตุ${dayElement} ควรจับตาธีมนี้!`,
    featuredStocks: themeStocks.map((s) => ({ ticker: s.ticker, name: s.name, element: s.primaryElement, reason: s.elementReason })),
    relatedThemes: [theme.name],
    hashtags: [`#${theme.name.replace(/\s/g, "")}`, `#ธาตุ${dayElement}`, `#ลงทุนตามดวง`],
    callToAction: "รู้หรือไม่ ดวงคุณเหมาะกับธีมไหน? 👉 เข้ากลุ่ม LINE ดู 10 หุ้นแรกที่เหมาะกับดวงคุณ!",
    trivia: `เกร็ด: ธีม${theme.name} ผูกกับธาตุ ${theme.elements.join("/")}`,
    status: "draft",
  };
}

/** ④ เกร็ดความรู้ — สอนเรื่องธาตุ/โหราศาสตร์การเงิน (สร้างความน่าเชื่อถือ) */
export function buildKnowledgeTip(date: string, dayGanzhi: string, dayElement: ThaiElement): DailyContentEntry {
  const tips: Record<ThaiElement, string> = {
    "ไม้": "คนธาตุไม้เหมาะกับการลงทุนระยะยาวแบบค่อยเติบโต (DCA กองทุน) มากกว่าการเทรดรายวัน",
    "ไฟ": "คนธาตุไฟเหมาะกับจังหวะเก็งกำไรระยะสั้น แต่ต้องมีวินัยตัดขาดทุน อย่าเทรดตามอารมณ์",
    "ดิน": "คนธาตุดินเหมาะกับอสังหาริมทรัพย์ REIT และการออมแบบมั่นคง เงินนิ่งๆ โตช้าแต่มั่นคง",
    "ทอง": "คนธาตุทองเหมาะกับหุ้นเทคโนโลยีที่ต้องวิเคราะห์แม่นยำ + ทองคำกันความเสี่ยง",
    "น้ำ": "คนธาตุน้ำเหมาะกับการเงิน ธนาคาร การเทรดตามกระแส และการลงทุนที่หมุนเวียนคล่องตัว",
  };

  return {
    date,
    dayGanzhi,
    dayElement,
    type: "knowledge-tip",
    headline: `คนธาตุ${dayElement} ควรลงทุนยังไง? 💡 (วันนี้ธาตุ${dayElement}มาแรง)`,
    body: `วันนี้วันจร ${dayGanzhi} (ธาตุ${dayElement})\n\n${tips[dayElement]}\n\nจำไว้ว่า: ลงทุนให้ตรงธาตุ = ลงทุนให้ตรงกับธรรมชาติของเรา`,
    featuredStocks: [],
    relatedThemes: ["ความรู้", "ธาตุ"],
    hashtags: [`#ธาตุ${dayElement}`, `#ความรู้การลงทุน`, `#ดวงนักลงทุน`],
    callToAction: "อยากรู้ว่าดวงคุณเป็นธาตุอะไร? 👉 เข้ากลุ่ม LINE รับการ์ด 'คุณเป็นนักลงทุนธาตุไหน?' ฟรี!",
    trivia: `เกร็ด: วันนี้ธาตุ${dayElement} ${ELEMENT_BUSINESS_TH[dayElement]}`,
    status: "draft",
  };
}

// ───────── ตัวหมุนเวียนรายวัน (rotator) ─────────

/** หมุนเวียนประเภทคอนเทนต์ตามวันในสัปดาห์ (จ-อา) */
const WEEKDAY_TYPE: DailyContentType[] = [
  "stock-of-day", // จ
  "element-of-day", // อ
  "theme-of-day", // พ
  "knowledge-tip", // พฤ
  "stock-of-day", // ศ
  "element-of-day", // ส
  "theme-of-day", // อา
];

/** สร้างคอนเทนต์ประจำวัน (1 โพสต์) — deterministic จากวันที่ */
export function buildDailyContent(
  stocks: StockEntry[],
  themes: Array<{ id: string; name: string; elements: string[] }>,
  date?: string,
): DailyContentEntry {
  const info = getTodayInfo();
  const targetDate = date ?? info.date;
  const { dayGanzhi, dayElement } = date ? resolveGanzhiForDate(date) : info;

  // เลือกประเภทตามวันในสัปดาห์ (จ=0 ... อา=6)
  const dow = new Date(`${targetDate}T12:00:00+07:00`).getDay();
  const type = WEEKDAY_TYPE[dow] ?? "stock-of-day";

  switch (type) {
    case "stock-of-day": return buildStockOfDay(stocks, targetDate, dayGanzhi, dayElement);
    case "element-of-day": return buildElementOfDay(stocks, targetDate, dayGanzhi, dayElement);
    case "theme-of-day": return buildThemeOfDay(stocks, themes, targetDate, dayGanzhi, dayElement);
    case "knowledge-tip": return buildKnowledgeTip(targetDate, dayGanzhi, dayElement);
  }
}

/** หาวันจรของวันที่ระบุ (ใช้ lunar-javascript ผ่าน engine) */
function resolveGanzhiForDate(dateStr: string): { dayGanzhi: string; dayElement: ThaiElement } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const solar = buildCurrentReferenceSolar(new Date(y, m - 1, d, 12, 0, 0));
  const dayGanzhi = solar.getLunar().getEightChar().getDay();
  return { dayGanzhi, dayElement: stemElement(dayGanzhi.charAt(0)) };
}

/** สร้างคอนเทนต์ 7 วันล่วงหน้า (ใช้แชร์/วางแผนโพสต์) */
export function buildWeeklyContent(
  stocks: StockEntry[],
  themes: Array<{ id: string; name: string; elements: string[] }>,
  startDate?: string,
): DailyContentEntry[] {
  const base = startDate ?? getTodayInfo().date;
  const start = new Date(`${base}T12:00:00+07:00`);
  const result: DailyContentEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    result.push(buildDailyContent(stocks, themes, dateStr));
  }
  return result;
}
