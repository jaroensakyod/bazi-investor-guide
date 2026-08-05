/**
 * HIDDEN GEMS CLI — หุ้นใต้ผืนน้ำ (คนไม่เห็น × คุณภาพดี) เรียงตามดวง
 *
 * รัน:
 *   npx tsx scripts/hidden-gems.ts                                # ไม่ระบุดวง — ดูทั้งหมด
 *   npx tsx scripts/hidden-gems.ts --birth 1990-05-15 --time 14:30 --gender female   # กรองตามดวง
 *   npx tsx scripts/hidden-gems.ts --market TH --limit 15
 *
 * ต้องมี: snapshot ราคา (fetch-market-data.ts) + fundamentals cache (fetch-fundamentals.ts)
 */
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { resolveInvestElements, resolveInvestorPersona } from "../src/lib/investor/investor-guide";
import { getAllStocks } from "../src/lib/investor/stock-database";
import { loadSnapshot } from "../src/lib/market/market-data";
import { loadFundamentalsCache } from "../src/lib/market/fundamentals";
import { rankHiddenGems } from "../src/lib/market/hidden-gems";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const TIER_ICON = { safe: "🟢", medium: "🟡", risky: "🔴" } as const;

async function main() {
  const birth = arg("--birth");
  const time = arg("--time");
  const gender = arg("--gender");
  const market = arg("--market");
  const limit = Number(arg("--limit") ?? 20);

  const snap = loadSnapshot();
  if (!snap) throw new Error("ยังไม่มี snapshot — รัน scripts/fetch-market-data.ts ก่อน");
  const fundamentals = loadFundamentalsCache();

  let usefulElements: string[] | undefined;
  let band: "weak" | "balanced" | "strong" | undefined;
  if (birth && time && gender) {
    const state = await calculateBaziChart(
      { birthDate: birth, birthTime: time, gender: gender as "male" | "female", province: arg("--province") ?? "Bangkok" },
      createInMemoryKnowledgeRepository(),
    );
    const invest = resolveInvestElements(state);
    usefulElements = invest.invest;
    band = resolveInvestorPersona(state).band as "weak" | "balanced" | "strong";
    console.log(`☯️ ดวง: ธาตุที่ควรลงทุน [${usefulElements.join(", ")}] · กำลังดวง: ${band}`);
    console.log(`   → ดวง${band === "weak" ? "อ่อน" : band === "balanced" ? "สมดุล" : "แข็ง"} เห็นแค่ระดับ ${band === "weak" ? "🟢 ปลอดภัย" : "🟢+🟡"}\n`);
  } else {
    console.log("ℹ️ ไม่ระบุดวง — แสดงใต้ผืนน้ำทุกธาตุ (ใส่ --birth --time --gender เพื่อกรองตามดวง)\n");
  }

  const gems = rankHiddenGems({
    stocks: getAllStocks(),
    quotes: snap.quotes,
    fundamentals,
    usefulElements: usefulElements as never,
    strengthBand: band,
    market,
    limit,
  });

  console.log(`🫧 หุ้นใต้ผืนน้ำ ${gems.length} ตัว:`);
  for (const g of gems) {
    const fit = usefulElements?.includes(g.element) ? " ✅ตรงดวง" : "";
    console.log(
      `   ${TIER_ICON[g.tier]} ${g.ticker} ${g.name.slice(0, 30)} | ใต้ผืนน้ำ ${g.underwaterScore}/100 · ธาตุ${g.element}${fit} · Buffett ${g.buffettScore}/10` +
        (g.changePct !== undefined ? ` · วันนี้ ${g.changePct > 0 ? "+" : ""}${g.changePct}%` : ""),
    );
    for (const r of g.reasons.slice(0, 2)) console.log(`        └ ${r}`);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
