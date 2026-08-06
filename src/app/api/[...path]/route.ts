/**
 * BFF proxy — ส่งต่อไปยัง backend service (scripts/api-server.ts — http://127.0.0.1:8787)
 *
 * ทำไมต้อง proxy: web app ไม่ bundle src/lib (หลังบ้าน) — เรียกผ่าน HTTP เหมือน LINE/mobile
 * เปลี่ยน backend ได้โดยไม่แตะหน้าเว็บ (เปลี่ยนแค่ API_BASE env)
 *
 * dev: เปิด 2 terminal — `npx tsx scripts/api-server.ts --port 8787` + `npm run dev`
 */
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:8787";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  const { path } = await ctx.params;
  const suffix = path.join("/");
  const qs = req.nextUrl.search;
  const url = `${API_BASE}/api/${suffix}${qs}`;
  try {
    const res = await fetch(url, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify(await req.json()) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return NextResponse.json(body, { status: res.status });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `backend ไม่พร้อม — รัน npx tsx scripts/api-server.ts --port 8787 (${(e as Error).message})` },
      { status: 502 },
    );
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx, "GET");
}
export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx, "POST");
}
