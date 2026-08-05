/**
 * ENRICH หุ้นสหรัฐฯ: อัปเดต tier + isHighLiquidity จาก market cap จริง (NASDAQ API)
 *
 * ปัญหา: pipeline auto (Wikipedia) ตั้ง tier: "mega" ทุกตัว — ผิด (หุ้นเล็กใน
 *   S&P 500 อย่าง Clorox ~15B ไม่ใช่ mega)
 *
 * แหล่งข้อมูล: api.nasdaq.com/api/screener/stocks (ฟรี ไม่ต้อง key)
 *   — ดึง symbol + marketCap ของทั้ง NYSE + NASDAQ
 *
 * เกณฑ์ tier (อิง MSCI/GICS market cap band):
 *   mega  ≥ $200B | large $10B–$200B | mid $2B–$10B | small < $2B
 * isHighLiquidity: true เมื่อเป็น S&P 500 (มีอยู่ในไฟล์แล้ว) หรือ tier mega/large
 *
 * รัน: npx tsx scripts/enrich-us-tiers.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

const TIER_BY_CAP = (capUsd: number): string =>
  capUsd >= 200e9 ? "mega" : capUsd >= 10e9 ? "large" : capUsd >= 2e9 ? "mid" : "small";

/** ดึง symbol → marketCap จาก NASDAQ screener API (หน้าเดียวครบ — limit สูง) */
async function fetchNasdaq(exchange: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let attempt = 0; attempt < 4; attempt++) {
    const url = `https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=10000&exchange=${exchange}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
        Origin: "https://www.nasdaq.com",
        Referer: "https://www.nasdaq.com/market-activity/stocks/screener",
      },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 10000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as {
      data?: { table?: { rows?: Array<{ symbol: string; marketCap: string }> } };
    };
    for (const r of json.data?.table?.rows ?? []) {
      if (!r.marketCap || r.marketCap === "NA" || r.marketCap === "N/A") continue;
      const cap = Number(r.marketCap.replace(/[^0-9.]/g, ""));
      if (!Number.isNaN(cap)) out.set(r.symbol, cap);
    }
    return out;
  }
  throw new Error("rate-limited เกิน");
}

async function main() {
  console.log("📡 ดึง market cap จาก NASDAQ API (NYSE + NASDAQ)...");
  const [nyse, nasdaq] = await Promise.all([
    fetchNasdaq("nyse").catch((e) => {
      console.log(`  ⚠️ NYSE: ${(e as Error).message}`);
      return new Map<string, number>();
    }),
    fetchNasdaq("nasdaq").catch((e) => {
      console.log(`  ⚠️ NASDAQ: ${(e as Error).message}`);
      return new Map<string, number>();
    }),
  ]);
  const caps = new Map([...nyse, ...nasdaq]);
  console.log(`  ได้ market cap ${caps.size} ตัว (NYSE ${nyse.size} + NASDAQ ${nasdaq.size})`);

  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };

  let updated = 0;
  let notFound = 0;
  const tierCounts: Record<string, number> = {};

  for (const s of db.stocks) {
    // เฉพาะหุ้น US (NYSE/NASDAQ) — ข้าม ETF/ADR ต่างชาติ? ใช้ market แทน
    if (!["NYSE/NASDAQ", "NYSE", "NASDAQ"].includes(s.market as string)) continue;
    const ticker = s.ticker as string;
    // NASDAQ ใช้ slash: BRK.B → BRK/B, BF.B → BF/B (ลองทั้ง 2 แบบ)
    let cap = caps.get(ticker);
    if (cap === undefined) cap = caps.get(ticker.replace(/\./g, "/"));
    if (cap === undefined) cap = caps.get(ticker.split(".")[0]);
    if (cap === undefined) {
      notFound++;
      continue;
    }
    const tier = TIER_BY_CAP(cap);
    s.tier = tier;
    s.isHighLiquidity = tier === "mega" || tier === "large";
    s.marketCapUsd = cap;
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
    updated++;
  }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  console.log(`\n✅ อัปเดต tier ${updated} ตัว (หาอันนี้ไม่เจอ ${notFound})`);
  console.log("  tier:", JSON.stringify(tierCounts));
  console.log(`→ ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
