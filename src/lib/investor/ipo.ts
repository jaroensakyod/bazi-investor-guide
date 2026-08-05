/**
 * IPO pipeline — หุ้น IPO กำลังจะเข้าเทรด
 *
 * แหล่งปัจจุบัน: StockAnalysis IPO calendar (https://stockanalysis.com/ipos/calendar/)
 *   — curl ได้ (free ไม่มี key) มี Date/Symbol/Company/Exchange/Price range — ครอบ US (NASDAQ/NYSE)
 *   — ไม่มี sector → primaryElement = null (รอ map ตอน enrich — ไม่เดา)
 *
 * หมายเหตุ: TradingView scanner ฟิลด์ ipo_date = dead ใน free tier (คืน null เสมอ — 2026-08-05)
 *   → เอเชีย (TW/JP/KR/...) ต้องใช้ Investing.com IPO calendar ผ่าน browser (TODO — pattern enrich-vn30)
 */
import type { ThaiElement } from "./stock-database";
export { sectorToElement } from "../market/sector-elements";

export type IpoEntry = {
  /** ticker (เช่น ATTO / 2330) */
  ticker: string;
  name: string;
  nameEn?: string;
  /** ตลาดในคลังเรา (NYSE/NASDAQ/TWSE/SGX/...) */
  market: string;
  country: string;
  exchange: string;
  ipoDate: string; // YYYY-MM-DD
  sector?: string;
  business?: string;
  primaryElement?: ThaiElement | null;
  priceRange?: string;
  currency?: string;
  source: string;
  status: "upcoming" | "listed";
  fetchedAt: string; // ISO
};

const SA_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Aug 5, 2026" → "2026-08-05" (คืน "" ถ้า parse ไม่ได้) */
export function parseSaDate(s: string): string {
  const m = s.trim().match(/^(\w{3})\s+(\d{1,2}),\s+(\d{4})$/);
  if (!m) return "";
  const mon = MONTHS.indexOf(m[1].toLowerCase());
  if (mon < 0) return "";
  return `${m[3]}-${String(mon + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

/** ดึง IPO กำลังจะเข้าเทรดจาก StockAnalysis calendar (US) */
export async function fetchIposFromStockAnalysis(): Promise<IpoEntry[]> {
  const res = await fetch("https://stockanalysis.com/ipos/calendar/", {
    headers: { "User-Agent": SA_UA },
  });
  if (!res.ok) throw new Error(`StockAnalysis → HTTP ${res.status}`);
  const html = await res.text();

  const out: IpoEntry[] = [];
  const rowRe = /<tr[^>]*>(.*?)<\/tr>/gs;
  const tdRe = /<t[dh][^>]*>(.*?)<\/t[dh]>/gs;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html)) !== null) {
    const cells: string[] = [];
    let td: RegExpExecArray | null;
    const tdRe2 = new RegExp(tdRe.source, tdRe.flags);
    while ((td = tdRe2.exec(rowMatch[1])) !== null) {
      cells.push(td[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim());
    }
    // ข้าม header (มี th) — แถวข้อมูลต้องมีอย่างน้อย 7 เซลล์ + symbol สั้นๆ + date parse ได้
    if (cells.length < 7 || rowMatch[1].includes("<th")) continue;
    const [dateStr, symbol, company, exchange, priceRange] = cells;
    const ipoDate = parseSaDate(dateStr);
    if (!ipoDate || !symbol || !/^[A-Z0-9.\-]{1,6}$/.test(symbol)) continue;
    const mkt = exchange === "NASDAQ" || exchange === "NYSE" ? "NYSE/NASDAQ" : exchange;
    out.push({
      ticker: symbol,
      name: company,
      nameEn: company,
      market: mkt,
      country: exchange === "NASDAQ" || exchange === "NYSE" ? "US" : exchange,
      exchange,
      ipoDate,
      priceRange: priceRange || undefined,
      currency: priceRange?.includes("$") ? "USD" : undefined,
      source: "StockAnalysis IPO calendar",
      status: "upcoming",
      fetchedAt: new Date().toISOString(),
    });
  }
  return out;
}

/** merge เข้า data/ipo.json — dedupe ด้วย ticker+exchange (ตัวใหม่ชนะ) */
export function mergeIpos(existing: IpoEntry[], incoming: IpoEntry[]): { entries: IpoEntry[]; added: number; updated: number } {
  const map = new Map<string, IpoEntry>();
  for (const e of existing) map.set(`${e.exchange}:${e.ticker}`, e);
  let added = 0;
  let updated = 0;
  for (const e of incoming) {
    const key = `${e.exchange}:${e.ticker}`;
    if (map.has(key)) updated++;
    else added++;
    map.set(key, e);
  }
  return { entries: [...map.values()], added, updated };
}

/** ตัวที่ยังไม่เข้าเทรด (จากวันที่กำหนด) — เรียงวันใกล้สุดก่อน */
export function upcomingIpos(entries: IpoEntry[], fromDate = new Date().toISOString().slice(0, 10)): IpoEntry[] {
  return entries
    .filter((e) => e.status === "upcoming" && e.ipoDate && e.ipoDate >= fromDate)
    .sort((a, b) => a.ipoDate.localeCompare(b.ipoDate));
}

/** ตัวที่เข้าเทรดไปแล้ว (วันที่ผ่าน) → status listed (กันรก) */
export function markListed(entries: IpoEntry[], today = new Date().toISOString().slice(0, 10)): IpoEntry[] {
  return entries.map((e) => (e.status === "upcoming" && e.ipoDate && e.ipoDate < today ? { ...e, status: "listed" as const } : e));
}
