import { beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

const SECRET = "test-secret-test-secret-test-secret-123";

function req(body: unknown) {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function cookieValue(res: Response, name: string) {
  const header = res.headers.get("set-cookie") ?? "";
  const match = header.match(new RegExp(`${name}=([^;]*)`));
  return { header, value: match?.[1] };
}

beforeEach(() => {
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("dung-mat-khau", 4);
  process.env.SESSION_SECRET = SECRET;
});

describe("POST /api/auth/login", () => {
  it("đăng nhập đúng → 200 và set cookie phiên httpOnly", async () => {
    const res = await login(req({ username: "admin", password: "dung-mat-khau" }));
    expect(res.status).toBe(200);
    const { header, value } = cookieValue(res, SESSION_COOKIE);
    expect(header.toLowerCase()).toContain("httponly");
    expect(await verifySession(value, SECRET)).toEqual({ username: "admin" });
  });

  it("sai mật khẩu → 401 với thông báo chung", async () => {
    const res = await login(req({ username: "admin", password: "sai" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sai tên đăng nhập hoặc mật khẩu" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("sai tên đăng nhập → 401 với cùng thông báo", async () => {
    const res = await login(req({ username: "khac", password: "dung-mat-khau" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sai tên đăng nhập hoặc mật khẩu" });
  });

  it("thiếu trường hoặc body không phải JSON → 400", async () => {
    expect((await login(req({ username: "admin" }))).status).toBe(400);
    expect((await login(req("khong-phai-json"))).status).toBe(400);
  });

  it("chưa cấu hình ADMIN_PASSWORD_HASH → 401, không cho đăng nhập", async () => {
    process.env.ADMIN_PASSWORD_HASH = "";
    const res = await login(req({ username: "admin", password: "" }));
    expect(res.status).not.toBe(200);
  });
});

describe("POST /api/auth/logout", () => {
  it("xoá cookie phiên", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
    const { header, value } = cookieValue(res, SESSION_COOKIE);
    expect(value).toBe("");
    expect(header).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/i);
  });
});
