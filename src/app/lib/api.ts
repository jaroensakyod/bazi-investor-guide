/** API helper ฝั่ง browser — เรียก BFF proxy (/api/*) แล้วคืน data หรือ throw error */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, init);
    const body = (await res.json()) as ApiResult<T>;
    return body;
  } catch {
    return { ok: false, error: "backend ไม่พร้อม — ลองใหม่ทีหลัง" };
  }
}

export function get<T>(path: string): Promise<ApiResult<T>> {
  return call<T>(path);
}

export function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return call<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** userId เก็บใน localStorage — กันสแปม/สลับเครื่อง (ไม่ต้อง login จริงใน MVP) */
export function myUserId(): string {
  if (typeof window === "undefined") return "guest";
  let id = window.localStorage.getItem("duang_user_id");
  if (!id) {
    id = `u_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem("duang_user_id", id);
  }
  return id;
}
