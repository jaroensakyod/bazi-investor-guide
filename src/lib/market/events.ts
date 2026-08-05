/**
 * ปฏิทินเหตุการณ์ (curated — ทบทวนรายสัปดาห์ ไม่ใช่ real-time)
 *
 * ใช้กับแชท "ข่าว/เหตุการณ์ส่งผลยังไง" — เหตุการณ์ → เซกเตอร์ → ธาตุ
 * ⚠️ วันที่ประชุม FOMC = ตามประกาศทางการของ Fed (2026) · เหตุการณ์อื่นเพิ่มผ่าน review รายสัปดาห์
 */
export type EventEntry = {
  date: string; // YYYY-MM-DD (หรือช่วง "2026-09-15..2026-09-16")
  title: string;
  type: "macro" | "policy" | "geopolitics" | "weather" | "tech" | "market";
  affectedSectors: string[];
  note?: string;
};

export const EVENTS_SEED: EventEntry[] = [
  // ── FOMC 2026 (ตามกำหนดการทางการของ Fed) ──
  { date: "2026-01-27..2026-01-28", title: "FOMC Meeting (ม.ค.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"], note: "ดอกเบี้ย → ธนาคาร(น้ำ)/อสังหา(ดิน)" },
  { date: "2026-03-17..2026-03-18", title: "FOMC Meeting (มี.ค.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-04-28..2026-04-29", title: "FOMC Meeting (เม.ย.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-06-16..2026-06-17", title: "FOMC Meeting (มิ.ย.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-07-28..2026-07-29", title: "FOMC Meeting (ก.ค.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-09-15..2026-09-16", title: "FOMC Meeting (ก.ย.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-10-27..2026-10-28", title: "FOMC Meeting (ต.ค.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },
  { date: "2026-12-08..2026-12-09", title: "FOMC Meeting (ธ.ค.)", type: "macro", affectedSectors: ["Banks", "Financials", "Real Estate"] },

  // ── เหตุการณ์หมุนเวียน/เทมเพลต (เพิ่ม/ปรับผ่าน review รายสัปดาห์) ──
  { date: "2026-08-12", title: "ประกาศ GDP ไตรมาส 2/2569 (ไทย)", type: "macro", affectedSectors: ["Financials", "Consumer Discretionary"] },
  { date: "2026-08-17", title: "OPEC+ ประชุมทบทวนกำลังผลิต", type: "geopolitics", affectedSectors: ["Energy"], note: "น้ำมัน(ไฟ) ขึ้น/ลงตามมติ" },
  { date: "2026-09-01", title: "เปิดเทอม/Back-to-school season (US)", type: "market", affectedSectors: ["Consumer Discretionary", "Retailing"] },
  { date: "2026-11-25", title: "Thanksgiving (US) — ตลาดปิด + Black Friday", type: "market", affectedSectors: ["Consumer Discretionary", "Retailing"] },
  { date: "2026-12-24..2026-12-25", title: "คริสต์มาส — ตลาดปิด", type: "market", affectedSectors: [] },
];

/** เหตุการณ์ในช่วงวันที่กำหนด (รวมช่วงวัน) */
export function eventsBetween(events: EventEntry[], from: string, to: string): EventEntry[] {
  return events.filter((e) => {
    const [start, end = start] = e.date.split("..");
    return start <= to && end >= from;
  });
}
