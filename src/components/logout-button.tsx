"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={pending}
      className="rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-line/50 hover:text-ink disabled:opacity-60"
    >
      Đăng xuất
    </button>
  );
}
