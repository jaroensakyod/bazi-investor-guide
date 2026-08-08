import { existsSync } from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { buildMonthlyPicks } from "../lib/picks/monthly-picks";
import { buildPersonalDashboard } from "../lib/portfolio/personal-dashboard";
import { buildFinancialSnapshot, FINANCIAL_PRESETS, type FinancialInputs } from "../lib/report/financial-system";
import { readBookNarrativeFromCache } from "../lib/report/narrative-v6";
import { buildReportToc, getReportManifest, type ReportPageId, type ReportPageSpec, type ReportTier } from "../lib/report/product-system";

const PAGE = { width: 595.28, height: 841.89, left: 54, right: 54, bottom: 58 };
const CONTENT_WIDTH = PAGE.width - PAGE.left - PAGE.right;
const COLORS = {
  paper: "#FAF7EF",
  paperDeep: "#EEE7DA",
  ink: "#29252B",
  inkSoft: "#5B555B",
  plum: "#4B2736",
  plumDark: "#241D27",
  gold: "#BA9150",
  line: "#D7CBB9",
  jade: "#315F59",
  white: "#FFFDFA",
  red: "#A84332",
};
const ELEMENT_COLOR: Record<string, string> = {
  ไม้: "#3F6D4F",
  ไฟ: "#A84332",
  ดิน: "#8A6949",
  ทอง: "#A57C38",
  น้ำ: "#315F67",
};

type ReportProfile = {
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  province?: string;
};

export type EditorialPdfOptions = {
  tier?: ReportTier | string;
  financial?: FinancialInputs;
  profile?: ReportProfile;
};

type Metric = { label: string; value: string; note?: string; tone?: "accent" | "good" | "warn" };
type TableRow = { cells: string[]; tone?: "accent" | "warn" | "muted" };

function clean(value: unknown): string {
  return String(value ?? "")
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: unknown, max = 260): string {
  const text = clean(value);
  return text.length <= max ? text : `${text.slice(0, max - 1).trim()}…`;
}

function money(value: number): string {
  return `${Math.round(value).toLocaleString("th-TH")} บาท`;
}

function number(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? "—" : value.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

function thaiDate(value?: string): string {
  if (!value) return "ไม่ระบุ";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

function ageAt(birthDate?: string, asOf = new Date()): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = asOf.getFullYear() - birth.getFullYear();
  if (asOf.getMonth() < birth.getMonth() || (asOf.getMonth() === birth.getMonth() && asOf.getDate() < birth.getDate())) age -= 1;
  return age;
}

function rangeIncludes(range: string, age: number | null): boolean {
  if (age == null) return false;
  const [start, end] = range.split(/[–-]/).map((part) => Number(part.trim()));
  return Number.isFinite(start) && Number.isFinite(end) && age >= start && age <= end;
}

function percentileTone(value: number): "good" | "warn" | "accent" {
  if (value < 0) return "warn";
  if (value >= 60) return "good";
  return "accent";
}

function fontPaths() {
  const reportDir = path.resolve("public/report/fonts");
  const regular = path.join(reportDir, "Sarabun-Regular.ttf");
  const bold = path.join(reportDir, "Sarabun-Bold.ttf");
  const display = path.join(reportDir, "IBMPlexSansThai-Bold.ttf");
  if (!existsSync(regular) || !existsSync(bold) || !existsSync(display)) {
    throw new Error("ไม่พบฟอนต์รายงานใน public/report/fonts");
  }
  return { regular, bold, display };
}

function createPainter(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string; display: string },
  accent: string,
  spec: ReportPageSpec,
  folio: number,
  totalPages: number,
  version: string,
  title: string,
  cue: string,
  lede?: string,
) {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper);
  doc.rect(0, 0, 8, PAGE.height).fill(accent);
  doc.moveTo(PAGE.left, 43).lineTo(PAGE.width - PAGE.right, 43).lineWidth(1.2).stroke(accent);
  doc.font(fonts.display).fontSize(8.8).fillColor(accent).text(clean(spec.label).toUpperCase(), PAGE.left, 24, { width: 265, characterSpacing: 0.5 });
  doc.font(fonts.regular).fontSize(8.8).fillColor("#82797A").text(clean(cue), PAGE.width - PAGE.right - 210, 24, { width: 210, align: "right" });

  const titleSize = title.length > 74 ? 22 : title.length > 50 ? 25 : 28;
  doc.font(fonts.display).fontSize(titleSize).fillColor(COLORS.ink).text(clean(title), PAGE.left, 66, {
    width: CONTENT_WIDTH,
    lineGap: 2,
  });
  let y = doc.y + 12;
  if (lede) {
    doc.font(fonts.regular).fontSize(12.3).fillColor(COLORS.inkSoft).text(clean(lede), PAGE.left, y, {
      width: CONTENT_WIDTH,
      lineGap: 4.2,
    });
    y = doc.y + 15;
  }

  const assertRoom = (need: number, label: string) => {
    if (y + need > PAGE.height - 76) throw new Error(`PDF page overflow: ${spec.id}/${label} at ${Math.round(y + need)}`);
  };

  const paragraph = (text: string, options?: { size?: number; color?: string; gap?: number; width?: number; x?: number }) => {
    const size = options?.size ?? 11.8;
    const width = options?.width ?? CONTENT_WIDTH;
    const x = options?.x ?? PAGE.left;
    doc.font(fonts.regular).fontSize(size);
    const content = clean(text);
    const height = doc.heightOfString(content, { width, lineGap: 4 });
    assertRoom(height + (options?.gap ?? 10), "paragraph");
    doc.fillColor(options?.color ?? COLORS.ink).text(content, x, y, { width, lineGap: 4 });
    y = doc.y + (options?.gap ?? 10);
  };

  const section = (heading: string, body: string) => {
    doc.font(fonts.display).fontSize(13.2);
    const headingHeight = doc.heightOfString(clean(heading), { width: CONTENT_WIDTH - 20, lineGap: 2 });
    doc.font(fonts.regular).fontSize(11.7);
    const bodyHeight = doc.heightOfString(clean(body), { width: CONTENT_WIDTH - 20, lineGap: 4 });
    assertRoom(headingHeight + bodyHeight + 22, `section:${heading}`);
    doc.rect(PAGE.left, y + 2, 4, headingHeight + 3).fill(accent);
    doc.font(fonts.display).fontSize(13.2).fillColor(COLORS.ink).text(clean(heading), PAGE.left + 14, y, { width: CONTENT_WIDTH - 14, lineGap: 2 });
    y = doc.y + 5;
    doc.font(fonts.regular).fontSize(11.7).fillColor(COLORS.inkSoft).text(clean(body), PAGE.left + 14, y, { width: CONTENT_WIDTH - 14, lineGap: 4.2 });
    y = doc.y + 12;
  };

  const bullets = (heading: string, items: string[]) => {
    doc.font(fonts.display).fontSize(13.2);
    const headingHeight = doc.heightOfString(clean(heading), { width: CONTENT_WIDTH });
    doc.font(fonts.regular).fontSize(11.4);
    const bodyHeight = items.reduce((sum, item) => sum + doc.heightOfString(clean(item), { width: CONTENT_WIDTH - 28, lineGap: 3 }) + 7, 0);
    assertRoom(headingHeight + bodyHeight + 19, `bullets:${heading}`);
    doc.font(fonts.display).fontSize(13.2).fillColor(accent).text(clean(heading), PAGE.left, y, { width: CONTENT_WIDTH });
    y = doc.y + 7;
    for (const item of items) {
      doc.circle(PAGE.left + 4, y + 6, 2.2).fill(COLORS.gold);
      doc.font(fonts.regular).fontSize(11.4).fillColor(COLORS.ink).text(clean(item), PAGE.left + 16, y, { width: CONTENT_WIDTH - 16, lineGap: 3.2 });
      y = doc.y + 7;
    }
    y += 4;
  };

  const metrics = (items: Metric[], columns = 3) => {
    const rows = Math.ceil(items.length / columns);
    const cellWidth = CONTENT_WIDTH / columns;
    const cellHeight = 82;
    assertRoom(rows * cellHeight + 10, "metrics");
    doc.moveTo(PAGE.left, y).lineTo(PAGE.width - PAGE.right, y).lineWidth(1.5).stroke(accent);
    for (const [index, item] of items.entries()) {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const x = PAGE.left + col * cellWidth;
      const top = y + row * cellHeight;
      if (col > 0) doc.moveTo(x, top + 9).lineTo(x, top + cellHeight - 10).lineWidth(0.7).stroke(COLORS.line);
      doc.font(fonts.display).fontSize(8.5).fillColor(accent).text(clean(item.label).toUpperCase(), x + (col ? 13 : 0), top + 12, { width: cellWidth - 15 });
      const tone = item.tone === "warn" ? COLORS.red : item.tone === "good" ? COLORS.jade : COLORS.ink;
      doc.font(fonts.display).fontSize(item.value.length > 18 ? 15.5 : 20).fillColor(tone).text(clean(item.value), x + (col ? 13 : 0), top + 29, { width: cellWidth - 15 });
      if (item.note) doc.font(fonts.regular).fontSize(9.2).fillColor(COLORS.inkSoft).text(shorten(item.note, 75), x + (col ? 13 : 0), top + 58, { width: cellWidth - 15, lineGap: 1.7 });
    }
    y += rows * cellHeight + 12;
  };

  const rows = (items: Array<{ label: string; title: string; body: string; aside?: string }>, options?: { compact?: boolean }) => {
    const rowHeight = options?.compact ? 61 : 76;
    assertRoom(items.length * rowHeight + 4, "rows");
    doc.moveTo(PAGE.left, y).lineTo(PAGE.width - PAGE.right, y).lineWidth(1.4).stroke(accent);
    for (const item of items) {
      const top = y;
      doc.font(fonts.display).fontSize(9).fillColor(accent).text(clean(item.label), PAGE.left, top + 10, { width: 62 });
      doc.font(fonts.display).fontSize(13).fillColor(COLORS.ink).text(shorten(item.title, 58), PAGE.left + 74, top + 9, { width: item.aside ? 235 : 405 });
      doc.font(fonts.regular).fontSize(options?.compact ? 10.2 : 10.8).fillColor(COLORS.inkSoft).text(shorten(item.body, options?.compact ? 150 : 190), PAGE.left + 74, top + 31, { width: item.aside ? 270 : 405, lineGap: 2.8 });
      if (item.aside) doc.font(fonts.bold).fontSize(9.5).fillColor(COLORS.ink).text(shorten(item.aside, 80), PAGE.width - PAGE.right - 125, top + 11, { width: 125, align: "right", lineGap: 2 });
      doc.moveTo(PAGE.left, top + rowHeight).lineTo(PAGE.width - PAGE.right, top + rowHeight).lineWidth(0.7).stroke(COLORS.line);
      y += rowHeight;
    }
    y += 9;
  };

  const table = (headers: string[], tableRows: TableRow[], widths?: number[]) => {
    const columnWidths = widths ?? headers.map(() => CONTENT_WIDTH / headers.length);
    const headerHeight = 27;
    const rowHeight = 44;
    assertRoom(headerHeight + tableRows.length * rowHeight + 8, "table");
    doc.rect(PAGE.left, y, CONTENT_WIDTH, headerHeight).fill(COLORS.plumDark);
    let x = PAGE.left;
    headers.forEach((header, index) => {
      doc.font(fonts.display).fontSize(8.5).fillColor(COLORS.white).text(clean(header), x + 8, y + 8, { width: columnWidths[index] - 12 });
      x += columnWidths[index];
    });
    y += headerHeight;
    for (const row of tableRows) {
      if (row.tone === "warn") doc.rect(PAGE.left, y, CONTENT_WIDTH, rowHeight).fill("#F3E4DF");
      else if (row.tone === "accent") doc.rect(PAGE.left, y, CONTENT_WIDTH, rowHeight).fill("#E8EEE8");
      x = PAGE.left;
      row.cells.forEach((cell, index) => {
        const color = row.tone === "muted" ? "#807779" : COLORS.ink;
        doc.font(index === 0 ? fonts.bold : fonts.regular).fontSize(9.7).fillColor(color).text(shorten(cell, 120), x + 8, y + 8, { width: columnWidths[index] - 12, height: rowHeight - 12, ellipsis: true, lineGap: 2.2 });
        x += columnWidths[index];
      });
      doc.moveTo(PAGE.left, y + rowHeight).lineTo(PAGE.width - PAGE.right, y + rowHeight).lineWidth(0.55).stroke(COLORS.line);
      y += rowHeight;
    }
    y += 12;
  };

  const quote = (text: string, label?: string) => {
    doc.font(fonts.display).fontSize(15.5);
    const quoteHeight = doc.heightOfString(clean(text), { width: CONTENT_WIDTH - 52, lineGap: 4 });
    assertRoom(quoteHeight + 43, "quote");
    doc.rect(PAGE.left, y, CONTENT_WIDTH, quoteHeight + 30).fill(COLORS.paperDeep);
    doc.rect(PAGE.left, y, 5, quoteHeight + 30).fill(accent);
    if (label) doc.font(fonts.display).fontSize(8.5).fillColor(accent).text(clean(label).toUpperCase(), PAGE.left + 22, y + 10, { width: CONTENT_WIDTH - 42 });
    doc.font(fonts.display).fontSize(15.5).fillColor(COLORS.ink).text(clean(text), PAGE.left + 22, y + (label ? 29 : 14), { width: CONTENT_WIDTH - 44, lineGap: 4 });
    y += quoteHeight + 42;
  };

  const bars = (items: Array<{ label: string; value: number; note?: string; color?: string }>) => {
    assertRoom(items.length * 34 + 10, "bars");
    const max = Math.max(1, ...items.map((item) => item.value));
    for (const item of items) {
      doc.font(fonts.bold).fontSize(9.5).fillColor(COLORS.ink).text(clean(item.label), PAGE.left, y + 2, { width: 76 });
      doc.rect(PAGE.left + 84, y + 5, 300, 9).fill("#E5DDD1");
      doc.rect(PAGE.left + 84, y + 5, 300 * (Math.max(0, item.value) / max), 9).fill(item.color ?? accent);
      doc.font(fonts.display).fontSize(10).fillColor(COLORS.ink).text(item.note ?? number(item.value), PAGE.left + 396, y, { width: 91, align: "right" });
      y += 34;
    }
    y += 5;
  };

  const form = (fields: Array<{ label: string; lines: number }>) => {
    const total = fields.reduce((sum, field) => sum + 29 + field.lines * 22, 0);
    assertRoom(total, "form");
    doc.moveTo(PAGE.left, y).lineTo(PAGE.width - PAGE.right, y).lineWidth(1.4).stroke(accent);
    for (const field of fields) {
      doc.font(fonts.display).fontSize(10.5).fillColor(accent).text(clean(field.label), PAGE.left, y + 10, { width: 180 });
      y += 31;
      for (let index = 0; index < field.lines; index += 1) {
        doc.moveTo(PAGE.left + 12, y + 13).lineTo(PAGE.width - PAGE.right, y + 13).lineWidth(0.55).stroke("#AFA59C");
        y += 22;
      }
      y += 5;
    }
  };

  const finish = () => {
    if (y > PAGE.height - 70) throw new Error(`PDF page overflow after render: ${spec.id} at ${Math.round(y)}`);
    doc.moveTo(PAGE.left, PAGE.height - 43).lineTo(PAGE.width - PAGE.right, PAGE.height - 43).lineWidth(0.6).stroke(COLORS.line);
    doc.font(fonts.regular).fontSize(7.8).fillColor("#867D7B").text(`ข้อมูลเพื่อการวางแผน ไม่ใช่คำรับรองผลตอบแทน · ${version}`, PAGE.left, PAGE.height - 33, { width: 350 });
    doc.font(fonts.display).fontSize(8.4).fillColor(accent).text(`${String(folio).padStart(2, "0")} / ${String(totalPages).padStart(2, "0")}`, PAGE.width - PAGE.right - 100, PAGE.height - 33, { width: 100, align: "right" });
  };

  return { paragraph, section, bullets, metrics, rows, table, quote, bars, form, finish };
}

