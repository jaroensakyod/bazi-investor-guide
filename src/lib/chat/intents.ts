/**
 * Intent Router — เข้าใจคำถามผู้ใช้ (rule-based ก่อน — ถูก เทสต์ได้ + LLM fallback ทีหลัง)
 *
 * 7 intents:
 *   today_movers (หุ้นวันนี้) · upcoming_ipo (IPO) · stock_verdict (หุ้น+ดวง)
 *   stock_analysis (พื้นฐาน) · news_impact (ข่าว/เหตุการณ์) · report (รายงาน) · smalltalk
 *
 * หลัก "ไม่เดา": ดึง ticker จากคลังจริง (ไม่ใช่ regex ลอยๆ) · คืน confidence
 * เพื่อให้แชทตัดสินใจได้ (confidence ต่ำ → ถามยืนยันก่อน)
 */
import { getAllStocks } from "../investor/stock-database";

export type Intent =
  | "today_movers"
  | "upcoming_ipo"
  | "stock_verdict"
  | "stock_analysis"
  | "news_impact"
  | "report"
  | "daily_fortune"
  | "fortune_invest"
  | "assets"
  | "advice_request"
  | "smalltalk";

export type IntentResult = {
  intent: Intent;
  /** ticker ที่ผู้ใช้พูดถึง (เช่น KBANK / 0700.HK) — ไม่มี = undefined */
  ticker?: string;
  /** ตลาดที่กรอง (TH/US/JP...) — ผู้ใช้ระบุ เช่น "หุ้นไทยวันนี้" */
  market?: string;
  confidence: number; // 0-1
  matched: string[]; // keyword ที่เจอ (debug/เทสต์)
};

// ── keyword ไทย/อังกฤษ (ค่อยๆ เพิ่มจากบทสนทนาจริง — review ได้) ──
const KW: Record<Exclude<Intent, "smalltalk">, string[]> = {
  today_movers: ["หุ้นวันนี้", "วันนี้มีหุ้น", "ตัวไหนน่าสนใจ", "ตัวไหนเด่น", "ขึ้นแรง", "ลงแรง", "มูฟเวอร์", "เคลื่อนไหว", "gainers", "losers", "หุ้นเด่น", "น่าจับตา"],
  upcoming_ipo: ["ipo", "ไอพีโอ", "เข้าตลาด", "เข้าจดทะเบียน", "หุ้นใหม่", "แรกเข้า", "จะเข้าเทรด", "ขึ้นทะเบียนใหม่"],
  stock_verdict: ["กับดวง", "ดวงเรา", "ดวงของเรา", "ธาตุ", "คู่ดวง", "เหมาะกับเราไหม", "เหมาะไหม", "ซินแส", "ถูกโฉลก", "ถูกธาตุ", "ดูดวง"],
  stock_analysis: ["วิเคราะห์", "พื้นฐาน", "กำไร", "รายได้", "งบ", "pe", "p/e", "ราคาเป้า", "เป้าหมาย", "buffett", "บัฟเฟตต์", "คุณภาพ", "หนี้", "roa", "roe"],
  news_impact: ["ข่าว", "ทรัมป์", "ภาษี", "เฟด", "fomc", "ขึ้นดอกเบี้ย", "ลดดอกเบี้ย", "ผลกระทบ", "กระทบ", "เหตุการณ์", "น้ำมันขึ้น", "ทองขึ้น", "สงคราม", "เลือกตั้ง", "เงินเฟ้อ"],
  report: ["รายงาน", "สรุปให้", "สรุปหุ้น", "วอร์เรน", "รายงานสถาบัน", "pdf", "เล่ม"],
  daily_fortune: ["วันนี้ดวง", "ดวงวันนี้", "ฤกษ์", "ยาม", "สีมงคล", "สีถูกโฉลก", "วันนี้เหมาะ", "วันนี้ควร", "วันนี้เลี่ยง", "ทิศมงคล", "ทิศอสูร", "ขึ้นแรม", "วันพระ", "วันธงชัย"],
  fortune_invest: ["ดวงกับหุ้น", "หุ้นกับดวง", "เดือนนี้ลงทุน", "เดือนนี้ซื้อ", "สัปดาห์นี้ลงทุน", "สัปดาห์นี้ซื้อ", "เดือนนี้", "สัปดาห์นี้", "ipo ตัวไหน", "ipo ที่เหมาะ", "ซื้อที่ดิน", "ซื้อหุ้นวันไหน", "ซื้อวันไหน", "วันไหนดี", "ฤกษ์ซื้อ", "ธาตุวันนี้", "วันนี้ธาตุ"],
  assets: ["ทองคำ", "ทอง", "เงิน", "btc", "bitcoin", "คริปโต", "ethereum", "eth", "น้ำมัน", "ก๊าซธรรมชาติ", "ที่ดิน", "อสังหา", "คอนโด", "สวนยาง", "ปาล์ม", "ผลไม้", "สลาก", "พระเครื่อง", "กองทุน", "พันธบัตร", "หุ้นกู้", "เงินฝาก", "สินทรัพย์", "จัดสรร", "พอร์ต", "reit", "ประกัน", "ฟาร์ม", "เพชร", "นาฬิกา", "งานศิลปะ"],
  advice_request: ["แนะนำ", "แนะนำหน่อย", "ควรซื้อ", "ซื้อเลย", "ซื้อตัวไหน", "ซื้อหุ้นตัวไหน", "ควรลงทุน", "ซื้อไหม", "ขายไหม", "ซื้อดีไหม", "ซื้อหรือไม่", "ช่วยตัดสินใจ"],
};

