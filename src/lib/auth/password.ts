import bcrypt from "bcryptjs";

const BCRYPT_PREFIX = /^\$2[aby]\$/;

/**
 * Nhận hash bcrypt dạng thô (`$2b$…`) hoặc mã hoá base64.
 * Base64 tránh ký tự `$`, vốn bị Next diễn giải thành biến khi có file `.env*`.
 */
export function normalizeHash(value: string | undefined): string {
  const v = value?.trim() ?? "";
  if (BCRYPT_PREFIX.test(v)) return v;
  if (!v) return "";
  const decoded = Buffer.from(v, "base64").toString("utf8").trim();
  return BCRYPT_PREFIX.test(decoded) ? decoded : "";
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}
