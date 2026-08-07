/**
 * PDF การ์ดตัวตนฟรี (lead magnet 1 หน้า) — "คุณเป็นนักลงทุนธาตุไหน?" — DESIGN v2 (มืออาชีพ)
 * Palette: เขียวเข้ม (เงิน/ความมั่งคั่ง) + ทอง + ครีม · hierarchy ชัด · callout · header/footer
 */
import { existsSync } from "node:fs";
import PDFDocument from "pdfkit";
import type { CalculatedStateValue } from "../lib/bazi/schema-types";
import { buildPersonalDashboard } from "../lib/portfolio/personal-dashboard";

const FONT_CANDIDATES = [
  process.env.PDF_FONT,
  "C:/Windows/Fonts/leelawad.ttf",
  "C:/Windows/Fonts/tahoma.ttf",
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].filter((f): f is string => Boolean(f));

// ── Design system ──
const C = {
  primary: "#14532d", // เขียวเข้ม (เงิน/มั่งคั่ง)
  gold: "#b8860b",
  ink: "#2b2417",
  muted: "#8a8478",
  cream: "#f7f4ec",
  line: "#e0d9c8",
  red: "#9b2c2c",
  green: "#1e6f3e",
  white: "#ffffff",
};
const EL: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };

function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\uFE00-\uFE0F\u2000-\u2BFF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildFreeCardPdf(state: CalculatedStateValue): Promise<Buffer> {
  const d = buildPersonalDashboard(state);
  const font = (FONT_CANDIDATES.find((f) => existsSync(f)) ?? "Helvetica") as string;
  const doc = new PDFDocument({ size: "A4", margins: { top: 0, bottom: 0, left: 0, right: 0 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (font !== "Helvetica") doc.registerFont("thai", font);
  const F = font === "Helvetica" ? "Helvetica" : "thai";
  const F_B = font === "Helvetica" ? "Helvetica-Bold" : "thai";
  const W = 595;
  let y = 0;

  // ── แถบหัว (primary) ──
  doc.rect(0, 0, W, 74).fill(C.primary);
  doc.rect(0, 74, W, 3).fill(C.gold);
  doc.font(F_B).fontSize(20).fillColor(C.white).text(clean("ดวงนักลงทุน"), 42, 16);
  doc.font(F).fontSize(9.5).fillColor("#cfe3d4").text(clean("รายงานส่วนตัวจากดวง 60 กะจื่อ (deterministic — ไม่ใช่ดวงเดา)"), 42, 44);
  doc.font(F_B).fontSize(10).fillColor(C.gold).text("LEAD MAGNET - ฟรี", 42, 60);

  // ── หัวการ์ด ──
  y = 104;
  doc.font(F_B).fontSize(25).fillColor(C.primary).text(clean("คุณเป็นนักลงทุนธาตุไหน?"), 42, y, { width: 510, align: "center" });
  y += 30;
  doc.font(F).fontSize(11).fillColor(C.muted).text(clean(`${d.persona.emoji} ${d.persona.name} (${d.persona.bandLabel})  ·  ${d.persona.style}`), 42, y, { width: 510, align: "center" });
  y += 26;

  const secTitle = (txt: string) => {
    doc.rect(42, y, 5, 15).fill(C.gold);
    doc.font(F_B).fontSize(13).fillColor(C.ink).text(clean(txt), 56, y - 1);
    y += 24;
  };
  const body = (txt: string, size = 10.5, color = C.ink) => {
    doc.font(F).fontSize(size).fillColor(color).text(clean(txt), 56, y, { width: 480 });
    y = doc.y + 5;
  };
  const chipRow = (txt: string, el?: string) => {
    if (el && EL[el]) {
      doc.roundedRect(56, y + 1, 9, 9, 2).fill(EL[el]);
    }
    doc.font(F).fontSize(10.5).fillColor(C.ink).text(clean(txt), el && EL[el] ? 74 : 56, y, { width: 460 });
    y = doc.y + 4;
  };

  // ── 1. เทรดได้/ไม่ได้ (callout ใหญ่) ──
  const allowed = d.trading.allowed;
  const boxColor = allowed === "no" ? C.red : allowed === "yes" ? C.green : C.gold;
  doc.roundedRect(42, y, 510, 44, 6).fill("#f2ede2").strokeColor(boxColor).lineWidth(1.2).stroke();
  doc.font(F_B).fontSize(13).fillColor(boxColor).text(clean(`การเทรด: ${d.trading.label}`), 58, y + 8);
  doc.font(F).fontSize(10).fillColor(C.ink).text(clean(`สัดส่วน: เงินเย็น ${d.trading.split.cold}% · เร็ว ${d.trading.split.fast}% · ฉุกเฉิน ${d.trading.split.emergency}%`), 58, y + 26, { width: 470 });
  y += 56;

  // ── 2. ธาตุที่ต้องเล่น/เลี่ยง ──
  secTitle("ธาตุที่ต้องเล่น / เลี่ยง");
  body(`เสริม: ${d.strengthen.element} (${d.strengthen.businessHint})`, 10.5, C.ink);
  body(`ธาตุลาภ: ${d.strengthen.wealth}  ·  เลี่ยง: ${d.avoid.join(" / ")}`, 10.5, C.ink);
  if (d.principle.excessElement) {
    doc.roundedRect(56, y + 2, 470, 20, 4).fill("#f9ecec");
    doc.font(F_B).fontSize(9.5).fillColor(C.red).text(clean(`ขอเตือน: ธาตุ ${d.principle.excessElement} มีเกิน (${d.principle.excessCount} ตัว) — อย่าเพิ่ม`), 66, y + 5);
    y += 26;
  } else {
    y += 4;
  }

  // ── 3. ทำไม ──
  secTitle("ทำไม (จากดวงของคุณ)");
  body(d.principle.desc, 10.5, C.muted);
  body(d.trading.reason, 10.5, C.muted);
  y += 4;

  // ── 4. หุ้นถูกดวง ──
  secTitle("หุ้นที่ถูกดวงของคุณ (ตัวอย่าง)");
  const goodStocks: Array<{ ticker: string; name: string; element: string }> = [];
  for (const c of d.categories) {
    for (const it of c.items) {
      if (goodStocks.length >= 3) break;
      const isRealStock = !it.ticker.includes("=") && !it.ticker.startsWith("^") && !it.ticker.includes("_");
      if ((it.stockTier === "gold" || it.stockTier === "silver") && isRealStock) goodStocks.push({ ticker: it.ticker, name: it.name, element: it.element });
    }
    if (goodStocks.length >= 3) break;
  }
  if (goodStocks.length) {
    for (const s of goodStocks) chipRow(`${s.ticker}  —  ${s.element} (ตรงดวง) · ${s.name}`, s.element);
  } else {
    body("(ไม่มีตัวอย่างในรอบนี้ — กรอกวันเกิดเพื่อดูของคุณ)", 10, C.muted);
  }
  y += 4;

  // ── 5. สินทรัพย์ถูกดวง ──
  secTitle("สินทรัพย์ที่ถูกดวง (ตัวอย่าง)");
  const goodAssets: Array<{ ticker: string; name: string; element: string }> = [];
  for (const c of d.categories) {
    for (const it of c.items) {
      if (goodAssets.length >= 3) break;
      const isAsset = it.ticker.includes("=") || it.ticker.startsWith("^") || it.ticker.includes("_") || it.ticker.length > 5;
      if (it.fit === "good" && isAsset) goodAssets.push({ ticker: it.ticker, name: it.name, element: it.element });
    }
    if (goodAssets.length >= 3) break;
  }
  if (goodAssets.length) {
    for (const a of goodAssets) chipRow(`${a.ticker}  —  ${a.element} (ตรงดวง) · ${a.name}`, a.element);
  } else {
    body("REIT/อสังหา (ดิน) · น้ำมัน/ก๊าซ (ไฟ) — ตัวอย่างสินทรัพย์ตรงดวง", 10, C.muted);
  }

  // ── 6. CTA ──
  y += 8;
  doc.roundedRect(42, y, 510, 62, 8).fill(C.primary);
  doc.rect(42, y, 510, 4).fill(C.gold);
  doc.font(F_B).fontSize(12).fillColor(C.white).text(clean("ยังมีอีกมาก: verdict 60 ข้อ · พอร์ตจัดสรร · แผนที่ชีวิต 0-80 ปี · วันมงคลรายเดือน"), 58, y + 14, { width: 478 });
  doc.font(F).fontSize(10).fillColor("#cfe3d4").text(clean("[ กดติดตาม LINE เพื่อปลดล็อกดูต่อ ]"), 58, y + 38, { width: 478 });
  y += 74;

  // ── footer ──
  doc.rect(0, 812, W, 30).fill(C.cream);
  doc.font(F).fontSize(7.5).fillColor(C.muted).text(clean(d.disclaimer), 42, 819, { width: 510, align: "center" });

  doc.end();
  return done;
}
