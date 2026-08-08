export const REPORT_TIERS = ["free", "99", "490", "790"] as const;

export type ReportTier = (typeof REPORT_TIERS)[number];

export type ReportTierConfig = {
  tier: ReportTier;
  displayName: string;
  priceLabel: string;
  promise: string;
  audience: string;
};

const TIER_RANK: Record<ReportTier, number> = {
  free: 0,
  "99": 1,
  "490": 2,
  "790": 3,
};

export const REPORT_TIER_CONFIGS: Record<ReportTier, ReportTierConfig> = {
  free: {
    tier: "free",
    displayName: "STARTER EDITION",
    priceLabel: "FREE",
    promise: "เข้าใจรูปแบบการตัดสินใจของตัวเอง และมีสามสิ่งที่เริ่มทำได้ทันที",
    audience: "ผู้ที่ต้องการรู้จักแนวโน้มของตัวเองก่อนเริ่มวางระบบเงิน",
  },
  "99": {
    tier: "99",
    displayName: "MONEY PLAYBOOK",
    priceLabel: "฿99",
    promise: "ได้ระบบแบ่งเงิน กรอบความเสี่ยง และแผน 90 วันที่ทำตามได้จริง",
    audience: "ผู้ที่เริ่มลงทุนหรือยังตัดสินใจตามอารมณ์และข่าวมากเกินไป",
  },
  "490": {
    tier: "490",
    displayName: "PRIVATE PLAN",
    priceLabel: "฿490",
    promise: "ได้ภาพฐานะ เป้าหมาย IPS สถานการณ์จำลอง และกรอบวิเคราะห์พอร์ตจากข้อมูลจริง",
    audience: "ผู้ที่มีเงินลงทุนหรือพอร์ตอยู่แล้ว และต้องการแผนที่ตรวจสอบย้อนกลับได้",
  },
  "790": {
    tier: "790",
    displayName: "PRIVATE CONTINUITY",
    priceLabel: "฿790",
    promise: "ได้รายงานเต็มพร้อม baseline สมุดตัดสินใจ และระบบติดตามสิ่งที่เปลี่ยนในรอบถัดไป",
    audience: "ผู้ที่ต้องการใช้รายงานเป็นระบบทบทวนต่อเนื่อง ไม่ใช่อ่านครั้งเดียวแล้วจบ",
  },
};

