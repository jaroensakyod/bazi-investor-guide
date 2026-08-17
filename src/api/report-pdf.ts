/**
 * PDF รายงานสไตล์สถาบัน — PDFKit + ฟอนต์ไทย (Leelawadee/Tahoma จาก Windows)
 * ใช้กับ GET /api/report/pdf — สร้าง .pdf จริง (ดาวน์โหลดได้)
 */
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { buildFullReport } from "../lib/report/full-report";

const FONT_CANDIDATES = [
  process.env.PDF_FONT,
  "C:/Windows/Fonts/leelawad.ttf", // Leelawadee (ไทย)
  "C:/Windows/Fonts/tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].filter((f): f is string => Boolean(f));

function findFont(): string {
  return FONT_CANDIDATES.find((f) => existsSync(f)) ?? "Helvetica";
}

const EL_COLOR: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };

/** ฟอนต์ Leelawadee ไม่มี glyph emoji/สัญลักษณ์ → กรองออกก่อนเขียน (รวม variation selector FE0F) */
function clean(s: string): string {
  return [...s]
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return !(
        (codePoint >= 0x1f000 && codePoint <= 0x1ffff)
        || (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
        || (codePoint >= 0x2000 && codePoint <= 0x2bff)
      );
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const pct = (v: number | null): string => (v != null ? `${v}%` : "-");

export async function buildReportPdf(ticker: string, state?: CalculatedStateValue): Promise<Buffer> {
  const report = buildFullReport(ticker, state);
  const font = findFont();
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
    doc.fontSize(8).fillColor("#888888").font(F).text(clean(report.disclaimer), 52, pageH - 40, { width: 500, align: "center" });
  };
  const sectionTitle = (text: string, color = "#8d6e63") => {
    ensure(40);
    y += 18;
    doc.fontSize(13).fillColor(color).font(F_B).text(text, 52, y);
    y += 20;
    doc.moveTo(52, y).lineTo(540, y).strokeColor("#d4c9a8").lineWidth(1).stroke();
    y += 10;
  };
  const line = (text: string, size = 10.5, color = "#222222", indent = 0) => {
    ensure(20);
    const s = clean(text);
    doc.fontSize(size).fillColor(color).font(F).text(s, 52 + indent, y, { width: 488 - indent });
    y += doc.heightOfString(s, { width: 488 - indent }) + 4;
  };
  const row = (a: string, b: string) => {
    ensure(18);
    doc.font(F).fontSize(10).fillColor("#333333").text(clean(a), 52, y);
    doc.font(F_B).text(clean(b), 380, y);
    y += 16;
  };

  // ── หน้าปก ──
  doc.fillColor("#0d0f14").rect(0, 0, 595, 150).fill();
  doc.fillColor("#d4af37").font(F_B).fontSize(20).text("ดวงนักลงทุน", 52, 40);
  doc.fillColor("#e8e6e1").fontSize(13).font(F).text("รายงานวิเคราะห์หุ้น (สไตล์สถาบัน)", 52, 72);
  y = 108;
  doc.fillColor("#9a937f").fontSize(9).font(F).text(`วันที่ ${report.meta.generatedAt} · พ.ศ. ${report.meta.yearBE}`, 52, y);
  y = 150;
  ensure(30);
  doc.fillColor("#222222").font(F_B).fontSize(17).text(clean(`${report.meta.name} (${report.meta.ticker})`), 52, y);
  y += 26;
  doc.font(F).fontSize(11);
  doc.fillColor(EL_COLOR[report.meta.element] ?? "#8d6e63").text(`ธาตุ ${report.meta.element}`, 52, y);
  doc.fillColor("#666666").text(`  ·  ${report.meta.tier}`, 90, y);
  y += 22;

  // ── 1. มุมมองดวง ──
  sectionTitle("1. มุมมองดวง (Verdict)");
  if (report.verdict) {
    line(`ผล: ${report.verdict.label}  (คะแนน ${report.verdict.score}) — ${clean(report.verdict.persona)}`, 11.5, "#1b5e20");
    for (const r of report.verdict.reasons) line(`• ${clean(r)}`, 10, "#444444", 8);
    line(`ควร (invest): ${report.verdict.invest.join(" / ")}   ·   เลี่ยง (avoid): ${report.verdict.avoid.join(" / ")}`, 10.5, "#333333");
    for (const t of report.verdict.timeline) line(`อายุ ${t.ageRange} (${t.verdict}): ${clean(t.advice)}`, 9.5, "#555555");
  } else {
    line("ยังไม่มีข้อมูลดวง (ต้องมีโปรไฟล์ผู้ใช้)", 10, "#999999");
  }

  // ── 2. พื้นฐาน + Buffett ──
  sectionTitle("2. พื้นฐาน + Buffett checklist");
  if (report.fundamentals) {
    row("ROE", pct(report.fundamentals.roe));
    row("Net margin", pct(report.fundamentals.profitMargin));
    row("รายได้โต YoY", pct(report.fundamentals.revenueGrowth));
    row("หนี้ D/E", `${report.fundamentals.debtToEquity ?? "-"}`);
    ensure(16);
    doc.fillColor("#b8860b").font(F_B).fontSize(11).text(`Buffett score: ${report.fundamentals.buffettScore}/10`, 52, y);
    y += 18;
    for (const c of report.fundamentals.checks) line(`${c.status === "pass" ? "✅" : c.status === "warn" ? "🟡" : "❌"} ${c.label}`, 10, c.status === "pass" ? "#2e7d32" : c.status === "warn" ? "#8d6e63" : "#c62828");
  } else {
    line("ยังไม่มีข้อมูลพื้นฐาน (fetch-fundamentals ยังไม่ครอบคลุมตัวนี้)", 10, "#999999");
  }

  // ── 3. เดือนนี้ ──
  sectionTitle("3. เดือนนี้ (Fortune × Market)");
  if (report.month) {
    line(`ธาตุเดือน: ${report.month.monthElement ?? "-"}  ·  ปี: ${report.month.yearElement ?? "-"}  ·  ทิศเงิน: ${report.month.caishenDir ?? "-"}`, 10.5);
    line(`วันดี: ${report.month.goodDays.slice(0, 5).map((d) => `${d.date} (${d.weekday})`).join(", ")}`, 10);
    line(`วันเลี่ยง: ${report.month.avoidDays.slice(0, 3).map((d) => `${d.date} (${d.weekday})`).join(", ")}`, 10, "#c62828");
  } else {
    line("ไม่มีข้อมูลเดือน (ต้องมีโปรไฟล์)", 10, "#999999");
  }

  // ── 4. หุ้นตรงธาตุวันนี้ + สินทรัพย์เด่น ──
  sectionTitle("4. หุ้นที่ตรงธาตุวันนี้ + สินทรัพย์เด่น");
  if (report.dayStocks.length) {
    for (const s of report.dayStocks) line(`${s.ticker} ${s.name} — ธาตุ${s.element}${s.changePct != null ? `  ${s.changePct >= 0 ? "+" : ""}${s.changePct}%` : ""}`, 10, "#222222", 8);
  }
  if (report.topAssets.length) {
    line("สินทรัพย์เด่น (เทียบดวง):", 10.5, "#8d6e63");
    for (const a of report.topAssets.slice(0, 5)) line(`${a.name} — ${a.verdict} (${a.score})`, 10, "#333333", 8);
  }

  footer();
  doc.end();
  return done;
}
