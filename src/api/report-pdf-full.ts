/**
 * PDF รายงานคู่ดวงฉบับเต็ม (สถาบัน) — ดวงผู้ใช้ + จัดพอร์ต + หุ้นเด่น(เทียร์) + ไทม์ไลน์ + วันมงคล
 * ใช้กับ GET /api/report/full-pdf — PDFKit + ฟอนต์ไทย Leelawadee (strip emoji → ป้าย [VIP]/[PRO]/[FREE]/[INFO])
 */
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { buildPersonalDashboard } from "../lib/portfolio/personal-dashboard";
import { buildMonthlyPicks } from "../lib/picks/monthly-picks";
import { TIER_META, type StockTier } from "../lib/investor/stock-tiers";

const FONT_CANDIDATES = [
  process.env.PDF_FONT,
  "C:/Windows/Fonts/leelawad.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].filter((f): f is string => Boolean(f));

const EL_COLOR: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };
const TIER_LABEL: Record<StockTier, string> = { gold: "[VIP เทียร์ 1]", silver: "[PRO เทียร์ 2]", bronze: "[FREE เทียร์ 3]", base: "[INFO เทียร์ 4]" };
// ── Design system (ตรงกับการ์ด) ──
const C = { primary: "#14532d", gold: "#b8860b", ink: "#2b2417", muted: "#8a8478", cream: "#f7f4ec", line: "#e0d9c8", red: "#9b2c2c", green: "#1e6f3e", white: "#ffffff" };

