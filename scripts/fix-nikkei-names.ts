/**
 * FIX Nikkei 184 ตัว: ชื่อถูกจับเป็น 1 ตัวอักษร (regex เดิมพัง)
 *
 * สาเหตุ (KNOWN-ISSUES #1): regex `\[?\[?(?:[^\]|]+\|)?([^\]|]+?)\]?\]?`
 *   จับ `[[Honda|Honda Motor]]` ได้แค่ "H" เพราะ capture แบบ lazy + optional group
 * วิธีแก้:
 *   1. ดึง wikitext ทั้งหน้า "Nikkei 225" ใน request เดียว (ประหยัด rate-limit)
 *   2. parse ด้วย regex ใหม่: `\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]`
 *      → ใช้ display name (หลัง `|`) ถ้ามี ไม่งั้นใช้ชื่อลิงก์
 *   3. force-update เฉพาะ TSE ticker ที่ name ปัจจุบันยาว ≤ 1 ตัวอักษร
 *      (ตัวที่ map มือ 35 ตัวมี business ละเอียดภาษาไทย — ไม่แตะ)
 *   4. ไม่แตะ sector/element — ธาตุมาจาก section map เดิมถูกต้องแล้ว
 *
 * รัน: npx tsx scripts/fix-nikkei-names.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../data/stocks/global.json");

const NIKKEI_SECTION_SECTOR: Record<string, string> = {
  "Air transport": "Transportation",
  "Automotive": "Automobiles & Components",
  "Banking": "Banks",
  "Chemicals": "Chemicals",
  "Communications": "Communication Services",
  "Construction": "Construction",
  "Electric machinery": "Technology",
  "Electric power": "Utilities",
  "Fishery": "Food & Beverage",
  "Foods": "Food & Beverage",
  "Gas": "Utilities",
  "Glass & ceramics": "Materials",
  "Insurance": "Insurance",
  "Land transport": "Transportation",
  "Machinery": "Machinery",
  "Marine transport": "Transportation",
  "Mining": "Metals & Mining",
  "Nonferrous metals": "Metals & Mining",
  "Other financial services": "Financial Services",
  "Other manufacturing": "Industrials",
  "Petroleum": "Energy",
  "Pharmaceuticals": "Pharmaceuticals",
  "Precision instruments": "Technology",
  "Pulp & paper": "Paper & Forest Products",
  "Railway/bus": "Transportation",
  "Real estate": "Real Estate",
  "Retail": "Retailing",
  "Securities": "Financial Services",
  "Services": "Consumer Discretionary",
  "Shipbuilding": "Capital Goods",
  "Steel": "Metals & Mining",
  "Textiles & apparels": "Consumer Products",
  "Trading companies": "Conglomerates",
  "Warehousing": "Transportation",
  "Wholesale": "Retailing",
};

interface NikkeiRow {
  symbol: string;
  name: string;
  sector: string;
}

/** parse wikitext ทั้งหน้า: ===Section=== + *[[Page|Display]] ({{tyo2|XXXX}})
 *  regex ใหม่: จับชื่อลิงก์ + display (หลัง |) แยกกัน แล้วเลือก display ถ้ามี */
function parseNikkei(wikitext: string): NikkeiRow[] {
  const rows: NikkeiRow[] = [];
  let currentSector = "Unknown";
  for (const line of wikitext.split("\n")) {
    const titleMatch = line.match(/^===\s*(.+?)\s*===/);
    if (titleMatch) {
      currentSector = NIKKEI_SECTION_SECTOR[titleMatch[1].trim()] ?? "Unknown";
      continue;
    }
    // *[[Honda|Honda Motor]] Co., Ltd. ({{tyo2|7267}})
    // รองรับ: *The [[Chiba Bank]], Ltd. / *'''[[TDK]] Corp.''' / [[Chugai Pharmaceutica]]l
    const m = line.match(
      /^\*\s*(?:The\s+)?'{0,3}\[\[([^\]|]+?)(?:\|([^\]|]+?))?\]\]([a-z]{0,3})'{0,3}[\s\S]*?\{\{[^|}]*\|(\d{4}[A-Z]?)\}\}/,
    );
    if (!m) continue;
    const name = ((m[2] ?? m[1]) + (m[3] ?? "")).trim().replace(/\(.*\)/, "").trim();
    const symbol = `${m[4]}.T`;
    if (name && currentSector !== "Unknown") rows.push({ symbol, name, sector: currentSector });
  }
  return rows;
}

async function fetchNikkeiFull(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const url =
      "https://en.wikipedia.org/w/api.php?action=parse&page=Nikkei%20225&format=json&prop=wikitext&redirects=1";
    const res = await fetch(url, {
      headers: { "User-Agent": "bazi-investor-guide/0.1 (data pipeline; contact: dev)" },
    });
    if (res.status === 429) {
      const wait = 10000 * (attempt + 1);
      console.log(`  ⏳ rate-limited รอ ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { parse?: { wikitext?: { "*"?: string } }; error?: { info?: string } };
    if (json.error) throw new Error(json.error.info);
    const text = json.parse?.wikitext?.["*"];
    if (!text) throw new Error("ไม่มี wikitext");
    return text;
  }
  throw new Error("rate-limited เกิน 5 ครั้ง");
}

async function main() {
  console.log("📡 ดึง wikitext Nikkei 225 (ทั้งหน้า, 1 request)...");
  const wikitext = await fetchNikkeiFull();
  const rows = parseNikkei(wikitext);
  console.log(`  parse ได้ ${rows.length} แถว (ควร ~225)`);

  const bySymbol = new Map(rows.map((r) => [r.symbol, r]));
  const db = JSON.parse(readFileSync(OUT, "utf8")) as {
    stocks: Array<Record<string, unknown>>;
    meta: Record<string, unknown>;
  };

  let fixed = 0;
  let unchanged = 0;
  let missing = 0;
  const examples: string[] = [];

  for (const s of db.stocks) {
    if (s.market !== "TSE") continue;
    const name = String(s.name ?? "").trim();
    // แก้เฉพาะตัวที่ชื่อพัง (1 ตัวอักษร) — ตัวมือ (business ไทย) ไม่แตะ
    if (name.length > 1) {
      unchanged++;
      continue;
    }
    const row = bySymbol.get(s.ticker as string);
    if (!row) {
      missing++;
      continue;
    }
    s.name = row.name;
    s.nameEn = row.name;
    s.business = row.name; // pattern เดียวกับ auto ตัวอื่น: business = ชื่อบริษัท
    s.elementReason = `GICS sector: ${row.sector} → ธาตุ ${s.primaryElement} (auto-map — รอซินแสตรวจ)`;
    fixed++;
    if (examples.length < 12) examples.push(`${s.ticker}: "${name}" → "${row.name}"`);
  }

  db.meta.updatedAt = new Date().toISOString().slice(0, 10);
  writeFileSync(OUT, JSON.stringify(db, null, 2) + "\n", "utf8");

  console.log(`\n✅ แก้ชื่อ ${fixed} ตัว (ข้าม ${unchanged} ตัวที่ดี, หาไม่เจอ ${missing})`);
  for (const e of examples) console.log(`   ${e}`);
  console.log(`→ ${OUT}`);
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
