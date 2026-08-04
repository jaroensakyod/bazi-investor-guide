/**
 * CLI: สร้าง checklist CSV ให้ซินแสตรวจธาตุหุ้น
 *
 * วิธีใช้:
 *   1. npx tsx scripts/review-checklist.ts export     → data/review/thailand-review.csv
 *   2. ซินแสเปิดใน Excel กรอก: isCorrect (Y/N) + correctedElements + note
 *   3. บันทึกเป็น thailand-review-done.csv
 *   4. npx tsx scripts/review-checklist.ts import <ไฟล์> --reviewer "ซินแสชื่อ"
 *      → อัปเดต data/stocks/thailand.json (status → reviewed + reviewHistory)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getThaiStocks, buildReviewChecklist, reviewChecklistToCsv, applyReviewResults, type ReviewResult } from "@/lib/investor/stock-database";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STOCKS_FILE = path.join(ROOT, "data/stocks/thailand.json");
const REVIEW_DIR = path.join(ROOT, "data/review");

function parseCsvSimple(csv: string): string[][] {
  // parse CSV แบบง่าย (รองรับ quote ") — ใช้กับไฟล์ที่ซินแสกรอก
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuote = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuote) {
      if (ch === '"') {
        if (csv[i + 1] === '"') { cell += '"'; i++; }
        else inQuote = false;
      } else cell += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      row.push(cell); cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && csv[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function main() {
  const [cmd, fileArg, ...rest] = process.argv.slice(2);
  const reviewerFlag = rest.find((a) => a.startsWith("--reviewer="));
  const reviewer = reviewerFlag ? reviewerFlag.split("=")[1] : "ซินแส";

  if (cmd === "export") {
    const stocks = getThaiStocks();
    const csv = reviewChecklistToCsv(buildReviewChecklist(stocks));
    mkdirSync(REVIEW_DIR, { recursive: true });
    const out = path.join(REVIEW_DIR, "thailand-review.csv");
    writeFileSync(out, "\uFEFF" + csv, "utf8"); // BOM ให้ Excel อ่านไทยไม่เพี้ยน
    console.log(`✅ export ${stocks.length} แถว → ${out}`);
    console.log("   ให้ซินแสกรอก isCorrect (Y/N) + correctedElements + note แล้วบันทึกเป็น *_done.csv");
    return;
  }

  if (cmd === "import") {
    if (!fileArg) { console.error("❌ ต้องระบุไฟล์ผลตรวจ: npx tsx scripts/review-checklist.ts import <file.csv>"); process.exit(1); }
    const csv = readFileSync(path.resolve(ROOT, fileArg), "utf8").replace(/^\uFEFF/, "");
    const rows = parseCsvSimple(csv);
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);

    const results: ReviewResult[] = [];
    for (const r of rows.slice(1)) {
      const ticker = r[idx("ticker")]?.trim();
      const isCorrect = r[idx("iscorrect")]?.trim().toUpperCase();
      if (!ticker || !isCorrect) continue;
      results.push({
        ticker,
        isCorrect: isCorrect === "Y" ? "Y" : "N",
        correctedElements: r[idx("correctedelements")]?.trim() || undefined,
        correctedPrimary: r[idx("correctedprimary")]?.trim() || undefined,
        note: r[idx("note")]?.trim() || undefined,
      });
    }

    const db = JSON.parse(readFileSync(STOCKS_FILE, "utf8"));
    const { updated, problems } = applyReviewResults(db.stocks, results, reviewer);
    writeFileSync(STOCKS_FILE, JSON.stringify(db, null, 2) + "\n", "utf8");

    console.log(`✅ import ${results.length} รายการ (reviewer: ${reviewer})`);
    for (const u of updated) console.log(`  ✓ ${u}`);
    for (const p of problems) console.log(`  ⚠️ ${p}`);
    console.log(`อัปเดต → ${STOCKS_FILE}`);
    return;
  }

  console.error("❌ คำสั่งไม่รู้จัก ใช้: export | import <file.csv> [--reviewer=ชื่อ]");
  process.exit(1);
}

main();
