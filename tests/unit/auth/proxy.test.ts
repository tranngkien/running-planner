import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { createSession, SESSION_COOKIE } from "@/lib/auth/session";

const SECRET = "test-secret-test-secret-test-secret-123";

function request(path: string, token?: string) {
  const headers = new Headers();
  if (token) headers.set("cookie", `${SESSION_COOKIE}=${token}`);
  return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("proxy (chặn khi chưa đăng nhập)", () => {
  it("trang: không có cookie → redirect /login", async () => {
    const res = await proxy(request("/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
  });

  it("API: không có cookie → 401 JSON", async () => {
    const res = await proxy(request("/api/routes/generate"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Chưa đăng nhập" });
  });

  it("cookie không hợp lệ → redirect /login", async () => {
    const res = await proxy(request("/", "rac"));
    expect(res.status).toBe(307);
  });

  it("cookie hợp lệ → cho qua", async () => {
    const token = await createSession("admin", SECRET);
    const res = await proxy(request("/", token));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("/login và /api/auth/login luôn cho qua", async () => {
    for (const path of ["/login", "/api/auth/login"]) {
      const res = await proxy(request(path));
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("đã đăng nhập mà vào /login → chuyển về trang chính", async () => {
    const token = await createSession("admin", SECRET);
    const res = await proxy(request("/login", token));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });
});
