/**
 * จำแนกธาตุ IPO แบบ deterministic (keyword จากชื่อ/ธุรกิจ/อุตสาหกรรม — ตามตารางซินแส Source6 §1.1.2)
 * ใช้ในหน้า /ipo + หมวด IPO ของ /personal + แชท · รองรับ EN + TH + KO
 *
 * หลักจัดลำดับ: ธรรมชาติของธุรกิจ มาก่อน ผลิตภัณฑ์/คำอธิบาย
 *   (ค้าปลีกเครื่องใช้ไฟฟ้า = ค้าปลีก(น้ำ) · สื่อ/บันเทิง = ไม้/น้ำ · REIT โรงแรม = ดิน(อสังหา))
 * ระวังคำซ้อน: พัทยา≠ยา · Thai≠ai · Holdings≠REIT · REIT≠Invest
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
  ipoDate?: string | null;
  priceRange?: string;
  currency?: string;
  status?: string;
  business?: string;
  industry?: string;
};

export const RULES: Array<{ el: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; kw: RegExp; note: string }> = [
  // 1) ไฟ: ยา/สุขภาพ
  { el: "ไฟ", kw: /therapeut|bio|pharma|health|medical|vaccine|cancer|immuno|clinic|genom|oncol|โรงพยาบาล|คลินิก|เวชภัณฑ์|ชีวภาพ|การแพทย์|รักษาพยาบาล|เภสัช|제약|바이오|의료/i, note: "ยา/ชีวภาพ/สุขภาพ (Source6: โรงพยาบาล/ยา=ไฟ)" },
  // 2) ดิน: เกษตร/ปศุสัตว์/อาหารสัตว์ (ก่อน น้ำ-อาหาร — pet food = อาหารสัตว์ = ดิน)
  { el: "ดิน", kw: /agri|farm|plantation|livestock|rice|rubber|pet food|อาหารสัตว์|ปศุสัตว์|ฟาร์ม|ยาง|ข้าว|ไร่|มันสำปะหลัง/i, note: "เกษตร/ปศุสัตว์/อาหารสัตว์ (Source6: การเกษตร อาหารสัตว์=ดิน)" },
  // 3) ดิน: อสังหา/ก่อสร้าง/วัสดุ (ก่อน น้ำ-โรงแรม — REIT โรงแรม = อสังหา)
  { el: "ดิน", kw: /real estate|property|land|reit|leasehold|construction|cement|estate|อสังหาริมทรัพย์|สิทธิการเช่า|คอนกรีต|วัสดุก่อสร้าง|ก่อสร้าง|ประตูเหล็ก|ผนัง|เหมือง|ปูน|อิฐ|รับเหมาก่อสร้าง|건설|부동산/i, note: "อสังหา/ก่อสร้าง/วัสดุ (Source6: อสังหาริมทรัพย์=ดิน)" },
  // 4) ไม้: กระดาษ/สิ่งทอ/สื่อ/ศึกษา/เฟอร์นิเจอร์/สวน/ปาล์ม (ก่อน น้ำ-อาหาร — ปาล์ม=สวน)
  { el: "ไม้", kw: /textile|fashion|apparel|furniture|paper|publish|media|education|school|internet|telecom|wireless|5g|packaging|กระดาษ|บรรจุภัณฑ์|กล่อง|สิ่งพิมพ์|สื่อ|การศึกษา|โรงเรียน|เสื้อผ้า|สิ่งทอ|เฟอร์นิเจอร์|ของตกแต่ง|อินเทอร์เน็ต|โทรคมนาคม|เครื่องนอน|ผ้าขนหนู|สวน|ปาล์ม|กล้วยไม้|의류|섬유|출판|교육/i, note: "กระดาษ/สิ่งทอ/สื่อ/ศึกษา/เฟอร์นิเจอร์/สวนปาล์ม (Source6: กระดาษ สิ่งพิมพ์ การศึกษา เฟอร์นิเจอร์ ต้นไม้=ไม้)" },
  // 5) น้ำ: ค้าปลีก/อาหาร/เครื่องดื่ม/ขนส่ง/โรงแรม/ท่องเที่ยว/บันเทิง
  { el: "น้ำ", kw: /retail|store|supermarket|wholesale|restaurant|beverage|food|hotel|travel|tourism|shipping|logistics|port|marine|ocean|water|ค้าปลีก|ซูเปอร์|มาร์เก็ต|ร้านสะดวกซื้อ|อาหาร|เครื่องดื่ม|น้ำดื่ม|เบียร์|ขนส่ง|โลจิสติกส์|ท่องเที่ยว|โรงแรม|รีสอร์ท|บันเทิง|식품|음료|유통|물류/i, note: "ค้าปลีก/อาหาร/ขนส่ง/โรงแรม/บันเทิง (Source6: ค้าปลีก อาหาร เครื่องดื่ม ขนส่ง โรงแรม บันเทิง=น้ำ)" },
  // 6) ไฟ: พลังงาน/ไฟฟ้า
  { el: "ไฟ", kw: /energy|power|solar|battery|electric|fuel|clean|green|wind|nuclear|hydro|biogas|พลังงาน|ไฟฟ้า|ก๊าซชีวภาพ|โซลาร์|แสงอาทิตย์|ชีวมวล|ไบโอ พาวเวอร์|ปิโตรเลียม|น้ำมันเชื้อเพลิง|에너지|전력/i, note: "พลังงาน/ไฟฟ้า (Source6: พลังงาน แสงสว่าง=ไฟ)" },
  // 7) ไฟ: เครื่องสำอาง/ความงาม
  { el: "ไฟ", kw: /cosmetic|beauty|skincare|makeup|เครื่องสำอาง|ความงาม|สกินแคร์|เสริมสวย|화장품|뷰티/i, note: "เครื่องสำอาง/ความงาม (Source6: ความงาม เครื่องสำอาง=ไฟ)" },
  // 8) น้ำ: การเงิน/FinTech/SPAC
  { el: "น้ำ", kw: /acquisition|capital|financial|bank|invest|insurance|credit|fintech|wealthtech|ธนาคาร|การเงิน|เงินทุน|หลักทรัพย์|ประกัน|สินเชื่อ|ลิสซิ่ง|ไฟแนนซ์|กองทุน|โบรกเกอร์|금융|은행|보험/i, note: "การเงิน/เงินทุน/SPAC/FinTech (Source6: การเงิน บัญชี สินเชื่อ=น้ำ)" },
  // 9) ทอง: เทคโนโลยี/ดิจิทัล (ห้าม "ai " — ซ้อนใน Thai)
  { el: "ทอง", kw: /tech|software|digital|semi|chip|data|quantum|robot|artificial|cloud|cyber|comput|erp|เทคโนโลยี|ดิจิทัล|ซอฟต์แวร์|แพลตฟอร์ม|ปัญญาประดิษฐ์|อิเล็กทรอนิกส์|반도체|소프트웨어|로봇/i, note: "เทคโนโลยี/ดิจิทัล (Source6: คอมพิวเตอร์/เทคโนโลยี=ทอง)" },
  // 10) ทอง: โลหะ/เครื่องจักร/วิศวกรรม
  { el: "ทอง", kw: /metal|steel|copper|gold |mining|industrial|machin|pump|valve|engineering|โลหะ|เหล็ก|ทองแดง|เครื่องจักร|เครื่องสูบ|วิศวกรรม|ชิ้นส่วน|ยานยนต์/i, note: "โลหะ/เครื่องจักร/วิศวกรรม (Source6: โลหะ=ทอง)" },
];

/** จำแนกธาตุจากชื่อ/ธุรกิจ/อุตสาหกรรม — คืน {element, reason} (เดา fallback = น้ำ + flag รอซินแส) */
export function classifyIpoElement(ipo: IpoRow): { element: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; reason: string } {
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
