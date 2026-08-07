/**
 * EXPAND ทุกตลาดที่มีอยู่ (user: ประเทศที่มีอยู่ก็ต้องเพิ่ม — ตลาดใหญ่กว่าไทย)
 * US 600/500 · CA 300 · AU 250 · KR 200 · HK 300 · VN 200 · CN 500 · MY 120 · PH 100
 * PK 100 · SA 100 · BR 150 · MX 100 · TR 100 · UK 200 · DE 200 · FR 150 · CH 100  (+~1,300 → ~5,100)
 *
 * แหล่ง: TradingView scanner (top by market cap) — pattern เดียวกับ expand-asia-universe
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts (อีกครั้ง) แล้ว npx tsx scripts/fetch-market-data.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/global.json");

type M = { tv: string; exchange: string | null; country: string; market: string; currency: string; limit: number; name: string };
const MARKETS: M[] = [
  { tv: "america", exchange: "NYSE", country: "US", market: "NYSE/NASDAQ", currency: "USD", limit: 600, name: "สหรัฐ NYSE" },
  { tv: "america", exchange: "NASDAQ", country: "US", market: "NYSE/NASDAQ", currency: "USD", limit: 520, name: "สหรัฐ NASDAQ" },
  { tv: "canada", exchange: "TSX", country: "CA", market: "TSX", currency: "CAD", limit: 300, name: "แคนาดา" },
  { tv: "australia", exchange: "ASX", country: "AU", market: "ASX", currency: "AUD", limit: 250, name: "ออสเตรเลีย" },
  { tv: "korea", exchange: "KRX", country: "KR", market: "KRX", currency: "KRW", limit: 200, name: "เกาหลี" },
  { tv: "hongkong", exchange: "HKEX", country: "HK", market: "HKEX", currency: "HKD", limit: 300, name: "ฮ่องกง" },
  { tv: "vietnam", exchange: "HOSE", country: "VN", market: "HOSE", currency: "VND", limit: 200, name: "เวียดนาม" },
  { tv: "china", exchange: "SSE", country: "CN", market: "SSE", currency: "CNY", limit: 300, name: "จีน SSE" },
  { tv: "china", exchange: "SZSE", country: "CN", market: "SZSE", currency: "CNY", limit: 300, name: "จีน SZSE" },
  { tv: "malaysia", exchange: "MYX", country: "MY", market: "BURSA", currency: "MYR", limit: 120, name: "มาเลเซีย" },
  { tv: "philippines", exchange: "PSE", country: "PH", market: "PSE", currency: "PHP", limit: 100, name: "ฟิลิปปินส์" },
  { tv: "pakistan", exchange: "PSX", country: "PK", market: "KSE", currency: "PKR", limit: 100, name: "ปากีสถาน" },
  { tv: "ksa", exchange: "TADAWUL", country: "SA", market: "TADAWUL", currency: "SAR", limit: 100, name: "ซาอุ" },
  { tv: "brazil", exchange: "BMFBOVESPA", country: "BR", market: "BOVESPA", currency: "BRL", limit: 150, name: "บราซิล" },
  { tv: "mexico", exchange: "BMV", country: "MX", market: "BMV", currency: "MXN", limit: 100, name: "เม็กซิโก" },
  { tv: "turkey", exchange: "BIST", country: "TR", market: "BIST", currency: "TRY", limit: 100, name: "ตุรกี" },
  { tv: "uk", exchange: "LSE", country: "GB", market: "LSE", currency: "GBP", limit: 200, name: "อังกฤษ" },
  { tv: "germany", exchange: "XETR", country: "DE", market: "XETR", currency: "EUR", limit: 200, name: "เยอรมนี" },
  { tv: "france", exchange: null, country: "FR", market: "EPA", currency: "EUR", limit: 150, name: "ฝรั่งเศส" },
  { tv: "switzerland", exchange: "SIX", country: "CH", market: "SWX", currency: "CHF", limit: 100, name: "สวิส" },
];

type Row = { symbol: string; name: string; sector: string; cap: number };

async function fetchTradingView(m: M): Promise<Row[]> {
  const filter: Array<Record<string, unknown>> = [{ left: "type", operation: "equal", right: "stock" }];
  if (m.exchange) filter.unshift({ left: "exchange", operation: "equal", right: m.exchange });
  const res = await fetch(`https://scanner.tradingview.com/${m.tv}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "sector", "market_cap_basic"],
      filter,
      options: { lang: "en" },
      range: [0, m.limit],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`${m.name} HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const out: Row[] = [];
  for (const r of json.data ?? []) {
    const [name, desc, sector, cap] = r.d as [string, string, string, number];
    if (!sectorToElement(sector)) continue;
    const symbol = r.s.split(":")[1] ?? "";
    if (!symbol) continue;
    out.push({ symbol, name: desc || name, sector, cap: cap ?? 0 });
  }
  return out;
}

async function main() {
  const db = JSON.parse(readFileSync(FILE, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
  const seen = new Set(db.stocks.map((s) => `${s.market}:${s.ticker}`));
  let added = 0;
  for (const m of MARKETS) {
    try {
      const rows = await fetchTradingView(m);
      let inMarket = 0;
      for (const r of rows) {
        const key = `${m.market}:${r.symbol}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const el = sectorToElement(r.sector);
        db.stocks.push({
          type: "stock", ticker: r.symbol, name: r.name, nameEn: r.name, country: m.country, market: m.market, currency: m.currency,
          sector: r.sector, business: "", businessKeywords: [], primaryElement: el, elementReason: `GICS ${r.sector} → ${el} (ตารางซินแส Source4/6)`,
          tier: r.cap > 1e11 ? "mega" : r.cap > 1e10 ? "large" : "mid", riskTier: "medium", cap: r.cap,
        });
        added += 1;
        inMarket += 1;
      }
      console.log(`📡 ${m.name}: ดึง ${rows.length} → เพิ่มใหม่ ${inMarket}`);
    } catch (e) {
      console.log(`❌ ${m.name}: ${(e as Error).message}`);
    }
  }
  db.meta.updatedAt = "2026-08-07";
  writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`\n✅ เพิ่มรวม ${added} ตัว → ทั้งหมด ${db.stocks.length}`);
}
main();
