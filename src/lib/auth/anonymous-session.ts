import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";

export const ANONYMOUS_SESSION_VERSION = 1 as const;
export const ANONYMOUS_SESSION_COOKIE = "bazi_session" as const;
export const ANONYMOUS_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const AnonymousSessionPayloadSchema = z.object({
  version: z.literal(ANONYMOUS_SESSION_VERSION),
  subjectId: z.string().regex(/^anon_[a-f0-9]{32}$/),
  issuedAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
});

export type AnonymousSessionPayload = z.infer<typeof AnonymousSessionPayloadSchema>;

function assertSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("session secret ต้องยาวอย่างน้อย 32 bytes");
  }
}

function signature(message: string, secret: string): string {
  return createHmac("sha256", secret).update(message).digest("base64url");
}

function newSubjectId(): string {
  return `anon_${randomBytes(16).toString("hex")}`;
}

export function createAnonymousSession(
  secret: string,
  options: {
    nowSeconds?: number;
    ttlSeconds?: number;
    subjectId?: string;
  } = {},
): { token: string; payload: AnonymousSessionPayload } {
  assertSecret(secret);
  const issuedAt = Math.floor(options.nowSeconds ?? Date.now() / 1_000);
  const ttlSeconds = Math.floor(options.ttlSeconds ?? ANONYMOUS_SESSION_TTL_SECONDS);
  if (ttlSeconds < 60 || ttlSeconds > ANONYMOUS_SESSION_TTL_SECONDS) {
    throw new Error("session ttl ต้องอยู่ระหว่าง 60 วินาทีถึง 30 วัน");
  }
  const payload = AnonymousSessionPayloadSchema.parse({
    version: ANONYMOUS_SESSION_VERSION,
    subjectId: options.subjectId ?? newSubjectId(),
    issuedAt,
    expiresAt: issuedAt + ttlSeconds,
  });
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const message = `v${ANONYMOUS_SESSION_VERSION}.${encoded}`;
  return { token: `${message}.${signature(message, secret)}`, payload };
}

export function verifyAnonymousSession(
  token: string | null | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1_000),
): AnonymousSessionPayload | null {
  assertSecret(secret);
  if (!token || token.length > 1_024) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== `v${ANONYMOUS_SESSION_VERSION}`) return null;
  const message = `${parts[0]}.${parts[1]}`;
  const expected = Buffer.from(signature(message, secret), "utf8");
  const received = Buffer.from(parts[2], "utf8");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const parsed = AnonymousSessionPayloadSchema.safeParse(
      JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")),
    );
    if (!parsed.success) return null;
    const payload = parsed.data;
    if (payload.expiresAt <= nowSeconds || payload.issuedAt > nowSeconds + 60) return null;
    if (payload.expiresAt - payload.issuedAt > ANONYMOUS_SESSION_TTL_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
}