function drawCover(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string; display: string },
  accent: string,
  manifest: ReturnType<typeof getReportManifest>,
  profile: ReportProfile,
  personaName: string,
  personaBand: string,
  promise: string,
) {
  const coverPath = path.resolve("public/report/cover-v5.png");
  if (existsSync(coverPath)) doc.image(coverPath, 0, 0, { width: PAGE.width, height: PAGE.height });
  else doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.paper);
  doc.save().opacity(0.94).rect(0, 0, 365, PAGE.height).fill(COLORS.paper).restore();
  doc.rect(0, 0, 12, PAGE.height).fill(accent);
  doc.font(fonts.display).fontSize(9.5).fillColor(accent).text("PERSONAL CAPITAL FIELD GUIDE", 48, 46, { width: 290, characterSpacing: 1 });
  doc.font(fonts.display).fontSize(34).fillColor(COLORS.ink).text("แผนที่เงินและ\nการตัดสินใจ", 48, 155, { width: 295, lineGap: 5 });
  doc.font(fonts.display).fontSize(19).fillColor(accent).text("ฉบับเฉพาะบุคคล", 48, 265, { width: 270 });
  doc.moveTo(48, 314).lineTo(310, 314).lineWidth(1.3).stroke(accent);
  doc.font(fonts.display).fontSize(21).fillColor(COLORS.ink).text(clean(personaName), 48, 342, { width: 270 });
  doc.font(fonts.regular).fontSize(11.5).fillColor(COLORS.inkSoft).text(clean(`${personaBand} · ${thaiDate(profile.birthDate)} · ${profile.birthTime || "ไม่ระบุเวลา"} · ${profile.province || "ไม่ระบุสถานที่"}`), 48, 377, { width: 282, lineGap: 4 });
  doc.font(fonts.display).fontSize(10.5).fillColor(accent).text(clean(`${manifest.config.displayName} · ${manifest.config.priceLabel} · ${manifest.pageCount} หน้า`), 48, 445, { width: 280 });
  doc.font(fonts.regular).fontSize(11.4).fillColor(COLORS.ink).text(clean(promise), 48, 478, { width: 280, lineGap: 4 });
  doc.rect(48, 600, 260, 112).fill(COLORS.plumDark);
  doc.font(fonts.display).fontSize(8.5).fillColor("#E6C98E").text("สิ่งที่เล่มนี้ทำ", 64, 616, { width: 228 });
  doc.font(fonts.regular).fontSize(9.9).fillColor(COLORS.white).text("แยกข้อเท็จจริง ผลคำนวณ การตีความ และสมมติฐาน เพื่อให้คุณใช้ดวงเป็นกระจกของพฤติกรรม ไม่ใช้แทนข้อมูลการเงินจริง", 64, 638, { width: 228, height: 62, lineGap: 3.2, ellipsis: true });
  doc.font(fonts.regular).fontSize(8.3).fillColor(COLORS.inkSoft).text(`รายงานรุ่น ${manifest.version} · สร้าง ${thaiDate(new Date().toISOString())}`, 48, PAGE.height - 54, { width: 280 });
}

function drawClosing(
  doc: PDFKit.PDFDocument,
  fonts: { regular: string; bold: string; display: string },
  accent: string,
  manifest: ReturnType<typeof getReportManifest>,
  personaName: string,
  dominant: string,
  support: string,
) {
  const coverPath = path.resolve("public/report/cover-v5.png");
  if (existsSync(coverPath)) doc.image(coverPath, 0, 0, { width: PAGE.width, height: PAGE.height });
  doc.save().opacity(0.91).rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.plumDark).restore();
  doc.rect(0, 0, 12, PAGE.height).fill(accent);
  doc.font(fonts.display).fontSize(9.5).fillColor("#E6C98E").text("FINAL NOTE", 54, 58, { width: 470, characterSpacing: 1.2 });
  doc.font(fonts.display).fontSize(31).fillColor(COLORS.white).text("คุณไม่ต้องทำนายอนาคตให้ถูก\nเพื่อดูแลเงินได้ดี", 54, 184, { width: 450, lineGap: 7 });
  doc.font(fonts.regular).fontSize(13).fillColor("#E1D9DD").text(clean(`สำหรับดวง ${personaName} จุดได้เปรียบเกิดเมื่อคุณใช้แรงธาตุ${dominant}อย่างมีขอบเขต และฝึกนิสัยธาตุ${support}ให้กลายเป็นกติกาที่ทำซ้ำได้`), 54, 318, { width: 420, lineGap: 6 });
  const rules = ["แยกเงินก่อนเลือกสินทรัพย์", "เขียนเหตุผลก่อนรู้ผลลัพธ์", "ทบทวนเมื่อข้อมูลเปลี่ยน ไม่ทบทวนเพราะราคาเสียงดัง"];
  let y = 466;
  rules.forEach((rule, index) => {
    doc.font(fonts.display).fontSize(11).fillColor("#E6C98E").text(String(index + 1).padStart(2, "0"), 54, y, { width: 30 });
    doc.font(fonts.display).fontSize(15).fillColor(COLORS.white).text(clean(rule), 98, y - 2, { width: 385 });
    doc.moveTo(98, y + 27).lineTo(480, y + 27).lineWidth(0.5).stroke("#786C75");
    y += 66;
  });
  doc.font(fonts.regular).fontSize(8.5).fillColor("#C7BEC4").text(`ฉบับ ${manifest.config.priceLabel} · ${manifest.pageCount} หน้า · ${manifest.version} · การตีความ BaZi ไม่ใช่คำแนะนำซื้อขายหลักทรัพย์`, 54, PAGE.height - 58, { width: 480, align: "center" });
}

