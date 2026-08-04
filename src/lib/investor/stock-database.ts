/**
 * คลังหุ้น (stock database) — โหลด + validate
 *
 * pure (อ่าน JSON แบบ static import) — client-safe
 * ข้อมูล: data/stocks/*.json (draft → reviewed → published)
 */
import thailandStocks from "@/../data/stocks/thailand.json";

export type StockEntry = {
  type: string;
  ticker: string;
  name: string;
  nameEn?: string;
  country: string;
  market: string;
  currency: string;
  sector: string;
  business: string;
  businessKeywords: string[];
  growthStage: "large" | "mid" | "small" | "startup";
  theme: string[];
  risingStar: boolean;
  listedDate: string | null;
  elements: ThaiElement[];
  primaryElement: ThaiElement;
  elementReason: string;
  elementSource: string;
  tier: string;
  isHighLiquidity: boolean;
  status: "draft" | "in_review" | "reviewed" | "published";
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes?: string;

  // ═══ ชั้น A: ข้อมูลนิ่งเพิ่มเติม (กรอกมือ — ใช้ในเล่ม/คอนเทนต์) ═══
  /** รายละเอียดธุรกิจแบบยาว (2-3 ประโยค จาก 56-1/10-K) — ใช้ในหน้าหุ้น/คอนเทนต์ */
  description?: string;
  /** ธุรกิจที่สร้างรายได้หลัก (เรียงตามสัดส่วน) — ทำให้ธาตุหลักแม่นขึ้น */
  revenueMix?: Array<{ segment: string; approxShare?: string; element?: ThaiElement }>;
  /** เว็บไซต์บริษัท / หน้า IR (อ้างอิง) */
  website?: string;
  /** ปีก่อตั้งบริษัท */
  foundedYear?: number;
  /** วันที่เข้าตลาดจริง (IPO) — YYYY-MM-DD */
  ipoDate?: string | null;
  /** หุ้นในกลุ่มเดียวกัน (peer) — ticker */
  peers?: string[];
  /** หมายเหตุซินแส (กรณีธาตุซับซ้อน/หลายธาตุ) */
  sinsiNote?: string;

  // ═══ ชั้น B: ข้อมูลตลาด (dynamic — ผ่าน API ราคา ไม่กรอกมือ) ═══
  /** ข้อมูลราคา/valuation — null จนกว่าจะต่อ API (web admin ระยะ 2) */
  marketData?: {
    price?: number;
    changePct?: number;
    pe?: number;
    pbv?: number;
    dividendYield?: number;
    marketCap?: number; // บาท
    avgVolume?: number;
    high52w?: number;
    low52w?: number;
    updatedAt?: string; // ISO timestamp
  } | null;
};

export type ThaiElement = "ไม้" | "ไฟ" | "ดิน" | "ทอง" | "น้ำ";

const THAI_ELEMENTS: ThaiElement[] = ["ไม้", "ไฟ", "ดิน", "ทอง", "น้ำ"];

/** หุ้นไทยทั้งหมด (รวมทุก status — ใช้ใน dev; ขายจริงต้องกรอง published) */
export function getThaiStocks(): StockEntry[] {
  return (thailandStocks as { stocks: StockEntry[] }).stocks;
}

/** เฉพาะหุ้นที่ผ่านตรวจแล้ว (ใช้ในเล่มที่ขาย) */
export function getPublishedThaiStocks(): StockEntry[] {
  return getThaiStocks().filter((s) => s.status === "published");
}

/** validate คลังหุ้น — คืนรายการปัญหา ([] = ผ่าน) */
export function validateStocks(stocks: StockEntry[]): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();

  for (const s of stocks) {
    if (!s.ticker) problems.push(`ticker ว่าง (${s.name ?? "?"})`);
    if (seen.has(s.ticker)) problems.push(`ticker ซ้ำ: ${s.ticker}`);
    seen.add(s.ticker);

    if (!s.business) problems.push(`${s.ticker}: ไม่มี business`);
    if (!s.elementReason) problems.push(`${s.ticker}: ไม่มี elementReason (กฎเหล็ก!)`);
    if (!THAI_ELEMENTS.includes(s.primaryElement)) problems.push(`${s.ticker}: primaryElement ไม่ใช่ธาตุไทย (${s.primaryElement})`);
    for (const e of s.elements) {
      if (!THAI_ELEMENTS.includes(e)) problems.push(`${s.ticker}: elements มีค่าผิด (${e})`);
    }
    if (!s.elements.includes(s.primaryElement)) problems.push(`${s.ticker}: primaryElement ไม่อยู่ใน elements`);
    if (!["draft", "in_review", "reviewed", "published"].includes(s.status)) {
      problems.push(`${s.ticker}: status ไม่ถูกต้อง (${s.status})`);
    }
    if (s.status === "published" && (!s.reviewedBy || !s.reviewedAt)) {
      problems.push(`${s.ticker}: published แต่ไม่มี reviewedBy/reviewedAt`);
    }

    // ชั้น A: ถ้ามี description ต้องยาวพอ (ไม่ใช่ 1 บรรทัด)
    if (s.description && s.description.length < 40) {
      problems.push(`${s.ticker}: description สั้นเกินไป (ควร 2-3 ประโยค)`);
    }
    // revenueMix: ถ้ามี element ใน segment ต้องเป็นธาตุไทย
    for (const mix of s.revenueMix ?? []) {
      if (mix.element && !THAI_ELEMENTS.includes(mix.element)) {
        problems.push(`${s.ticker}: revenueMix.element ผิด (${mix.element})`);
      }
    }
    // marketData: ถ้ามี updatedAt ต้องมี price อย่างน้อย
    if (s.marketData && s.marketData.updatedAt && s.marketData.price == null) {
      problems.push(`${s.ticker}: marketData มี updatedAt แต่ไม่มี price`);
    }
  }

  return problems;
}
