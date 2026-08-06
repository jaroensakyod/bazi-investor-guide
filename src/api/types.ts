/**
 * API layer types — รูปแบบ response กลาง (ทุก handler คืนแบบเดียวกัน)
 * เพื่อให้ frontend/web/LINE เรียกใช้ได้โดยไม่ผูกกับ implementation
 */
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

export function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}
export function err<T = never>(error: string): ApiResponse<T> {
  return { ok: false, error };
}

export type Query = Record<string, string | undefined>;