export async function buildEditorialProductPdf(state: CalculatedStateValue, options?: EditorialPdfOptions): Promise<Buffer> {
  const manifest = getReportManifest(options?.tier);
  const profile = options?.profile ?? {};
  const input = options?.financial ?? FINANCIAL_PRESETS.builder;
  const financial = buildFinancialSnapshot(input);
  const dashboard = buildPersonalDashboard(state);
  const thPicks = buildMonthlyPicks(state, "TH", 10, "premium");
  const narrative = readBookNarrativeFromCache(state);
  const sortedElements = [...dashboard.elementBalance].sort((a, b) => b.pct - a.pct);
  const dominant = sortedElements[0] ?? { element: dashboard.persona.element || "ดิน", pct: 0, count: 0, strength: "balanced" };
  const second = sortedElements[1] ?? dominant;
  const support = dashboard.principle.supplementElement || dashboard.strengthen.element;
  const accent = ELEMENT_COLOR[dominant.element] ?? COLORS.red;
  const supportColor = ELEMENT_COLOR[support] ?? COLORS.jade;
  const age = ageAt(profile.birthDate);
  const currentPhase = dashboard.timeline.find((phase) => rangeIncludes(phase.ageRange, age)) ?? dashboard.timeline[0];
  const picks = thPicks.picks.slice(0, 5);
  const marketDate = thaiDate(thPicks.updatedAt || new Date().toISOString());
  const birthLabel = `${thaiDate(profile.birthDate)} · ${profile.birthTime || "ไม่ระบุเวลา"} · ${profile.province || "ไม่ระบุสถานที่"}`;
  const split = dashboard.trading.split;
  const coldAmount = input.capital * split.cold / 100;
  const fastAmount = input.capital * split.fast / 100;
  const emergencyAmount = input.capital * split.emergency / 100;
  const target = financial.allocationModel.allocation;
  const fonts = fontPaths();
  const doc = new PDFDocument({ size: "A4", margin: 0, autoFirstPage: false, bufferPages: true, compress: true });
  doc.registerFont("body", fonts.regular);
  doc.registerFont("bold", fonts.bold);
  doc.registerFont("display", fonts.display);
  const registeredFonts = { regular: "body", bold: "bold", display: "display" };
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  doc.info.Title = clean(`แผนที่เงินและการตัดสินใจ - ${dashboard.persona.name}`);
  doc.info.Author = "Bazi Investor Guide";
  doc.info.Subject = clean(`${manifest.config.priceLabel} · ${manifest.version}`);

  const pageTitle: Partial<Record<ReportPageId, { title: string; cue: string; lede?: string }>> = {
    letter: { title: "จดหมายถึงเจ้าของเล่ม", cue: "เริ่มจากชีวิตจริง ก่อนเริ่มจากคำทำนาย", lede: "เล่มนี้มีหน้าที่ช่วยให้คุณเห็นรูปแบบการตัดสินใจของตัวเอง แล้ววางกติกาที่ใช้ได้เมื่อทั้งตลาดและความรู้สึกไม่เป็นใจ" },
    contents: { title: "เลือกอ่านจากคำถาม ไม่ต้องอ่านตามลำดับ", cue: "แผนที่ของคำตอบ", lede: "ทุกส่วนถูกออกแบบให้จบด้วยสิ่งที่ต้องรู้ สิ่งที่ต้องตรวจ และสิ่งที่ต้องทำต่อ" },
    executive: { title: "สี่คำตอบที่ควรจำ แม้คุณปิดเล่มตรงหน้านี้", cue: "คำตอบก่อนรายละเอียด", lede: "ข้อสรุปชุดนี้เชื่อมพฤติกรรม ฐานชีวิต และกระบวนการลงทุนเข้าด้วยกัน โดยไม่ใช้ดวงเป็นเหตุผลซื้อสินทรัพย์" },
    confidence: { title: "รายงานฉบับนี้รู้อะไร มั่นใจเพียงใด และยังตอบอะไรไม่ได้", cue: "รู้สิ่งที่รู้ ไม่แต่งสิ่งที่หาย", lede: "ความน่าเชื่อถือไม่ได้เกิดจากข้อความที่ฟังดูมั่นใจ แต่เกิดจากการบอกขอบเขตข้อมูลและย้อนกลับไปหาต้นทางได้" },
    balance: { title: "แรงใดดังเกินไป และแรงใดต้องสร้างให้เป็นนิสัย", cue: "หลักฐานจากสมดุลธาตุ", lede: "ธาตุไม่ใช่ป้ายดีหรือร้าย แต่เป็นภาษาสำหรับสังเกตว่าคุณมักใช้แรงแบบใดเมื่อเจอโอกาสหรือแรงกดดัน" },
    persona: { title: `${dashboard.persona.name}: ภาพบุคลิกการเงินของคุณ`, cue: "แปลดวงเป็นภาษาคน", lede: "คำอ่านที่ดีต้องชี้ให้เห็นพฤติกรรมที่สังเกตได้ และต้องเปิดพื้นที่ให้ข้อเท็จจริงใหม่หักล้างคำตีความเดิม" },
    "wealth-flow": { title: "เงินไหลผ่านการตัดสินใจของคุณตรงจุดใดบ้าง", cue: "เห็นจุดแทรกของอารมณ์", lede: "เราไม่ได้ถามว่าเงินจะมาเมื่อไร แต่ถามว่าระหว่างเห็นโอกาสกับลงมือ จุดใดทำให้คุณเพิ่มความเสี่ยงโดยไม่รู้ตัว" },
    "support-habit": { title: `เปลี่ยนธาตุ${support}จากคำบนกระดาษให้เป็นนิสัยที่ฝึกได้`, cue: "สิ่งเล็กที่ทำซ้ำได้", lede: "ธาตุเสริมมีประโยชน์ก็ต่อเมื่อถูกแปลงเป็นการกระทำก่อนเปิดแอปลงทุน ไม่ใช่ถูกแปลงเป็นรายชื่อหุ้น" },
    "decision-loop": { title: "วงจรที่ทำให้การตัดสินใจเล็กกลายเป็นความเสียหายใหญ่", cue: "ตัดวงจรก่อนข้ออ้างเกิด", lede: "FOMO ไม่ได้เริ่มจากการกดซื้อ แต่มักเริ่มจากขอบเขตที่ไม่ชัดและเหตุผลที่ไม่ได้เขียนไว้" },
    "financial-snapshot": { title: "ชีวิตเหลือพื้นที่ให้ลงทุนเท่าไร ก่อนถามว่าจะลงทุนอะไร", cue: input.isDemo ? "DEMO DATA - ห้ามส่งมอบ" : "ข้อมูลที่ผู้ใช้ยืนยัน", lede: "ตัวเลขหน้านี้เป็นข้อจำกัดของแผน ไม่ใช่คะแนนความสำเร็จของชีวิต" },
    "money-buckets": { title: "เงินทุกบาทต้องมีหน้าที่ ก่อนมีผลตอบแทน", cue: "สถาปัตยกรรมเงินสามกอง", lede: "การแยกกองช่วยไม่ให้เงินฉุกเฉินต้องรับความผันผวน และไม่ให้การทดลองชั่วคราวกลายเป็นภาระระยะยาว" },
    "risk-capacity": { title: "ใจอยากเสี่ยงเท่าไร กับชีวิตรับความเสียหายได้เท่าไร เป็นคนละคำถาม", cue: "Willingness เทียบ Capacity", lede: "ระบบใช้ค่าที่อนุรักษ์นิยมกว่าเสมอ เพราะความมั่นใจวันนี้ไม่สามารถจ่ายค่าใช้จ่ายแทนเงินสำรองได้" },
    allocation: { title: "กรอบจัดสินทรัพย์ในกองลงทุน และความเสียหายที่ต้องเห็นก่อนผลตอบแทน", cue: "Allocation ก่อน Selection", lede: "สัดส่วนเป็นกรอบตั้งต้นจากข้อจำกัดจริง ไม่ใช่คำสั่งซื้อ และต้องถูกปรับเมื่อชีวิตเปลี่ยน" },
    "goal-gap": { title: `เป้าหมาย “${input.goal}” ยังต้องเติมเงินและเวลาเท่าไร`, cue: "สามสมมติฐาน ไม่ใช่สามคำสัญญา", lede: "ผลตอบแทนที่สูงขึ้นทำให้ตัวเลขดูง่ายขึ้น แต่แผนที่แข็งแรงต้องยังพอเดินได้ในกรณีที่ไม่สวยที่สุด" },
    ips: { title: "Investment Policy: กติกาเดียวกันในวันที่ตลาดเงียบและวันที่ตลาดผันผวน", cue: "รัฐธรรมนูญการเงินหนึ่งหน้า", lede: "IPS ลดจำนวนการตัดสินใจสด และทำให้คุณตรวจได้ว่าการเปลี่ยนพอร์ตเกิดจากข้อมูลหรืออารมณ์" },
    "current-phase": { title: `จังหวะปัจจุบัน: ทำให้การตัดสินใจย้อนกลับได้`, cue: "วัยจรใช้กำหนดขนาด ไม่ใช้ทายราคา", lede: "ช่วงชีวิตมีประโยชน์เมื่อช่วยตั้งความเร็ว จุดทบทวน และขอบเขตของภาระที่รับเพิ่ม" },
    "life-map": { title: "แผนที่ชีวิต: หน้าที่ของเงินเปลี่ยนตามช่วงเวลา", cue: "มองเป็นบท ไม่มองเป็นคำตัดสิน", lede: "แผนที่นี้ใช้จัดลำดับการสะสม การทดลอง และการลดภาระ ไม่ได้ยืนยันว่าเหตุการณ์ใดจะเกิดแน่นอน" },
    "month-plan": { title: "แผนเดือนนี้: สี่สัปดาห์ที่มีงานชัดเจน", cue: "ใช้เดือนเป็นรอบทบทวน", lede: "คำอ่านรายเดือนมีคุณค่าเมื่อเปลี่ยนเป็นปฏิทินงาน ไม่ใช่การเฝ้ารอวันดีเพื่อซื้อ" },
    "research-funnel": { title: "กรวยคัดกิจการ: จากรายชื่อที่เข้าธาตุ สู่ธุรกิจที่หลักฐานครบ", cue: "หยุดก่อนคำว่าแนะนำ", lede: "ธาตุทำหน้าที่เป็นเลนส์ตั้งคำถามเท่านั้น ทุกบริษัทต้องผ่านคุณภาพธุรกิจ ราคา ความเสี่ยง และบทบาทในพอร์ต" },
    "company-duo": { title: "สองกิจการ สองกลไกกำไร และคำถามที่ห้ามใช้แทนกัน", cue: `ข้อมูลตลาด ณ ${marketDate}`, lede: "คะแนนจัดคิวการศึกษา ไม่ใช่ความน่าจะเป็นของกำไร และไม่ชดเชยข้อมูลที่ขาด" },
    "company-trio": { title: "Deep research set: เปรียบเทียบตัวขับกำไร ความเสี่ยง และหลักฐานที่ต้องหา", cue: "ฉบับต่อเนื่องเชิงลึก", lede: "การมีสามชื่อในธีมเดียวไม่เท่ากับกระจายความเสี่ยง หากทั้งสามพึ่งสมมติฐานเดียวกัน" },
    "research-queue": { title: "ห้าบริษัทนี้คือคิวงานวิจัย ไม่ใช่ใบสั่งซื้อ", cue: `ข้อมูลตลาด ณ ${marketDate}`, lede: "ลำดับมีไว้บอกว่าควรใช้เวลาอ่านอะไรก่อน โดยทุกชื่อยังต้องผ่านแบบคัดและกฎ IPS" },
    "portfolio-diagnostic": { title: "ก่อนเพิ่มหุ้นตัวใหม่ ต้องรู้ก่อนว่าพอร์ตเดิมกำลังเดิมพันกับอะไร", cue: input.isDemo ? "DEMO ALLOCATION" : "สัดส่วนที่ผู้ใช้ยืนยัน", lede: "การวินิจฉัยเริ่มจากบทบาทและการกระจุกตัว ไม่ได้เริ่มจากการหาหุ้นตัวถัดไป" },
    "scenario-lab": { title: "ถ้าตลาดหรือรายรับผิดจากแผน คุณต้องรู้ล่วงหน้าว่าจะทำอะไร", cue: "เห็นความเสียหายก่อนเห็นผลตอบแทน", lede: "สถานการณ์จำลองทำให้แผนตอบสนองถูกเขียนตอนที่ยังไม่ตกใจ และแยกเหตุการณ์ตลาดออกจากเหตุการณ์ชีวิต" },
    worksheet: { title: "หนึ่งบริษัท หนึ่งสมมติฐาน หนึ่งทางถอย", cue: "พิมพ์หน้านี้ใช้ซ้ำได้", lede: "เขียนให้ครบก่อนสร้างสถานะ หากช่องใดตอบไม่ได้ นั่นคือข้อมูลที่ต้องหา ไม่ใช่ช่องให้ความเชื่อเข้ามาเติม" },
    "action-plan": { title: "แผน 30/90/365 วัน: เปลี่ยนคำอ่านเป็นระบบที่วัดผลได้", cue: "งานเล็กก่อนเงินก้อนใหญ่", lede: "ความคืบหน้าวัดจากฐานที่แข็งขึ้นและกระบวนการที่ทำซ้ำได้ ไม่ได้วัดจากผลตอบแทนหนึ่งเดือน" },
    "decision-journal": { title: "คุณภาพการตัดสินใจวัดจากกระบวนการ ไม่ได้วัดจากผลลัพธ์ครั้งเดียว", cue: "บันทึกก่อนรู้ผล", lede: "สมุดตัดสินใจป้องกันไม่ให้ความจำแก้เหตุผลย้อนหลัง และช่วยแยกโชคออกจากทักษะ" },
    "monthly-baseline": { title: "รอบหน้าไม่ควรเขียนหนังสือเดิมใหม่ แต่ต้องบอกว่าสิ่งใดเปลี่ยนและทำไม", cue: "จุดเริ่มสำหรับฉบับถัดไป", lede: "Baseline ทำให้รายงานรายเดือนมีหน้าที่ติดตาม delta แทนการผลิตคำอ่านซ้ำ" },
    "annual-roadmap": { title: "แผนหนึ่งปีต้องวัดฐานชีวิต พอร์ต และพฤติกรรมพร้อมกัน", cue: "สี่รอบใหญ่ แทนการปรับทุกสัปดาห์", lede: "แต่ละไตรมาสมีโจทย์หนึ่งชุด เพื่อไม่ให้ข่าวรายวันแย่งพื้นที่จากงานสำคัญ" },
    "source-ledger": { title: "ตัวเลขและคำแนะนำทุกชิ้นต้องย้อนกลับไปหาข้อมูลต้นทางได้", cue: `ข้อมูลตลาด ณ ${marketDate}`, lede: "หากข้อมูลหมดอายุหรือยังไม่ผ่านการตรวจ ระบบต้องหยุดที่คำว่า ‘รอข้อมูล’" },
  };

  for (const [index, spec] of manifest.pages.entries()) {
    doc.addPage();
    if (spec.id === "cover") {
      drawCover(doc, registeredFonts, accent, manifest, profile, dashboard.persona.name, dashboard.persona.bandLabel, manifest.config.promise);
      continue;
    }
    if (spec.id === "closing") {
      drawClosing(doc, registeredFonts, accent, manifest, dashboard.persona.name, dominant.element, support);
      continue;
    }

    const meta = pageTitle[spec.id] ?? { title: spec.label, cue: spec.value };
    const painter = createPainter(doc, registeredFonts, accent, spec, index + 1, manifest.pageCount, manifest.version, meta.title, meta.cue, meta.lede);

    switch (spec.id) {
      case "letter":
        painter.paragraph(`ถึงเจ้าของเล่ม ${dashboard.persona.name} — รายงานนี้เริ่มจากข้อมูลเกิด ${birthLabel} และแยกการตีความออกจากข้อเท็จจริงทางการเงินอย่างชัดเจน เพื่อให้คุณรู้ว่าควรเชื่อส่วนใด ควรตรวจส่วนใด และส่วนใดเป็นเพียงสมมติฐานสำหรับทบทวนตัวเอง`);
        painter.section("สิ่งที่เล่มนี้ช่วยคุณทำ", `มองเห็นรูปแบบเด่นของธาตุ${dominant.element} จุดกดดันที่ทำให้เหตุผลเปลี่ยนกลางทาง และนิสัยธาตุ${support}ที่ควรฝึกก่อนเพิ่มความเสี่ยง จากนั้นจึงนำข้อค้นพบไปเทียบกับเงินสำรอง หนี้ เป้าหมาย และพอร์ตจริง`);
        painter.section("สิ่งที่เล่มนี้จะไม่ทำ", "ไม่ทำนายราคาหุ้น ไม่รับรองผลตอบแทน ไม่บอกให้ซื้อเพราะธาตุตรง และไม่เติมตัวเลขที่ผู้ใช้ไม่ได้ระบุ หากข้อมูลสำคัญขาด รายงานต้องแสดงสถานะว่าขาดแทนการเดา");
        painter.bullets("อ่านสามรอบให้ได้ประโยชน์สูงสุด", [
          "รอบแรกอ่านคำตอบสำคัญและวงจรการตัดสินใจ เพื่อจับประเด็นที่เกี่ยวกับตัวเอง",
          "รอบที่สองกรอกแบบคัดและเทียบคำอ่านกับเหตุการณ์จริงอย่างน้อยสองเหตุการณ์",
          "รอบที่สามเลือกกติกาหนึ่งข้อไปใช้ 30 วัน แล้วกลับมาวัดว่าพฤติกรรมเปลี่ยนหรือไม่",
        ]);
        painter.quote("อ่านเพื่อสร้างกติกาที่ใช้ซ้ำได้ ไม่ใช่อ่านเพื่อหาคำอนุญาตให้ทำสิ่งที่อยากทำอยู่แล้ว", "วิธีใช้ที่คุ้มที่สุด");
        break;
      case "contents":
        painter.rows(buildReportToc(manifest).map((row) => ({ label: row.number, title: row.question, body: row.description, aside: row.pages })), { compact: false });
        painter.quote(manifest.config.promise, `${manifest.config.priceLabel} · คำสัญญาของฉบับนี้`);
        break;
      case "executive":
        painter.rows([
          { label: "01", title: `พลังเด่นคือธาตุ${dominant.element}`, body: `จุดแข็งทำงานได้ดีเมื่อมีขอบเขต แต่แรงกดดันมักทำให้คุณใช้ข้อได้เปรียบเดิมมากเกินไป จึงต้องสร้างนิสัยธาตุ${support}เป็นตัวคุมกระบวนการ` },
          input.isDemo && manifest.config.tier === "free"
            ? { label: "02", title: "ยังไม่ประเมินความเสี่ยงจากฐานะจริง", body: "ฉบับฟรีไม่เดารายรับ หนี้ เงินสำรอง หรือเป้าหมาย จึงไม่ควรสรุปว่าชีวิตรับความเสียหายได้เท่าไร" }
            : { label: "02", title: `กรอบความเสี่ยงที่ใช้จริง: ${financial.effectiveRisk}`, body: `Willingness อยู่ที่ ${financial.willingness} แต่ capacity อยู่ที่ ${financial.capacity}; ระบบเลือกค่าที่อนุรักษ์นิยมกว่า` },
          input.isDemo && manifest.config.tier === "free"
            ? { label: "03", title: "งานถัดไปคือเก็บข้อมูลฐานชีวิต", body: "ยืนยันรายรับ ค่าใช้จ่าย เงินสำรอง หนี้ เป้าหมาย และสัดส่วนพอร์ต ก่อนขอคำตอบเรื่อง allocation หรือจำนวนเงินลงทุน" }
            : { label: "03", title: financial.alerts[0] || "ยังไม่พบข้อจำกัดเร่งด่วน", body: `เงินเหลือจริง ${money(financial.monthlySurplus)} ต่อเดือน เงินสำรอง ${number(financial.runwayMonths)} เดือน และเงินลงทุนที่ไม่กดชีวิต ${money(financial.investableMonthly)}` },
          { label: "04", title: "วิจัยก่อนสร้างสถานะ", body: `เริ่มจาก ${picks.slice(0, 3).map((pick) => pick.ticker).join(", ") || "รอข้อมูลบริษัท"} แต่ต้องผ่าน thesis ราคา ความเสี่ยง และบทบาทในพอร์ตทุกครั้ง`, aside: "ไม่ใช่คำสั่งซื้อ" },
        ]);
        painter.bullets("ทำสามอย่างหลังปิดหน้านี้", [
          `เขียนเหตุการณ์หนึ่งครั้งที่แรงธาตุ${dominant.element}ช่วยคุณ และหนึ่งครั้งที่ทำให้ขอบเขตหาย`,
          input.isDemo ? "เก็บข้อมูลฐานชีวิตให้ครบก่อนขอคำตอบเรื่องจำนวนเงินและ allocation" : `ล็อกเพดานลงทุนต่อเดือนไว้ที่ ${money(financial.investableMonthly)}`,
          `เลือกเพียงหนึ่งบริษัทจากคิวเพื่อทำแบบคัดให้ครบ แทนการเปิดสถานะพร้อมกันหลายชื่อ`,
        ]);
        break;
      case "confidence":
        painter.metrics([
          { label: "ข้อมูลเกิด", value: "พร้อมคำนวณ", note: birthLabel, tone: "good" },
          { label: "ข้อมูลการเงิน", value: financial.confidence, note: input.isDemo ? "fixture สำหรับ QA" : "ผู้ใช้ระบุ", tone: input.isDemo ? "warn" : "good" },
          { label: "ข้อมูลตลาด", value: marketDate, note: `${thPicks.picks.length} บริษัทในชุดคัด`, tone: "accent" },
          { label: "ขอบเขต", value: "วางแผน", note: "ไม่ทำนายราคา", tone: "accent" },
          { label: "เวอร์ชัน", value: manifest.version, note: manifest.config.priceLabel, tone: "accent" },
          { label: "สถานะส่งมอบ", value: input.isDemo && manifest.config.tier !== "free" ? "ห้ามส่งลูกค้า" : "พร้อมใช้", note: input.isDemo ? "ต้องรับข้อมูลจริงก่อน" : "ทบทวนเมื่อชีวิตเปลี่ยน", tone: input.isDemo && manifest.config.tier !== "free" ? "warn" : "good" },
        ], 3);
        painter.table(["ชั้นข้อมูล", "หน้าที่", "ข้อจำกัด"], [
          { cells: ["ข้อเท็จจริง", "วันเกิด ฐานะ เป้าหมาย holdings", "ผิดได้หากผู้ใช้กรอกผิด"] },
          { cells: ["ผลคำนวณ", "สมดุลธาตุ ช่องว่างเป้าหมาย stress", "ขึ้นกับสูตรและวันที่"] },
          { cells: ["การตีความ", "สมมติฐานพฤติกรรมและคำถาม", "ต้องให้ผู้ใช้ยืนยันกับชีวิตจริง"] },
          { cells: ["สมมติฐาน", "ผลตอบแทน 2/5/8% และตลาดลดลง", "ไม่ใช่การคาดการณ์"] },
        ], [96, 205, 186]);
        break;
      case "balance":
        painter.bars(dashboard.elementBalance.map((item) => ({ label: `ธาตุ${item.element}`, value: item.pct, note: `${item.pct}%`, color: ELEMENT_COLOR[item.element] })));
        painter.section(`แรงนำ: ธาตุ${dominant.element} ${dominant.pct}%`, `แรงนี้เป็นบริบทหลักของการตอบสนอง จุดสำคัญไม่ใช่มีมากแล้วดีหรือร้าย แต่ต้องสังเกตว่าเมื่อถูกกดดัน คุณใช้แรงเดิมจนขอบเขตหายหรือไม่`);
        painter.section(`แรงรอง: ธาตุ${second.element} ${second.pct}%`, "แรงรองอธิบายว่าพฤติกรรมเดียวกันอาจแสดงออกต่างกันตามสถานการณ์ จึงควรดูเหตุการณ์จริงประกอบคำอ่านเสมอ");
        painter.section(`แรงที่ต้องสร้าง: ธาตุ${support}`, `เปลี่ยนธาตุ${support}เป็นขั้นตอนก่อนตัดสินใจ เช่น เขียนเงื่อนไข ตรวจฐานชีวิต และกำหนดวันทบทวน ไม่ใช้เป็นเหตุผลเลือกหุ้นอัตโนมัติ`);
        break;
      case "persona":
        painter.quote(`${dashboard.persona.name} · ${dashboard.persona.bandLabel} · ${dashboard.persona.style}`, "ภาพบุคลิก");
        painter.section("เมื่ออยู่ในสมดุล", `${dashboard.persona.strengths} จุดแข็งเหล่านี้เหมาะกับการลงทุนที่มีสมมติฐาน มีเวลารอ และมีหลักฐานให้กลับมาตรวจ`);
        painter.section("เมื่อแรงกดดันสูง", `${dashboard.persona.weaknesses} ให้จับตาการเปลี่ยนเหตุผล ขนาด หรือกรอบเวลาโดยไม่ได้เขียนไว้ก่อน`);
        painter.section("ประโยคหยุดกระบวนการ", "ข้อมูลใหม่ชิ้นนี้เปลี่ยนสมมติฐานข้อใด หากตอบไม่ได้ ให้เลื่อนการตัดสินใจและกลับไปหาหลักฐานแทนการดูราคาถี่ขึ้น");
        if (narrative["1"]?.summary) painter.paragraph(shorten(narrative["1"]?.summary, 260), { color: COLORS.inkSoft, size: 10.4 });
        break;
      case "wealth-flow":
        painter.rows([
          { label: "01", title: "เห็นโอกาส", body: `แรงธาตุ${dominant.element}ทำให้คุณสนใจสิ่งที่สอดคล้องกับรูปแบบเดิมเร็วเป็นพิเศษ` },
          { label: "02", title: "สร้างเรื่องเล่า", body: "ข้อมูลบางส่วนถูกเชื่อมเป็นภาพใหญ่ก่อนที่ข้อโต้แย้งจะถูกค้นอย่างจริงจัง" },
          { label: "03", title: "ขนาดเริ่มโต", body: "ความรู้สึกว่าเข้าใจถูกแปลเป็นขนาดเงิน ทั้งที่ thesis และทางถอยยังไม่ครบ" },
          { label: "04", title: "ราคาเริ่มกำกับเหตุผล", body: "กำไรทำให้เพิ่มความมั่นใจ ขาดทุนทำให้หาข้อมูลยืนยัน แทนการตรวจสมมติฐานเดิม" },
        ], { compact: true });
        painter.bullets("สัญญาณว่าเรื่องเล่ากำลังนำหน้าหลักฐาน", [
          "อธิบายว่าบริษัทดีได้ แต่ระบุไม่ได้ว่าตัวเลขใดจะยืนยันคำพูดนั้น",
          "เพิ่มขนาดเพราะราคาขึ้นหรือลง โดยไม่มีข้อมูลธุรกิจใหม่",
          "เปลี่ยนกรอบเวลาจากสั้นเป็นยาวหลังขาดทุน และจากยาวเป็นสั้นเมื่อกำไรเร็ว",
        ]);
        painter.quote(`นิสัยธาตุ${support}: เขียนหน้าที่ของเงิน เหตุผลหลัก ข้อมูลหักล้าง และวันทบทวนก่อนกดซื้อ`, "ราวกันตก");
        break;
      case "support-habit":
        painter.rows([
          { label: "ก่อนเปิดแอป", title: "ตั้งคำถามหนึ่งข้อ", body: `วันนี้ต้องการตรวจอะไร ไม่ใช่วันนี้อยากทำอะไร` },
          { label: "ก่อนซื้อ", title: "เขียน thesis สี่บรรทัด", body: "รายได้มาจากไหน เหตุใดราคาน่าสนใจ อะไรทำให้คิดผิด และขนาดสูงสุดเท่าไร" },
          { label: "ระหว่างถือ", title: "ตรวจตามรอบ", body: "ดูข้อมูลตามปฏิทิน ไม่เพิ่มความถี่เพียงเพราะราคาผันผวน" },
          { label: "ก่อนเพิ่ม", title: "ขอหลักฐานใหม่", body: "เพิ่มน้ำหนักเมื่อ thesis แข็งขึ้น ไม่เพิ่มเพียงเพราะราคาลดหรือกลัวพลาด" },
        ]);
        painter.paragraph("ให้ทำสี่ขั้นตอนนี้กับการตัดสินใจเงินจริงหนึ่งครั้งต่อสัปดาห์ แล้วบันทึกว่าขั้นตอนไหนถูกข้าม การฝึกที่วัดได้มีค่ากว่าการอ่านคำอธิบายธาตุเพิ่มอีกหลายหน้า", { color: COLORS.inkSoft });
        painter.quote(`ธาตุ${support}ในเล่มนี้หมายถึงกระบวนการที่ฝึกได้ ไม่ได้หมายถึงต้องซื้อกิจการธาตุ${support}`, "ข้อจำกัดสำคัญ");
        break;
      case "decision-loop":
        painter.rows([
          { label: "01", title: "แรงหลักทำงาน", body: `ใช้ความถนัดของธาตุ${dominant.element}เพื่ออ่านโอกาส` },
          { label: "02", title: "ขอบเขตหาย", body: "ไม่ได้กำหนดว่าจะใช้เงินกองใด ขนาดเท่าไร หรือทบทวนเมื่อไร" },
          { label: "03", title: "แรงเร่งเกิด", body: "ราคาเคลื่อนหรือคนอื่นพูดถึง ทำให้กลัวพลาดมากกว่ากลัวซื้อผิด" },
          { label: "04", title: "ตัดสินใจใหญ่", body: "ใช้เงินเกินขนาดทดลองเพื่อชดเชยเวลาที่รู้สึกว่าเสียไป" },
          { label: "05", title: "ทนการแกว่งไม่ได้", body: "เหตุผลไม่ชัดจึงตีความการลดลงเล็กน้อยว่าเป็นหลักฐานว่าคิดผิด" },
          { label: "06", title: "หาข้อมูลปลอบใจ", body: "อ่านเพื่อยืนยันสิ่งที่ทำแล้ว แทนการทดสอบสมมติฐานเดิม" },
        ], { compact: true });
        painter.quote("ถ้าราคานิ่ง 30 วัน ฉันยังอยากเป็นเจ้าของกิจการนี้หรือไม่", "คำถามตัดวงจร");
        break;
      case "financial-snapshot":
        painter.metrics([
          { label: "รายรับสุทธิ/เดือน", value: money(input.monthlyIncome), note: "ฐานความสามารถรับความเสี่ยง" },
          { label: "ค่าใช้จ่าย/เดือน", value: money(input.monthlyExpense), note: "ไม่รวมกำไรที่คาดหวัง" },
          { label: "เงินเหลือจริง", value: money(financial.monthlySurplus), note: `${number(financial.surplusRate)}% ของรายรับ`, tone: percentileTone(financial.monthlySurplus) },
          { label: "เงินสำรอง", value: `${number(financial.runwayMonths)} เดือน`, note: `เป้าหมาย ${input.emergencyMonths} เดือน`, tone: financial.emergencyGap > 0 ? "warn" : "good" },
          { label: "หนี้คงเหลือ", value: money(input.debtBalance), note: `ดอกเบี้ย ${number(input.debtApr)}%`, tone: financial.highInterestDebt ? "warn" : "accent" },
          { label: "ลงทุนได้/เดือน", value: money(financial.investableMonthly), note: "เพดานจากเงินเหลือจริง", tone: "good" },
        ]);
        painter.bullets("ลำดับก่อนเพิ่มความเสี่ยง", [
          financial.highInterestDebt ? `จัดการหนี้ดอกเบี้ย ${number(input.debtApr)}% ก่อน` : "ไม่พบหนี้ดอกเบี้ยสูงจากข้อมูลชุดนี้",
          financial.emergencyGap > 0 ? `เติมเงินสำรองอีก ${money(financial.emergencyGap)}` : "เงินสำรองถึงเป้าหมายที่ระบุ",
          `ใช้เงินลงทุนต่อเดือนไม่เกิน ${money(financial.investableMonthly)} จนกว่าฐานจะเปลี่ยน`,
        ]);
        break;
      case "money-buckets":
        painter.rows([
          { label: `${split.cold}%`, title: `กองเย็น · ${money(coldAmount)}`, body: `รอได้ตามเป้าหมาย ${input.horizonYears} ปี ใช้กับพอร์ตหลักและทบทวนตามรอบ ไม่ดึงออกเพราะข่าวระยะสั้น`, aside: "หน้าที่: สร้างอนาคต" },
          { label: `${split.fast}%`, title: `กองเร็ว · ${money(fastAmount)}`, body: "ใช้ทดลองสมมติฐานแบบจำกัดความเสียหาย หนึ่งแนวคิดต่อหนึ่งครั้ง และห้ามเติมเงินเพื่อแก้มือ", aside: "หน้าที่: ซื้อบทเรียน" },
          { label: `${split.emergency}%`, title: `กองฉุกเฉิน · ${money(emergencyAmount)}`, body: `ซื้อเวลาให้ชีวิต เป้าหมายจากค่าใช้จ่ายจริงคือ ${money(financial.emergencyTarget)}`, aside: "หน้าที่: รักษาทางเลือก" },
        ]);
        painter.table(["กอง", "ใช้ได้เมื่อ", "ห้ามใช้เมื่อ"], [
          { cells: ["กองเย็น", "เป้าหมายยาวและไม่ต้องใช้เงินก่อนกำหนด", "ต้องใช้เงินใน 3 ปีหรือ thesis ยังไม่ครบ"] },
          { cells: ["กองเร็ว", "ขนาดเสียได้และมีวันจบการทดลอง", "กำลังแก้มือหรือย้ายเงินจากฉุกเฉิน"] },
          { cells: ["กองฉุกเฉิน", "เหตุการณ์จำเป็นต่อชีวิตและรายรับ", "ราคาในตลาดดูถูกหรือกลัวพลาด"] },
        ], [105, 191, 191]);
        painter.quote("ถ้าเงินก้อนหนึ่งตอบไม่ได้ว่าจะใช้เมื่อไร รับขาดทุนได้เท่าไร และเติมจากไหน แสดงว่าเงินก้อนนั้นยังไม่มีหน้าที่", "กติกาสามกอง");
        break;
      case "risk-capacity":
        painter.metrics([
          { label: "Willingness", value: financial.willingness, note: `ผู้ใช้ระบุรับลดลง ${number(input.maxDrawdown, 0)}%`, tone: "accent" },
          { label: "Capacity", value: financial.capacity, note: `สำรอง ${number(financial.runwayMonths)} เดือน · เป้าหมาย ${input.horizonYears} ปี`, tone: financial.capacity === "ระวังสูง" ? "warn" : "good" },
          { label: "กรอบที่ใช้จริง", value: financial.effectiveRisk, note: "เลือกค่าที่อนุรักษ์นิยมกว่า", tone: financial.effectiveRisk === "ระวังสูง" ? "warn" : "good" },
        ]);
        painter.bullets("สัญญาณที่ต้องตอบก่อนเพิ่มความเสี่ยง", financial.alerts);
        painter.section("สิ่งที่ต้องวัดในเหตุการณ์จริง", "หากตลาดลดลง ให้บันทึกว่าคุณอยากขายเพราะ thesis เปลี่ยน เพราะต้องใช้เงิน หรือเพราะความไม่สบายใจ เหตุผลทั้งสามต้องนำไปสู่การกระทำคนละแบบ");
        painter.table(["เหตุผลที่อยากขาย", "สิ่งที่ต้องตรวจ", "การตอบสนอง"], [
          { cells: ["Thesis เปลี่ยน", "หลักฐานธุรกิจที่หักล้างเหตุผลเดิม", "ลดหรือออกตามกฎที่เขียนไว้"] },
          { cells: ["ต้องใช้เงิน", "runway และกำหนดใช้เงิน", "ลดความเสี่ยงฐานชีวิตก่อน"] },
          { cells: ["ไม่สบายใจ", "ขนาดเทียบ IPS และ capacity", "หยุด ดูบันทึก และไม่ตัดสินใจจากราคาอย่างเดียว"] },
        ], [125, 175, 187]);
        break;
      case "allocation": {
        painter.metrics([
          { label: "หุ้น", value: `${target.equity}%`, note: money(coldAmount * target.equity / 100), tone: "accent" },
          { label: "สินทรัพย์กันแรง", value: `${target.bond}%`, note: money(coldAmount * target.bond / 100), tone: "accent" },
          { label: "เงินพร้อมใช้", value: `${target.cash}%`, note: money(coldAmount * target.cash / 100), tone: "accent" },
        ]);
        painter.section(`โมเดล “${financial.allocationModel.name}”`, financial.allocationModel.reason);
        painter.bars([
          { label: "หุ้น", value: target.equity, note: `${target.equity}%`, color: accent },
          { label: "กันแรง", value: target.bond, note: `${target.bond}%`, color: COLORS.gold },
          { label: "พร้อมใช้", value: target.cash, note: `${target.cash}%`, color: supportColor },
        ]);
        const stress20 = financial.stressScenarios.find((scenario) => scenario.marketDrop === 20)!;
        painter.quote(`ถ้าตลาดหุ้นลดลง 20% ความเสียหายจำลองของพอร์ตตามกรอบนี้ประมาณ ${money(stress20.estimatedLoss)} เหลือทุนประมาณ ${money(stress20.postStressCapital)}`, "Stress ก่อนผลตอบแทน");
        break;
      }
      case "goal-gap":
        painter.metrics([
          { label: "เป้าหมาย", value: money(input.goalAmount), note: `ภายใน ${input.goalYears} ปี` },
          { label: "มีแล้ว", value: money(input.currentGoalSavings), note: `${number(input.goalAmount > 0 ? input.currentGoalSavings / input.goalAmount * 100 : 0)}% ของเป้าหมาย`, tone: "good" },
          { label: "ช่องว่างวันนี้", value: money(financial.goalGap), note: "ก่อนคิดผลตอบแทน", tone: financial.goalGap > input.currentGoalSavings ? "warn" : "accent" },
        ]);
        painter.table(["สมมติฐาน", "ผลตอบแทน/ปี", "ต้องเติมต่อเดือน", "สถานะ"], financial.goalScenarios.map((scenario) => ({
          cells: [scenario.label, `${number(scenario.annualReturn, 0)}%`, money(scenario.requiredMonthly), financial.investableMonthly >= scenario.requiredMonthly ? "อยู่ในเพดาน" : "เกินเพดาน"],
          tone: financial.investableMonthly >= scenario.requiredMonthly ? "accent" : "warn",
        })), [120, 90, 155, 122]);
        painter.quote(`${financial.goalStatus} · ปัจจุบันลงทุนได้ไม่กดชีวิต ${money(financial.investableMonthly)} ต่อเดือน`, "คำตัดสินของแผน");
        break;
      case "ips":
        painter.table(["หัวข้อ", "กติกา", "เหตุผล"], [
          { cells: ["วัตถุประสงค์", `${input.goal} · ${input.goalYears} ปี`, "กำหนดหน้าที่ก่อนเลือกสินทรัพย์"] },
          { cells: ["สภาพคล่อง", `เงินสำรอง ${input.emergencyMonths} เดือน`, financial.emergencyGap > 0 ? `ยังขาด ${money(financial.emergencyGap)}` : "ถึงเป้าหมาย"] },
          { cells: ["กรอบสินทรัพย์", `หุ้น ${target.equity} / กันแรง ${target.bond} / พร้อมใช้ ${target.cash}`, "ใช้ในกองลงทุน ไม่รวมฉุกเฉิน"] },
          { cells: ["เพดานเสียหาย", `${number(input.maxDrawdown, 0)}% ที่ผู้ใช้ระบุ`, "capacity ต่ำกว่าต้องเป็นข้อจำกัด"] },
          { cells: ["Rebalance", "รายไตรมาสหรือ drift >= 10 จุด", "ไม่ปรับเพราะข่าวหนึ่งวัน"] },
          { cells: ["Stop condition", "รายรับหาย สำรองต่ำ หนี้สูง thesis ผิด", "หยุดเพิ่มความเสี่ยงก่อน"] },
        ], [112, 192, 183]);
        painter.quote(`ทบทวนภายใน 90 วัน · สถานะข้อมูล ${financial.confidence} · ผู้ใช้ต้องยืนยันก่อนนำไปใช้เงินจริง`, "ลงนามในกติกา");
        break;
      case "current-phase":
        painter.metrics([
          { label: "อายุปัจจุบัน", value: age == null ? "—" : `${age} ปี`, note: currentPhase?.ageRange ? `ช่วง ${currentPhase.ageRange} ปี` : "ไม่พบช่วง" },
          { label: "จังหวะ", value: currentPhase?.verdict || "ทบทวน", note: shorten(currentPhase?.reaction, 65), tone: "accent" },
          { label: "หลักปฏิบัติ", value: "ย้อนกลับได้", note: "ทดลองก่อนขยาย", tone: "good" },
        ]);
        painter.section("คำแนะนำของช่วง", shorten(currentPhase?.advice || "ใช้ขนาดเล็ก เก็บข้อมูล และทบทวนเมื่อข้อเท็จจริงเปลี่ยน", 320));
        painter.rows([
          { label: "งาน", title: "เพิ่มทักษะหรือกระแสเงินสด", body: "เลือกโครงการที่ทดลองได้ก่อนเพิ่มต้นทุนคงที่" },
          { label: "เงิน", title: "เติมฐานตามลำดับ", body: "เงินสำรองและหนี้มาก่อนการเพิ่มเป้าผลตอบแทน" },
          { label: "ลงทุน", title: "หลักฐานก่อนน้ำหนัก", body: "ใช้ตำแหน่งเล็กเพื่อเรียนรู้ แล้วเพิ่มเมื่อ thesis แข็งขึ้น" },
          { label: "เลื่อน", title: "ภาระที่ย้อนกลับยาก", body: "อย่าผูกข้อสัญญากับสมมติฐานรายได้ดีที่สุด" },
        ], { compact: true });
        painter.quote("ในจังหวะนี้ คำถามสำคัญไม่ใช่ว่าโอกาสใหญ่พอหรือไม่ แต่คือหากผิด คุณยังเหลือเวลา เงิน และทางเลือกให้แก้หรือไม่", "หลักกำหนดขนาด");
        break;
      case "life-map": {
        const selectedTimeline = dashboard.timeline.filter((_, timelineIndex) => timelineIndex % 2 === 0).slice(0, 8);
        painter.rows(selectedTimeline.map((phase) => ({ label: phase.ageRange, title: phase.verdict, body: phase.advice, aside: rangeIncludes(phase.ageRange, age) ? "ช่วงปัจจุบัน" : undefined })), { compact: true });
        painter.quote("ใช้ช่วงชีวิตเป็นคำถามว่าเงินควรทำหน้าที่อะไร ไม่ใช้เป็นใบอนุญาตให้เพิ่มหรือลดความเสี่ยงโดยไม่ดูฐานชีวิต", "วิธีอ่านแผนที่");
        break;
      }
      case "month-plan":
        painter.metrics([
          { label: "ธาตุเดือน", value: dashboard.monthAdvice.element || "—", note: dashboard.monthAdvice.fit, tone: dashboard.monthAdvice.fit === "avoid" ? "warn" : "good" },
          { label: "วันเหมาะทบทวน", value: `${dashboard.auspiciousDays.month.goodDayCount} วัน`, note: "ใช้จัดตารางงาน ไม่ใช้ทายราคา" },
          { label: "วันควรลดแรงเร่ง", value: `${dashboard.auspiciousDays.month.avoidDayCount} วัน`, note: "เลื่อนการตัดสินใจที่ย้อนกลับยาก", tone: "warn" },
        ]);
        painter.section("ภาพรวมเดือน", dashboard.monthAdvice.text);
        painter.rows([
          { label: "สัปดาห์ 1", title: "ยืนยันฐาน", body: "อัปเดตรายรับ ค่าใช้จ่าย เงินสำรอง หนี้ และเงินลงทุนที่โอนได้จริง" },
          { label: "สัปดาห์ 2", title: "อ่านกิจการ", body: `ทำแบบคัดให้ ${picks[0]?.ticker || "บริษัทแรก"} และ ${picks[1]?.ticker || "บริษัทที่สอง"} โดยยังไม่เพิ่มสถานะ` },
          { label: "สัปดาห์ 3", title: "ทดสอบพอร์ต", body: "จำลองตลาดลดลง 20% และรายรับหาย 3 เดือน แล้วตรวจแผนตอบสนอง" },
          { label: "สัปดาห์ 4", title: "สรุป delta", body: "บันทึกสิ่งที่เปลี่ยน เหตุผล และงานหนึ่งข้อสำหรับเดือนถัดไป" },
        ], { compact: true });
        break;
      case "research-funnel":
        painter.rows([
          { label: "01", title: "Universe", body: "เริ่มจากบริษัทที่ข้อมูลธุรกิจและตลาดมีต้นทางตรวจสอบได้ ไม่เริ่มจากเรื่องเล่าที่ไม่มีหลักฐาน" },
          { label: "02", title: "Business quality", body: "รายได้ ลูกค้า ความได้เปรียบ งบดุล และกระแสเงินสดต้องอธิบายได้" },
          { label: "03", title: "Valuation", body: "ระบุว่าราคาปัจจุบันต้องการการเติบโตแบบใด และเหลือส่วนเผื่อความผิดพลาดหรือไม่" },
          { label: "04", title: "Portfolio role", body: "บริษัทนี้เพิ่มตัวขับกำไรใหม่ หรือเพียงเพิ่มความเสี่ยงเดิมในชื่อใหม่" },
          { label: "05", title: "Decision rule", body: "กำหนดขนาด เงื่อนไขเพิ่ม ข้อมูลหักล้าง และวันทบทวนก่อนสร้างสถานะ" },
        ], { compact: true });
        painter.section("ผลลัพธ์ที่ต้องได้จากกรวยนี้", "ไม่จำเป็นต้องได้หุ้นหนึ่งตัว แต่ต้องได้คำตอบว่า ‘ผ่าน’, ‘รอข้อมูล’ หรือ ‘ไม่เหมาะกับพอร์ตนี้’ พร้อมเหตุผลที่บุคคลอื่นอ่านแล้วตรวจซ้ำได้");
        painter.quote("ธาตุเป็นเลนส์ตั้งคำถาม คะแนนเป็นลำดับงาน หลักฐานธุรกิจเป็นผู้ตัดสิน", "กฎกรวยคัด");
        break;
      case "company-duo":
        painter.table(["บริษัท", "กลไกที่ต้องเข้าใจ", "หลักฐานสำคัญ", "สิ่งที่ทำให้คิดผิด"], picks.slice(0, 2).map((pick) => ({ cells: [
          `${pick.ticker} · ${pick.name}`,
          shorten(pick.business || pick.description || "รอยืนยันโมเดลรายได้", 110),
          `ROE ${number(pick.fundamentals?.roe)}% · P/E ${number(pick.valuation?.pe)} · ปันผล ${number(pick.valuation?.dividendYield)}%`,
          shorten(pick.reasons?.[0] || "ข้อมูลธุรกิจหรือมูลค่าไม่เป็นไปตาม thesis", 100),
        ] })), [105, 150, 125, 107]);
        for (const pick of picks.slice(0, 2)) {
          painter.section(`${pick.ticker}: คำถามถัดไป`, shorten(narrative["3"]?.picks?.[pick.ticker] || `ตรวจว่าตัวขับรายได้หลักของ ${pick.name} ยั่งยืนเพียงใด ภาระหนี้และการลงทุนใหม่กดกระแสเงินสดหรือไม่ และราคาปัจจุบันสะท้อนความคาดหวังไว้มากแค่ไหน`, 280));
        }
        painter.quote("หากตอบได้เพียงว่าบริษัทดี แต่ยังตอบไม่ได้ว่าราคาต้องการอะไรและอะไรจะทำให้คิดผิด งานวิจัยยังไม่จบ", "เกณฑ์ผ่าน");
        break;
      case "company-trio":
        painter.table(["บริษัท", "ตัวขับกำไร", "ความเสี่ยงร่วม", "งานวิจัยถัดไป"], picks.slice(0, 3).map((pick, pickIndex) => ({ cells: [
          `${pick.ticker}\nคะแนน ${number(pick.score)}`,
          shorten(pick.business || pick.description || "รอยืนยัน", 95),
          `${pick.sector || "ไม่ระบุ sector"} · ธาตุ${pick.element}`,
          ["อ่านรายได้รายส่วนและ margin", "ตรวจงบดุล capex และคู่แข่ง", "สร้างกรณีดี กลาง แย่พร้อมราคา"][pickIndex],
        ] })), [100, 145, 115, 127]);
        painter.bullets("คำถามเปรียบเทียบที่ต้องตอบให้ครบ", [
          "ทั้งสามบริษัทพึ่งตัวขับเศรษฐกิจ ดอกเบี้ย ค่าเงิน หรือราคาสินค้าโภคภัณฑ์เดียวกันหรือไม่",
          "ตัวใดมีงบดุลและกระแสเงินสดรองรับกรณีแย่ได้ดีที่สุด",
          "ราคาของตัวใดบังคับให้สมมติการเติบโตสูงที่สุด และส่วนเผื่อความผิดพลาดอยู่ตรงไหน",
          "หากเลือกได้เพียงหนึ่งชื่อ เหตุผลต้องเป็นคุณภาพและราคา ไม่ใช่คะแนนธาตุ",
        ]);
        painter.section("บทบาทที่ต่างกันในพอร์ต", "เขียนให้ได้ว่าตัวใดทำหน้าที่เติบโต ตัวใดลดความผันผวน และตัวใดเป็นเพียงงานวิจัย หากสองชื่อมีหน้าที่และตัวขับกำไรเหมือนกัน ให้ถือว่าเป็นความเสี่ยงก้อนเดียวจนกว่าจะพิสูจน์ได้ว่าต่าง");
        break;
      case "research-queue":
        painter.table(["ลำดับ", "บริษัท", "คะแนน", "คำถามที่ต้องตอบ", "สถานะหลักฐาน"], picks.map((pick, pickIndex) => ({ cells: [
          String(pickIndex + 1).padStart(2, "0"),
          `${pick.ticker} · ${pick.name}`,
          `${number(pick.score)} / 10`,
          shorten(pick.reasons?.[0] || pick.business || "ตรวจโมเดลรายได้", 105),
          `${pick.evidence?.reviewStatus || "รอตรวจ"} · ${pick.evidence?.reviewedAt || marketDate}`,
        ] })), [45, 108, 68, 160, 106]);
        painter.section("Definition of done", "หนึ่งชื่อออกจากคิวได้เมื่อแบบคัดครบ มีกรณีดี กลาง แย่ มีข้อมูลหักล้าง มีช่วงมูลค่าที่อธิบายได้ และมีบทบาทในพอร์ต หากไม่ครบให้คงสถานะรอข้อมูล ไม่สร้างความมั่นใจด้วยคะแนน");
        painter.quote("คะแนนทำหน้าที่จัดคิว ไม่ได้วัดโอกาสกำไร หากงบ ราคา หรือคำอธิบายธุรกิจล้าสมัย ให้หยุดที่ ‘รอข้อมูล’", "Trust note");
        break;
      case "portfolio-diagnostic":
        painter.metrics([
          { label: "พอร์ตหุ้นปัจจุบัน", value: `${financial.currentAllocation.equity}%`, note: `กรอบ IPS ${target.equity}%`, tone: Math.abs(financial.allocationDrift.equity) >= 10 ? "warn" : "good" },
          { label: "สินทรัพย์กันแรง", value: `${financial.currentAllocation.bond}%`, note: `กรอบ IPS ${target.bond}%`, tone: Math.abs(financial.allocationDrift.bond) >= 10 ? "warn" : "good" },
          { label: "เงินพร้อมใช้", value: `${financial.currentAllocation.cash}%`, note: `กรอบ IPS ${target.cash}%`, tone: Math.abs(financial.allocationDrift.cash) >= 10 ? "warn" : "good" },
        ]);
        painter.bars([
          { label: "Drift หุ้น", value: Math.abs(financial.allocationDrift.equity), note: `${financial.allocationDrift.equity > 0 ? "+" : ""}${financial.allocationDrift.equity} จุด`, color: Math.abs(financial.allocationDrift.equity) >= 10 ? COLORS.red : supportColor },
          { label: "Drift กันแรง", value: Math.abs(financial.allocationDrift.bond), note: `${financial.allocationDrift.bond > 0 ? "+" : ""}${financial.allocationDrift.bond} จุด`, color: Math.abs(financial.allocationDrift.bond) >= 10 ? COLORS.red : supportColor },
          { label: "Drift พร้อมใช้", value: Math.abs(financial.allocationDrift.cash), note: `${financial.allocationDrift.cash > 0 ? "+" : ""}${financial.allocationDrift.cash} จุด`, color: Math.abs(financial.allocationDrift.cash) >= 10 ? COLORS.red : supportColor },
        ]);
        painter.bullets("ก่อนเพิ่มชื่อใหม่", [
          "มีสินทรัพย์หรือธีมใดเกิน 20% และจะเสียพร้อมกันเมื่อสมมติฐานเดียวผิดหรือไม่",
          "เงินที่ต้องใช้ใน 3 ปีอยู่ในสินทรัพย์ที่ลดลงแรงหรือขายยากหรือไม่",
          "ทุกสถานะมีหน้าที่ชัด หรือบางตัวอยู่เพราะยังไม่อยากตัดสินใจ",
          "ปรับเมื่อ drift เกินกฎ IPS ไม่ปรับเพียงเพราะสินทรัพย์หนึ่งเป็นข่าว",
        ]);
        break;
      case "scenario-lab":
        painter.table(["เหตุการณ์", "ขาดทุนจำลอง", "ทุนหลังเหตุการณ์", "การตอบสนองที่เขียนไว้ก่อน"], financial.stressScenarios.map((scenario) => ({ cells: [
          `ตลาดหุ้น -${scenario.marketDrop}%`,
          `-${money(scenario.estimatedLoss)}`,
          money(scenario.postStressCapital),
          scenario.action,
        ], tone: scenario.marketDrop >= 35 ? "warn" : undefined })), [105, 115, 115, 152]);
        painter.table(["เหตุการณ์ชีวิต", "เงินสำรองคงเหลือ", "สถานะ"], financial.incomeShock.map((shock) => ({ cells: [
          `รายได้หาย ${shock.months} เดือน`,
          shock.remainingEmergency >= 0 ? money(shock.remainingEmergency) : `ขาด ${money(Math.abs(shock.remainingEmergency))}`,
          shock.status,
        ], tone: shock.remainingEmergency < 0 ? "warn" : "accent" })), [150, 155, 182]);
        painter.quote("หากเงินสำรองต่ำกว่า 3 เดือน หนี้ดอกเบี้ยสูง หรือรายรับหลักหาย ให้หยุดเพิ่มความเสี่ยงก่อนพิจารณาว่าราคาหุ้นน่าสนใจเพียงใด", "กฎก่อนเหตุการณ์จริง");
        break;
      case "worksheet":
        painter.form([
          { label: "บริษัท / สินทรัพย์ และหน้าที่ในพอร์ต", lines: 2 },
          { label: "รายได้มาจากไหน และหลักฐานสามข้อ", lines: 4 },
          { label: "ราคานี้ต้องการการเติบโตแบบใด", lines: 3 },
          { label: "ข้อมูลใดจะทำให้ฉันยอมรับว่าคิดผิด", lines: 3 },
          { label: "ขนาดสูงสุด เงื่อนไขเพิ่ม และวันทบทวน", lines: 3 },
        ]);
        break;
      case "action-plan":
        painter.rows([
          { label: "วัน 1-30", title: "ตั้งฐานและลดเสียงรบกวน", body: `ยืนยันข้อมูลการเงิน แยกสามกอง เติมช่องว่างสำรอง และจำกัดคิวศึกษาไว้ที่ ${picks.length || 5} บริษัท`, aside: "วัด: data completeness" },
          { label: "วัน 31-90", title: "สร้างหลักฐานก่อนสร้างสถานะ", body: "ทำแบบคัดให้ครบสองบริษัท เขียนกรณีดี กลาง แย่ และเริ่ม decision journal ทุกครั้งที่เปลี่ยนพอร์ต", aside: "วัด: research completed" },
          { label: "วัน 91-365", title: "ทำให้ระบบอยู่รอดข้ามอารมณ์", body: "ทบทวน IPS รายไตรมาส ตรวจ drift และสรุปว่ากติกาข้อใดช่วยหรือกติกาข้อใดต้องแก้", aside: "วัด: process adherence" },
        ]);
        painter.bullets("ตัวชี้วัดที่ควรเก็บ", [
          `เงินสำรอง ${number(financial.runwayMonths)} เดือน เทียบเป้าหมาย ${input.emergencyMonths} เดือน`,
          `เงินลงทุนจริงต่อเดือนเทียบเพดาน ${money(financial.investableMonthly)}`,
          "จำนวน thesis ที่เขียนครบก่อนซื้อ และจำนวนครั้งที่หลุดกฎ",
          "จำนวนการตัดสินใจที่เลือกไม่ทำเพราะหลักฐานไม่พอ",
        ]);
        break;
      case "decision-journal":
        painter.form([
          { label: "การตัดสินใจและวันที่", lines: 1 },
          { label: "เหตุผลหลักสามข้อ", lines: 3 },
          { label: "ข้อมูลที่จะทำให้เปลี่ยนใจ", lines: 2 },
          { label: "ขนาด เพดานเสียหาย และวันทบทวน", lines: 2 },
        ]);
        painter.bullets("เช็กก่อนลงนาม", ["ข้อมูลครบตามเกณฑ์", "ขนาดอยู่ใน IPS", "ไม่มีแรงเร่งจากราคา", "อธิบายทางถอยได้", "กำหนดวันทบทวนแล้ว"]);
        break;
      case "monthly-baseline":
        painter.metrics([
          { label: "เงินสำรอง", value: `${number(financial.runwayMonths)} เดือน`, note: `เป้าหมาย ${input.emergencyMonths} เดือน`, tone: financial.emergencyGap > 0 ? "warn" : "good" },
          { label: "ลงทุนต่อเดือน", value: money(financial.investableMonthly), note: `ตั้งใจ ${money(input.monthly)}`, tone: "accent" },
          { label: "ช่องว่างเป้าหมาย", value: money(financial.goalGap), note: financial.goalStatus, tone: financial.goalStatus === "ต้องซ่อมฐานก่อน" ? "warn" : "accent" },
          { label: "Risk frame", value: financial.effectiveRisk, note: `${financial.willingness} / ${financial.capacity}` },
          { label: "พอร์ตหุ้น", value: `${financial.currentAllocation.equity}%`, note: `กรอบ ${target.equity}%`, tone: Math.abs(financial.allocationDrift.equity) >= 10 ? "warn" : "good" },
          { label: "คิววิจัย", value: `${picks.length} บริษัท`, note: picks.map((pick) => pick.ticker).join(" · ") },
        ]);
        painter.table(["ค่าเดิม", "ค่าใหม่", "สาเหตุ", "ผลต่อแผน", "งานถัดไป"], [
          { cells: ["________", "________", "________________", "________________", "________________"] },
          { cells: ["________", "________", "________________", "________________", "________________"] },
          { cells: ["________", "________", "________________", "________________", "________________"] },
        ], [75, 75, 112, 112, 113]);
        painter.quote(`Baseline ${profile.birthDate || "unknown"}-${manifest.version} · ฉบับถัดไปต้องรายงาน delta ไม่ใช่เขียนคำอ่านเดิมใหม่`, "สัญญารอบถัดไป");
        break;
      case "annual-roadmap":
        painter.rows([
          { label: "Q1", title: "ซ่อมฐานและยืนยันข้อมูล", body: "เติมเงินสำรอง ตรวจหนี้ ยืนยัน holdings และเขียน IPS ให้ครบ", aside: "runway / debt / completeness" },
          { label: "Q2", title: "ทดสอบกระบวนการ", body: "ทำ dossier สองบริษัท ใช้ decision journal และวัดจำนวนครั้งที่หลุดกติกา", aside: "process / research" },
          { label: "Q3", title: "ตรวจพอร์ตทั้งก้อน", body: "ดู concentration, currency, fees, thesis และ drift จาก IPS", aside: "position / drift / fees" },
          { label: "Q4", title: "ทบทวนเป้าหมาย", body: "อัปเดตรายรับ ภาระ เป้าหมาย และตัดสิ่งที่ไม่มีหน้าที่ออกจากพอร์ต", aside: "goal gap / contribution" },
        ]);
        painter.metrics([
          { label: "ทบทวนฐานชีวิต", value: "Q1", note: "runway / debt / data" },
          { label: "ทบทวนพอร์ต", value: "Q3", note: "position / drift / fees" },
          { label: "ทบทวนเป้าหมาย", value: "Q4", note: "goal gap / contribution" },
        ]);
        painter.quote("การทบทวนที่ดีเปลี่ยนกติกาเพราะข้อมูลชีวิตหรือหลักฐานธุรกิจเปลี่ยน ไม่เปลี่ยนเพราะผลตอบแทนระยะสั้นทำให้มั่นใจหรือกลัว", "กฎประจำปี");
        break;
      case "source-ledger":
        painter.table(["รายการ", "ต้นทาง", "สถานะ / วันที่"], [
          { cells: ["วัน เวลา สถานที่เกิด", "ข้อมูลโปรไฟล์ที่ผู้ใช้ระบุ", birthLabel] },
          { cells: ["ฐานะ เป้าหมาย ความเสี่ยง", input.isDemo ? "Financial fixture สำหรับ QA" : "ข้อมูลที่ผู้ใช้ยืนยัน", `${financial.confidence} · ${thaiDate(new Date().toISOString())}`], tone: input.isDemo ? "warn" : "accent" },
          { cells: ["BaZi persona และสมดุลธาตุ", "Deterministic symbolic engine", `${dashboard.persona.bandLabel} · เด่น${dominant.element}`] },
          ...picks.map((pick) => ({ cells: [
            `${pick.ticker} · ${pick.name}`,
            pick.evidence?.businessSource || pick.evidence?.elementSource || "ฐานข้อมูลธุรกิจภายใน",
            `${pick.evidence?.reviewStatus || "รอตรวจ"} · ${pick.evidence?.reviewedAt || marketDate}`,
          ], tone: pick.evidence?.reviewStatus === "published" || pick.evidence?.reviewStatus === "reviewed" ? "accent" as const : "muted" as const })),
        ], [132, 210, 145]);
        painter.quote("หากราคา งบ หรือคำอธิบายธุรกิจเกินรอบ freshness ที่กำหนด ให้แสดงว่า stale และหยุดข้อสรุปเชิงกิจการไว้ที่ ‘รอข้อมูล’", "Freshness policy");
        break;
    }

    painter.finish();
  }

  doc.end();
  return done;
}
