/**
 * Fix: แก้ชื่อหุ้น Nikkei 225 ที่ parser รอบแรกจับผิด (business = ตัวอักษรแรกของ [[X|Y]])
 * + แก้ชื่อสั้น AU/KR ที่เป็น ticker แทนชื่อบริษัท
 *
 * ออกแบบให้ "ต่อยอดได้" (resumable): อ่าน global.json → แก้เฉพาะตัวที่ยังเสีย
 * → เขียนกลับทุก section → ถ้าโดน rate-limit ขัดกลางคัน รันซ้ำได้ ต่อจากที่แก้แล้ว
 *
 * รัน: npx tsx scripts/fix-nikkei-names.ts   (รันซ้ำจนกว่า "เหลือ" = 0)
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../data/stocks/global.json", import.meta.url);
const DELAY_MS = 4000;

const NIKKEI_SECTION_SECTOR: Record<string, string> = {
  "Air transport": "Transportation", "Automotive": "Automobiles & Components", "Banking": "Banks",
  "Chemicals": "Chemicals", "Communications": "Communication Services", "Construction": "Construction",
  "Electric machinery": "Technology", "Electric power": "Utilities", "Fishery": "Food & Beverage",
  "Foods": "Food & Beverage", "Gas": "Utilities", "Glass & ceramics": "Materials", "Insurance": "Insurance",
  "Land transport": "Transportation", "Machinery": "Machinery", "Marine transport": "Transportation",
  "Mining": "Metals & Mining", "Nonferrous metals": "Metals & Mining", "Other financial services": "Financial Services",
  "Other manufacturing": "Industrials", "Petroleum": "Energy", "Pharmaceuticals": "Pharmaceuticals",
  "Precision instruments": "Technology", "Pulp & paper": "Paper & Forest Products", "Railway/bus": "Transportation",
  "Real estate": "Real Estate", "Retail": "Retailing", "Securities": "Financial Services",
  "Services": "Consumer Discretionary", "Shipbuilding": "Capital Goods", "Steel": "Metals & Mining",
  "Textiles & apparels": "Consumer Products", "Trading companies": "Conglomerates", "Warehousing": "Transportation",
  "Wholesale": "Retailing",
};

/** ชื่อเต็มของหุ้น AU/KR ที่ ticker สั้นเกิน 3 ตัว (แก้ด้วยมือ — ข้อมูลจริง) */
const SHORT_NAME_FIXES: Record<string, string> = {
  "EVT.AX": "Event Hospitality & Entertainment (โรงแรม โรงภาพยนตร์)",
  "IGO.AX": "IGO (เหมืองนิกเกิล/ลิเทียม)",
  "SGH.AX": "SGH (วิศวกรรมไฟฟ้าและโครงข่าย)",
  "278470.KS": "APR (เครื่องสำอาง ความงาม)",
  "383220.KS": "F&F (แฟชั่น แบรนด์ MLB)",
  "066970.KS": "L&F (วัสดุแบตเตอรี่)",
  "012750.KS": "S-1 (ความปลอดภัย/เซฟตี้)",
};

type Stock = {
  ticker: string;
  business: string;
  name: string;
  sector: string;
  primaryElement: string;
  elementReason: string;
};

