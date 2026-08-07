/**
 * PDF รายงานคู่ดวง ฉบับหนังสือ (สถาบัน) — ปก + สารบัญ + บทนำ + 6 บท (กราฟโดนัท/แท่ง + กล่องรู้/ระวัง) + ภาคผนวก (เช็กลิสต์/อภิธาน)
 * ใช้กับ /api/product-pdf?tier=free|99|490|790 · กราฟวาดด้วย PDFKit (arc/rect) — ไม่ต้องใช้รูปภายนอก
 */
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { buildPersonalDashboard } from "../lib/portfolio/personal-dashboard";
import { buildMonthlyPicks } from "../lib/picks/monthly-picks";
import type { StockTier } from "../lib/investor/stock-tiers";
import { generateReportNarrative, type Narrative } from "../lib/report/narrative";
import { generateBookNarrative } from "../lib/report/narrative-v5";

const FONT_CANDIDATES = [
  process.env.PDF_FONT,
  "C:/Windows/Fonts/leelawad.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].filter((f): f is string => Boolean(f));

const EL_COLOR: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };
const TIER_LABEL: Record<StockTier, string> = { gold: "[VIP เทียร์ 1]", silver: "[PRO เทียร์ 2]", bronze: "[FREE เทียร์ 3]", base: "[INFO เทียร์ 4]" };
// ── Design system ──
const C = { primary: "#14532d", gold: "#b8860b", ink: "#2b2417", muted: "#8a8478", cream: "#f7f4ec", line: "#e0d9c8", red: "#9b2c2c", green: "#1e6f3e", white: "#ffffff" };

