/**
 * จำแนกธาตุ IPO แบบ deterministic (keyword จากชื่อบริษัท — ตามตารางซินแส Source6 §1.1.2)
 * ใช้ในหน้า /ipo + หมวด IPO ของ /personal + แชท
 */
import { resolveInvestElements } from "../investor/investor-guide";
import { getEngineStrengthBand } from "../bazi/topic-knowledge-adapted";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

export type IpoRow = {
  ticker: string;
  name: string;
  nameEn?: string;
  market?: string;
  country?: string;
  exchange?: string;
  ipoDate?: string;
  priceRange?: string;
  currency?: string;
  status?: string;
};

/**
 * keyword → ธาตุ — อ้างตารางซินแส Source6 §1.1.2 · รองรับ EN + TH
 * หลักจัดลำดับ: เฉพาะก่อนทั่วไป · ระวังคำซ้อน (พัทยา≠ยา · Thai≠ai · Holdings ≠ อสังหา)
 */
export const RULES: Array<{ el: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; kw: RegExp; note: string }> = [
  // ── ไฟ: ยา/สุขภาพ (ห้ามใช้ "ยา" เฉย — ซ้อนในคำอื่น เช่น พัทยา) + พลังงาน + ความงาม ──
  { el: "ไฟ", kw: /therapeut|bio|pharma|health|medical|vaccine|cancer|immuno|clinic|genom|oncol|โรงพยาบาล|คลินิก|เวชภัณฑ์|ชีวภาพ|การแพทย์|รักษาพยาบาล|เภสัช/i, note: "ยา/ชีวภาพ/สุขภาพ (Source6: โรงพยาบาล/ยา=ไฟ)" },
  { el: "ไฟ", kw: /energy|power|solar|battery|electric|fuel|clean|green|wind|nuclear|hydro|biogas|พลังงาน|ไฟฟ้า|ก๊าซชีวภาพ|โซลาร์|แสงอาทิตย์|ชีวมวล|ไบโอ พาวเวอร์|ปิโตรเลียม|น้ำมันเชื้อเพลิง/i, note: "พลังงาน/ไฟฟ้า (Source6: พลังงาน แสงสว่าง=ไฟ)" },
  { el: "ไฟ", kw: /cosmetic|beauty|skincare|makeup|เครื่องสำอาง|ความงาม|สกินแคร์|เสริมสวย|แฟชั่นโชว์|บันเทิง/i, note: "เครื่องสำอาง/ความงาม (Source6: ความงาม เครื่องสำอาง=ไฟ)" },
  // ── ดิน: อสังหา/ก่อสร้าง/วัสดุ (ก่อน น้ำ-การเงิน — REIT มีคำว่า ลงทุน/Invest ในคำอธิบาย) ──
  { el: "ดิน", kw: /real estate|property|land|reit|leasehold|construction|cement|infrastructure|estate|อสังหาริมทรัพย์|สิทธิการเช่า|คอนกรีต|วัสดุก่อสร้าง|ก่อสร้าง|ประตูเหล็ก|ผนัง|เหมือง|ปูน|อิฐ|รับเหมาก่อสร้าง/i, note: "อสังหา/ก่อสร้าง/วัสดุ (Source6: อสังหาริมทรัพย์=ดิน)" },
  // ── น้ำ: การเงิน/FinTech/SPAC (ก่อน เทค — fintech = การเงิน) ──
  { el: "น้ำ", kw: /acquisition|capital|financial|bank|invest|insurance|credit|fintech|wealthtech|ธนาคาร|การเงิน|เงินทุน|หลักทรัพย์|ประกัน|สินเชื่อ|ลิสซิ่ง|ไฟแนนซ์|กองทุน|โบรกเกอร์/i, note: "การเงิน/เงินทุน/SPAC/FinTech (Source6: การเงิน บัญชี สินเชื่อ=น้ำ)" },
  // ── ทอง: เทคโนโลยี/ดิจิทัล (ห้าม "ai " — ซ้อนใน Thai) ──
  { el: "ทอง", kw: /tech|software|digital|semi|chip|data|quantum|robot|artificial|cloud|cyber|comput|erp|เทคโนโลยี|ดิจิทัล|ซอฟต์แวร์|แพลตฟอร์ม|ปัญญาประดิษฐ์|อิเล็กทรอนิกส์/i, note: "เทคโนโลยี/ดิจิทัล (Source6: คอมพิวเตอร์/เทคโนโลยี=ทอง)" },
  // ── ทอง: โลหะ/เครื่องจักร/วิศวกรรม ──
  { el: "ทอง", kw: /metal|steel|copper|gold |mining|industrial|machin|pump|valve|engineering|โลหะ|เหล็ก|ทองแดง|เครื่องจักร|เครื่องสูบ|วิศวกรรม|ชิ้นส่วน|ยานยนต์/i, note: "โลหะ/เครื่องจักร/วิศวกรรม (Source6: โลหะ=ทอง)" },
  // ── ดิน: เกษตร/ปศุสัตว์/อาหารสัตว์ ──
  { el: "ดิน", kw: /agri|farm|plantation|livestock|rice|rubber|pet food|อาหารสัตว์|ปศุสัตว์|ฟาร์ม|ยาง|ข้าว|ไร่|มันสำปะหลัง/i, note: "เกษตร/ปศุสัตว์/อาหารสัตว์ (Source6: การเกษตร อาหารสัตว์=ดิน)" },
  // ── ไม้: กระดาษ/สิ่งทอ/สื่อ/ศึกษา/เฟอร์นิเจอร์/สวน/ปาล์ม (ก่อน อาหาร-น้ำ — ปาล์ม=สวน) ──
  { el: "ไม้", kw: /textile|fashion|apparel|furniture|paper|publish|media|education|school|internet|telecom|wireless|5g|packaging|กระดาษ|บรรจุภัณฑ์|กล่อง|สิ่งพิมพ์|สื่อ|การศึกษา|โรงเรียน|เสื้อผ้า|สิ่งทอ|เฟอร์นิเจอร์|ของตกแต่ง|อินเทอร์เน็ต|โทรคมนาคม|เครื่องนอน|ผ้าขนหนู|สวน|ปาล์ม|กล้วยไม้/i, note: "กระดาษ/สิ่งทอ/สื่อ/ศึกษา/เฟอร์นิเจอร์/สวนปาล์ม (Source6: กระดาษ สิ่งพิมพ์ การศึกษา เฟอร์นิเจอร์ ต้นไม้=ไม้)" },
  // ── น้ำ: ขนส่ง/อาหาร/เครื่องดื่ม/ค้าปลีก/โรงแรม ──
  { el: "น้ำ", kw: /ocean|water|marine|shipping|logistics|port|travel|tourism|hotel|restaurant|beverage|food|retail|store|เครื่องดื่ม|น้ำดื่ม|เบียร์|อาหาร|ขนส่ง|โลจิสติกส์|ท่องเที่ยว|โรงแรม|รีสอร์ท|ค้าปลีก|ซูเปอร์|มาร์เก็ต|ร้านสะดวกซื้อ/i, note: "ขนส่ง/ท่องเที่ยว/อาหาร/เครื่องดื่ม/ค้าปลีก (Source6: ขนส่ง อาหาร เครื่องดื่ม=น้ำ)" },
];

