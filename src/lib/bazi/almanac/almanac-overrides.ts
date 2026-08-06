/**
 * Override types สำหรับปฏิทินโหราศาสตร์ — port มาจาก bazi-sft-dataset
 * (ตัด DB/drizzle ออก เหลือแค่ types — ไม่ต้องใช้ override ก็รันได้)
 */
export type DayStarRow = {
  id: string;
  name: string;
  polarity: "good" | "bad";
  activity: string | null;
  triggers: Record<string, string[]>;
  note?: string | null;
};

export type SpecialEntry = {
  id: string;
  name: string;
  category: string;
  rule: Record<string, unknown>;
};

/** patch รายวันแบบ generic: ฟิลด์ใดของ AlmanacDay ก็ได้ → ค่าใหม่ (เก็บเป็น JSON) */
export type DayPatch = Record<string, unknown>;

export type AlmanacOverrides = {
  dayStars: DayStarRow[];
  specialDays: SpecialEntry[];
  dayPatches?: Record<string, DayPatch>;
};