const PAGE_SPECS = [
  { id: "cover", minimumTier: "free", label: "ปกเฉพาะบุคคล", value: "ยืนยันเจ้าของข้อมูล รุ่น และวันที่ของรายงาน" },
  { id: "letter", minimumTier: "free", label: "จดหมายถึงเจ้าของเล่ม", value: "วางกรอบการอ่านโดยไม่ใช้ดวงแทนข้อเท็จจริง" },
  { id: "contents", minimumTier: "free", label: "แผนที่คำถาม", value: "เลือกอ่านจากคำถามและผลลัพธ์ที่ต้องการ" },
  { id: "executive", minimumTier: "free", label: "คำตอบสำคัญ", value: "เห็นข้อสรุปที่ใช้ได้ก่อนอ่านรายละเอียด" },
  { id: "confidence", minimumTier: "free", label: "ขอบเขตและความมั่นใจ", value: "รู้ว่าระบบรู้อะไร ไม่รู้อะไร และใช้ข้อมูลวันใด" },
  { id: "balance", minimumTier: "free", label: "สมดุลธาตุ", value: "เห็นหลักฐานที่ใช้ตีความพฤติกรรม" },
  { id: "persona", minimumTier: "free", label: "ภาพบุคลิกการเงิน", value: "แปลดวงเป็นรูปแบบการตัดสินใจที่สังเกตได้" },
  { id: "wealth-flow", minimumTier: "99", label: "การไหลของเงิน", value: "เห็นจุดที่โอกาสและความกลัวเข้ามาแทรก" },
  { id: "support-habit", minimumTier: "99", label: "นิสัยธาตุเสริม", value: "เปลี่ยนสัญลักษณ์ให้เป็นพฤติกรรมที่ฝึกได้" },
  { id: "decision-loop", minimumTier: "free", label: "วงจรการตัดสินใจ", value: "ตัดวงจร FOMO และการตัดสินใจที่ย้อนกลับยาก" },
  { id: "financial-snapshot", minimumTier: "490", label: "ฐานะการเงินวันนี้", value: "รู้เงินเหลือจริง เงินสำรอง หนี้ และข้อจำกัด" },
  { id: "money-buckets", minimumTier: "99", label: "สถาปัตยกรรมเงิน", value: "กำหนดหน้าที่ของเงินก่อนเลือกสินทรัพย์" },
  { id: "risk-capacity", minimumTier: "99", label: "ใจอยากเสี่ยงกับชีวิตรับได้", value: "แยก willingness ออกจาก capacity" },
  { id: "allocation", minimumTier: "490", label: "กรอบจัดสินทรัพย์", value: "ได้ allocation range และกฎปรับสมดุล" },
  { id: "goal-gap", minimumTier: "490", label: "ช่องว่างเป้าหมาย", value: "รู้เงินที่ยังขาดและเงินที่ต้องเติมต่อเดือน" },
  { id: "ips", minimumTier: "490", label: "IPS ส่วนตัว", value: "มีกติกาการลงทุนที่ใช้ซ้ำได้" },
  { id: "current-phase", minimumTier: "99", label: "จังหวะชีวิตปัจจุบัน", value: "ใช้วัฏจักรเพื่อกำหนดขนาดและจุดทบทวน" },
  { id: "life-map", minimumTier: "99", label: "แผนที่ชีวิต", value: "เห็นว่าหน้าที่ของเงินเปลี่ยนตามช่วงชีวิตอย่างไร" },
  { id: "month-plan", minimumTier: "free", label: "แผนเดือนนี้", value: "เปลี่ยนสัญญาณรายเดือนเป็นงานสี่สัปดาห์" },
  { id: "research-funnel", minimumTier: "490", label: "กรวยคัดกิจการ", value: "ไม่ใช้คำว่าถูกธาตุเป็นข้อสรุปลงทุน" },
  { id: "company-duo", minimumTier: "490", label: "กรณีศึกษาเปรียบเทียบ", value: "เห็นว่าธุรกิจคล้ายกันต้องถามคนละคำถาม" },
  { id: "company-trio", minimumTier: "790", label: "Deep research set", value: "เปรียบเทียบกลไกกำไรและความเสี่ยงเชิงลึก" },
  { id: "research-queue", minimumTier: "490", label: "คิวงานวิจัย", value: "ได้คำถามถัดไป ไม่ใช่ใบสั่งซื้อ" },
  { id: "portfolio-diagnostic", minimumTier: "490", label: "วินิจฉัยพอร์ต", value: "เห็น drift และจุดกระจุกตัวก่อนเพิ่มหุ้น" },
  { id: "scenario-lab", minimumTier: "490", label: "ห้องจำลองความเสี่ยง", value: "รู้ผลกระทบและแผนตอบสนองก่อนเหตุการณ์จริง" },
  { id: "worksheet", minimumTier: "99", label: "แบบคัดก่อนลงทุน", value: "บังคับให้หนึ่งบริษัทมีหนึ่งสมมติฐานและหนึ่งทางถอย" },
  { id: "action-plan", minimumTier: "free", label: "แผนลงมือทำ", value: "เปลี่ยนคำอ่านเป็นงาน 30/90/365 วัน" },
  { id: "decision-journal", minimumTier: "790", label: "สมุดตัดสินใจ", value: "เก็บเหตุผลก่อนผลลัพธ์เพื่อวัดคุณภาพการตัดสินใจ" },
  { id: "monthly-baseline", minimumTier: "790", label: "Baseline รายเดือน", value: "สร้างฐานเปรียบเทียบสำหรับรอบถัดไป" },
  { id: "annual-roadmap", minimumTier: "790", label: "แผนทบทวน 12 เดือน", value: "รู้ว่าแต่ละไตรมาสต้องวัดและปรับอะไร" },
  { id: "source-ledger", minimumTier: "490", label: "บัญชีหลักฐาน", value: "ตรวจที่มา วันที่ และข้อจำกัดของข้อมูล" },
  { id: "closing", minimumTier: "free", label: "วิธีใช้ต่อ", value: "จบด้วยกฎสามข้อและจุดทบทวนถัดไป" },
] as const satisfies ReadonlyArray<{
  id: string;
  minimumTier: ReportTier;
  label: string;
  value: string;
}>;

export type ReportPageId = (typeof PAGE_SPECS)[number]["id"];

export type ReportPageSpec = (typeof PAGE_SPECS)[number];

