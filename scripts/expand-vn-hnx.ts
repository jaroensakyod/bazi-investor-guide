/**
 * EXPAND เวียดนาม HNX (ตลาดฮานอย) — ตลาดที่ดึงไม่ได้ในรอบแรก (เหลือ 85 → +150)
 * TradingView: scanner.tradingview.com/vietnam/scan exchange=HNX
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts (resumable) แล้ว fetch-market-data
 * ตลาดที่ TradingView API ไม่มี: KOSDAQ (เกาหลี) · TPEx (ไต้หวัน) · JSE (แอฟริกาใต้) · mai — รอแหล่งอื่น
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/global.json");

async function main() {
  const res = await fetch("https://scanner.tradingview.com/vietnam/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "sector", "market_cap_basic"],
      filter: [
        { left: "exchange", operation: "equal", right: "HNX" },
        { left: "type", operation: "equal", right: "stock" },
      ],
      options: { lang: "en" },
      range: [0, 200],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`HNX HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const db = JSON.parse(readFileSync(FILE, "utf8")) as { meta: Record<string, unknown>; stocks: Array<Record<string, unknown>> };
  const seen = new Set(db.stocks.map((s) => `${s.market}:${s.ticker}`));
  let added = 0;
  for (const r of json.data ?? []) {
    const [name, desc, sector, cap] = r.d as [string, string, string, number];
    if (!sectorToElement(sector)) continue;
    const symbol = r.s.split(":")[1] ?? "";
    if (!symbol) continue;
    const key = `HOSE:${symbol}`;
    if (seen.has(key)) continue; // HNX symbol ซ้ำกับ HOSE (เช่น ticker เดียวกัน) — ข้าม
    seen.add(key);
    const el = sectorToElement(sector);
    db.stocks.push({
      type: "stock", ticker: symbol, name: desc || name, nameEn: desc || name, country: "VN", market: "HOSE", currency: "VND",
      sector, business: "", businessKeywords: [], primaryElement: el, elementReason: `GICS ${sector} → ${el} (ตารางซินแส Source4/6)`,
      tier: cap > 1e11 ? "mega" : cap > 1e10 ? "large" : "mid", riskTier: "medium", cap: cap ?? 0,
    });
    added += 1;
  }
  db.meta.updatedAt = "2026-08-07";
  writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  console.log(`📡 HNX: เพิ่ม ${added} ตัว → ทั้งหมด ${db.stocks.length}`);
}
main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
