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
  // LLM อธิบายความหมาย (ทำไม/เพื่ออะไร/ดี-ไม่ดี/แล้วยังไง) — ล้มเหลว = ใช้เทมเพลต
  const narrative = await generateReportNarrative(state).catch(() => ({}) as Narrative);
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
    ensure(40);
    doc.rect(0, y - 8, 595, 30).fill(C.primary);
    doc.rect(0, y + 22, 595, 3).fill(C.gold);
    doc.font(F_B).fontSize(16).fillColor(C.white).text(clean(`${num}  ${text}`), 52, y, { width: 500 });
    y += 36;
  };
  const h2 = (text: string) => {
    ensure(30);
    doc.rect(52, y, 5, 14).fill(C.gold);
    doc.fontSize(13).font(F_B).fillColor(C.primary).text(clean(text), 66, y - 1);
    y += 20;
  };
  const h3 = (text: string) => {
    ensure(24);
    doc.font(F_B).fontSize(11).fillColor(C.ink).text(clean(text), 52, y);
    y += 16;
  };
  const p = (text: string, size = 10, color = "#333333") => {
    ensure(24);
    doc.fontSize(size).font(F).fillColor(color).text(clean(text), 52, y, { width: 490 });
    y = doc.y + 4;
  };
  const bullet = (txt: string, color = "#333333") => {
    ensure(22);
    doc.circle(58, y + 4, 2).fill(color === "#333333" ? C.gold : color);
    doc.font(F).fontSize(10).fillColor(color).text(clean(txt), 68, y, { width: 472 });
    y = doc.y + 3;
  };
  const callout = (title: string, text: string, kind: "good" | "warn" | "info" = "info") => {
    ensure(40);
    const fill = kind === "good" ? "#e8f3ea" : kind === "warn" ? "#f9ecec" : "#fdf6e3";
    const edge = kind === "good" ? C.green : kind === "warn" ? C.red : C.gold;
    doc.roundedRect(52, y, 490, 36, 6).fill(fill);
    doc.rect(52, y, 4, 36).fill(edge);
    doc.font(F_B).fontSize(9.5).fillColor(edge).text(clean(title), 64, y + 5, { width: 460 });
    doc.font(F).fontSize(9).fillColor("#555555").text(clean(text), 64, y + 18, { width: 460 });
    y += 44;
  };
  const row = (cols: Array<{ text: string; w: number; bold?: boolean; color?: string }>, header = false) => {
    ensure(20);
    let x = 52;
    if (header) doc.rect(52, y, 490, 17).fill("#eef2ec");
    for (const c of cols) {
      doc.font(c.bold || header ? F_B : F).fontSize(header ? 8.5 : 9).fillColor(header ? C.primary : c.color ?? "#333333").text(clean(c.text), x, y + (header ? 3 : 1), { width: c.w });
      x += c.w;
    }
    y += header ? 18 : 15;
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

  // ══════════ ปก (หนังสือ) ══════════
  doc.rect(0, 0, 595, 260).fill(C.primary);
  doc.rect(0, 260, 595, 6).fill(C.gold);
  doc.rect(0, 780, 595, 62).fill("#0c2416");
  // วงแหวนธาตุบนปก (โดนัท 5 ธาตุ)
  donut(297, 420, 95, d.elementBalance.map((e) => ({ pct: e.pct, color: EL_COLOR[e.element] ?? C.muted })), 0.55);
  doc.font(F_B).fontSize(13).fillColor("#cfe3d4").text(clean("ดวงนักลงทุน  ·  ฉบับสถาบัน"), 52, 40);
  doc.font(F_B).fontSize(34).fillColor(C.white).text(clean("รายงานการลงทุนคู่ดวง"), 52, 80, { width: 490 });
  doc.font(F).fontSize(13).fillColor("#cfe3d4").text(clean("ดวง 60 กะจื่อ  x  หุ้น/สินทรัพย์จริง  x  แผนที่ชีวิตทั้งชีวิต"), 52, 130, { width: 490 });
  doc.font(F).fontSize(11).fillColor("#9fb8a8").text(`ฉบับ ${maxSection >= 6 ? "VIP ฉบับเต็ม" : maxSection >= 4 ? "PRO" : maxSection >= 2 ? "ฉบับสรุป" : "ตัวอย่าง"}  ·  วันที่ ${new Date().toISOString().slice(0, 10)}`, 52, 160);
  doc.roundedRect(52, 540, 490, 70, 10).fill("#fdf6e3");
  doc.font(F_B).fontSize(20).fillColor(C.primary).text(clean(`${d.persona.emoji} ${d.persona.name}`), 68, 556, { width: 450 });
  doc.font(F).fontSize(11.5).fillColor(C.muted).text(clean(`${d.persona.bandLabel}  ·  สไตล์ ${d.persona.style}  ·  เทรด: ${d.trading.label}`), 68, 584, { width: 450 });
  doc.font(F).fontSize(8.5).fillColor("#cfe3d4").text(clean(d.disclaimer), 52, 792, { width: 490, align: "center" });

  // ══════════ สารบัญ + บทนำ ══════════
  doc.addPage();
  y = 52;
  footer();
  h1("สารบัญ", "");
  const toc = [
    ["บทที่ 1", "มุมมองดวง (Verdict) — กำลังดิถี + ธาตุในดวง"],
    ["บทที่ 2", "การจัดสรรเงินตามกำลังดวง (70/10/20)"],
    ["บทที่ 3", "พอร์ตเด่นประจำเดือน (เทียร์ 1-4)"],
    ["บทที่ 4", "สินค้าแนะนำตามดวง (11 หมวด)"],
    ["บทที่ 5", "แผนที่ชีวิต Life Map 0-80+ ปี"],
    ["บทที่ 6", "วันมงคล / วันระวัง (เดือนนี้)"],
    ["ภาคผนวก ก", "เช็กลิสต์ก่อนลงทุน (20 ข้อ)"],
    ["ภาคผนวก ข", "อภิธานศัพท์ (ธาตุ/วัยจร/เชี่ยงแซ/เทียร์)"],
  ];
  for (const [n, t] of toc) {
    row([{ text: n, w: 70, bold: true, color: C.gold }, { text: t, w: 420 }]);
  }
  y += 6;
  h1("บทนำ  —  วิธีอ่านหนังสือเล่มนี้", "อ่านก่อน");
  p("หนังสือเล่มนี้สร้างจากข้อมูลจริงของคุณเท่านั้น: ดวงคำนวณด้วยตำรา 60 กะจื่อ (deterministic — ไม่ใช่ดวงเดา) × ข้อมูลตลาดจริง 5,958 หุ้น 27 ตลาด × ตารางธาตุจากซินแส", 10);
  h2("คำศัพท์ที่ต้องรู้ก่อนอ่าน");
  bullet("ธาตุ (ไม้/ไฟ/ดิน/ทอง/น้ำ) — พลัง 5 ชนิดในดวงและในธุรกิจ — หุ้นแต่ละตัวมีธาตุของตัวเอง (เช่น โรงพยาบาล=ไฟ, ธนาคาร=น้ำ)");
  bullet("กำลังดิถี — แรงของวันเกิด: อ่อน=ต้องเสริม อย่าไล่ลาภ / แข็ง=ถ่ายเทได้ ลงทุนกล้าได้");
  bullet("ธาตุลาภ — ธาตุที่ 'เป็นเงิน' ของดวงคุณ แต่ถ้ามีเกิน (เช่น น้ำ 45%) การไล่ลาภ = ดูดพลัง");
  bullet("วัยจร — วงจร 10 ปีที่เปลี่ยนธาตุ สลับกันทั้งชีวิต — เปลี่ยนทิศทางดวงการเงินทุกช่วง");
  bullet("เทียร์หุ้น 1-4 — ระดับคุณภาพคำแนะนำ: 1=VIP (ตรงดวง+แข็ง) → 4=INFO (แค่ข้อมูล)");
  callout("วิธีใช้เล่มนี้ (3 นาที)", "อ่านบท 1 เพื่อรู้กำลังตัวเอง → เปิดบท 3 เลือกหุ้นเทียร์ 1-2 → ใช้บท 5 วางแผนช่วงวัย → ทำเช็กลิสต์ภาคผนวก ก ก่อนซื้อทุกครั้ง", "good");

  // ══════════ บท 1: มุมมองดวง ══════════
  if (maxSection >= 1) {
    doc.addPage();
    y = 52;
    footer();
    h1("มุมมองดวง (Verdict)", "บทที่ 1");
    p(narrative["1"] ?? "ส่วนนี้สรุปกำลังดวงของคุณ — เป็นหลักตั้งต้นของทุกคำแนะนำในเล่มนี้", 10, "#8d6e63");
    h2("กำลังดิถีของคุณ");
    row([{ text: "กำลัง", w: 90, bold: true }, { text: "ผลต่อการลงทุน", w: 200, bold: true }, { text: "แนวทาง", w: 200, bold: true }], true);
    row([{ text: d.principle.band === "weak" ? "ดิถีอ่อน" : d.principle.band === "strong" ? "ดิถีแข็ง" : "ดิถีสมดุล", w: 90, bold: true }, { text: d.principle.mode, w: 200 }, { text: `เสริม ${d.principle.supplementElement}`, w: 200, color: C.green }]);
    p(d.principle.desc, 10, "#555555");
    h2("ธาตุในดวงของคุณ (5 ธาตุ)");
    const eb = d.elementBalance;
    donut(180, y + 75, 62, eb.map((e) => ({ pct: e.pct, color: EL_COLOR[e.element] ?? C.muted })));
    // legend ขวาของโดนัท
    let ly = y + 40;
    for (const e of eb) {
      doc.roundedRect(280, ly, 12, 12, 2).fill(EL_COLOR[e.element] ?? C.muted);
      doc.font(F).fontSize(10).fillColor("#333333").text(clean(`${e.element} ${e.pct}%`), 298, ly, { width: 200 });
      ly += 18;
    }
    y += 150;
    h3("ตารางธาตุในดวง — ดี/ไม่ดี ยังไง");
    row([{ text: "ธาตุ", w: 50, bold: true }, { text: "จำนวน", w: 60, bold: true }, { text: "บทบาท", w: 180, bold: true }, { text: "ควรทำ", w: 200, bold: true }], true);
    for (const e of eb) {
      const role = e.element === d.strengthen.wealth ? `ธาตุลาภ${e.pct >= 30 ? " (เกิน — ดูดพลัง)" : ""}` : e.element === d.strengthen.element ? "ธาตุที่ต้องเสริม" : d.avoid.includes(e.element) ? "ธาตุพิฆาต" : "กลาง";
      const act = e.element === d.strengthen.element ? "ลงทุนธุรกิจธาตุนี้" : d.avoid.includes(e.element) ? "หลีกเลี่ยง" : e.pct >= 30 ? "อย่าเพิ่ม" : "ถือไว้";
      row([{ text: e.element, w: 50, bold: true, color: EL_COLOR[e.element] ?? "#333" }, { text: `${e.count ?? "?"} ตัว (${e.pct}%)`, w: 60 }, { text: role, w: 180 }, { text: act, w: 200, color: act.includes("หลีก") ? C.red : act.includes("อย่า") ? C.red : C.green }]);
    }
    if (d.principle.excessElement) {
      callout("ขอเตือน", `ธาตุ ${d.principle.excessElement} มีเกิน (${d.principle.excessCount} ตัว) — ${d.principle.excessNote ?? "อย่าเพิ่ม ไม่งั้นเสียสมดุล"}`, "warn");
    }
    callout("ข้อควรรู้", `ธาตุลาภของคุณคือ ${d.strengthen.wealth} — เงินของคุณมาจากธุรกิจธาตุนี้ แต่ถ้า${d.principle.excessElement ? ` ${d.principle.excessElement} เกินอยู่แล้ว` : "มีน้อย"} ให้ใช้หลัก "เสริมก่อน ไล่ลาภทีหลัง"`, "info");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 1", "มุมมองดวง (Verdict)", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ══════════ บท 2: จัดสรรเงิน ══════════
  if (maxSection >= 2) {
    doc.addPage();
    y = 52;
    footer();
    h1("การจัดสรรเงินตามกำลังดวง", "บทที่ 2");
    p(narrative["2"] ?? "กำลังดวงกำหนดว่า 'ไล่กำไรได้แค่ไหน' — ดิถีอ่อนต้องกันเงินเย็นไว้มาก", 10, "#8d6e63");
    donut(170, y + 80, 65, [
      { pct: d.trading.split.cold, color: C.green },
      { pct: d.trading.split.fast, color: C.gold },
      { pct: d.trading.split.emergency, color: "#1565c0" },
    ]);
    let l2y = y + 46;
    for (const [lab, pct, col] of [["เงินเย็น (ยาว)", d.trading.split.cold, C.green], ["เงินเร็ว (เทรด)", d.trading.split.fast, C.gold], ["เงินฉุกเฉิน", d.trading.split.emergency, "#1565c0"]] as const) {
      doc.roundedRect(270, l2y, 12, 12, 2).fill(col);
      doc.font(F_B).fontSize(10.5).fillColor("#333333").text(`${lab} ${pct}%`, 288, l2y, { width: 220 });
      l2y += 18;
    }
    y += 165;
    h2("เครื่องมือของแต่ละกอง");
    row([{ text: "กอง", w: 100, bold: true }, { text: "เครื่องมือที่แนะนำ", w: 390, bold: true }], true);
    row([{ text: "เงินเย็น 70%", w: 100, bold: true, color: C.green }, { text: d.instruments.cold.join(" · "), w: 390 }]);
    row([{ text: "เงินเร็ว 10%", w: 100, bold: true, color: C.gold }, { text: d.instruments.fast.join(" · "), w: 390 }]);
    row([{ text: "ฉุกเฉิน 20%", w: 100, bold: true, color: "#1565c0" }, { text: d.instruments.emergency.join(" · "), w: 390 }]);
    callout("ข้อควรระวัง", "เงินเย็น = ห้ามแตะแม้ตลาดร่วง (นี่คือกอง 'รอจังหวะทอง') · เงินเร็ว = ขาดทุนได้แต่ห้ามเกินสัดส่วน · ฉุกเฉิน = กันภัย 6 เดือน", "warn");
    callout("ข้อควรรู้", `การเทรด: ${d.trading.label} — ${d.trading.reason}`, "info");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 2", "การจัดสรรเงินตามกำลังดวง", maxSection <= 0 ? "ฉบับสรุป (฿99)" : "ฉบับ Pro (฿490)");
  }

  // ══════════ บท 3: พอร์ตเด่น ══════════
  if (maxSection >= 3) {
    doc.addPage();
    y = 52;
    footer();
    h1("พอร์ตเด่นประจำเดือน (เทียร์ 1-4)", "บทที่ 3");
    p(narrative["3"] ?? "วิธีอ่านเทียร์: 1=VIP ตรงดวง+แข็ง · 2=PRO · 3=FREE · 4=INFO แค่ข้อมูล", 10, "#8d6e63");
    h2("TH30 — 30 หุ้นไทยที่ตรงดวงที่สุด (เทียบ SET)");
    p(`SET วันนี้: ${thPicks.benchmark.changePct != null ? `${thPicks.benchmark.changePct}%` : "-"} · คัดจาก 5,958 หุ้น 27 ตลาด เฉพาะธาตุตรงดวง`, 9.5, "#666666");
    row([{ text: "#", w: 24, bold: true }, { text: "หุ้น", w: 84, bold: true }, { text: "ธาตุ", w: 36, bold: true }, { text: "เทียร์", w: 88, bold: true }, { text: "คะแนน", w: 42, bold: true }, { text: "เหตุผลหลัก", w: 216, bold: true }], true);
    for (const [i, pk] of thPicks.picks.entries()) {
      row([{ text: `${i + 1}`, w: 24 }, { text: pk.ticker, w: 84, bold: true }, { text: pk.element, w: 36, color: EL_COLOR[pk.element] ?? "#333" }, { text: TIER_LABEL[pk.stockTier], w: 88, color: pk.stockTier === "gold" ? "#b8860b" : "#333" }, { text: `${pk.score}`, w: 42 }, { text: pk.reasons[0] ?? "", w: 216, color: "#555555" }]);
    }
    h2("คะแนนพอร์ตเด่น (กราฟ)");
    bars(52, y + 10, 490, thPicks.picks.slice(0, 10).map((pk) => ({ label: pk.ticker, value: pk.score, color: pk.stockTier === "gold" ? C.gold : pk.stockTier === "silver" ? "#9aa5b1" : pk.stockTier === "bronze" ? "#b08d57" : "#c9c2b2" })));
    y += 95;
    callout("วิธีใช้พอร์ตนี้", "เริ่มจากเทียร์ 1-2 ก่อน (ตรงดวง+พื้นฐานแข็ง) · เทียร์ 3 = ฟรี ใช้ประกอบ · เทียร์ 4 = ยังไม่ควรแตะ · ซื้อเฉพาะวันมงคล (บท 6) + ผ่านเช็กลิสต์ (ภาคผนวก ก)", "good");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 3", "พอร์ตเด่นประจำเดือน (เทียร์)", maxSection <= 2 ? "ฉบับ Pro (฿490)" : "VIP (฿790/เดือน)");
  }

  // ══════════ บท 4: สินค้าแนะนำ ══════════
  if (maxSection >= 4) {
    doc.addPage();
    y = 52;
    footer();
    h1("สินค้าแนะนำตามดวง (11 หมวด)", "บทที่ 4");
    p(narrative["4"] ?? "ตรงดวง = ลงทุนได้ · ดูดพลัง = เลี่ยง · ขัดดวง = อย่าแตะ", 10, "#8d6e63");
    row([{ text: "หมวด", w: 130, bold: true }, { text: "สินค้าเด่น (เทียร์/fit)", w: 360, bold: true }], true);
    for (const cat of d.categories) {
      const items = cat.items.slice(0, 2).map((it) => `${it.ticker}(${TIER_LABEL[it.stockTier as StockTier] ?? ""} ${it.fit === "good" ? "ตรงดวง" : it.fit === "drain" ? "ดูดพลัง" : it.fit === "avoid" ? "ขัดดวง" : "กลาง"})`).join(", ");
      if (items) row([{ text: cat.label, w: 130 }, { text: items, w: 360, color: "#555555" }]);
    }
    callout("ความหมายของ fit", "ตรงดวง = ธาตุสินค้าอยู่ในธาตุที่ต้องเสริม (ลงทุนได้) · ดูดพลัง = ธาตุลาภเกิน — การไล่ลาภจะดึงพลัง (ดิถีอ่อนเสี่ยงสุด) · ขัดดวง = ธาตุพิฆาต — ห้ามแตะเด็ดขาด", "info");
    callout("ข้อควรระวัง", "สินค้าที่ fit='ตรงดวง' แต่เทียร์ 4 = แค่ข้อมูล — ต้องมีพื้นฐานแข็ง (เทียร์ 1-2) ถึงลงทุนจริง", "warn");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 4", "สินค้าแนะนำตามดวง (11 หมวด)", maxSection <= 2 ? "ฉบับ Pro (฿490)" : "VIP (฿790/เดือน)");
  }

  // ══════════ บท 5: Life Map ══════════
  if (maxSection >= 5) {
    doc.addPage();
    y = 52;
    footer();
    h1("แผนที่ชีวิต (Life Map) 0-80+ ปี", "บทที่ 5");
    p(narrative["5"] ?? "แต่ละแถบ = วัยจร 5 ปี — วางแผนการเงินทั้งชีวิตจากแถบนี้", 10, "#8d6e63");
    const vMeta: Record<string, { label: string; color: string; tint: string }> = {
      invest: { label: "ลงทุนเต็มที่", color: "#1e6f3e", tint: "#e8f3ea" },
      accumulate: { label: "สะสม/ถือ", color: "#b8860b", tint: "#f7f1e2" },
      avoid: { label: "หลีกเลี่ยง", color: "#9b2c2c", tint: "#f9ecec" },
      "no-risk": { label: "ห้ามเสี่ยง", color: "#6b1f1f", tint: "#f3e3e3" },
    };
    const legendX = [52, 178, 296, 414];
    for (const [i, m] of Object.values(vMeta).entries()) {
      doc.roundedRect(legendX[i], y + 2, 10, 10, 2).fill(m.color);
      doc.font(F).fontSize(8.5).fillColor(C.muted).text(clean(m.label), legendX[i] + 14, y, { width: 100 });
    }
    y += 14;
    for (const t of d.timeline) {
      const m = vMeta[t.verdict] ?? vMeta.accumulate;
      ensure(22);
      doc.roundedRect(52, y, 490, 20, 4).fill(m.tint);
      doc.roundedRect(52, y, 6, 20, 3).fill(m.color);
      doc.font(F_B).fontSize(9.5).fillColor(C.ink).text(clean(`${t.ageRange} ปี`), 66, y + 4, { width: 58 });
      doc.font(F_B).fontSize(9.5).fillColor(m.color).text(clean(m.label), 128, y + 4, { width: 82 });
      doc.font(F).fontSize(8.5).fillColor("#555555").text(clean(t.advice), 214, y + 4, { width: 324 });
      y += 24;
    }
    const golds = d.timeline.filter((t) => t.verdict === "invest");
    if (golds.length) {
      y += 2;
      doc.roundedRect(52, y, 490, 26, 4).fill("#fdf6e3").strokeColor(C.gold).lineWidth(1).stroke();
      doc.font(F_B).fontSize(10).fillColor(C.gold).text(clean(`ช่วงทองของคุณ: ${golds.map((g) => g.ageRange).join(", ")} ปี — ลงทุนเต็มที่ ริเริ่มก่อเกิดลาภ`), 62, y + 7, { width: 470 });
      y += 32;
    }
    callout("วิธีใช้ Life Map", "ดูแถบสีอายุปัจจุบัน → ทำตามคำแนะนำช่วงนั้น · วางแผนว่า 'ช่วงทอง' จะมาถึงเมื่อไหร่ → เตรียมเงินเย็นไว้รอ · ช่วงแดง = ห้ามเสี่ยงเด็ดขาด กันเงินสด", "good");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 5", "แผนที่ชีวิต (Life Map)", "VIP (฿790/เดือน)");
  }

  // ══════════ บท 6: วันมงคล ══════════
  if (maxSection >= 6) {
    doc.addPage();
    y = 52;
    footer();
    h1("วันมงคล / วันระวัง (เดือนนี้)", "บทที่ 6");
    p(narrative["6"] ?? "วันมงคล = ทำธุรกรรมใหญ่ · วันระวัง = งดเสี่ยง", 10, "#8d6e63");
    h2("ธาตุเดือนนี้");
    p(`ธาตุเดือน: ${d.monthAdvice.element ?? "-"} (${d.monthAdvice.fit === "good" ? "หนุนดวง" : d.monthAdvice.fit === "avoid" ? "ขัดดวง" : "กลาง"}) — ${d.monthAdvice.text}`, 10.5);
    h2("วันมงคล (${d.auspiciousDays.month.goodDayCount} วัน)");
    const gd = d.auspiciousDays.month.goodDays.map((g) => g.date);
    for (let i = 0; i < gd.length; i += 6) {
      row(gd.slice(i, i + 6).map((x) => ({ text: x, w: 78, color: C.green })));
    }
    h2("วันระวัง (${d.auspiciousDays.month.avoidDayCount} วัน)");
    const ad = d.auspiciousDays.month.avoidDays.map((g) => g.date);
    for (let i = 0; i < ad.length; i += 6) {
      row(ad.slice(i, i + 6).map((x) => ({ text: x, w: 78, color: C.red })));
    }
    callout("วิธีใช้", "วางแผนซื้อก้อน/ลงทุน/เซ็นสัญญาในวันมงคล · วันระวัง = งดตัดสินใจเสี่ยง เก็บเงินสด · ธาตุเดือนเปลี่ยน = ปรับน้ำหนักพอร์ตตาม (หนุน→เพิ่ม  ขัด→ลด)", "good");
  } else {
    doc.addPage();
    y = 52;
    footer();
    lockedSection("บทที่ 6", "วันมงคล / วันระวัง (รายเดือน)", "VIP (฿790/เดือน)");
  }

  // ══════════ ภาคผนวก ก: เช็กลิสต์ ══════════
  if (maxSection >= 3) {
    doc.addPage();
    y = 52;
    footer();
    h1("เช็กลิสต์ก่อนลงทุน (20 ข้อ)", "ภาคผนวก ก");
    p("ตรวจทุกข้อก่อนซื้อทุกครั้ง — ผ่าน 16/20 ขึ้นไปถึงเริ่ม  (ข้อไหนไม่ได้ = หยุดก่อน)", 10, "#8d6e63");
    const checks: Array<[string, boolean]> = [
      [`หุ้นธาตุ = ${d.strengthen.element} หรือธาตุที่ควรทำ (ไม่ใช่ ${d.avoid.join("/")})`, true],
      ["fit ไม่ใช่ 'ขัดดวง' (ธาตุพิฆาต)", true],
      ["fit ไม่ใช่ 'ดูดพลัง' ถ้าดิถีอ่อน", true],
      ["เทียร์ไม่ใช่ INFO (เทียร์ 4 = ยังไม่ควรแตะ)", true],
      ["อยู่ในช่วงวัยจรที่ไม่ใช่ 'เลี่ยง/ห้ามเสี่ยง'", true],
      ["สัดส่วนเงินเย็น/เร็ว/ฉุกเฉินยังคงเดิม (ไม่เอาเงินฉุกเฉินไปลง)", true],
      ["ซื้อเฉพาะวันมงคล (บท 6)", true],
      ["ไม่ซื้อเกิน 5% ของพอร์ตต่อตัวเดียว", true],
      ["มีเหตุผลเขียนได้ 1 บรรทัด (ธุรกิจ+ธาตุ+เทียร์)", true],
      ["ราคา/สภาพคล่อง: หุ้นเล็กซื้อได้เฉพาะเงินเร็ว", true],
      ["DCA ดีกว่าซื้อทีเดียวถ้าวัยจร 'สะสม'", true],
      ["ไม่ใช้เงินกู้/มาร์จิ้น (ดิถีอ่อนยิ่งห้าม)", true],
      ["ตั้งจุดตัดขาดทุนไว้ก่อนซื้อ (เช่น -15%)", true],
      ["ธาตุเดือนนี้ไม่ขัด (บท 6)", true],
      ["หุ้นมีธาตุชัดเจน (ไม่ใช่ธาตุคลุมเครือ)", true],
      ["ผ่านเกณฑ์: 16/20 ขึ้นไป", false],
    ];
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
