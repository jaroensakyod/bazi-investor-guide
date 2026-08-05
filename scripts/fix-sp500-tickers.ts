/**
 * FIX หุ้น S&P 500: 32 ตัว ticker เป็น "ปีก่อตั้ง" (1894, 1930...) — regex เก่าจับผิด
 *
 * ต้นตอ: ตาราง S&P 500 มีโครงสร้าง
 *   |1894                          ← ปีก่อตั้ง (4 หลักล้วน — regex เก่าจับเป็น ticker!)
 *   |-
 *   |{{NyseSymbol|AME}}            ← ticker จริง
 *   |[[Ametek]]|| Industrials||... ← ชื่อบริษัท
 * regex เก่า `^\|\s*([A-Z0-9.\-]{1,10})\s*$` จับ "1894" แทน "AME"
 *
 * วิธีแก้: parse ใหม่จาก wikitext — จับ ticker template (NyseSymbol/NasdaqSymbol)
 *   + ชื่อบริษัทจากบรรทัดถัดไป → map ชื่อ→ticker จริง → แก้ 32 ตัวใน JSON
 *
 * รัน: npx tsx scripts/fix-sp500-tickers.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

async function fetchSp500(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=parse&page=List%20of%20S%26P%20500%20companies&format=json&prop=wikitext&section=1&redirects=1";
    const res = await fetch(url, {
      headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
    });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 10000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } }; error?: { info?: string } };
    if (json.error) throw new Error(json.error.info);
    const text = json.parse?.wikitext?.["*"];
    if (!text) throw new Error("ไม่มี wikitext");
    return text;
  }
  throw new Error("rate-limited เกิน");
}

/** parse: จับคู่ ticker template + ชื่อบริษัท → Map<ชื่อ, ticker จริง> */
function parseTickers(wikitext: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = wikitext.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const tpl = lines[i].match(/^\|\s*\{\{(?:NyseSymbol|NasdaqSymbol)\|([A-Z0-9.\-]{1,10})\}\}/);
    if (!tpl) continue;
    // บรรทัดถัดไป: |[[Company Name]]|| Sector ||...
    const nameMatch = (lines[i + 1] ?? "").match(/^\|\s*\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]/);
    if (!nameMatch) continue;
    const name = (nameMatch[2] ?? nameMatch[1]).trim();
    map.set(name.toLowerCase(), tpl[1].trim());
  }
  return map;
}

async function main() {
  console.log("📡 ดึง wikitext S&P 500...");
  const wikitext = await fetchSp500();
  const tickerMap = parseTickers(wikitext);
  console.log(`  map ชื่อ→ticker ได้ ${tickerMap.size} คู่`);

  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };

  let fixed = 0;
  let stillBad: string[] = [];
  const examples: string[] = [];

  for (const s of db.stocks) {
    if (!["NYSE/NASDAQ", "NYSE", "NASDAQ"].includes(s.market as string)) continue;
    const ticker = String(s.ticker ?? "");
    // ตัวที่ ticker เป็นปี (4 หลักล้วน) = จับผิด
    if (!/^\d{4}$/.test(ticker)) continue;
    const real = tickerMap.get(String(s.name ?? "").toLowerCase());
    if (!real) {
      stillBad.push(`${ticker}=${s.name}`);
      continue;
    }
    examples.push(`${s.name}: "${ticker}" → "${real}"`);
    s.ticker = real;
    fixed++;
  }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  console.log(`\n✅ แก้ ticker ${fixed} ตัว`);
  for (const e of examples.slice(0, 15)) console.log(`   ${e}`);
  if (stillBad.length) console.log(`  ⚠️ ยังหาไม่เจอ (${stillBad.length}): ${stillBad.slice(0, 10).join(", ")}`);
  console.log(`→ ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
