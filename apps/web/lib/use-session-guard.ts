"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { SessionUser, UserRole } from "@/lib/types";

export function useSessionGuard(role?: UserRole) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error("unauth");
        }
        return (await res.json()) as SessionUser;
      })
      .then((me) => {
        if (cancelled) return;
        if (role && me.role !== role) {
          router.replace(me.role === "gestor" ? "/gestor" : "/analista");
          return;
        }
        setUser(me);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Sessao nao encontrada.");
        router.replace("/login");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, role]);

  return { user, loading, error };
}
