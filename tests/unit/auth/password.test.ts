import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { verifyPassword } from "@/lib/auth/password";

const hash = bcrypt.hashSync("dung-mat-khau", 4);

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