const GREETING = ["สวัสดี", "hello", "hi", "ทักทาย", "มีไร", "มีอะไร", "ขอบคุณ", "bye", "ลาก่อน", "ช่วยหน่อย"];

// ตลาดไทย (ชื่อประเทศ/ตลาด → รหัส)
const MARKET_WORDS: Array<[string, string]> = [
  ["ไทย", "TH"], ["บ้านเรา", "TH"], ["set", "TH"], ["ตลาดไทย", "TH"],
  ["อเมริกา", "US"], ["อเมริกัน", "US"], ["สหรัฐ", "US"], ["usa", "US"], ["อเมริกา", "US"],
  ["ญี่ปุ่น", "JP"], ["จีน", "CN"], ["ฮ่องกง", "HK"], ["เวียดนาม", "VN"], ["เกาหลี", "KR"],
  ["ไต้หวัน", "TW"], ["สิงคโปร์", "SG"], ["อินโดนีเซีย", "ID"], ["มาเลเซีย", "MY"], ["ฟิลิปปินส์", "PH"],
  ["ยุโรป", "EU"], ["อังกฤษ", "GB"], ["เยอรมนี", "DE"], ["ฝรั่งเศส", "FR"],
];

// ── คลัง ticker/ชื่อ ไทย+อังกฤษ (โหลดครั้งเดียว) ──
let lookup: { byTicker: Map<string, string>; byName: Map<string, string> } | null = null;
function buildLookup() {
  if (lookup) return lookup;
  const byTicker = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const s of getAllStocks()) {
    byTicker.set(String(s.ticker).toUpperCase(), String(s.ticker));
    const n = String(s.name ?? "").toLowerCase();
    if (n) byName.set(n, String(s.ticker));
    const ne = String(s.nameEn ?? "").toLowerCase();
    if (ne && ne !== n) byName.set(ne, String(s.ticker));
  }
  lookup = { byTicker, byName };
  return lookup;
}

// ── ชื่อย่อไทยที่คนใช้จริง (ยาว→สั้น เรียงให้ match ก่อน) — เพิ่มได้เรื่อยๆ เหมือน dictionary ──
const TH_ALIASES: Array<[string, string]> = [
  ["ปตท.สำรวจ", "PTTEP"], ["ปตท.สผ", "PTTEP"], ["ปตท.", "PTT"], ["ปตท", "PTT"],
  ["เอไอเอส", "ADVANC"], ["อินทัช", "INTUCH"], ["ดีแทค", "DTAC"], ["ทรู", "TRUE"],
  ["กสิกรไทย", "KBANK"], ["ธนาคารกรุงเทพ", "BBL"], ["กรุงไทย", "KTB"], ["ไทยพาณิชย์", "SCB"],
  ["กรุงศรี", "BAY"], ["ทหารไทย", "TTB"], ["เกียรตินาคินภัทร", "KKP"], ["เกียรตินาคิน", "KKP"],
  ["เจริญโภคภัณฑ์", "CPF"], ["ซีพีออลล์", "CPALL"], ["เซ็นทรัลรีเทล", "CRC"], ["เซ็นทรัล", "CENTEL"],
  ["ไมเนอร์", "MINT"], ["ไทยยูเนี่ยน", "TU"], ["บ้านปู", "BANPU"], ["บี.กริม", "BGRIM"],
  ["โกลบอลเพาเวอร์", "GPSC"], ["คาราบาว", "CBG"], ["โอสถสภา", "OSP"], ["อิชิตัน", "ITC"],
  ["โตอา", "TOA"], ["อสมท", "MCOT"], ["โรงพยาบาลบำรุงราษฎร์", "BH"],
];
TH_ALIASES.sort((a, b) => b[0].length - a[0].length);

