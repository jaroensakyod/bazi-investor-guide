/**
 * EXPAND คลังไทย 129 → ~250: ดึงหุ้น SET top-250 + mai top-80 จาก TradingView scanner
 * (pattern เดียวกับ expand-to-100.ts — sector taxonomy → ธาตุ)
 *
 * กฎ: ไม่ทับตัวที่มีอยู่ (merge ข้าม ticker ซ้ำ) · sector ไม่รู้จัก → ข้าม (ไม่เดาธาตุ)
 * หลังรัน: npx tsx scripts/enrich-descriptions-yahoo.ts เพื่อเติม description ให้ตัวใหม่
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sectorToElement } from "../src/lib/market/sector-elements";
import type { ThaiElement } from "../src/lib/investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FILE = path.join(ROOT, "data/stocks/thailand.json");

type Row = { symbol: string; name: string; sector: string; cap: number };

async function fetchTradingView(exchange: string, limit: number): Promise<Row[]> {
  const res = await fetch("https://scanner.tradingview.com/thailand/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      columns: ["name", "description", "sector", "market_cap_basic"],
      filter: [
        { left: "exchange", operation: "equal", right: exchange },
        { left: "type", operation: "equal", right: "stock" },
      ],
      options: { lang: "en" },
      range: [0, limit],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ s: string; d: unknown[] }> };
  const out: Row[] = [];
  for (const r of json.data ?? []) {
    const [name, desc, sector, cap] = r.d as [string, string, string, number];
    if (!sectorToElement(sector)) continue; // sector ไม่รู้จัก → ข้าม (กันธาตุผิด)
    const symbol = r.s.split(":")[1] ?? "";
    if (!symbol) continue;
    out.push({ symbol, name: desc || name, sector, cap: cap ?? 0 });
  }
  return out;
}

async function main() {
  const db = JSON.parse(readFileSync(FILE, "utf8")) as {
    meta: Record<string, unknown>;
    stocks: Array<Record<string, unknown>>;
  };
  const existing = new Set(db.stocks.map((s) => String(s.ticker)));

  console.log("📡 ดึง SET top-250 + mai top-80 (TradingView)...");
  const setRows = await fetchTradingView("SET", 250).catch((e) => {
    console.log(`  ⚠️ SET: ${(e as Error).message}`);
    return [];
  });
  await new Promise((r) => setTimeout(r, 1500));
  const maiRows = await fetchTradingView("MAI", 80).catch((e) => {
    console.log(`  ⚠️ MAI: ${(e as Error).message}`);
    return [];
  });
  console.log(`  SET ${setRows.length} แถว · MAI ${maiRows.length} แถว (เฉพาะ sector ที่ map ธาตุได้)`);

  let added = 0;
  let skipped = 0;
  const rankBySymbol = new Map<string, number>();
  setRows.forEach((r, i) => rankBySymbol.set(r.symbol, i + 1));
  for (const [rows, market] of [[setRows, "SET"], [maiRows, "mai"]] as Array<[Row[], "SET" | "mai"]>) {
    for (const r of rows) {
      if (existing.has(r.symbol)) {
        skipped++;
        continue;
      }
      const element = sectorToElement(r.sector) as ThaiElement;
      const rank = rankBySymbol.get(r.symbol);
      const tier = market === "mai" ? "mai" : rank !== undefined && rank <= 50 ? "SET50" : rank !== undefined && rank <= 100 ? "SET100" : "mid";
      db.stocks.push({
        type: "stock",
        ticker: r.symbol,
        name: r.name,
        nameEn: r.name,
        country: "TH",
        market,
        currency: "THB",
        sector: r.sector,
        business: r.name,
        businessKeywords: [],
        growthStage: rank !== undefined && rank <= 100 ? "large" : market === "mai" ? "small" : "mid",
        theme: [],
        risingStar: false,
        listedDate: null,
        elements: [element],
        primaryElement: element,
        elementReason: `TradingView sector: ${r.sector} → ธาตุ ${element} (auto-map — รอซินแสตรวจ)`,
        elementSource: "TradingView sector (auto) — draft รอตรวจ",
        tier,
        isHighLiquidity: rank !== undefined && rank <= 100,
        status: "draft",
        reviewedBy: null,
        reviewedAt: null,
        notes: "auto จาก TradingView — รอซินแสตรวจธาตุ",
      });
      existing.add(r.symbol);
      added++;
    }
  }

  if (added > 0) {
    db.meta.updatedAt = new Date().toISOString().slice(0, 10);
    db.meta.label = `หุ้นไทย SET50/SET100/mai + auto (TradingView top-250)`;
    writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
  }
  const tierCount: Record<string, number> = {};
  db.stocks.forEach((s) => {
    tierCount[String(s.tier)] = (tierCount[String(s.tier)] ?? 0) + 1;
  });
  console.log(`\n✅ รวม ${db.stocks.length} ตัว (เพิ่ม ${added}, ข้ามซ้ำ ${skipped})`);
  console.log("tier:", JSON.stringify(tierCount));
  console.log("\nขั้นต่อไป: npx tsx scripts/enrich-descriptions-yahoo.ts (เติม description ตัวใหม่)");
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
