/**
 * User chart store — จำโปรไฟล์ผู้ใช้ (วันเกิด/เวลา/เพศ/จังหวัด) + แคช chartHash
 *
 * เก็บ data/users/<userId>.json (LINE userId = รหัส alphanumeric) — คำนวณดวงครั้งเดียว
 * หลัก: hash ป้องกันคำนวณซ้ำ (chart deterministic) · sanitize userId กัน path traversal
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const USERS_DIR = path.join(ROOT, "data/users");

export type UserProfile = {
  userId: string;
  birthDate: string; // YYYY-MM-DD
  birthTime: string; // HH:mm (24h)
  gender: "male" | "female";
  province: string;
  /** sha256 ของ birth payload — เปลี่ยนเมื่อข้อมูลเกิดเปลี่ยน → ต้องคำนวณดวงใหม่ */
  chartHash: string;
  locale: "th" | "zh" | "en";
  /** ติดตาม (watchlist) — รูปแบบ "s:<market>:<ticker>" (หุ้น) / "a:<ticker>" (สินทรัพย์) */
  watchlist?: string[];
  createdAt: string;
  updatedAt: string;
};

export type BirthPayload = {
  birthDate: string;
  birthTime: string;
  gender: "male" | "female";
  province: string;
};

export function chartHashOf(p: BirthPayload): string {
  return createHash("sha256").update([p.birthDate, p.birthTime, p.gender, p.province].join("|")).digest("hex").slice(0, 16);
}

/** userId ต้องเป็น alphanumeric/-/_ (LINE ID) — กัน path traversal */
export function sanitizeUserId(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!clean) throw new Error("userId ไม่ถูกต้อง");
  return clean;
}

export function userFilePath(userId: string): string {
  return path.join(USERS_DIR, `${sanitizeUserId(userId)}.json`);
}

export function loadUser(userId: string): UserProfile | null {
  try {
    const file = userFilePath(userId);
    if (!existsSync(file)) return null;
    return JSON.parse(readFileSync(file, "utf8")) as UserProfile;
  } catch {
    return null;
  }
}

export function saveUser(profile: UserProfile): void {
  mkdirSync(USERS_DIR, { recursive: true });
  writeFileSync(userFilePath(profile.userId), JSON.stringify(profile, null, 2) + "\n", "utf8");
}

/** สร้าง/อัปเดต profile + คำนวณ chartHash ใหม่ถ้าข้อมูลเกิดเปลี่ยน */
export function upsertUser(p: BirthPayload & { userId: string; locale?: UserProfile["locale"] }): UserProfile {
  const existing = loadUser(p.userId);
  const now = new Date().toISOString();
  const hash = chartHashOf(p);
  const profile: UserProfile = {
    userId: sanitizeUserId(p.userId),
    birthDate: p.birthDate,
    birthTime: p.birthTime,
    gender: p.gender,
    province: p.province,
    chartHash: hash,
    locale: p.locale ?? existing?.locale ?? "th",
    watchlist: existing?.watchlist ?? [],
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  saveUser(profile);
  return profile;
}

/** เพิ่ม/ลบรายการติดตาม (watchlist) — รูปแบบ "s:<market>:<ticker>" / "a:<ticker>" — คืนรายการใหม่ กันซ้ำ */
export function toggleWatchlist(userId: string, entry: string): string[] {
  const u = loadUser(userId);
  if (!u) return [];
  const list = u.watchlist ?? [];
  const i = list.indexOf(entry);
  if (i >= 0) list.splice(i, 1);
  else list.push(entry);
  u.watchlist = list;
  u.updatedAt = new Date().toISOString();
  saveUser(u);
  return list;
}

/** ข้อมูลเกิดเปลี่ยนไปหรือยัง (ใช้เช็คว่าต้องคำนวณดวงใหม่ไหม) */
export function isChartStale(profile: UserProfile, p: BirthPayload): boolean {
  return profile.chartHash !== chartHashOf(p);
}
