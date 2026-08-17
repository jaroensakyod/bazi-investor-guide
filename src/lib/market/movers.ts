/**
 * Today Movers — หุ้นเด่นวันนี้ (จาก snapshot ราคาที่ fetch ไว้ — ไม่ยิง network เพิ่ม)
 *
 * ทำไมใช้ snapshot แทน TradingView scanner (ตามแผนเดิม):
 *   - snapshot = คลังเราพอดี (2,023 ตัวมีธาตุ) — scanner จะได้หุ้นนอกคลังที่ไม่มีธาตุ
 *   - ไม่เปลือง request · deterministic · เทสต์ง่าย
 *   - ข้อมูลสดพอ (fetch วันละ 1 รอบ)
 */
import { getResearchableStocks, type StockEntry, type ThaiElement } from "../investor/stock-database";
import { loadSnapshot, type MarketSnapshot } from "./market-data";
import { yahooTicker } from "./yahoo";

export type MoverRow = {
  ticker: string;
  name: string;
  market: string;
  country: string;
  price?: number;
  changePct?: number;
  element: ThaiElement;
};

export type MoversOptions = {
  /** จำกัดตลาด: "TH" | "US" | ... — ว่าง = ทั้งหมด */
  market?: string;
  limit?: number;
  direction?: "gainers" | "losers";
};

/** เรียงหุ้นในคลังตาม % เปลี่ยนวันนี้ (จาก snapshot) */
export function topMovers(snap: MarketSnapshot | null = loadSnapshot(), opts: MoversOptions = {}): MoverRow[] {
  const { market, limit = 10, direction = "gainers" } = opts;
  if (!snap) return [];
  const rows: MoverRow[] = [];
  for (const stock of getResearchableStocks()) {
    if (market && !matchMarket(stock, market)) continue;
    const q = findQuote(snap, stock);
    if (!q || typeof q.changePct !== "number" || typeof q.price !== "number") continue;
    rows.push({
      ticker: stock.ticker,
      name: stock.name,
      market: stock.market,
      country: stock.country,
      price: q.price,
      changePct: q.changePct,
      element: stock.primaryElement,
    });
  }
  rows.sort((a, b) => (direction === "gainers" ? b.changePct! - a.changePct! : a.changePct! - b.changePct!));
  return rows.slice(0, limit);
}

/** หุ้นที่ตรงธาตุวันนี้ + ติด movers — ใช้กับ daily-content/แชท "วันนี้มีหุ้นอะไรน่าสนใจ" */
export function topMoversByElement(element: ThaiElement, snap?: MarketSnapshot | null, limit = 5): MoverRow[] {
  return topMovers(snap, { limit: 100 }).filter((r) => r.element === element).slice(0, limit);
}

function matchMarket(stock: StockEntry, market: string): boolean {
  const m = market.toUpperCase();
  if (m === "TH") return stock.market === "SET" || stock.market === "mai" || stock.country === "TH";
  return stock.market.toUpperCase().includes(m) || stock.country.toUpperCase() === m;
}

function findQuote(snap: MarketSnapshot, stock: StockEntry) {
  // ใช้ yahooTicker เป็น key ตรง (กันชน "7203"@TADAWUL กับ "7203.T"@TSE — startsWith เดิมหลวมเกิน)
  const candidates = [String(stock.ticker ?? "")];
  const yt = yahooTicker(stock.ticker, stock.market);
  if (yt && !candidates.includes(yt)) candidates.push(yt);
  for (const c of candidates) {
    if (c in snap.quotes) return snap.quotes[c];
  }
  return null;
}
