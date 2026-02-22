"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { StatusChip } from "@/components/status-chip";
import { useSessionGuard } from "@/lib/use-session-guard";
import { formatDateTime, formatMinutesDuration } from "@/lib/format";
import type { RondaResumo } from "@/lib/types";

export default function AnalistaHomePage() {
  const router = useRouter();
  const { user, loading } = useSessionGuard("analista");
  const [rondas, setRondas] = useState<RondaResumo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadRondas() {
    setRefreshing(true);
    const res = await fetch("/api/rondas", { cache: "no-store" });
    if (!res.ok) {
      setError("Falha ao carregar rondas.");
      setRefreshing(false);
      return;
    }
    const body = (await res.json()) as { rondas: RondaResumo[] };
    setRondas(body.rondas);
    setRefreshing(false);
  }

  useEffect(() => {
    if (!user) return;
    loadRondas().catch(() => setError("Falha ao carregar dados."));
    const timer = window.setInterval(() => {
      loadRondas().catch(() => undefined);
    }, 20000);
    return () => window.clearInterval(timer);
  }, [user]);

  async function iniciarRonda() {
    setStarting(true);
    setError(null);
    const res = await fetch("/api/rondas", { method: "POST" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Falha ao iniciar ronda.");
      setStarting(false);
      return;
    }
    const body = (await res.json()) as { ronda: { id: string } };
    startTransition(() => {
      router.push(`/analista/ronda?id=${body.ronda.id}`);
    });
  }

  const rondaAberta = rondas.find((r) => r.status === "aberta");

  return (
    <main className="rf-page">
      <AppTopbar user={user} />

      <section className="rf-hero">
        <p className="rf-section-title">Área do Analista</p>
        <h1 className="rf-title">Execução da ronda diária</h1>
        <p className="rf-subtitle">
          Inicie uma ronda, registre checklist por setor, fotos, localização e finalize com observação geral.
        </p>
        <div className="rf-actions" style={{ marginTop: 14 }}>
          <button className="rf-btn primary" onClick={iniciarRonda} disabled={loading || starting}>
            {starting ? "Iniciando..." : rondaAberta ? "Continuar ronda aberta" : "Iniciar nova ronda"}
          </button>
          {rondaAberta && (
            <Link className="rf-btn" href={`/analista/ronda?id=${rondaAberta.id}`}>
              Abrir ronda atual
            </Link>
          )}
          <button className="rf-btn" onClick={() => loadRondas().catch(() => undefined)} disabled={refreshing}>
            {refreshing ? "Atualizando..." : "Atualizar"}
          </button>
          {error && <span className="rf-chip incidente">{error}</span>}
        </div>
      </section>

      <section className="rf-grid cols-3" style={{ marginTop: 14 }}>
        <div className="rf-kpi">
          <span>Rondas totais</span>
          <strong>{rondas.length}</strong>
        </div>
        <div className="rf-kpi">
          <span>Rondas abertas</span>
          <strong>{rondas.filter((r) => r.status === "aberta").length}</strong>
        </div>
        <div className="rf-kpi">
          <span>Incidentes em aberto</span>
          <strong>{rondas.reduce((acc, r) => acc + r.incidentesAbertos, 0)}</strong>
        </div>
      </section>

      <section className="rf-card" style={{ marginTop: 14 }}>
        <div className="rf-row wrap" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>Histórico de rondas</h2>
          <span className="rf-muted">{refreshing ? "Sincronizando..." : "Dados do banco"}</span>
        </div>

        {rondas.length === 0 ? (
          <div className="rf-empty">Nenhuma ronda registrada ainda para este analista.</div>
        ) : (
          <div className="rf-table-wrap">
            <table className="rf-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Início</th>
                  <th>Fim</th>
                  <th>Progresso</th>
                  <th>Incidentes</th>
                  <th>Fotos</th>
                  <th>Localização</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rondas.map((ronda) => (
                  <tr key={ronda.id}>
                    <td className="rf-mono">{ronda.id}</td>
                    <td>
                      <StatusChip status={ronda.status} />
                    </td>
                    <td>{formatDateTime(ronda.iniciadaEm)}</td>
                    <td>{formatDateTime(ronda.finalizadaEm)}</td>
                    <td>{ronda.percentualConcluido}%</td>
                    <td>{ronda.itensIncidente}</td>
                    <td>{ronda.totalFotos}</td>
                    <td>{ronda.totalPingsLocalizacao} pings</td>
                    <td>
                      <div className="rf-actions">
                        <Link className="rf-btn" href={`/analista/ronda?id=${ronda.id}`}>
                          Abrir
                        </Link>
                        {ronda.finalizadaEm && (
                          <span className="rf-muted">{formatMinutesDuration(ronda.iniciadaEm, ronda.finalizadaEm)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
