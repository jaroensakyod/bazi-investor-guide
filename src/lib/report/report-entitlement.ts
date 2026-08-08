import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { normalizeReportTier, tierIncludes, type ReportTier } from "./product-system";
import type { ReportParamReader } from "./report-input";

export type EntitlementProfile = {
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  province?: string;
};

export type ReportEntitlementClaims = {
  version: 1;
  reportId: string;
  profileHash: string;
  tier: ReportTier;
  issuedAt: number;
  expiresAt: number;
};

export type ReportAccess = {
  tier: ReportTier;
  source: "free" | "development-preview" | "signed-entitlement";
  reportId?: string;
};

function encode(value: string | Buffer): string {
  return Buffer.from(value).toString("base64url");
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function reportProfileFingerprint(profile: EntitlementProfile): string {
  const normalized = [profile.birthDate, profile.birthTime, profile.gender, profile.province]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 24);
}

export function signReportEntitlement(
  input: Omit<ReportEntitlementClaims, "version" | "issuedAt"> & { issuedAt?: number },
  secret: string,
): string {
  if (secret.length < 24) throw new Error("REPORT_ENTITLEMENT_SECRET ต้องยาวอย่างน้อย 24 ตัวอักษร");
  const claims: ReportEntitlementClaims = {
    version: 1,
    reportId: input.reportId,
    profileHash: input.profileHash,
    tier: input.tier,
    issuedAt: input.issuedAt ?? Math.floor(Date.now() / 1000),
    expiresAt: input.expiresAt,
  };
  const payload = encode(JSON.stringify(claims));
  return `${payload}.${encode(signature(payload, secret))}`;
}

export function verifyReportEntitlement(token: string, secret: string, nowSeconds = Math.floor(Date.now() / 1000)): ReportEntitlementClaims {
  const [payload, suppliedSignature, extra] = token.split(".");
  if (!payload || !suppliedSignature || extra) throw new Error("รูปแบบสิทธิ์รายงานไม่ถูกต้อง");
  const expected = signature(payload, secret);
  const supplied = Buffer.from(suppliedSignature, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error("ลายเซ็นสิทธิ์รายงานไม่ถูกต้อง");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as ReportEntitlementClaims;
  if (claims.version !== 1) throw new Error("เวอร์ชันสิทธิ์รายงานไม่รองรับ");
  if (!claims.reportId || !claims.profileHash || !claims.tier) throw new Error("ข้อมูลสิทธิ์รายงานไม่ครบ");
  if (claims.expiresAt <= nowSeconds) throw new Error("สิทธิ์รายงานหมดอายุแล้ว");
  return { ...claims, tier: normalizeReportTier(claims.tier) };
}

export function resolveReportAccess(
  reader: ReportParamReader,
  profile: EntitlementProfile,
  options?: { production?: boolean; secret?: string; nowSeconds?: number },
): ReportAccess {
  const requestedTier = normalizeReportTier(reader("tier"));
  if (requestedTier === "free") return { tier: "free", source: "free" };
  const production = options?.production ?? process.env.NODE_ENV === "production";
  if (!production) return { tier: requestedTier, source: "development-preview" };

  const secret = options?.secret ?? process.env.REPORT_ENTITLEMENT_SECRET;
  if (!secret) throw new Error("ระบบยังไม่ได้ตั้ง REPORT_ENTITLEMENT_SECRET");
  const token = reader("entitlement");
  if (!token) throw new Error("ไม่พบสิทธิ์สำหรับรายงานแบบชำระเงิน");
  const claims = verifyReportEntitlement(token, secret, options?.nowSeconds);
  const expectedProfile = reportProfileFingerprint(profile);
  if (claims.profileHash !== expectedProfile) throw new Error("สิทธิ์รายงานไม่ตรงกับโปรไฟล์นี้");
  if (!tierIncludes(claims.tier, requestedTier)) throw new Error(`สิทธิ์ ${claims.tier} ไม่ครอบคลุมแพ็กเกจ ${requestedTier}`);
  return { tier: requestedTier, source: "signed-entitlement", reportId: claims.reportId };
}
