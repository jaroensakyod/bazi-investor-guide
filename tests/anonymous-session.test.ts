import { describe, expect, it } from "vitest";
import {
  createAnonymousSession,
  verifyAnonymousSession,
} from "../src/lib/auth/anonymous-session";

const SECRET = "test-secret-that-is-longer-than-thirty-two-bytes";

describe("anonymous session", () => {
  it("สร้างและตรวจ signed subject โดยไม่เก็บ PII", () => {
    const created = createAnonymousSession(SECRET, { nowSeconds: 1_000, ttlSeconds: 3_600 });
    expect(created.payload.subjectId).toMatch(/^anon_[a-f0-9]{32}$/);
    expect(verifyAnonymousSession(created.token, SECRET, 1_001)).toEqual(created.payload);
    expect(created.token).not.toContain(created.payload.subjectId);
  });

  it("ปฏิเสธ token ที่ถูกแก้ ลายเซ็นผิด หมดอายุ หรืออายุยาวเกิน policy", () => {
    const created = createAnonymousSession(SECRET, { nowSeconds: 1_000, ttlSeconds: 60 });
    expect(verifyAnonymousSession(created.token + "x", SECRET, 1_001)).toBeNull();
    expect(verifyAnonymousSession(created.token, "different-secret-that-is-also-long-enough", 1_001)).toBeNull();
    expect(verifyAnonymousSession(created.token, SECRET, 1_060)).toBeNull();
  });

  it("fail closed เมื่อ secret สั้น", () => {
    expect(() => createAnonymousSession("short")).toThrow(/32 bytes/);
    expect(() => verifyAnonymousSession("anything", "short")).toThrow(/32 bytes/);
  });
});
