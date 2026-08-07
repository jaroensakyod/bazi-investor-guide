/**
 * PDF การ์ดตัวตนฟรี (lead magnet 1 หน้า) — "คุณเป็นนักลงทุนธาตุไหน?"
 * ฟรีต้องให้น้อย: 3 คำถาม + หุ้น/สินทรัพย์ถูกดวง 2-3 ตัว (ticker+ธาตุ+fit เท่านั้น) + verdict เต็ม = เบลอ CTA
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

const EL_COLOR: Record<string, string> = { ไม้: "#2e7d32", ไฟ: "#c62828", ดิน: "#8d6e63", ทอง: "#b8860b", น้ำ: "#1565c0" };

function clean(s: string): string {
  return s
    .replace(/[\u{1F000}-\u{1FFFF}\uFE00-\uFE0F\u2000-\u2BFF]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function buildFreeCardPdf(state: CalculatedStateValue): Promise<Buffer> {
  const d = buildPersonalDashboard(state);
  const font = (FONT_CANDIDATES.find((f) => existsSync(f)) ?? "Helvetica") as string;
  const doc = new PDFDocument({ size: "A4", margins: { top: 40, bottom: 40, left: 48, right: 48 } });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  if (font !== "Helvetica") doc.registerFont("thai", font);
  const F = font === "Helvetica" ? "Helvetica" : "thai";
  const F_B = font === "Helvetica" ? "Helvetica-Bold" : "thai";

  // ── หัวการ์ด ──
  doc.font(F_B).fontSize(22).fillColor("#8d6e63").text(clean("คุณเป็นนักลงทุนธาตุไหน?"), 48, 48, { width: 500, align: "center" });
  doc.font(F).fontSize(11).fillColor("#777777").text(clean("การ์ดตัวตนการเงิน ฟรี — จากดวง 60 กะจื่อ (ไม่ใช่ดวงเดา)"), 48, 78, { width: 500, align: "center" });
  doc.moveTo(48, 100).lineTo(552, 100).strokeColor("#c9b28a").lineWidth(1).stroke();

  let y = 122;
  const line = (txt: string, size = 10.5, color = "#333333", bold = false) => {
    doc.font(bold ? F_B : F).fontSize(size).fillColor(color).text(clean(txt), 48, y, { width: 504 });
    y = doc.y + 5;
  };
  const sec = (txt: string) => {
    y += 4;
    doc.font(F_B).fontSize(12.5).fillColor("#8d6e63").text(clean(txt), 48, y);
    y += 18;
  };

  // 1. ตัวตน + เทรดได้ไหม
  sec("ตัวตนของคุณ");
  line(`${d.persona.name} (${d.persona.bandLabel}) — สไตล์ ${d.persona.style}`, 11, "#333333", true);
  line(`การเทรด: ${d.trading.label}`, 10.5, d.trading.allowed === "no" ? "#c62828" : d.trading.allowed === "yes" ? "#2e7d32" : "#8d6e63", true);

  // 2. ธาตุเสริม/เลี่ยง
  sec("ธาตุที่ต้องเล่น / เลี่ยง");
  line(`เสริม: ${d.strengthen.element} (${d.strengthen.businessHint}) · ธาตุลาภ: ${d.strengthen.wealth} · เลี่ยง: ${d.avoid.join("/")}`, 10.5, "#333333");
  if (d.principle.excessElement) line(`ขอเตือน: ธาตุ ${d.principle.excessElement} มีเกิน (${d.principle.excessCount} ตัว) — อย่าเพิ่ม`, 10.5, "#c62828");

  // 3. ทำไม (สั้น)
  sec("ทำไม (จากดวงของคุณ)");
  line(d.principle.desc, 10.5, "#555555");
  line(d.trading.reason, 10.5, "#555555");

  // 4. หุ้นถูกดวง 2-3 (จากธาตุที่ต้องเสริม — tier สูงสุด)
  sec("หุ้นที่ถูกดวงของคุณ (ตัวอย่าง)");
  const goodStocks: Array<{ ticker: string; name: string; element: string }> = [];
  for (const c of d.categories) {
    for (const it of c.items) {
      if (goodStocks.length >= 3) break;
      if (it.stockTier === "gold" || it.stockTier === "silver") goodStocks.push({ ticker: it.ticker, name: it.name, element: it.element });
    }
    if (goodStocks.length >= 3) break;
  }
  if (goodStocks.length) {
    for (const s of goodStocks) {
      line(`${s.ticker} — ${s.element} (ตรงดวง) · ${s.name}`, 10, EL_COLOR[s.element] ?? "#333");
    }
  } else {
    line("(ไม่มีตัวอย่างในรอบนี้ — กรอกวันเกิดเพื่อดูของคุณ)", 10, "#888888");
  }

  // 5. สินทรัพย์ถูกดวง 2-3
  sec("สินทรัพย์ที่ถูกดวง (ตัวอย่าง)");
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
    for (const a of goodAssets) {
      line(`${a.ticker} — ${a.element} (ตรงดวง) · ${a.name}`, 10, EL_COLOR[a.element] ?? "#333");
    }
  } else {
    line("REIT/อสังหา (ดิน) · น้ำมัน/ก๊าซ (ไฟ) — ตัวอย่างสินทรัพย์ตรงดวง", 10, "#333");
  }

  // 6. CTA เบลอ
  y += 10;
  doc.roundedRect(48, y, 504, 54, 8).fillColor("#f0e9dd").fill();
  doc.font(F_B).fontSize(11.5).fillColor("#8d6e63").text(clean("ยังมีอีกมาก: verdict เต็ม 60 ข้อ · พอร์ตจัดสรร · แผนที่ชีวิต 0-80 ปี · วันมงคลรายเดือน"), 62, y + 10, { width: 476 });
  doc.font(F).fontSize(10).fillColor("#a08c6e").text(clean("[ กดติดตาม LINE เพื่อปลดล็อกดูต่อ ]"), 62, y + 32, { width: 476 });

  // footer
  doc.font(F).fontSize(7.5).fillColor("#999999").text(clean(d.disclaimer), 48, 800, { width: 504, align: "center" });

  doc.end();
  return done;
}