async function fetchWithRetry(url: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "bazi-investor-guide/0.1 (fix script; contact: dev)" } });
    if (res.status === 429) {
      const wait = 20000 * (attempt + 1);
      console.log(`  ⏳ rate-limited รอ ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  }
  throw new Error("rate-limited เกิน 5 ครั้ง");
}

async function fetchSection(page: string, section: number): Promise<string> {
  // section = -1 → ดึงทั้งหน้า (request เดียว ได้ทุก section รวมกัน — ลด rate-limit)
  const url = section < 0
    ? `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=wikitext&redirects=1`
    : `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&format=json&prop=wikitext&section=${section}&redirects=1`;
  const raw = await fetchWithRetry(url);
  const j = JSON.parse(raw) as { parse?: { wikitext?: { "*"?: string } }; error?: { info?: string } };
  if (j.error) throw new Error(j.error.info ?? "error");
  return j.parse?.wikitext?.["*"] ?? "";
}

async function main() {
  const db = JSON.parse(readFileSync(FILE, "utf8")) as { stocks: Stock[] };
  const stocks = db.stocks;

  // 1) ชื่อสั้น AU/KR — แก้ตรง (ไม่ต้อง fetch)
  let fixed = 0;
  for (const s of stocks) {
    if (SHORT_NAME_FIXES[s.ticker] && s.business.length <= 3) {
      s.business = SHORT_NAME_FIXES[s.ticker];
      s.name = SHORT_NAME_FIXES[s.ticker];
      fixed++;
    }
  }
  console.log(`✅ แก้ชื่อสั้น AU/KR: ${fixed} ตัว`);

  // 2) Nikkei — ดึงทั้งหน้าใน request เดียว (ลด rate-limit) แล้วไล่ section title เอง
  const fullText = await fetchSection("Nikkei 225", -1);
  const lines = fullText.split("\n");
  let currentSector = "Unknown";
  let found = 0;

  // index เร็ว: ticker → stock ที่ชื่อยังเสีย
  const brokenByTicker = new Map<string, Stock>();
  for (const s of stocks) {
    if (s.ticker.endsWith(".T") && s.business.length <= 3) brokenByTicker.set(s.ticker, s);
  }
  console.log(`Nikkei ชื่อเสียก่อนเริ่ม: ${brokenByTicker.size}`);

  for (const line of lines) {
    const titleMatch = line.match(/^={2,4}\s*(.+?)\s*={2,4}/);
    if (titleMatch) {
      currentSector = NIKKEI_SECTION_SECTOR[titleMatch[1].trim()] ?? "Unknown";
      continue;
    }
    // รองรับ: *[[X]] · *The [[X]] · *'''[[X]] · [[a|b]] · [[jp:xx|M3]]
    // + suffix ต่อท้ายลิงก์: [[NEC]] Corp. · [[Chiba Bank]], Ltd. · [[Chugai...]]l Co., Ltd. (ตัวอักษรต่อเนื่อง)
    const m = line.match(/^\*\s*(?:The\s+)?'{0,3}\[\[(?:[^\]|]+\|)?([^\]|]+?)\]\]\s*([^({]*?)(?:\s*\(\{\{|$)/);
    const base = m?.[1]?.trim() ?? "";
    const suffix = m?.[2]?.trim() ?? "";
    const name = suffix
      ? /^[a-z,.]/.test(suffix) ? base + suffix : `${base} ${suffix}`
      : base;
    const symMatch = line.match(/\{\{[^|}]*\|(\d{4}[A-Z]?)\}\}/);
    if (!symMatch) continue;
    const symbol = `${symMatch[1]}.T`;
    const stock = brokenByTicker.get(symbol);
    if (stock && name.trim().length > 2 && currentSector !== "Unknown") {
      const cleanName = name.trim().replace(/\(.*\)/, "").trim();
      stock.business = cleanName;
      stock.name = cleanName;
      stock.sector = currentSector;
      stock.elementReason = `GICS sector: ${currentSector} → ธาตุ ${stock.primaryElement} (auto-map — รอซินแสตรวจ)`;
      brokenByTicker.delete(symbol);
      found++;
    }
  }
  if (found > 0) {
    writeFileSync(FILE, JSON.stringify(db, null, 2) + "\n", "utf8");
    console.log(`  ✅ แก้ Nikkei จากทั้งหน้า: ${found} ตัว`);
  } else {
    console.log("  ⚠️ ยังแก้ไม่ได้ (rate-limit หรือ regex ไม่ตรง) — ลองรันซ้ำ");
  }

  const remaining = stocks.filter((s) => s.ticker.endsWith(".T") && s.business.length <= 3).length;
  console.log(`\nเสร็จรอบนี้ — เหลือ Nikkei ชื่อเสีย: ${remaining} ตัว`);
  console.log(remaining > 0 ? "→ รันซ้ำอีกครั้ง (ต่อจากที่แก้แล้ว)" : "🎉 ครบแล้ว!");
}

main().catch((e) => { console.error("❌", e); process.exit(1); });