/** ฟอนต์ไทยไม่มี glyph emoji → กรองออก (รวม variation selector) */
function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\uFE00-\uFE0F\u2000-\u2BFF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildFullReportPdf(state: CalculatedStateValue, opts?: { maxSection?: number; lockedNote?: string }): Promise<Buffer> {
  const maxSection = opts?.maxSection ?? 6;
  const lockedNote = opts?.lockedNote ?? "ปลดล็อกด้วยฉบับที่สูงขึ้น";
  const d = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 10, "premium");
  const usPicks = buildMonthlyPicks(state, "US", 8, "premium");
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
    // brand + หมายเลขหน้า
    doc.font(F_B).fontSize(8).fillColor(C.gold).text(clean("ดวงนักลงทุน"), 52, pageH - 52);
    doc.font(F).fontSize(8).fillColor("#bbbbbb").text(`หนา ${doc.bufferedPageRange().count}`, 500, pageH - 52, { width: 48, align: "right" });
  };
  const h2 = (text: string, color = C.gold) => {
    ensure(34);
    doc.rect(52, y, 5, 16).fill(color);
    doc.fontSize(14.5).font(F_B).fillColor(C.primary).text(clean(text), 66, y - 2);
    y += 22;
    doc.moveTo(52, y).lineTo(540, y).strokeColor(C.line).lineWidth(0.7).stroke();
    y += 12;
  };
  const p = (text: string, size = 10.5, color = "#333333") => {
    ensure(30);
    doc.fontSize(size).font(F).fillColor(color).text(clean(text), 52, y, { width: 490 });
    y = doc.y + 4;
  };
  const callout = (text: string, color = C.red) => {
    ensure(26);
    doc.roundedRect(52, y, 490, 22, 4).fill(color === C.red ? "#f9ecec" : "#eef5ee");
    doc.font(F_B).fontSize(9.5).fillColor(color).text(clean(text), 62, y + 5, { width: 470 });
    y += 28;
  };
  // ส่วนที่ยังไม่จ่าย = กล่องล็อก (จำลองเบลอ — เนื้อหาจาง + overlay "🔒")
  const lockedSection = (num: number, title: string, unlockTier: string) => {
    ensure(60);
    doc.rect(52, y, 5, 16).fill("#c9c2b2");
    doc.fontSize(14).font(F_B).fillColor("#9a9388").text(clean(`${num}. ${title}`), 66, y - 2);
    y += 26;
    doc.roundedRect(52, y, 490, 52, 6).fill("#e9e5da");
    doc.font(F_B).fontSize(11).fillColor("#b8b0a0").text(clean("เนื้อหาส่วนนี้ถูกจำกัด (ตัวอย่างเบลอ)"), 70, y + 12, { width: 450 });
    doc.font(F).fontSize(9.5).fillColor(C.gold).text(clean(`[ ล็อกอยู่ — ${unlockTier} ]`), 70, y + 32, { width: 450 });
    y += 62;
  };
  const row = (cols: Array<{ text: string; w: number; bold?: boolean; color?: string }>, header = false) => {
    ensure(20);
    let x = 52;
    if (header) {
      doc.rect(52, y, 490, 17).fill("#eef2ec");
    }
    for (const c of cols) {
      doc.font(c.bold || header ? F_B : F).fontSize(header ? 9 : 9.5).fillColor(header ? C.primary : c.color ?? "#333333").text(clean(c.text), x, y + (header ? 3 : 0), { width: c.w });
      x += c.w;
    }
    y += header ? 19 : 16;
  };

  // ── ปก (แถบสี + ทอง) ──
  doc.rect(0, 0, 595, 150).fill(C.primary);
  doc.rect(0, 150, 595, 4).fill(C.gold);
  doc.font(F_B).fontSize(13).fillColor("#cfe3d4").text(clean("ดวงนักลงทุน  ·  ฉบับสถาบัน"), 52, 32);
  doc.font(F_B).fontSize(30).fillColor(C.white).text(clean("รายงานการลงทุนคู่ดวง"), 52, 62, { width: 490 });
  doc.font(F).fontSize(12.5).fillColor("#cfe3d4").text(clean("ดวง x หุ้น x สินทรัพย์ — คำนวณจากตำรา 60 กะจื่อ × ข้อมูลตลาดจริง"), 52, 104, { width: 490 });
  doc.roundedRect(52, 200, 490, 60, 8).fill(C.cream);
  doc.font(F_B).fontSize(19).fillColor(C.primary).text(clean(`${d.persona.emoji} ${d.persona.name}`), 70, 214, { width: 450 });
  doc.font(F).fontSize(11.5).fillColor(C.muted).text(clean(`${d.persona.bandLabel}  ·  สไตล์ ${d.persona.style}  ·  เทรด: ${d.trading.label}`), 70, 240, { width: 450 });
  doc.font(F).fontSize(10).fillColor(C.muted).text(`วันที่ ${new Date().toISOString().slice(0, 10)}  ·  แหล่ง: Yahoo Finance + ตารางธาตุซินแส`, 52, 280, { width: 490 });
  doc.font(F_B).fontSize(11).fillColor(C.gold).text(clean("สารบัญ: 1.มุมมองดวง  2.จัดสรรเงิน  3.พอร์ตเด่น(เทียร์)  4.สินค้าแนะนำ  5.ไทม์ไลน์วัยจร  6.วันมงคล"), 52, 320, { width: 490 });
  doc.rect(0, 812, 595, 30).fill(C.cream);
  doc.font(F).fontSize(7.5).fillColor("#999999").text(clean(d.disclaimer), 52, 819, { width: 490, align: "center" });
  doc.addPage();
  y = 52;
  footer();

  // ── 1. มุมมองดวง ──
  if (maxSection >= 1) {
  h2("1. มุมมองดวง (Verdict)");
  p(`${d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล"} — ${d.principle.mode} · ${d.principle.desc}`, 11, "#333333");
  p(`หลักการ: ดวงแข็งเกินไป → ถ่ายเท (${d.principle.outputElement}) · ดวงอ่อน/ขาด → เสริม (${d.principle.supplementElement})`, 10.5);
  p(`ธาตุที่ต้องเสริม: ${d.strengthen.element} (${d.strengthen.businessHint}) · ธาตุลาภ: ${d.strengthen.wealth} · ธาตุเลี่ยง: ${d.avoid.join("/")}`, 10.5, "#8d6e63");
  if (d.principle.excessElement) {
    p(`ขอเตือน: ธาตุ ${d.principle.excessElement} มี ${d.principle.excessCount} ตัวในดวง (${d.principle.excessNote})`, 10.5, "#c62828");
  }
  p("สัดส่วนธาตุในดวง: " + d.elementBalance.map((e) => `${e.element} ${e.pct}%`).join("  |  "), 10);
  y += 4;
  } else {
    lockedSection(1, "มุมมองดวง (Verdict)", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ── 2. จัดสรรเงินตามกำลังดวง ──
  if (maxSection >= 2) {
  h2("2. การจัดสรรเงินตามกำลังดวง");
  p(`เงินเย็น (ยาว) ${d.trading.split.cold}% — ${d.instruments.cold.join(", ")}`, 10.5);
  p(`เงินเร็ว (เทรด) ${d.trading.split.fast}% — ${d.instruments.fast.join(", ")}`, 10.5);
  p(`เงินสำรองฉุกเฉิน ${d.trading.split.emergency}% — ${d.instruments.emergency.join(", ")}`, 10.5);
  p(`การเทรด: ${d.trading.label} — ${d.trading.reason}`, 10.5, "#8d6e63");
  y += 4;
  } else {
    lockedSection(2, "การจัดสรรเงินตามกำลังดวง", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ── 3. หุ้นเด่นประจำเดือน (เทียร์) ──
  if (maxSection >= 3) {
  h2("3. พอร์ตเด่นประจำเดือน (คัดโดย ดวง x พื้นฐาน x โมเมนตัม)");
  p(`TH30 (เทียบ SET): ${thPicks.benchmark.changePct != null ? `${thPicks.benchmark.changePct}%` : "-"} วันนี้ · คัดเฉพาะธาตุตรงดวง — เคารพสมดุลดิถี (อ่อน: อย่าไล่ลาภ)`, 10, "#666666");
  row([{ text: "อันดับ", w: 40, bold: true }, { text: "หุ้น", w: 90, bold: true }, { text: "ธาตุ", w: 40, bold: true }, { text: "เทียร์", w: 110, bold: true }, { text: "คะแนน", w: 50, bold: true }, { text: "เหตุผลหลัก", w: 170, bold: true }], true);
  for (const [i, pk] of thPicks.picks.entries()) {
    const reason = pk.reasons[0] ?? "";
    row([{ text: `#${i + 1}`, w: 40 }, { text: pk.ticker, w: 90, bold: true }, { text: pk.element, w: 40, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 110, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 50 }, { text: reason, w: 170, color: "#555555" }]);
  }
  p("US30 (เทียบ S&P 500) — ตัวอย่าง:", 10, "#666666");
  row([{ text: "อันดับ", w: 40, bold: true }, { text: "หุ้น", w: 90, bold: true }, { text: "ธาตุ", w: 40, bold: true }, { text: "เทียร์", w: 110, bold: true }, { text: "คะแนน", w: 50, bold: true }, { text: "เหตุผลหลัก", w: 170, bold: true }], true);
  for (const [i, pk] of usPicks.picks.entries()) {
    row([{ text: `#${i + 1}`, w: 40 }, { text: pk.ticker, w: 90, bold: true }, { text: pk.element, w: 40, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 110, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 50 }, { text: pk.reasons[0] ?? "", w: 170, color: "#555555" }]);
  }
  y += 2;
  } else {
    lockedSection(3, "พอร์ตเด่นประจำเดือน (เทียร์)", maxSection <= 2 ? "ฉบับ Pro (฿490)" : "VIP (฿790/เดือน)");
  }

  // ── 4. สินค้าแนะนำ (หมวดเด่น + เทียร์) ──
  if (maxSection >= 4) {
  h2("4. สินค้าแนะนำตามดวง (11 หมวด)");
  for (const cat of d.categories) {
    const items = cat.items.slice(0, 2).map((it) => `${it.ticker}(${TIER_LABEL[it.stockTier as StockTier] ?? "[FREE]"} ${it.fit === "good" ? "ตรงดวง" : it.fit === "drain" ? "ดูดพลัง" : it.fit === "avoid" ? "ขัดดวง" : "กลาง"})`).join(", ");
    if (items) p(`${cat.label}: ${items}`, 10, "#333333");
  }
  y += 4;
  } else {
    lockedSection(4, "สินค้าแนะนำตามดวง (11 หมวด)", maxSection <= 2 ? "ฉบับ Pro (฿490)" : "VIP (฿790/เดือน)");
  }

  // ── 5. ไทม์ไลน์วัยจร ──
  if (maxSection >= 5) {
  h2("5. ไทม์ไลน์วัยจร (15-84 ปี — ทุก 5 ปี)");
  row([{ text: "ช่วงอายุ", w: 70, bold: true }, { text: "สถานะ", w: 80, bold: true }, { text: "คำแนะนำ", w: 380, bold: true }], true);
  for (const t of d.timeline) {
    const verdict = t.verdict === "invest" ? "ลงทุนได" : t.verdict === "accumulate" ? "สะสม" : t.verdict === "avoid" ? "เลี่ยง" : "ไมเสยง";
    row([{ text: `${t.ageRange} ป`, w: 70 }, { text: verdict, w: 80, bold: true, color: t.verdict === "invest" ? "#2e7d32" : t.verdict === "avoid" ? "#c62828" : "#8d6e63" }, { text: t.advice, w: 380, color: "#555555" }]);
  }
  y += 4;
  } else {
    lockedSection(5, "ไทม์ไลน์วัยจร (แผนที่ชีวิต)", "VIP (฿790/เดือน)");
  }

  // ── 6. วันมงคลเดือนนี้ ──
  if (maxSection >= 6) {
  h2("6. วันมงคล / วันระวัง (เดือนนี้)");
  p(`ธาตุเดือน: ${d.monthAdvice.element ?? "-"} (${d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"}) — ${d.monthAdvice.text}`, 10.5);
  p(`วันมงคล ${d.auspiciousDays.month.goodDayCount} วัน: ${d.auspiciousDays.month.goodDays.map((g) => g.date).join(", ")}`, 10.5, "#2e7d32");
  p(`วันระวัง ${d.auspiciousDays.month.avoidDayCount} วัน: ${d.auspiciousDays.month.avoidDays.map((g) => g.date).join(", ")}`, 10.5, "#c62828");
  } else {
    lockedSection(6, "วันมงคล / วันระวัง (รายเดือน)", "VIP (฿790/เดือน)");
  }

  doc.end();
  return done;
}