function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\uFE00-\uFE0F\u2000-\u2BFF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildFullReportPdf(state: CalculatedStateValue, opts?: { maxSection?: number; lockedNote?: string }): Promise<Buffer> {
  const maxSection = opts?.maxSection ?? 6;
  const d = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 10, "premium");
  const usPicks = buildMonthlyPicks(state, "US", 8, "premium");
  // LLM อธิบายความหมาย — v5 หนังสือขาย (gen 25 บท) + fallback v4
  const narrative = await generateBookNarrative(state).catch(async () => (await generateReportNarrative(state).catch(() => ({}))) as Narrative);
  const font = (FONT_CANDIDATES.find((f) => existsSync(f)) ?? "Helvetica") as string;
  const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 }, bufferPages: true });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (font !== "Helvetica") doc.registerFont("thai", font);
  const F = font === "Helvetica" ? "Helvetica" : "thai";
  const F_B = font === "Helvetica" ? "Helvetica-Bold" : "thai";
  const pageH = 842;
  const marginB = 56;
  let y = 0;

  const ensure = (need: number) => {
    if (y + need > pageH - marginB) {
      doc.addPage();
      y = 52;
      footer();
    }
  };
  const footer = () => {
    doc.fontSize(7.5).fillColor("#999999").font(F).text(clean(d.disclaimer), 52, pageH - 40, { width: 500, align: "center" });
    doc.font(F_B).fontSize(8).fillColor(C.gold).text(clean("ดวงนักลงทุน"), 52, pageH - 52);
    doc.font(F).fontSize(8).fillColor("#bbbbbb").text(`หนา ${doc.bufferedPageRange().count}`, 500, pageH - 52, { width: 48, align: "right" });
  };
  const h1 = (text: string, num: string) => {
    ensure(46);
    doc.rect(0, y - 10, 595, 34).fill(C.primary);
    doc.rect(0, y + 24, 595, 3).fill(C.gold);
    doc.font(F_B).fontSize(18).fillColor(C.white).text(clean(`${num}  ${text}`), 52, y, { width: 500 });
    y += 42;
  };
  const h2 = (text: string) => {
    ensure(34);
    doc.rect(52, y, 5, 16).fill(C.gold);
    doc.fontSize(15).font(F_B).fillColor(C.primary).text(clean(text), 66, y - 1);
    y += 24;
  };
  const h3 = (text: string) => {
    ensure(28);
    doc.font(F_B).fontSize(12.5).fillColor(C.ink).text(clean(text), 52, y);
    y += 20;
  };
  const p = (text: string, size = 11, color = "#333333") => {
    ensure(32);
    doc.fontSize(size).font(F).fillColor(color).text(clean(text), 52, y, { width: 490, lineGap: 4 });
    y = doc.y + 6;
  };
  const bullet = (txt: string, color = "#333333") => {
    ensure(26);
    doc.circle(58, y + 5, 2.5).fill(color === "#333333" ? C.gold : color);
    doc.font(F).fontSize(10.5).fillColor(color).text(clean(txt), 68, y, { width: 472, lineGap: 3 });
    y = doc.y + 4;
  };
  const callout = (title: string, text: string, kind: "good" | "warn" | "info" = "info") => {
    ensure(50);
    const fill = kind === "good" ? "#e8f3ea" : kind === "warn" ? "#f9ecec" : "#fdf6e3";
    const edge = kind === "good" ? C.green : kind === "warn" ? C.red : C.gold;
    doc.roundedRect(52, y, 490, 44, 8).fill(fill);
    doc.rect(52, y, 5, 44).fill(edge);
    doc.font(F_B).fontSize(10.5).fillColor(edge).text(clean(title), 66, y + 7, { width: 460 });
    doc.font(F).fontSize(10).fillColor("#555555").text(clean(text), 66, y + 24, { width: 460, lineGap: 3 });
    y += 54;
  };
  const row = (cols: Array<{ text: string; w: number; bold?: boolean; color?: string }>, header = false) => {
    ensure(22);
    let x = 52;
    if (header) doc.rect(52, y, 490, 19).fill("#eef2ec");
    for (const c of cols) {
      doc.font(c.bold || header ? F_B : F).fontSize(header ? 9 : 10).fillColor(header ? C.primary : c.color ?? "#333333").text(clean(c.text), x, y + (header ? 4 : 1), { width: c.w });
      x += c.w;
    }
    y += header ? 20 : 17;
  };
  // กราฟโดนัท (polygon approximation — กัน typing/arc)
  const donut = (cx: number, cy: number, r: number, segs: Array<{ pct: number; color: string }>, holeRatio = 0.62) => {
    let a0 = -Math.PI / 2;
    for (const s of segs) {
      if (s.pct <= 0) continue;
      const a1 = a0 + (s.pct / 100) * Math.PI * 2;
      const steps = Math.max(4, Math.floor((a1 - a0) / (Math.PI / 24)));
      doc.moveTo(cx, cy);
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        doc.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      doc.closePath().fill(s.color);
      a0 = a1;
    }
    doc.circle(cx, cy, r * holeRatio).fill("#ffffff");
  };
  // กราฟแท่ง (คะแนน)
  const bars = (x: number, y0: number, w: number, items: Array<{ label: string; value: number; color: string }>, max = 10) => {
    const bw = w / items.length;
    const bhMax = 70;
    for (const [i, it] of items.entries()) {
      const hh = Math.max(3, (it.value / max) * bhMax);
      doc.roundedRect(x + i * bw + 6, y0 + bhMax - hh, bw - 12, hh, 2).fill(it.color);
      doc.font(F).fontSize(7).fillColor("#666666").text(clean(it.label), x + i * bw, y0 + bhMax + 3, { width: bw, align: "center" });
    }
    doc.rect(x, y0 + bhMax, w, 0.8).fill(C.line);
  };
  const lockedSection = (num: string, title: string, unlockTier: string) => {
    ensure(60);
    doc.rect(52, y, 5, 16).fill("#c9c2b2");
    doc.fontSize(14).font(F_B).fillColor("#9a9388").text(clean(`${num} ${title}`), 66, y - 2);
    y += 26;
    doc.roundedRect(52, y, 490, 52, 6).fill("#e9e5da");
    doc.font(F_B).fontSize(11).fillColor("#b8b0a0").text(clean("เนื้อหาส่วนนี้ถูกจำกัด (ตัวอย่างเบลอ)"), 70, y + 12, { width: 450 });
    doc.font(F).fontSize(9.5).fillColor(C.gold).text(clean(`[ ล็อกอยู่ — ${unlockTier} ]`), 70, y + 32, { width: 450 });
    y += 62;
  };

  // ══════════ ปก (หนังสือ 6 ภาค 25 บท) ══════════
  const FIT_LABEL_PDF: Record<string, string> = { good: "ตรงดวง", drain: "ดูดพลัง", avoid: "ขัดดวง", neutral: "กลาง" };
  doc.rect(0, 0, 595, 260).fill(C.primary);
  doc.rect(0, 260, 595, 6).fill(C.gold);
  doc.rect(0, 780, 595, 62).fill("#0c2416");
  donut(297, 420, 95, d.elementBalance.map((e) => ({ pct: e.pct, color: EL_COLOR[e.element] ?? C.muted })), 0.55);
  doc.font(F_B).fontSize(13).fillColor("#cfe3d4").text(clean("ดวงนักลงทุน  ·  ฉบับสถาบัน"), 52, 40);
  doc.font(F_B).fontSize(32).fillColor(C.white).text(clean("หนังสือการลงทุนคู่ดวง"), 52, 82, { width: 490 });
  doc.font(F).fontSize(13).fillColor("#cfe3d4").text(clean("6 ภาค · 25 บท — ดวง 60 กะจื่อ  x  หุ้น/สินทรัพย์จริง  x  แผนที่ชีวิตทั้งชีวิต"), 52, 128, { width: 490 });
  doc.font(F).fontSize(11).fillColor("#9fb8a8").text(`ฉบับ ${maxSection >= 6 ? "VIP ฉบับเต็ม (25 บท)" : maxSection >= 4 ? "PRO (20 บท)" : maxSection >= 2 ? "ฉบับสรุป (10 บท)" : "ตัวอย่าง"}  ·  ${new Date().toLocaleDateString("th-TH", { month: "long", year: "numeric" })}`, 52, 158);
  doc.roundedRect(52, 540, 490, 70, 10).fill("#fdf6e3");
  doc.font(F_B).fontSize(20).fillColor(C.primary).text(clean(`${d.persona.emoji} ${d.persona.name}`), 68, 556, { width: 450 });
  doc.font(F).fontSize(11.5).fillColor(C.muted).text(clean(`${d.persona.bandLabel}  ·  สไตล์ ${d.persona.style}  ·  เทรด: ${d.trading.label}`), 68, 584, { width: 450 });
  doc.font(F).fontSize(8.5).fillColor("#cfe3d4").text(clean(d.disclaimer), 52, 792, { width: 490, align: "center" });

  // ══════════ สารบัญ + บทนำ ══════════
  doc.addPage();
  y = 52;
  footer();
  h1("สารบัญ (6 ภาค · 25 บท)", "");
  const toc = [
    ["ภาค 1", "ดีเอ็นเอการเงิน — ธาตุลาภ/กำลังดิถี/คลังทรัพย์/จิตวิทยา/การ์ด (บท 1-5)"],
    ["ภาค 2", "ลงทุนอะไร — เซกเตอร์/สินทรัพย์/ตลาด/สิ่งต้องห้าม/เช็กลิสต์ (บท 6-10)"],
    ["ภาค 3", "ลงทุนยังไง — สไตล์/เงินเร็วเย็น/พอร์ตธาตุ/DCA/ฟอเร็กซ์-คริปโต (บท 11-15)"],
    ["ภาค 4", "ลงทุนเมื่อไหร่ — วัยจร 4 ช่วง + แผนที่ชีวิต (บท 16-20)"],
    ["ภาค 5", "ป้องกัน — ผั่วไฉ่โข่ว/คลังแตก/กฎเหล็ก (บท 21-23)"],
    ["ภาค 6", "เสริมดวง — สี/ทิศ/เครื่องราง + เสริมวัยจร (บท 24-25)"],
    ["บท 26", "ฉบับเดือนนี้ (ของสด VIP) — ธาตุเดือน/ปฏิทินมงคล/แผนเดือน"],
    ["ภาคผนวก", "เช็กลิสต์ 30 ข้อ + อภิธานศัพท์"],
  ];
  for (const [n, t] of toc) {
    row([{ text: n, w: 70, bold: true, color: C.gold }, { text: t, w: 420 }]);
  }
  y += 6;
  h1("บทนำ  —  วิธีอ่านหนังสือเล่มนี้", "อ่านก่อน");
  p("หนังสือ 25 บทนี้สร้างจากข้อมูลจริงของคุณเท่านั้น: ดวงคำนวณด้วยตำรา 60 กะจื่อ (deterministic — ไม่ใช่ดวงเดา) × ข้อมูลตลาดจริง 5,958 หุ้น 27 ตลาด × ตารางธาตุจากซินแส", 10);
  h2("คำศัพท์ที่ต้องรู้ก่อนอ่าน");
  bullet("ธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ) — พลัง 5 ชนิดในดวงและในธุรกิจ — หุ้นแต่ละตัวมีธาตุของตัวเอง (เช่น โรงพยาบาล=ไฟ, ธนาคาร=น้ำ)");
  bullet("กำลังดิถี — แรงของวันเกิด: อ่อน=ต้องเสริม อย่าไล่ลาภ / แข็ง=ถ่ายเทได้ ลงทุนกล้าได้");
  bullet("ธาตุลาภ — ธาตุที่ 'เป็นเงิน' ของดวงคุณ แต่ถ้ามีเกิน (เช่น น้ำ 45%) การไล่ลาภ = ดูดพลัง");
  bullet("วัยจร — วงจร 10 ปีที่เปลี่ยนธาตุ สลับกันทั้งชีวิต — เปลี่ยนทิศทางดวงการเงินทุกช่วง");
  bullet("เทียร์หุ้น 1-4 — ระดับคุณภาพคำแนะนำ: 1=VIP (ตรงดวง+แข็ง) → 4=INFO (แค่ข้อมูล)");
  callout("วิธีใช้เล่มนี้ (3 นาที)", "ภาค 1 รู้ตัวเอง → ภาค 2 เลือกของที่ตรง → ภาค 3 วิธีลงทุน → ภาค 4 จังหวะชีวิต → ภาค 5 กันเจ๊ง → ภาค 6 เสริมดวง · ใช้บท 26 เป็นคู่มือรายเดือน", "good");

  // helper: ข้อความ narrative per chapter (v5 → v4 fallback → template)
  const n = (ch: string, fb: string) => (narrative as Record<string, string>)[ch] || fb;

  const phaseOf = (s: number, e: number) => d.timeline.filter((t) => { const a = parseInt((t.ageRange.split("–")[0] || t.ageRange.split("-")[0] || "0"), 10); return a >= s && a < e; });
  const lifeRow = (t: { ageRange: string; verdict: string; advice: string }) => {
    const m = { invest: { label: "ลงทุนเต็มที่", color: "#1e6f3e", tint: "#e8f3ea" }, accumulate: { label: "สะสม/ถือ", color: "#b8860b", tint: "#f7f1e2" }, avoid: { label: "หลีกเลี่ยง", color: "#9b2c2c", tint: "#f9ecec" }, "no-risk": { label: "ห้ามเสี่ยง", color: "#6b1f1f", tint: "#f3e3e3" } }[t.verdict] ?? { label: "สะสม/ถือ", color: "#b8860b", tint: "#f7f1e2" };
    ensure(20);
    doc.roundedRect(52, y, 490, 18, 4).fill(m.tint);
    doc.roundedRect(52, y, 5, 18, 3).fill(m.color);
    doc.font(F_B).fontSize(9).fillColor(C.ink).text(clean(`${t.ageRange} ปี`), 64, y + 3, { width: 58 });
    doc.font(F_B).fontSize(9).fillColor(m.color).text(clean(m.label), 126, y + 3, { width: 80 });
    doc.font(F).fontSize(8.5).fillColor("#555555").text(clean(t.advice), 210, y + 3, { width: 330 });
    y += 22;
  };
  const partH = (num: string, title: string, desc: string) => {
    doc.addPage();
    y = 52;
    footer();
    doc.rect(0, y - 10, 595, 56).fill(C.primary);
    doc.rect(0, y + 46, 595, 3).fill(C.gold);
    doc.font(F_B).fontSize(12).fillColor("#cfe3d4").text(clean(`ภาค ${num}  ·  ${title}`), 52, y + 4, { width: 490 });
    doc.font(F).fontSize(9.5).fillColor("#9fb8a8").text(clean(desc), 52, y + 24, { width: 490 });
    y += 62;
  };

  // ══════════ ภาค 1: ดีเอ็นเอการเงิน (บท 1-5) ══════════
  if (maxSection >= 1) {
    partH("1", "ดีเอ็นเอการเงิน", "รู้จักตัวเองในเรื่องเงิน — ธาตุอะไรคือเงินของคุณ กำลังเท่าไหร่ เก็บอะไรแล้วอยู่");
    h2("บท 1 · ธาตุลาภ — เงินของคุณมาจากธาตุอะไร");
    p(`ธาตุลาภของคุณ = ${d.strengthen.wealth} (มี ${d.elementBalance.find((e) => e.element === d.strengthen.wealth)?.count ?? "?"} ตัว / ${d.elementBalance.find((e) => e.element === d.strengthen.wealth)?.pct ?? "?"}%) — ${d.principle.excessElement === d.strengthen.wealth ? "แต่เกิน → อย่าไล่ลาภ (ดูดพลัง) เสริมธาตุที่ขาดก่อน" : "ลงทุนธุรกิจธาตุนี้ได้"}`, 10, "#8d6e63");
    p(`ตัวอย่างธุรกิจธาตุ ${d.strengthen.wealth}: ${d.strengthen.businessHint}`, 10);
    h2("บท 2 · กำลังดิถี — ไล่ลาภได้เต็มที่ หรือต้องสะสม");
    p(`${d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล"} — ${d.principle.mode} · แนวทาง: เสริม ${d.principle.supplementElement}`, 10.5);
    p(d.principle.desc, 10, "#555555");
    callout("เทรดได้/ไม่ได้", `${d.trading.label} — ${d.trading.reason}`, d.trading.allowed === "no" ? "warn" : "good");
    h2("บท 3 · คลังทรัพย์ — เก็บอะไรแล้วอยู่");
    const goodAssets: Array<{ ticker: string; name: string; element: string }> = [];
    for (const c of d.categories) {
      for (const it of c.items) {
        if (goodAssets.length >= 6) break;
        if (it.fit === "good") goodAssets.push({ ticker: it.ticker, name: it.name, element: it.element });
      }
      if (goodAssets.length >= 6) break;
    }
    if (goodAssets.length) {
      for (const a of goodAssets) bullet(`${a.ticker} — ${a.name} (${a.element} · ตรงดวง)`, "#333333");
    }
    h2("บท 4 · จิตวิทยาเงิน — จุดอ่อนการตัดสินใจของคุณ");
    p(`จุดแข็ง: ${d.persona.strengths ?? d.persona.style}`, 10, "#1e6f3e");
    p(`จุดที่ต้องระวัง: ${d.persona.weaknesses ?? "ใจร้อนตามธาตุ ต้องมีกฎเหล็กรอซื้อ/ตัดขาดทุน"}`, 10, "#9b2c2c");
    h2("บท 5 · การ์ดตัวตนนักลงทุน (สรุปภาค 1)");
    row([{ text: "หัวข้อ", w: 120, bold: true }, { text: "คำตอบของคุณ", w: 370, bold: true }], true);
    row([{ text: "ตัวตน", w: 120 }, { text: `${d.persona.name} (${d.persona.bandLabel})`, w: 370, bold: true }]);
    row([{ text: "ธาตุลาภ / เสริม / เลี่ยง", w: 120 }, { text: `${d.strengthen.wealth} / ${d.strengthen.element} / ${d.avoid.join("/")}`, w: 370 }]);
    row([{ text: "เทรด + สัดส่วนเงิน", w: 120 }, { text: `${d.trading.label} · เย็น ${d.trading.split.cold}% เร็ว ${d.trading.split.fast}% ฉุกเฉิน ${d.trading.split.emergency}%`, w: 370 }]);
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 1", "ดีเอ็นเอการเงิน (บท 1-5)", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ══════════ ภาค 2: ลงทุนอะไร (บท 6-10) ══════════
  if (maxSection >= 2) {
    partH("2", "ลงทุนอะไร", "เอาเงินไปไว้ที่ไหน — เซกเตอร์/สินทรัพย์/ตลาด ที่ตรงธาตุ + สิ่งต้องห้าม");
    h2("บท 6 · เซกเตอร์/หุ้นที่ตรงธาตุ");
    p(`หุ้นธาตุ ${d.strengthen.element} (ต้องเสริม) — ตัวอย่างจาก 5,958 หุ้น:`, 10, "#8d6e63");
    row([{ text: "#", w: 24, bold: true }, { text: "หุ้น", w: 84, bold: true }, { text: "ธาตุ", w: 36, bold: true }, { text: "เทียร์", w: 88, bold: true }, { text: "คะแนน", w: 42, bold: true }, { text: "เหตุผล", w: 216, bold: true }], true);
    for (const [i, pk] of thPicks.picks.slice(0, 8).entries()) {
      row([{ text: `${i + 1}`, w: 24 }, { text: pk.ticker, w: 84, bold: true }, { text: pk.element, w: 36, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 88, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 42 }, { text: pk.reasons[0] ?? "", w: 216, color: "#555555" }]);
    }
    h2("บท 7 · สินค้า/สินทรัพย์ (fit 4 ระดับ)");
    row([{ text: "หมวด", w: 130, bold: true }, { text: "สินค้าเด่น", w: 360, bold: true }], true);
    for (const cat of d.categories) {
      const items = cat.items.slice(0, 2).map((it) => `${it.ticker}(${TIER_LABEL[it.stockTier as StockTier] ?? ""} ${FIT_LABEL_PDF[it.fit] ?? "กลาง"})`).join(", ");
      if (items) row([{ text: cat.label, w: 130 }, { text: items, w: 360, color: "#555555" }]);
    }
    h2("บท 8 · ตลาด/ประเทศ (ธาตุตลาด × ดวงคุณ)");
    row([{ text: "ตลาด", w: 130, bold: true }, { text: "ธาตุ", w: 60, bold: true }, { text: "กับดวงคุณ", w: 300, bold: true }], true);
    row([{ text: "ไทย", w: 130 }, { text: "น้ำ", w: 60 }, { text: d.avoid.includes("น้ำ") ? "⚠️ ธาตุเลี่ยง — เลือกหุ้นรายตัวที่ตรงธาตุ" : "กลาง", w: 300 }]);
    row([{ text: "สหรัฐฯ", w: 130 }, { text: "ไม้", w: 60 }, { text: d.avoid.includes("ไม้") ? "⚠️ ธาตุเลี่ยง — เน้นหุ้นรายตัวธาตุอื่น" : "กลาง", w: 300 }]);
    row([{ text: "อินเดีย", w: 130 }, { text: "ทอง", w: 60 }, { text: d.strengthen.element === "ทอง" ? "✅ ตรงธาตุที่ต้องเสริม" : "กลาง", w: 300 }]);
    row([{ text: "ออสเตรเลีย", w: 130 }, { text: "ไฟ", w: 60 }, { text: d.strengthen.element === "ไฟ" ? "✅ ตรงธาตุที่ต้องเสริม" : "กลาง", w: 300 }]);
    p("* ธาตุตลาด = ทิศจากไทย (ใช้เฉพาะภาพรวม) — ทุกหุ้น verdict รายตัว ไม่เหมารวมตลาด", 9, "#999999");
    h2("บท 9 · สิ่งต้องห้าม (ธาตุพิฆาต)");
    callout("ธาตุพิฆาตของคุณ", `${d.avoid.join(" / ")} — ห้ามแตะธุรกิจ/หุ้น/สินทรัพย์ธาตุนี้เด็ดขาด (ต่อให้พื้นฐานดีแค่ไหน)`, "warn");
    h2("บท 10 · เช็กลิสต์ 30 ข้อก่อนซื้อ");
    p("ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 24/30 ขึ้นไปถึงเริ่ม (เต็มอยู่ในภาคผนวก ก)", 10, "#8d6e63");
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 2", "ลงทุนอะไร (บท 6-10)", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ══════════ ภาค 3: ลงทุนยังไง (บท 11-15) ══════════
  if (maxSection >= 3) {
    partH("3", "ลงทุนยังไง", "วิธีลงทุนให้เข้ากับดวง — สไตล์/สัดส่วน/พอร์ตตามธาตุ/DCA/เก็งกำไร");
    h2("บท 11 · สไตล์ตามเชี่ยงแซ (5 ปีนี้)");
    p(`สไตล์ของคุณ: ${d.persona.style} — ${d.principle.band === "weak" ? "ดิถีอ่อน → ใช้หลักเสริม (สะสมก้อนมั่นคง)" : d.principle.band === "strong" ? "ดิถีแข็ง → ใช้หลักถ่ายเท (กล้าลงทุนหลายธีม)" : "ดิถีสมดุล → ใช้ทั้งสอง"}`, 10);
    h2("บท 12 · เงินเร็ว-เย็น-ฉุกเฉิน (สัดส่วน)");
    donut(170, y + 80, 65, [
      { pct: d.trading.split.cold, color: C.green },
      { pct: d.trading.split.fast, color: C.gold },
      { pct: d.trading.split.emergency, color: "#1565c0" },
    ]);
    let l12y = y + 46;
    for (const [lab, pct, col] of [["เงินเย็น (ยาว)", d.trading.split.cold, C.green], ["เงินเร็ว (เทรด)", d.trading.split.fast, C.gold], ["เงินฉุกเฉิน", d.trading.split.emergency, "#1565c0"]] as const) {
      doc.roundedRect(270, l12y, 12, 12, 2).fill(col);
      doc.font(F_B).fontSize(10.5).fillColor("#333333").text(`${lab} ${pct}%`, 288, l12y, { width: 220 });
      l12y += 18;
    }
    y += 165;
    p(`เย็น: ${d.instruments.cold.join(" · ")}`, 9.5, "#555555");
    p(`เร็ว: ${d.instruments.fast.join(" · ")}`, 9.5, "#555555");
    p(`ฉุกเฉิน: ${d.instruments.emergency.join(" · ")}`, 9.5, "#555555");
    h2("บท 13 · จัดพอร์ตตามธาตุ");
    bars(52, y + 10, 490, d.elementBalance.map((e) => ({ label: e.element, value: e.pct, color: EL_COLOR[e.element] ?? C.muted })), 50);
    y += 95;
    p(`ดวงคุณมี ${d.strengthen.element} ${d.elementBalance.find((e) => e.element === d.strengthen.element)?.pct ?? 0}% → เพิ่มน้ำหนักสินทรัพย์ธาตุ ${d.strengthen.element} (ไม่เกิน 40% ต่อธาตุเดียว)`, 10);
    h2("บท 14 · DCA / สะสม (จังหวะทยอยซื้อ)");
    const accs = phaseOf(0, 100).filter((t) => t.verdict === "accumulate").slice(0, 3);
    for (const t of accs) lifeRow(t);
    if (!accs.length) p("ช่วงวัยจรของคุณส่วนใหญ่เป็น 'ลงทุนเต็มที่' — ซื้อก้อนได้ในวันมงคล", 10);
    h2("บท 15 · forex / คริปโต (เก็งกำไรขั้นสูง)");
    callout("คำเตือน", d.trading.allowed === "no" ? "ดวงคุณเทรดไม่ได้ — เก็งกำไรสูงสุด (ฟอเร็กซ์/คริปโต/ฟิวเจอร์ส) = เสี่ยงสุด จำกัดไม่เกิน 5% ของเงินเร็ว หรือเลี่ยง" : "เก็งกำไรได้เฉพาะสัดส่วนเงินเร็ว + วันมงคล + มีจุดตัดขาดทุน", "warn");
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 3", "ลงทุนยังไง (บท 11-15)", "ฉบับ Pro (฿490)");
  }

  // ══════════ ภาค 4: ลงทุนเมื่อไหร่ (บท 16-20) ══════════
  if (maxSection >= 3) {
    partH("4", "ลงทุนเมื่อไหร่", "จังหวะชีวิตทั้ง 80 ปี — ช่วงไหนรวย ช่วงไหนต้องระวัง");
    h2("บท 16 · วัยจร 0-20 (ปฐมวัย — สร้างนิสัย)");
    for (const t of phaseOf(0, 20)) lifeRow(t);
    h2("บท 17 · วัยจร 20-40 (สร้างตัว — สะสมก้อน)");
    for (const t of phaseOf(20, 40)) lifeRow(t);
    h2("บท 18 · วัยจร 40-60 (จังหวะทอง)");
    for (const t of phaseOf(40, 60)) lifeRow(t);
    const golds = phaseOf(40, 60).filter((t) => t.verdict === "invest");
    if (golds.length) callout("ช่วงทอง", `${golds.map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ อย่าพลาด`, "good");
    h2("บท 19 · วัยจร 60-80 (รักษาทรัพย์)");
    for (const t of phaseOf(60, 100)) lifeRow(t);
    h2("บท 20 · แผนที่ชีวิต (Life Map 0-80+ ดูจบในตาเดียว)");
    for (const t of d.timeline) lifeRow(t);
    const allGolds = d.timeline.filter((t) => t.verdict === "invest");
    if (allGolds.length) {
      y += 2;
      doc.roundedRect(52, y, 490, 24, 4).fill("#fdf6e3").strokeColor(C.gold).lineWidth(1).stroke();
      doc.font(F_B).fontSize(10).fillColor(C.gold).text(clean(`ช่วงทองของคุณ: ${allGolds.map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ`), 62, y + 6, { width: 470 });
      y += 30;
    }
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 4", "ลงทุนเมื่อไหร่ (บท 16-20)", "ฉบับ Pro (฿490)");
  }

  // ══════════ ภาค 5: ป้องกัน (บท 21-23) ══════════
  if (maxSection >= 5) {
    partH("5", "ป้องกัน", "กันเจ๊ง — จุดรั่วไหล ช่วงคลังแตก กฎเหล็กคุ้มครอง");
    h2("บท 21 · ผั่วไฉ่โข่ว (จุดรั่วไหลของเงิน)");
    p(`เดือนนี้มีวันระวัง ${d.auspiciousDays.month.avoidDayCount} วัน: ${d.auspiciousDays.month.avoidDays.map((g) => g.date).join(", ")} — งดซื้อก้อนใหญ่/เซ็นสัญญา เก็บเงินสด`, 10, "#9b2c2c");
    h2("บท 22 · คลังแตก (ช่วงที่ต้องลดความเสี่ยง)");
    const risks = d.timeline.filter((t) => t.verdict === "avoid" || t.verdict === "no-risk");
    for (const t of risks) lifeRow(t);
    if (!risks.length) p("ไม่มีช่วง 'ห้ามเสี่ยง' ในวัยจรของคุณ — แต่ยังต้องมีเงินสำรอง 6 เดือนเสมอ", 10);
    h2("บท 23 · กฎเหล็ก 5 ข้อ (คุ้มครองตัวเอง)");
    bullet("1) ซื้อเฉพาะวันมงคล  2) ไม่เกิน 5% ของพอร์ตต่อตัว  3) ผ่านเช็กลิสต์ 30 ข้อก่อน");
    bullet("4) เงินฉุกเฉินห้ามแตะเด็ดขาด  5) ธาตุเดือนขัดดวง = ลดน้ำหนัก งดเสี่ยง");
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 5", "ป้องกัน (บท 21-23)", "VIP (฿790/เดือน)");
  }

  // ══════════ ภาค 6: เสริม (บท 24-25) + บท 26 ฉบับเดือนนี้ ══════════
  if (maxSection >= 6) {
    partH("6", "เสริมดวง", "ดวงดีขึ้นได้ — สี/ทิศ/เครื่องราง + เสริมตามวัยจร");
    h2("บท 24 · สี / ทิศ / เครื่องราง (เสริมธาตุ)");
    const boost = { ไม้: { color: "เขียว/น้ำตาล", dir: "ตะวันออก", item: "ต้นไม้ ไม้มงคล หนังสือ" }, ไฟ: { color: "แดง/ส้ม/ม่วง", dir: "ทิศใต้", item: "เทียน ตะเกียง ของร้อนแรง" }, ดิน: { color: "เหลือง/ครีม/น้ำตาล", dir: "กลาง/ตะวันตกเฉียงใต้", item: "หิน แร่ เซรามิก" }, ทอง: { color: "ขาว/เงิน/ทอง", dir: "ตะวันตก", item: "เหรียญ กุญแจ โลหะ" }, น้ำ: { color: "ดำ/น้ำเงินเข้ม", dir: "ทิศเหนือ", item: "น้ำพุ ตู้ปลา กระจก" } }[d.strengthen.element] ?? { color: "แดง/ส้ม", dir: "ทิศใต้", item: "เทียน ของร้อนแรง" };
    row([{ text: "ธาตุที่ต้องเสริม", w: 120, bold: true }, { text: d.strengthen.element, w: 370, color: C.green }], true);
    row([{ text: "สี", w: 120, bold: true }, { text: boost.color, w: 370 }]);
    row([{ text: "ทิศ", w: 120, bold: true }, { text: boost.dir, w: 370 }]);
    row([{ text: "เครื่องราง/ของเสริม", w: 120, bold: true }, { text: boost.item, w: 370 }]);
    h2("บท 25 · เสริมตามวัยจร (ช่วงนี้ต้องเสริมอะไร)");
    for (const t of d.timeline.slice(0, 4)) lifeRow(t);
    p("* วัยจรถัดไป = เปลี่ยนธาตุ — อ่านภาค 4 วางแผนล่วงหน้า 5 ปี", 9, "#999999");
    h1(`ฉบับเดือนนี้ (${new Date().toLocaleDateString("th-TH", { month: "long", year: "numeric" })})`, "บท 26");
    const mf = d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง";
    callout(`ธาตุเดือน: ${d.monthAdvice.element ?? "-"} (${mf})`, d.monthAdvice.text, d.monthAdvice.fit === "good" ? "good" : d.monthAdvice.fit === "avoid" ? "warn" : "info");
    h2("ปฏิทินมงคลทั้งเดือน");
    p(`วันมงคล ${d.auspiciousDays.month.goodDayCount} วัน: ${d.auspiciousDays.month.goodDays.map((g) => g.date).join(", ")}`, 10, "#1e6f3e");
    p(`วันระวัง ${d.auspiciousDays.month.avoidDayCount} วัน: ${d.auspiciousDays.month.avoidDays.map((g) => g.date).join(", ")}`, 10, "#9b2c2c");
    const plan = d.monthAdvice.fit === "good" ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} หนุนดวง → เพิ่มน้ำหนักธาตุ ${d.strengthen.element} · ธุรกรรมใหญ่ในวันมงคล · ทยอย DCA` : d.monthAdvice.fit === "avoid" ? `เดือนนี้ ${d.monthAdvice.element ?? "ธาตุ"} ขัดดวง → ลดความเสี่ยง งดก้อนใหญ่ เก็บเงินสดในวันระวัง` : "เดือนนี้ธาตุกลาง → ทำตามแผนปกติ ทยอยสะสมในวันมงคล";
    callout("สิ่งที่ต้องทำเดือนนี้", plan, "good");
    callout("กฎเหล็ก 5 ข้อ (ทุกเดือน)", "1) ซื้อเฉพาะวันมงคล  2) ไม่เกิน 5% ต่อตัว  3) เช็กลิสต์ 30 ข้อ  4) เงินฉุกเฉินห้ามแตะ  5) ธาตุเดือนขัด = ลดน้ำหนัก", "warn");
  } else {
    doc.addPage(); y = 52; footer();
    lockedSection("ภาค 6 + บท 26", "เสริมดวง + ฉบับเดือนนี้ (ของสด VIP)", "VIP (฿790/เดือน)");
  }
  // ══════════ ภาคผนวก ก: เช็กลิสต์ ══════════
  if (maxSection >= 3) {
    doc.addPage();
    y = 52;
    footer();
    h1("เช็กลิสต์ก่อนลงทุน (30 ข้อ)", "ภาคผนวก ก");
    p("ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 24/30 ขึ้นไปถึงเริ่ม  (ข้อไหนไม่ได้ = หยุดก่อน)", 10, "#8d6e63");
    const checks = [
      [`หุ้นธาตุ = ${d.strengthen.element} หรือธาตุที่ควรทำ (ไม่ใช่ ${d.avoid.join("/")})`, true],
      ["fit ไม่ใช่ 'ขัดดวง' (ธาตุพิฆาต)", true],
      ["fit ไม่ใช่ 'ดูดพลัง' ถ้าดิถีอ่อน", true],
      ["เทียร์ไม่ใช่ INFO (เทียร์ 4 = ยังไม่ควรแตะ)", true],
      ["อยู่ในช่วงวัยจรที่ไม่ใช่ 'เลี่ยง/ห้ามเสี่ยง'", true],
      ["สัดส่วนเงินเย็น/เร็ว/ฉุกเฉินยังคงเดิม", true],
      ["ซื้อเฉพาะวันมงคล (บท 6)", true],
      ["ไม่ซื้อเกิน 5% ของพอร์ตต่อตัวเดียว", true],
      ["มีเหตุผลเขียนได้ 1 บรรทัด (ธุรกิจ+ธาตุ+เทียร์)", true],
      ["หุ้นใหญ่/สภาพคล่องดี (เล็ก = เงินเร็วเท่านั้น)", true],
      ["DCA ดีกว่าซื้อทีเดียวถ้าวัยจร 'สะสม'", true],
      ["ไม่ใช้เงินกู้/มาร์จิ้น (ดิถีอ่อนยิ่งห้าม)", true],
      ["ตั้งจุดตัดขาดทุนไว้ก่อนซื้อ (เช่น -15%)", true],
      ["ธาตุเดือนนี้ไม่ขัด (บท 7)", true],
      ["หุ้นมีธาตุชัดเจน (ไม่ใช่ธาตุคลุมเครือ)", true],
      ["พื้นฐาน: ROE ≥ 15% หรือ Buffett ผ่าน (ถ้ามีข้อมูล)", true],
      ["ราคาไม่แพงเกิน: PE ไม่สูงสุดเป็นประวัติการณ์", true],
      ["เงินเย็นของเดือนนี้เหลือพอ (ไม่กู้เกิน)", true],
      ["ซื้อแล้วถือได้ 1 ปีขึ้นไป (ไม่ใช่เล่นสั้น)", true],
      ["มีเงินฉุกเฉิน 6 เดือนก่อนซื้อ", true],
      ["เช็กข่าวลบรอบตัวหุ้น (อัปเดต 1 สัปดาห์)", true],
      ["ไม่ซื้อตามกระแสโซเชียล (ดวงไม่เอื้อ)", true],
      ["เปรียบเทียบกับพอร์ต: ไม่ซ้ำธาตุเดียวเกิน 40%", true],
      ["วันนี้ไม่ใช่วันระวัง/ผั่วไฉ่โข่ว", true],
      ["สินทรัพย์ตรงกับกองที่ตั้งไว้ (เย็น/เร็ว/ฉุกเฉิน)", true],
      ["หุ้น IPO: ธาตุบริษัทชัดเจน + รอผ่านวันขึ้น 1 สัปดาห์", true],
      ["ไม่ได้ใช้เงินที่ต้องใช้ใน 6 เดือน", true],
      ["เข้าใจธุรกิจของหุ้น (อธิบายได้ 2 ประโยค)", true],
      ["ตั้งเป้าหมายกำไร/ขายไว้ล่วงหน้า", true],
      ["ผ่านเกณฑ์ 24/30 ขึ้นไป", false],
    ] as Array<[string, boolean]>;
    for (const [txt, ok] of checks) {
      doc.circle(58, y + 5, 5).stroke(ok ? C.green : C.gold).lineWidth(1);
      doc.font(F).fontSize(9.5).fillColor("#333333").text(clean(txt), 70, y, { width: 470 });
      y = doc.y + 4;
    }
  }

  // ══════════ ภาคผนวก ข: อภิธานศัพท์ ══════════
  if (maxSection >= 3) {
    doc.addPage();
    y = 52;
    footer();
    h1("อภิธานศัพท์ (เข้าใจคำในเล่มนี้)", "ภาคผนวก ข");
    const gloss: Array<[string, string]> = [
      ["ธาตุ", "พลัง 5 ชนิด (ไม้/ไฟ/ดิน/ทอง/น้ำ) — ทุกสิ่งมีธาตุ: คน (จากวันเกิด) ธุรกิจ หุ้น สินทรัพย์ ตลาด"],
      ["กำลังดิถี", "ความแข็ง-อ่อนของวันเกิด — อ่อน = ต้องเสริม อย่าไล่ลาภ / แข็ง = ถ่ายเทได้ กล้าลงทุน"],
      ["ธาตุลาภ", "ธาตุที่เป็น 'เงิน' ของดวง — ลงทุนธุรกิจธาตุนี้ได้ผล แต่ถ้าเกิน = ดูดพลัง"],
      ["ธาตุพิฆาต", "ธาตุที่ทำลายดวง — ห้ามแตะธุรกิจ/หุ้นธาตุนี้"],
      ["วัยจร", "วงจร 10 ปีของดวง (แบ่ง 5 ปีในเล่มนี้) — สลับธาตุทั้งชีวิต กำหนดจังหวะรวย/ระวัง"],
      ["เชี่ยงแซ", "ระดับพลังของธาตุลาภในแต่ละวัย (ซี่/เจ๊าะ = ห้ามเสี่ยง · ฯลฯ)"],
      ["ดิถี", "วันเกิดในปฏิทินจีน — ตัวแทน 'ตัวตน' ของดวง"],
      ["เทียร์ 1-4", "VIP / PRO / FREE / INFO — ระดับคุณภาพคำแนะนำรายหุ้น (ตรงดวง+พื้นฐาน+สภาพคล่อง+โมเมนตัม)"],
      ["fit 4 ระดับ", "ตรงดวง (ลงทุนได้) / กลาง / ดูดพลัง (เลี่ยง) / ขัดดวง (ห้าม)"],
      ["เงินเย็น/เร็ว/ฉุกเฉิน", "กองยาว (รอจังหวะ) / กองเทรด (เสี่ยงได้) / กองกันภัย (ห้ามแตะ)"],
      ["Life Map", "แผนที่ชีวิต 0-80+ ปี — แถบสีวัยจรบอกว่าช่วงไหนลงทุน/สะสม/เลี่ยง"],
      ["วันมงคล", "วันที่ธาตุเอื้อต่อธุรกรรม — ใช้ซื้อก้อน/เซ็นสัญญา"],
    ];
    for (const [term, def] of gloss) {
      ensure(26);
      doc.font(F_B).fontSize(10).fillColor(C.primary).text(clean(term), 52, y, { width: 120 });
      doc.font(F).fontSize(9.5).fillColor("#555555").text(clean(def), 180, y, { width: 360 });
      y = Math.max(doc.y, y + 16) + 4;
    }
  }

  // ══════════ สรุปท้าย (LLM) ══════════
  if (maxSection >= 2 && narrative.summary) {
    ensure(40);
    doc.roundedRect(52, y, 490, 8, 2).fill(C.gold);
    doc.roundedRect(52, y + 8, 490, 64, 4).fill("#fdf6e3");
    doc.font(F_B).fontSize(11.5).fillColor(C.primary).text(clean("สรุป — ทำอะไรเป็นอันดับแรก"), 62, y + 16, { width: 470 });
    doc.font(F).fontSize(9.5).fillColor("#555555").text(clean(narrative.summary), 62, y + 34, { width: 470 });
    y += 80;
  }

  doc.end();
  return done;
}
