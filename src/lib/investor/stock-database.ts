/**
 * คลังหุ้น (stock database) — โหลด + validate
 *
 * pure (อ่าน JSON แบบ static import) — client-safe
 * ข้อมูล: data/stocks/*.json (draft → reviewed → published)
 */
import thailandStocks from "@/../data/stocks/thailand.json";
import globalStocks from "@/../data/stocks/global.json";

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

  // ═══ ★ หลักฐานธุรกิจ (ให้ซินแสตรวจได้ว่า "ประกอบกิจการนี้จริงไหม") ═══
  /** แหล่งที่มาของข้อมูลธุรกิจ — ต้องระบุให้ตรวจย้อนกลับได้ */
  businessEvidence?: {
    /** แหล่ง: เช่น "56-1 ปี 2567", "10-K 2024", "เว็บ IR", "รายงานประจำปี" */
    source: string;
    /** ลิงก์อ้างอิง (ถ้ามี) */
    url?: string;
    /** คำพูด/ข้อความจากแหล่ง (evidence ตรง ๆ ที่ซินแสเทียบได้) */
    quote?: string;
  };

  // ═══ ★ ประวัติการตรวจของซินแส (review trail — กันแก้ย้อนหลัง/ดูว่าใครยืนยัน) ═══
  /** แต่ละรายการ = 1 รอบการตรวจ (draft → reviewed ครั้งแรก หรือแก้หลัง reviewed) */
  reviewHistory?: Array<{
    reviewedBy: string;
    reviewedAt: string; // ISO
    /** verdict ของรอบนี้ */
    action: "approved" | "changed";
    /** ธาตุก่อนตรวจ (ถ้าแก้) */
    beforeElements?: ThaiElement[];
    beforePrimary?: ThaiElement;
    /** ธาตุหลังตรวจ */
    afterElements: ThaiElement[];
    afterPrimary: ThaiElement;
    /** ความเห็นซินแส (เช่น "ธุรกิจหลักคือ X ไม่ใช่ Y → แก้ธาตุ") */
    note?: string;
  }>;

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

/** หุ้นโลกทั้งหมด (8 ตลาด — จีน/เวียดนาม/ญี่ปุ่น/US/แคนาดา/ออส/เกาหลี/อินเดีย) */
export function getGlobalStocks(): StockEntry[] {
  return (globalStocks as { stocks: StockEntry[] }).stocks;
}

/** หุ้นทั้งหมด (ไทย + โลก) */
export function getAllStocks(): StockEntry[] {
  return [...getThaiStocks(), ...getGlobalStocks()];
}

/** ข้อมูลตลาด (ประเทศ→ทิศ→ธาตุ) — ใช้เฉพาะภาพรวมประเทศ (บท 8) ไม่ใช่ verdict รายหุ้น */
export function getMarketMeta(): Record<string, { country: string; direction: string; marketElement: ThaiElement; note: string }> {
  return (globalStocks as { meta: { markets: Record<string, { country: string; direction: string; marketElement: ThaiElement; note: string }> } }).meta.markets;
}

// ───────── ★ Review Workflow: export checklist ให้ซินแสตรวจ + import ผลกลับ ─────────

/**
 * สร้างแถว checklist สำหรับซินแสตรวจ (1 แถว/หุ้น)
 * คอลัมน์: ticker | ชื่อ | ธุรกิจ (สั้น) | description (ยาว) | revenueMix | ธาตุปัจจุบัน | ถูกต้อง? | ธาตุที่แก้ | หมายเหตุ
 * — ซินแสกรอกเฉพาะ 3 คอลัมน์สุดท้าย
 */
export function buildReviewChecklist(stocks: StockEntry[]): Array<{
  ticker: string;
  name: string;
  business: string;
  description: string;
  revenueMix: string;
  currentElements: string;
  currentPrimary: string;
  elementSource: string;
  businessEvidenceSource: string;
  isCorrect: ""; // ซินแสกรอก: "Y" / "N"
  correctedElements: ""; // ถ้า N: ธาตุใหม่ (เช่น "น้ำ,ดิน")
  note: ""; // หมายเหตุ/ความเห็นซินแส
}> {
  return stocks.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    business: s.business,
    description: s.description ?? "",
    revenueMix: (s.revenueMix ?? []).map((m) => `${m.segment}${m.approxShare ? ` (${m.approxShare})` : ""}`).join(" | "),
    currentElements: s.elements.join(","),
    currentPrimary: s.primaryElement,
    elementSource: s.elementSource,
    businessEvidenceSource: s.businessEvidence?.source ?? "",
    isCorrect: "",
    correctedElements: "",
    note: "",
  }));
}

