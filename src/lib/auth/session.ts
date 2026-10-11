import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "rp_session";
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 32;

function key(secret: string) {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SESSION_SECRET phải có ít nhất ${MIN_SECRET_LENGTH} ký tự`);
  }
  return new TextEncoder().encode(secret);
}

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET ?? "";
}

export async function createSession(username: string, secret: string): Promise<string> {
  return new SignJWT({ sub: username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(key(secret));
}

export async function verifySession(
  token: string | undefined,
  secret: string,
): Promise<{ username: string } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(secret), { algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? { username: payload.sub } : null;
  } catch {
    return null;
  }
}
