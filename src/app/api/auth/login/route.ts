import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeHash, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  getSessionSecret,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/auth/session";

const bodySchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const INVALID = "Sai tên đăng nhập hoặc mật khẩu";

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Vui lòng nhập tên đăng nhập và mật khẩu" }, { status: 400 });
  }

  const { username, password } = parsed.data;
  const expectedUser = process.env.ADMIN_USERNAME ?? "";
  const hash = normalizeHash(process.env.ADMIN_PASSWORD_HASH);
  // Luôn chạy verifyPassword để thời gian phản hồi không lộ việc sai username
  const passwordOk = await verifyPassword(password, hash);
  if (!expectedUser || username !== expectedUser || !passwordOk) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(username, getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return res;
}
