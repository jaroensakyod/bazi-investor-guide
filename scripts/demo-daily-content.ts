/**
 * DEMO: คอนเทนต์รายวัน 7 วัน (ตัวอย่างโพสต์ที่ระบบผลิตให้ LINE group / TikTok)
 * รัน: npx tsx scripts/demo-daily-content.ts
 */
import { getThaiStocks } from "@/lib/investor/stock-database";
import { buildWeeklyContent } from "@/lib/investor/daily-content";

const THEMES = [
  { id: "AI/Data Center", name: "AI/Data Center", elements: ["ทอง", "ไฟ"] },
  { id: "EV", name: "EV/แบตเตอรี่", elements: ["ไฟ", "ทอง"] },
  { id: "พลังงานสะอาด", name: "พลังงานสะอาด", elements: ["ไฟ"] },
  { id: "การแพทย์", name: "การแพทย์/Aging", elements: ["ไฟ", "น้ำ"] },
  { id: "อาหาร", name: "Food Security", elements: ["น้ำ", "ไม้"] },
  { id: "ท่องเที่ยว", name: "ท่องเที่ยว", elements: ["น้ำ"] },
  { id: "ค้าปลีก", name: "ค้าปลีก", elements: ["น้ำ"] },
  { id: "โทรคมนาคม", name: "โทรคมนาคม/ดิจิทัล", elements: ["ไม้"] },
  { id: "อสังหาริมทรัพย์", name: "อสังหาริมทรัพย์", elements: ["ดิน"] },
  { id: "ก่อสร้าง", name: "ก่อสร้าง", elements: ["ดิน"] },
  { id: "พลังงาน", name: "พลังงาน", elements: ["ไฟ"] },
  { id: "การเงิน", name: "การเงิน", elements: ["น้ำ"] },
  { id: "ยานยนต์", name: "ยานยนต์/EV", elements: ["ทอง", "ไฟ"] },
  { id: "ขนส่ง", name: "ขนส่ง/โลจิสติกส์", elements: ["น้ำ"] },
];

async function main() {
  const week = buildWeeklyContent(getThaiStocks(), THEMES, "2026-08-03"); // จันทร์ที่ 3 ส.ค. 69
  console.log("════════ คอนเทนต์รายวัน 7 วัน (สัปดาห์เริ่ม 3 ส.ค. 2026) ════════\n");

  for (const c of week) {
    const dayNames = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
    const dow = new Date(`${c.date}T12:00:00+07:00`).getDay();
    console.log(`📅 ${c.date} (${dayNames[dow]}) · วันจร ${c.dayGanzhi} (ธาตุ${c.dayElement}) · [${c.type}]`);
    console.log(`   ${c.headline}`);
    console.log(`   ${c.body.split("\n")[0]}`);
    if (c.featuredStocks.length > 0) {
      const names = c.featuredStocks.slice(0, 5).map((s) => `${s.ticker}(${s.element})`).join(", ");
      console.log(`   หุ้น: ${names}${c.featuredStocks.length > 5 ? ` +${c.featuredStocks.length - 5}` : ""}`);
    }
    console.log(`   ${c.hashtags.join(" ")}`);
    console.log(`   CTA: ${c.callToAction}`);
    console.log();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
