"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { SessionUser } from "@/lib/types";

export function AppTopbar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    router.replace("/login");
  }

  return (
    <div className="rf-topbar">
      <div className="rf-brand">
        <span className="rf-brand-dot" />
        <div>
          <h2>RondaFlow</h2>
          <small>{user ? `${user.nome} (${user.role})` : "Checklist auditado de ronda TI"}</small>
        </div>
      </div>
      <div className="rf-actions">
        <nav className="rf-pill-nav" aria-label="Navegação principal">
          <Link className={`rf-pill-link ${pathname === "/" ? "active" : ""}`} href="/">
            Início
          </Link>
          <Link className={`rf-pill-link ${pathname.startsWith("/analista") ? "active" : ""}`} href="/analista">
            Analista
          </Link>
          <Link className={`rf-pill-link ${pathname.startsWith("/gestor") ? "active" : ""}`} href="/gestor">
            Gestor
          </Link>
        </nav>
        {user && (
          <button className="rf-btn" onClick={logout}>
            Sair
          </button>
        )}
      </div>
    </div>
  );
}
