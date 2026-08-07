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

/** ฟอนต์ไทยไม่มี glyph emoji → กรองออก (รวม variation selector) */
function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\uFE00-\uFE0F\u2000-\u2BFF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildFullReportPdf(state: CalculatedStateValue): Promise<Buffer> {
  const d = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 10, "premium");
  const usPicks = buildMonthlyPicks(state, "US", 8, "premium");
  const font = (FONT_CANDIDATES.find((f) => existsSync(f)) ?? "Helvetica") as string;
  const doc = new PDFDocument({ size: "A4", margins: { top: 48, bottom: 56, left: 52, right: 52 }, bufferPages: true });
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
  };
  const h2 = (text: string, color = "#8d6e63") => {
    ensure(34);
    doc.fontSize(15).font(F_B).fillColor(color).text(clean(text), 52, y);
    y += 24;
    doc.moveTo(52, y).lineTo(540, y).strokeColor(color).lineWidth(0.7).stroke();
    y += 12;
  };
  const p = (text: string, size = 10.5, color = "#333333") => {
    ensure(30);
    doc.fontSize(size).font(F).fillColor(color).text(clean(text), 52, y, { width: 490 });
    y = doc.y + 4;
  };
  const row = (cols: Array<{ text: string; w: number; bold?: boolean; color?: string }>) => {
    ensure(20);
    let x = 52;
    for (const c of cols) {
      doc.font(c.bold ? F_B : F).fontSize(9.5).fillColor(c.color ?? "#333333").text(clean(c.text), x, y, { width: c.w });
      x += c.w;
    }
    y += 16;
  };

  // ── ปก ──
  doc.font(F_B).fontSize(26).fillColor("#8d6e63").text(clean("รายงานการลงทุนคู่ดวง"), 52, 120, { align: "center", width: 500 });
  doc.font(F).fontSize(13).fillColor("#666666").text(clean("ฉบับสถาบัน — ดวง x หุ้น x สินทรัพย์ (จัดทำโดย AI ผู้ช่วยลงทุนคู่ดวง)"), 52, 160, { align: "center", width: 500 });
  doc.font(F_B).fontSize(18).fillColor("#333333").text(clean(`${d.persona.emoji} ${d.persona.name}`), 52, 250, { align: "center", width: 500 });
  doc.font(F).fontSize(12).fillColor("#555555").text(clean(`${d.persona.bandLabel} · สไตล์ ${d.persona.style}`), 52, 280, { align: "center", width: 500 });
  doc.font(F).fontSize(11).fillColor("#777777").text(`วันที่ ${new Date().toISOString().slice(0, 10)} · แหล่งข้อมูล Yahoo Finance + ตารางธาตุซินแส`, 52, 310, { align: "center", width: 500 });
  doc.moveTo(52, 380).lineTo(548, 380).strokeColor("#c9b28a").lineWidth(1).stroke();
  doc.font(F).fontSize(9.5).fillColor("#888888").text(clean(d.disclaimer), 52, 400, { width: 500, align: "center" });
  doc.addPage();
  y = 52;
  footer();

  // ── 1. มุมมองดวง ──
  h2("1. มุมมองดวง (Verdict)");
  p(`${d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล"} — ${d.principle.mode} · ${d.principle.desc}`, 11, "#333333");
  p(`หลักการ: ดวงแข็งเกินไป → ถ่ายเท (${d.principle.outputElement}) · ดวงอ่อน/ขาด → เสริม (${d.principle.supplementElement})`, 10.5);
  p(`ธาตุที่ต้องเสริม: ${d.strengthen.element} (${d.strengthen.businessHint}) · ธาตุลาภ: ${d.strengthen.wealth} · ธาตุเลี่ยง: ${d.avoid.join("/")}`, 10.5, "#8d6e63");
  if (d.principle.excessElement) {
    p(`ขอเตือน: ธาตุ ${d.principle.excessElement} มี ${d.principle.excessCount} ตัวในดวง (${d.principle.excessNote})`, 10.5, "#c62828");
  }
  p("สัดส่วนธาตุในดวง: " + d.elementBalance.map((e) => `${e.element} ${e.pct}%`).join("  |  "), 10);
  y += 4;

  // ── 2. จัดสรรเงินตามกำลังดวง ──
  h2("2. การจัดสรรเงินตามกำลังดวง");
  p(`เงินเย็น (ยาว) ${d.trading.split.cold}% — ${d.instruments.cold.join(", ")}`, 10.5);
  p(`เงินเร็ว (เทรด) ${d.trading.split.fast}% — ${d.instruments.fast.join(", ")}`, 10.5);
  p(`เงินสำรองฉุกเฉิน ${d.trading.split.emergency}% — ${d.instruments.emergency.join(", ")}`, 10.5);
  p(`การเทรด: ${d.trading.label} — ${d.trading.reason}`, 10.5, "#8d6e63");
  y += 4;

  // ── 3. หุ้นเด่นประจำเดือน (เทียร์) ──
  h2("3. พอร์ตเด่นประจำเดือน (คัดโดย ดวง x พื้นฐาน x โมเมนตัม)");
  p(`TH30 (เทียบ SET): ${thPicks.benchmark.changePct != null ? `${thPicks.benchmark.changePct}%` : "-"} วันนี้ · คัดเฉพาะธาตุตรงดวง — เคารพสมดุลดิถี (อ่อน: อย่าไล่ลาภ)`, 10, "#666666");
  row([{ text: "อันดับ", w: 40, bold: true }, { text: "หุ้น", w: 90, bold: true }, { text: "ธาตุ", w: 40, bold: true }, { text: "เทียร์", w: 110, bold: true }, { text: "คะแนน", w: 50, bold: true }, { text: "เหตุผลหลัก", w: 170, bold: true }]);
  for (const [i, pk] of thPicks.picks.entries()) {
    const reason = pk.reasons[0] ?? "";
    row([{ text: `#${i + 1}`, w: 40 }, { text: pk.ticker, w: 90, bold: true }, { text: pk.element, w: 40, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 110, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 50 }, { text: reason, w: 170, color: "#555555" }]);
  }
  p("US30 (เทียบ S&P 500) — ตัวอย่าง:", 10, "#666666");
  row([{ text: "อันดับ", w: 40, bold: true }, { text: "หุ้น", w: 90, bold: true }, { text: "ธาตุ", w: 40, bold: true }, { text: "เทียร์", w: 110, bold: true }, { text: "คะแนน", w: 50, bold: true }, { text: "เหตุผลหลัก", w: 170, bold: true }]);
  for (const [i, pk] of usPicks.picks.entries()) {
    row([{ text: `#${i + 1}`, w: 40 }, { text: pk.ticker, w: 90, bold: true }, { text: pk.element, w: 40, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 110, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 50 }, { text: pk.reasons[0] ?? "", w: 170, color: "#555555" }]);
  }
  y += 2;

  // ── 4. สินค้าแนะนำ (หมวดเด่น + เทียร์) ──
  h2("4. สินค้าแนะนำตามดวง (11 หมวด)");
  for (const cat of d.categories) {
    const items = cat.items.slice(0, 2).map((it) => `${it.ticker}(${TIER_LABEL[it.stockTier as StockTier] ?? "[FREE]"} ${it.fit === "good" ? "ตรงดวง" : it.fit === "drain" ? "ดูดพลัง" : it.fit === "avoid" ? "ขัดดวง" : "กลาง"})`).join(", ");
    if (items) p(`${cat.label}: ${items}`, 10, "#333333");
  }
  y += 4;

  // ── 5. ไทม์ไลน์วัยจร ──
  h2("5. ไทม์ไลน์วัยจร (15-84 ปี — ทุก 5 ปี)");
  row([{ text: "ช่วงอายุ", w: 70, bold: true }, { text: "สถานะ", w: 80, bold: true }, { text: "คำแนะนำ", w: 380, bold: true }]);
  for (const t of d.timeline) {
    const verdict = t.verdict === "invest" ? "ลงทุนได" : t.verdict === "accumulate" ? "สะสม" : t.verdict === "avoid" ? "เลี่ยง" : "ไมเสยง";
    row([{ text: `${t.ageRange} ป`, w: 70 }, { text: verdict, w: 80, bold: true, color: t.verdict === "invest" ? "#2e7d32" : t.verdict === "avoid" ? "#c62828" : "#8d6e63" }, { text: t.advice, w: 380, color: "#555555" }]);
  }
  y += 4;

  // ── 6. วันมงคลเดือนนี้ ──
  h2("6. วันมงคล / วันระวัง (เดือนนี้)");
  p(`ธาตุเดือน: ${d.monthAdvice.element ?? "-"} (${d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"}) — ${d.monthAdvice.text}`, 10.5);
  p(`วันมงคล ${d.auspiciousDays.month.goodDayCount} วัน: ${d.auspiciousDays.month.goodDays.map((g) => g.date).join(", ")}`, 10.5, "#2e7d32");
  p(`วันระวัง ${d.auspiciousDays.month.avoidDayCount} วัน: ${d.auspiciousDays.month.avoidDays.map((g) => g.date).join(", ")}`, 10.5, "#c62828");

  doc.end();
  return done;
}
