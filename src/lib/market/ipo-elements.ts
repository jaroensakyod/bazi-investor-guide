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
  market?: string;
  country?: string;
  exchange?: string;
  ipoDate?: string;
  priceRange?: string;
  currency?: string;
  status?: string;
};

/** keyword → ธาตุ (ตรวจลำดับ: เฉพาะก่อนทั่วไป) — อ้าง Source6 */
const RULES: Array<{ el: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; kw: RegExp; note: string }> = [
  // ไฟ: ยา/สุขภาพ (โรงพยาบาล เภสัช = ไฟ) + พลังงาน (พลังงาน แสงสว่าง = ไฟ)
  { el: "ไฟ", kw: /therapeut|bio|pharma|health|medical|vaccine|cancer|immuno|clinic|genom|oncol/i, note: "ยา/ชีวภาพ/สุขภาพ (Source6: โรงพยาบาล/ยา=ไฟ)" },
  { el: "ไฟ", kw: /energy|power|solar|battery|electric|fuel|clean|green|wind|nuclear|hydro/i, note: "พลังงาน/ไฟฟ้า (Source6: พลังงาน แสงสว่าง=ไฟ)" },
  // ทอง: เทคโนโลยี/ชิป (เครื่องจักร/เทคโนโลยี = ทอง) + โลหะ
  { el: "ทอง", kw: /tech|software|digital|semi|chip|data|quantum|robot|ai |cloud|cyber|comput/i, note: "เทคโนโลยี/ชิป (Source6: คอมพิวเตอร์/เทคโนโลยี=ทอง)" },
  { el: "ทอง", kw: /metal|steel|copper|gold |mining|industrial|machin/i, note: "โลหะ/เครื่องจักร (Source6: โลหะ=ทอง)" },
  // ดิน: อสังหา/ก่อสร้าง/เกษตร
  { el: "ดิน", kw: /real estate|property|land|reit|construction|cement|infrastructure|estate/i, note: "อสังหา/ก่อสร้าง (Source6: อสังหาริมทรัพย์=ดิน)" },
  { el: "ดิน", kw: /agri|farm|plantation|livestock|rice|rubber/i, note: "เกษตร/ปศุสัตว์ (Source6: การเกษตร=ดิน)" },
  // น้ำ: การเงิน/ขนส่ง/อาหาร/ค้าปลีก/น้ำ/SPAC
  { el: "น้ำ", kw: /acquisition|holdings|capital|financial|bank|invest|insurance|credit|fintech|spac/i, note: "การเงิน/เงินทุน/SPAC (Source6: การเงิน บัญชี สินเชื่อ=น้ำ)" },
  { el: "น้ำ", kw: /ocean|water|marine|shipping|logistics|port|travel|tourism|hotel|restaurant|beverage|food|retail|store/i, note: "ขนส่ง/ท่องเที่ยว/อาหาร/ค้าปลีก (Source6: ขนส่ง อาหาร เครื่องดื่ม=น้ำ)" },
  // ไม้: สิ่งทอ/สื่อ/การศึกษา/อินเทอร์เน็ต
  { el: "ไม้", kw: /textile|fashion|apparel|furniture|paper|publish|media|education|school|internet|telecom|wireless|5g/i, note: "สิ่งทอ/สื่อ/ศึกษา/อินเทอร์เน็ต (Source6: กระดาษ สิ่งพิมพ์ การศึกษา อินเทอร์เน็ต=ไม้)" },
];

/** จำแนกธาตุจากชื่อบริษัท — คืน {element, reason} (เดา fallback = น้ำ + flag รอซินแส) */
export function classifyIpoElement(ipo: IpoRow): { element: "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ"; reason: string } {
  const text = `${ipo.name} ${ipo.name ?? ""} ${ipo.exchange ?? ""} ${ipo.market ?? ""}`;
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
