/**
 * Backend config — จุดเดียวสำหรับสลับ provider/key (swap-able ตามที่ต้องการ)
 * ตอนนี้: LLM (Nous/DeepSeek ผ่าน .env) — อนาคต: data source, payment ฯลฯ
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnv(): Record<string, string> {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#")) out[m[1]] = m[2].trim();
  }
  return out;
}
const ENV = { ...loadEnv(), ...process.env };

export type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  locale: "th" | "zh" | "en";
  /** เปิด LLM หรือปิด (โหมด template) — สลับได้โดยไม่แตะโค้ด */
  enabled: boolean;
};

export function getLlmConfig(): LlmConfig {
  const key = ENV.LLM_API_KEY ?? "";
  return {
    apiKey: key,
    baseUrl: ENV.LLM_BASE_URL ?? "https://inference-api.nousresearch.com/v1",
    model: ENV.LLM_MODEL ?? "deepseek/deepseek-v4-flash-0731",
    locale: (ENV.LLM_LOCALE as "th" | "zh" | "en") ?? "th",
    enabled: Boolean(key),
  };
}

export const ROOT_DIR = ROOT;

/** รหัสเจ้าของ (owner) — ใช้สร้างสินค้า PDF / งาน admin ภายใน · เปลี่ยนใน .env (OWNER_PASS) */
export const OWNER_PASS = process.env.OWNER_PASS ?? "bazi2569";