export type ReportManifest = {
  config: ReportTierConfig;
  pageIds: ReportPageId[];
  pages: ReportPageSpec[];
  pageCount: number;
  version: string;
};

export type ReportTocRow = {
  number: string;
  question: string;
  pages: string;
  description: string;
};

export function normalizeReportTier(value?: string | null): ReportTier {
  if (value && (REPORT_TIERS as readonly string[]).includes(value)) return value as ReportTier;
  return "free";
}

export function tierIncludes(tier: ReportTier, minimumTier: ReportTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimumTier];
}

export function getReportManifest(value?: string | null): ReportManifest {
  const tier = normalizeReportTier(value);
  const pages = PAGE_SPECS.filter((page) => tierIncludes(tier, page.minimumTier));
  return {
    config: REPORT_TIER_CONFIGS[tier],
    pageIds: pages.map((page) => page.id),
    pages,
    pageCount: pages.length,
    version: "editorial-v7.2",
  };
}

export function reportPageNumber(manifest: ReportManifest, pageId: ReportPageId): number | null {
  const index = manifest.pageIds.indexOf(pageId);
  return index >= 0 ? index + 1 : null;
}

export function buildReportToc(manifest: ReportManifest): ReportTocRow[] {
  const groups: Array<{
    question: string;
    description: string;
    ids: ReportPageId[];
  }> = [
    {
      question: "ฉันตัดสินใจเรื่องเงินแบบไหน",
      description: "อ่านหลักฐานจากดวง ภาพบุคลิก และวงจรที่อารมณ์มักเข้ามาแทรก",
      ids: ["confidence", "balance", "persona", "wealth-flow", "support-habit", "decision-loop"],
    },
    {
      question: "ชีวิตการเงินจริงรับความเสี่ยงได้เท่าไร",
      description: "ดูฐานะ เงินสำรอง หนี้ ความเสี่ยง และกติกาจัดเงินที่ไม่ทำให้ชีวิตเสียรูป",
      ids: ["financial-snapshot", "money-buckets", "risk-capacity", "allocation", "goal-gap", "ips"],
    },
    {
      question: "ตอนนี้ควรเดินเร็วแค่ไหน",
      description: "ใช้ช่วงชีวิตและแผนประจำเดือนเป็นจังหวะทบทวน ไม่ใช่สัญญาณทายตลาด",
      ids: ["current-phase", "life-map", "month-plan"],
    },
    {
      question: "จะศึกษาธุรกิจและพอร์ตอย่างไร",
      description: "ผ่านกรวยคัดกิจการ ตรวจพอร์ต และจำลองสิ่งที่อาจผิดก่อนเพิ่มเงิน",
      ids: ["research-funnel", "company-duo", "company-trio", "research-queue", "portfolio-diagnostic", "scenario-lab"],
    },
    {
      question: "พรุ่งนี้และรอบถัดไปต้องทำอะไร",
      description: "ใช้แบบคัด แผนลงมือ สมุดตัดสินใจ และ baseline เพื่อวัดความคืบหน้า",
      ids: ["worksheet", "action-plan", "decision-journal", "monthly-baseline", "annual-roadmap", "source-ledger"],
    },
  ];

  return groups
    .map((group) => {
      const pageNumbers = group.ids
        .map((id) => reportPageNumber(manifest, id))
        .filter((value): value is number => value != null);
      if (!pageNumbers.length) return null;
      const first = Math.min(...pageNumbers);
      const last = Math.max(...pageNumbers);
      return {
        number: "",
        question: group.question,
        pages: first === last ? `หน้า ${first}` : `หน้า ${first}-${last}`,
        description: group.description,
      };
    })
    .filter((row): row is ReportTocRow => row != null)
    .map((row, index) => ({ ...row, number: String(index + 1).padStart(2, "0") }));
}

export function reportManifestSummary(): Array<{
  tier: ReportTier;
  price: string;
  pages: number;
  addedValue: string[];
}> {
  return REPORT_TIERS.map((tier, index) => {
    const current = getReportManifest(tier);
    const previous = index > 0 ? getReportManifest(REPORT_TIERS[index - 1]) : null;
    const previousIds = new Set(previous?.pageIds ?? []);
    return {
      tier,
      price: current.config.priceLabel,
      pages: current.pageCount,
      addedValue: current.pages.filter((page) => !previousIds.has(page.id)).map((page) => page.value),
    };
  });
}
