/**
 * PORTFOLIO DEMO — จัดพอร์ตตามดวง (บท 13) + verdict สินทรัพย์หลัก
 *
 * รัน:
 *   npx tsx scripts/portfolio-demo.ts --birth 1990-05-15 --time 14:30 --gender female
 */
import { calculateBaziChart } from "../src/lib/bazi/symbolic-engine";
import { createInMemoryKnowledgeRepository } from "../src/lib/bazi/in-memory-repository";
import { resolveInvestElements, resolveInvestorPersona } from "../src/lib/investor/investor-guide";
import { allocatePortfolio } from "../src/lib/assets/portfolio";
import { assetVerdict } from "../src/lib/assets/asset-verdict";
import { getAsset } from "../src/lib/assets/asset-universe";
import { loadSnapshot } from "../src/lib/market/market-data";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const birth = arg("--birth") ?? "1990-05-15";
  const time = arg("--time") ?? "14:30";
  const gender = (arg("--gender") ?? "female") as "male" | "female";
  const state = await calculateBaziChart(
    { birthDate: birth, birthTime: time, gender, province: arg("--province") ?? "Bangkok" },
    createInMemoryKnowledgeRepository(),
  );
  const { invest, avoid } = resolveInvestElements(state);
  const persona = resolveInvestorPersona(state);
  console.log(`☯️ ดวง (${birth} ${time} ${gender}): ธาตุควรลงทุน [${invest.join(", ")}] · เลี่ยง [${avoid.join(", ")}]`);
  console.log(`   การ์ดตัวตน: ${persona.emoji} ${persona.name} (ดวง${persona.band === "weak" ? "อ่อน" : persona.band === "strong" ? "แข็ง" : "สมดุล"})\n`);

  console.log("📊 จัดพอร์ตตามธาตุ (บท 13):");
  const rows = allocatePortfolio({ usefulElements: invest, strengthBand: persona.band as "weak" | "balanced" | "strong" });
  for (const r of rows) {
    console.log(`   ${r.element} ${r.pct}% → ${r.assets.join(", ") || "-"}`);
    console.log(`        └ ${r.note}`);
  }

  console.log("\n🛒 verdict สินทรัพย์หลักวันนี้:");
  const snap = loadSnapshot();
  for (const t of ["GC=F", "CL=F", "BTC-USD", "BND", "VNQ", "USDTHB=X"]) {
    const asset = getAsset(t);
    if (!asset) continue;
    const md = snap?.quotes[t];
    const v = assetVerdict(asset, { usefulElements: invest, avoidElements: avoid, strengthBand: persona.band as "weak" | "balanced" | "strong", changePct: md?.changePct });
    const icon = { "very-good": "✅✅", good: "✅", neutral: "🟡", avoid: "⛔" }[v.verdict];
    console.log(`   ${icon} ${asset.name} (ธาตุ${asset.primaryElement} · tier ${asset.riskTier})${md ? ` ราคา ${md.price} (${md.changePct ?? 0}%)` : ""}`);
    for (const r of v.reasons.slice(0, 2)) console.log(`        └ ${r}`);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