/** จำแนกธาตุจากชื่อ/ธุรกิจ/อุตสาหกรรม — คืน {element, reason} (เดา fallback = น้ำ + flag รอซินแส) */
export function classifyIpoElement(ipo: IpoRow & { business?: string; industry?: string }): { element: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; reason: string } {
  const text = `${ipo.name} ${ipo.nameEn ?? ""} ${ipo.business ?? ""} ${ipo.industry ?? ""} ${ipo.exchange ?? ""} ${ipo.market ?? ""}`;
  for (const r of RULES) {
    if (r.kw.test(text)) return { element: r.el, reason: `${r.el} — ${r.note}` };
  }
  return { element: "น้ำ", reason: "น้ำ — เดาจากตลาดทุน/การเงิน (keyword ไม่ตรง) ⚠️ รอซินแสยืนยัน" };
}

/** fit ธาตุ vs ดวง (ใช้ร่วม: dashboard/หน้า IPO) — good/avoid/drain/neutral ตามกำลังดิถี */
export function elementFitForUser(state: CalculatedStateValue, el: string): "good" | "neutral" | "avoid" | "drain" {
  const { invest, avoid } = resolveInvestElements(state);
  const band = getEngineStrengthBand(state);
  const weak = band === "weak" || band === "very-weak";
  if ((avoid as string[]).includes(el)) return "avoid";
  if ((invest as string[]).includes(el)) return "good";
  if (weak) return "drain"; // ดิถีอ่อน: ธาตุอื่น (食伤/财) = ดูดพลัง
  return "neutral";
}
