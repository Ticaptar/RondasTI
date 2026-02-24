"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import type { UserRole } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>("analista");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as { role: UserRole };
      })
      .then((me) => {
        if (!me) return;
        router.replace(me.role === "gestor" ? "/gestor" : "/analista");
      })
      .catch(() => undefined);
  }, [router]);

  async function submitLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, role })
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Falha no login.");
      setLoading(false);
      return;
    }

    router.replace(role === "gestor" ? "/gestor" : "/analista");
  }

  return (
    <main className="rf-page">
      <AppTopbar user={null} />

      <div className="rf-auth-stage">
        <section className="rf-hero rf-auth-panel">
          <p className="rf-section-title">Acesso</p>
          <h1 className="rf-title">Entrar no RondaFlow</h1>
          <p className="rf-subtitle">Informe seu usuario e selecione o perfil para entrar no sistema.</p>

          <form onSubmit={submitLogin} className="rf-grid rf-auth-form">
            <label className="rf-label">
              Perfil
              <select className="rf-select" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>
                <option value="analista">Analista TI</option>
                <option value="gestor">Gestor</option>
              </select>
            </label>

            <label className="rf-label">
              Usuario
              <input
                className="rf-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite seu usuario"
                autoComplete="username"
                autoFocus
              />
            </label>

            <div className="rf-actions rf-auth-actions">
              <button className="rf-btn primary" type="submit" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </div>

            <span className="rf-muted rf-auth-note">Login interno</span>
            {error && <span className="rf-chip incidente">{error}</span>}
          </form>
        </section>
      </div>
    </main>
  );
}
