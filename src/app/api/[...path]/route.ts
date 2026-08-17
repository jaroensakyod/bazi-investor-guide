/**
 * Same-origin BFF for the internal API service.
 *
 * Client-provided userId is deliberately discarded. User-scoped requests use
 * a signed, HttpOnly anonymous subject until full account authentication is
 * introduced. The backend must independently verify the internal secret in
 * production; the subject header alone is never an authentication mechanism.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  ANONYMOUS_SESSION_COOKIE,
  ANONYMOUS_SESSION_TTL_SECONDS,
  createAnonymousSession,
  verifyAnonymousSession,
  type AnonymousSessionPayload,
} from "../../../lib/auth/anonymous-session";

export const runtime = "nodejs";

const API_BASE = process.env.API_BASE ?? "http://127.0.0.1:8787";
const MAX_JSON_BYTES = 64 * 1024;
const DEVELOPMENT_SESSION_SECRET = randomBytes(32).toString("base64url");
const USER_SCOPED_ROOTS = new Set([
  "profile",
  "chat",
  "fortune",
  "report",
  "report-html-data",
  "product-pdf",
  "full-pdf",
  "card-data",
  "card-pdf",
  "personal",
  "picks",
  "portfolio",
  "watchlist",
  "research",
  "decision-profile",
  "portfolio-ledger",
]);

type Ctx = { params: Promise<{ path: string[] }> };

type SessionResolution = {
  payload: AnonymousSessionPayload;
  tokenToSet: string | null;
};

class ProxyRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function resolveSessionSecret(userScoped: boolean): string | null {
  const configured = process.env.BAZI_SESSION_SECRET?.trim();
  if (configured) {
    if (Buffer.byteLength(configured, "utf8") < 32) {
      throw new ProxyRequestError("BAZI_SESSION_SECRET ต้องยาวอย่างน้อย 32 bytes", 503);
    }
    return configured;
  }
  if (process.env.NODE_ENV === "production") {
    if (userScoped) throw new ProxyRequestError("ระบบ session ยังตั้งค่าไม่ครบ", 503);
    return null;
  }
  return DEVELOPMENT_SESSION_SECRET;
}

function resolveSession(req: NextRequest, userScoped: boolean): SessionResolution | null {
  const secret = resolveSessionSecret(userScoped);
  if (!secret) return null;
  const existing = verifyAnonymousSession(req.cookies.get(ANONYMOUS_SESSION_COOKIE)?.value, secret);
  if (existing) return { payload: existing, tokenToSet: null };
  const created = createAnonymousSession(secret);
  return { payload: created.payload, tokenToSet: created.token };
}

function setSessionCookie(response: NextResponse, session: SessionResolution | null): NextResponse {
  if (!session?.tokenToSet) return response;
  response.cookies.set({
    name: ANONYMOUS_SESSION_COOKIE,
    value: session.tokenToSet,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ANONYMOUS_SESSION_TTL_SECONDS,
  });
  return response;
}

function safePath(path: string[]): string {
  if (path.length === 0 || path.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment))) {
    throw new ProxyRequestError("API path ไม่ถูกต้อง", 400);
  }
  return path.map(encodeURIComponent).join("/");
}

function targetUrl(req: NextRequest, suffix: string): string {
  const url = new URL(`${API_BASE.replace(/\/$/, "")}/api/${suffix}`);
  for (const [key, value] of req.nextUrl.searchParams) {
    if (key.toLowerCase() !== "userid") url.searchParams.append(key, value);
  }
  return url.toString();
}

async function safeJsonBody(req: NextRequest): Promise<Record<string, unknown>> {
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    throw new ProxyRequestError("request body ใหญ่เกิน 64 KB", 413);
  }
  const text = await req.text();
  if (!text) return {};
  if (!req.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new ProxyRequestError("POST endpoint นี้รับเฉพาะ application/json", 415);
  }
  if (Buffer.byteLength(text, "utf8") > MAX_JSON_BYTES) {
    throw new ProxyRequestError("request body ใหญ่เกิน 64 KB", 413);
  }
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("body must be an object");
    }
    const body = { ...(parsed as Record<string, unknown>) };
    delete body.userId;
    delete body.userid;
    return body;
  } catch {
    throw new ProxyRequestError("JSON body ไม่ถูกต้อง", 400);
  }
}

function responseHeaders(contentType?: string): HeadersInit {
  return {
    ...(contentType ? { "Content-Type": contentType } : {}),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
}

async function proxy(req: NextRequest, ctx: Ctx, method: "GET" | "POST") {
  try {
    const { path } = await ctx.params;
    const suffix = safePath(path);
    const userScoped = USER_SCOPED_ROOTS.has(path[0]);
    const session = resolveSession(req, userScoped);
    const internalSecret = process.env.API_INTERNAL_SECRET?.trim();
    if (process.env.NODE_ENV === "production" && userScoped && !internalSecret) {
      throw new ProxyRequestError("ระบบเชื่อมต่อ backend ภายในยังตั้งค่าไม่ครบ", 503);
    }
    const body = method === "POST" ? await safeJsonBody(req) : undefined;
    const headers = new Headers();
    if (method === "POST") headers.set("Content-Type", "application/json");
    if (session) headers.set("x-bazi-subject-id", session.payload.subjectId);
    if (internalSecret) headers.set("x-bazi-internal-secret", internalSecret);

    const upstream = await fetch(targetUrl(req, suffix), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf") || contentType.includes("text/csv")) {
      const response = new NextResponse(await upstream.arrayBuffer(), {
        status: upstream.status,
        headers: {
          ...responseHeaders(contentType),
          "Content-Disposition": upstream.headers.get("content-disposition") ?? 'attachment; filename="download"',
        },
      });
      return setSessionCookie(response, session);
    }

    const text = await upstream.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { ok: false, error: "backend ส่ง response ที่ไม่ใช่ JSON" };
    }
    const response = NextResponse.json(payload, {
      status: contentType.includes("application/json") ? upstream.status : 502,
      headers: responseHeaders("application/json; charset=utf-8"),
    });
    return setSessionCookie(response, session);
  } catch (error) {
    const known = error instanceof ProxyRequestError;
    const message = known
      ? error.message
      : process.env.NODE_ENV === "production"
        ? "backend ไม่พร้อมใช้งาน"
        : `backend ไม่พร้อมใช้งาน — ตรวจว่า API server ทำงานอยู่ (${(error as Error).message})`;
    return NextResponse.json(
      { ok: false, error: message },
      { status: known ? error.status : 502, headers: responseHeaders("application/json; charset=utf-8") },
    );
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx, "GET");
}

export async function POST(req: NextRequest, ctx: Ctx) {
  return proxy(req, ctx, "POST");
}