/** หา ticker จากคำถาม — ตรง ticker (KBANK/AAPL/0700.HK) · ชื่อเต็ม · ชื่อย่อไทย */
function findTicker(text: string): string | undefined {
  const { byTicker, byName } = buildLookup();
  const upper = text.toUpperCase();
  // 1) ticker ตรง (รวม suffix: KBANK / 0700.HK / 7203.T)
  for (const m of upper.matchAll(/\b([A-Z][A-Z0-9]{0,5}(?:\.[A-Z]{1,3})?)\b/g)) {
    const hit = byTicker.get(m[1]);
    if (hit) return hit;
  }
  // 2) ชื่อไทย/อังกฤษเต็ม (ยาวสุดก่อน — กัน "แบงก์" ชน "ธนาคารกรุงเทพ")
  const lower = text.toLowerCase();
  const hits: Array<[string, string]> = [];
  for (const [name, ticker] of byName) {
    if (lower.includes(name)) hits.push([name, ticker]);
  }
  if (hits.length === 0) {
    // 3) ชื่อย่อไทย (กสิกรไทย → KBANK)
    for (const [alias, ticker] of TH_ALIASES) {
      if (lower.includes(alias)) return ticker;
    }
    return undefined;
  }
  hits.sort((a, b) => b[0].length - a[0].length);
  return hits[0][1];
}

function findMarket(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [word, code] of MARKET_WORDS) {
    if (lower.includes(word)) return code;
  }
  return undefined;
}

/** detect intent จากข้อความ (rule-based) */
export function detectIntent(text: string): IntentResult {
  const lower = text.toLowerCase();
  const ticker = findTicker(text);
  const market = findMarket(text);
  const matched: string[] = [];

  const hit = (kws: string[]) => {
    const found = kws.filter((k) => lower.includes(k.toLowerCase()));
    matched.push(...found);
    return found.length;
  };

  // ลำดับ: advice_request (compliance ก่อนสุด!) → verdict → fortune_invest (เจาะจงกว่า daily) → daily_fortune → analysis → news → ipo → movers → report
  if (hit(KW.advice_request) > 0) {
    return { intent: "advice_request", ticker, market, confidence: 0.9, matched };
  }
  if (hit(KW.stock_verdict) > 0 && ticker) {
    return { intent: "stock_verdict", ticker, market, confidence: 0.95, matched };
  }
  if (hit(KW.fortune_invest) > 0) {
    return { intent: "fortune_invest", ticker, market, confidence: 0.85, matched };
  }
  if (hit(KW.news_impact) > 0) {
    return { intent: "news_impact", market, confidence: 0.85, matched };
  }
  if (hit(KW.assets) > 0) {
    return { intent: "assets", ticker, market, confidence: 0.8, matched };
  }
  if (hit(KW.daily_fortune) > 0) {
    return { intent: "daily_fortune", market, confidence: 0.9, matched };
  }
  if (ticker) {
    hit(KW.stock_analysis);
    return { intent: "stock_analysis", ticker, market, confidence: 0.9, matched };
  }
  if (hit(KW.upcoming_ipo) > 0) {
    return { intent: "upcoming_ipo", market, confidence: 0.9, matched };
  }
  if (hit(KW.today_movers) > 0) {
    return { intent: "today_movers", market, confidence: 0.85, matched };
  }
  if (hit(KW.report) > 0) {
    return { intent: "report", market, confidence: 0.8, matched };
  }
  if (GREETING.some((g) => lower.includes(g))) {
    matched.push("ทักทาย");
    return { intent: "smalltalk", market, confidence: 0.9, matched };
  }
  return { intent: "smalltalk", market, confidence: 0.3, matched }; // ไม่รู้จัก → ถามให้ชัด
}
