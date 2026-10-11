import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { normalizeHash, verifyPassword } from "@/lib/auth/password";

const hash = bcrypt.hashSync("dung-mat-khau", 4);
const base64 = Buffer.from(hash).toString("base64");

describe("normalizeHash", () => {
  it("hash bcrypt thô → giữ nguyên (bỏ khoảng trắng thừa)", () => {
    expect(normalizeHash(hash)).toBe(hash);
    expect(normalizeHash(`  ${hash}\n`)).toBe(hash);
  });

  it("hash dạng base64 → giải mã ra bcrypt", () => {
    expect(base64).not.toContain("$");
    expect(normalizeHash(base64)).toBe(hash);
  });

  it("rỗng, undefined hoặc chuỗi rác → chuỗi rỗng", () => {
    expect(normalizeHash("")).toBe("");
    expect(normalizeHash(undefined)).toBe("");
    expect(normalizeHash("khong-phai-hash")).toBe("");
  });
});

describe("verifyPassword", () => {
  it("trả true khi mật khẩu đúng", async () => {
    expect(await verifyPassword("dung-mat-khau", hash)).toBe(true);
  });

  it("trả false khi mật khẩu sai", async () => {
    expect(await verifyPassword("sai", hash)).toBe(false);
  });

  it("trả false khi hash rỗng hoặc không hợp lệ", async () => {
    expect(await verifyPassword("dung-mat-khau", "")).toBe(false);
    expect(await verifyPassword("dung-mat-khau", "khong-phai-bcrypt")).toBe(false);
  });

  it("trả false khi mật khẩu rỗng", async () => {
    expect(await verifyPassword("", hash)).toBe(false);
  });
});
