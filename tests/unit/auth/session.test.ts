import { describe, expect, it } from "vitest";
import { SignJWT } from "jose";
import { createSession, verifySession, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/session";

const SECRET = "test-secret-test-secret-test-secret-123";

describe("session", () => {
  it("tạo và xác thực token hợp lệ", async () => {
    const token = await createSession("admin", SECRET);
    expect(await verifySession(token, SECRET)).toEqual({ username: "admin" });
  });

  it("phiên hết hạn sau 7 ngày", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(7 * 24 * 60 * 60);
  });

  it("trả null khi sai chữ ký", async () => {
    const token = await createSession("admin", SECRET);
    expect(await verifySession(token, "secret-khac-secret-khac-secret-khac-1")).toBeNull();
  });

  it("trả null khi token hết hạn", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const token = await new SignJWT({ sub: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(past - 10)
      .setExpirationTime(past)
      .sign(new TextEncoder().encode(SECRET));
    expect(await verifySession(token, SECRET)).toBeNull();
  });

  it("trả null khi token rỗng hoặc rác", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("abc.def.ghi", SECRET)).toBeNull();
  });

  it("báo lỗi khi secret quá ngắn", async () => {
    await expect(createSession("admin", "ngan")).rejects.toThrow();
  });
});