/** แปลง checklist → CSV (เปิดใน Excel ให้ซินแสกรอกได้) */
export function reviewChecklistToCsv(rows: ReturnType<typeof buildReviewChecklist>): string {
  const header = ["ticker", "name", "business", "description", "revenueMix", "currentElements", "currentPrimary", "elementSource", "businessEvidenceSource", "isCorrect", "correctedElements", "note"];
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push([r.ticker, r.name, r.business, r.description, r.revenueMix, r.currentElements, r.currentPrimary, r.elementSource, r.businessEvidenceSource, r.isCorrect, r.correctedElements, r.note].map(escape).join(","));
  }
  return lines.join("\n");
}

export type ReviewResult = {
  ticker: string;
  /** Y = ธาตุถูกต้องแล้ว, N = ต้องแก้ */
  isCorrect: "Y" | "N";
  /** ถ้า N: ธาตุใหม่ (เช่น "น้ำ,ดิน") */
  correctedElements?: string;
  correctedPrimary?: string;
  note?: string;
};

/**
 * ใช้ผลตรวจของซินแส → อัปเดตหุ้น (elements/primaryElement/status/reviewHistory)
 * @returns รายการที่อัปเดต + ปัญหา
 */
export function applyReviewResults(
  stocks: StockEntry[],
  results: ReviewResult[],
  reviewerName: string,
): { updated: string[]; problems: string[] } {
  const updated: string[] = [];
  const problems: string[] = [];
  const now = new Date().toISOString();

  for (const r of results) {
    const stock = stocks.find((s) => s.ticker === r.ticker);
    if (!stock) {
      problems.push(`ไม่พบ ticker: ${r.ticker}`);
      continue;
    }

    const beforeElements = [...stock.elements];
    const beforePrimary = stock.primaryElement;

    if (r.isCorrect === "Y") {
      // ยืนยันธาตุเดิม
      stock.reviewHistory = [
        ...(stock.reviewHistory ?? []),
        {
          reviewedBy: reviewerName,
          reviewedAt: now,
          action: "approved",
          afterElements: beforeElements,
          afterPrimary: beforePrimary,
          note: r.note,
        },
      ];
      updated.push(`${r.ticker} (approved)`);
    } else {
      // แก้ธาตุตามซินแส
      const corrected = (r.correctedElements ?? "")
        .split(",")
        .map((e) => e.trim() as ThaiElement)
        .filter((e) => THAI_ELEMENTS.includes(e));
      const primary = (r.correctedPrimary ?? corrected[0]) as ThaiElement;

      if (corrected.length === 0) {
        problems.push(`${r.ticker}: isCorrect=N แต่ correctedElements ว่าง/ไม่ใช่ธาตุไทย`);
        continue;
      }

      stock.elements = corrected;
      stock.primaryElement = THAI_ELEMENTS.includes(primary) ? primary : corrected[0];
      stock.sinsiNote = r.note ?? stock.sinsiNote;
      stock.reviewHistory = [
        ...(stock.reviewHistory ?? []),
        {
          reviewedBy: reviewerName,
          reviewedAt: now,
          action: "changed",
          beforeElements,
          beforePrimary,
          afterElements: corrected,
          afterPrimary: stock.primaryElement,
          note: r.note,
        },
      ];
      updated.push(`${r.ticker} (changed: ${beforePrimary} → ${stock.primaryElement})`);
    }

    // ตั้งค่า review meta + status (เฉพาะถ้ายังไม่ published — published ต้องผ่าน gate อื่น)
    stock.reviewedBy = reviewerName;
    stock.reviewedAt = now;
    if (stock.status === "draft" || stock.status === "in_review") {
      stock.status = "reviewed";
    }
  }

  return { updated, problems };
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
