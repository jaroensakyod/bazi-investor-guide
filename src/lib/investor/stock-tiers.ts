/**
 * ระบบเทียร์หุ้น (Hormozi value ladder — จ่ายมาก ได้เทียร์ดีขึ้น)
 *
 * gold 🥇 (VIP)  → unlock premium — ธาตุตรงดวง + พื้นฐานแกร่ง + ขนาดใหญ่ + โมเมนตัม
 * silver 🥈 (Pro) → unlock pro     — ธาตุตรงดวง/พื้นฐานดี อย่างน้อย 2 ปัจจัย
 * bronze 🥉 (Free) → unlock free   — กลางๆ (เห็นตลาดได้ทั่วไป)
 * base 📦 (Free)   → unlock free   — ขัดดวง/ข้อมูลน้อย — ข้อมูลตลาดล้วน
 *
 * deterministic ล้วน (ไม่มี LLM) — fit จาก scoreStock · พื้นฐานจาก Yahoo (ROE/Buffett)
 */
export type StockTier = "gold" | "silver" | "bronze" | "base";
export type UnlockLevel = "free" | "pro" | "premium";

export const TIER_META: Record<StockTier, { label: string; unlock: UnlockLevel; icon: string; color: string; desc: string }> = {
  gold: { label: "เทียร์ 1 — หุ้นเด่นสุด", unlock: "premium", icon: "🥇", color: "#f5c542", desc: "ธาตุตรงดวง + พื้นฐานแกร่ง + โมเมนตัม — กลุ่ม VIP (จ่ายสูงสุด)" },
  silver: { label: "เทียร์ 2 — หุ้นดี", unlock: "pro", icon: "🥈", color: "#c0c8d4", desc: "ตรงดวง/พื้นฐานดี — กลุ่ม Pro" },
  bronze: { label: "เทียร์ 3 — หุ้นกลาง", unlock: "free", icon: "🥉", color: "#d08a4e", desc: "กลางๆ เห็นได้ฟรี" },
  base: { label: "เทียร์ 4 — ข้อมูลตลาด", unlock: "free", icon: "📦", color: "#9a937f", desc: "ขัดดวง/ข้อมูลน้อย — ใช้ดูตลาดเท่านั้น" },
};

export const TIER_ORDER: StockTier[] = ["gold", "silver", "bronze", "base"];

export type TierInput = {
  fit: "good" | "neutral" | "drain" | "avoid" | null; // เทียบดวง (null = ไม่มีบริบทดวง — ใช้พื้นฐานล้วน)
  roe: number | null;
  buffett: number | null;
  capTier?: string; // mega/large/mid/small
  changePct: number | null;
};

/** จำแนกเทียร์หุ้น — deterministic (คะแนน: fit 3/1/-1 · พื้นฐานแกร่ง 2 · ใหญ่ 1 · โมเมนตัมบวก 1) */
export function classifyStockTier(i: TierInput): { tier: StockTier; score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (i.fit === "avoid") return { tier: "base", score: -9, reasons: ["ธาตุขัดดวง (avoid) — เหมาะดูข้อมูลตลาดเท่านั้น"] };
  let score = 0;
  if (i.fit === "good") { score += 3; reasons.push("ธาตุตรงดวง"); }
  else if (i.fit === "neutral") { score += 1; reasons.push("ธาตุเป็นกลาง"); }
  else if (i.fit === "drain") { score -= 1; reasons.push("ธาตุดูดพลัง (ดิถีอ่อน)"); }
  const strongFund = (i.roe ?? 0) >= 15 || (i.buffett ?? 0) >= 7;
  if (strongFund) { score += 2; reasons.push(`พื้นฐานแกร่ง (ROE=${i.roe ?? "-"}/Buffett=${i.buffett ?? "-"})`); }
  if (i.capTier === "mega" || i.capTier === "large") { score += 1; reasons.push("ขนาดใหญ่ สภาพคล่องดี"); }
  if (i.changePct != null && i.changePct >= 0) { score += 1; reasons.push("โมเมนตัมบวก"); }
  if (score >= 6) return { tier: "gold", score, reasons: [...reasons, "🥇 เทียร์ 1 (VIP)"] };
  if (score >= 4) return { tier: "silver", score, reasons: [...reasons, "🥈 เทียร์ 2 (Pro)"] };
  if (score >= 1) return { tier: "bronze", score, reasons: [...reasons, "🥉 เทียร์ 3 (ฟรี)"] };
  return { tier: "base", score, reasons: [...reasons, "📦 เทียร์ 4 — ข้อมูลตลาด"] };
}

/** ใครเห็นเทียร์ไหนได้บ้าง (Hormozi ladder) */
export function visibleTiers(unlock: UnlockLevel): StockTier[] {
  if (unlock === "premium") return TIER_ORDER;
  if (unlock === "pro") return ["silver", "bronze", "base"];
  return ["bronze", "base"];
}
