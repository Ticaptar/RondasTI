"use client";

import { startTransition, useDeferredValue, useEffect, useState } from "react";
import { AppTopbar } from "@/components/app-topbar";
import { AuditTimeline } from "@/components/audit-timeline";
import { GestorChecklistAdmin } from "@/components/gestor-checklist-admin";
import { RouteMap } from "@/components/route-map";
import { StatusChip } from "@/components/status-chip";
import { useSessionGuard } from "@/lib/use-session-guard";
import { formatDateTime, formatMinutesDuration } from "@/lib/format";
import type { AuditLog, DashboardSnapshot, Ronda } from "@/lib/types";

type DetailResponse = {
  ronda: Ronda;
  auditLogs: AuditLog[];
};

export default function GestorPage() {
  const { user, loading: sessionLoading } = useSessionGuard("gestor");
  const [dashboard, setDashboard] = useState<DashboardSnapshot | null>(null);
  const [selectedRondaId, setSelectedRondaId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<DetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const deferredFilter = useDeferredValue(filter);

  async function loadDashboard() {
    const res = await fetch("/api/dashboard", { cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao carregar dashboard");
    }
    const body = (await res.json()) as DashboardSnapshot;
    setDashboard(body);
    if (!selectedRondaId && body.rondas[0]) {
      setSelectedRondaId(body.rondas[0].id);
    }
  }

  async function loadDetail(rondaId: string) {
    const res = await fetch(`/api/rondas/${rondaId}`, { cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Falha ao carregar detalhe");
    }
    const body = (await res.json()) as DetailResponse;
    setSelectedDetail(body);
  }

  async function poll() {
    loadDashboard()
      .then(() => (selectedRondaId ? loadDetail(selectedRondaId) : undefined))
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    if (!user) return;
    poll();
    const timer = window.setInterval(() => poll(), 15000);
    return () => window.clearInterval(timer);
  }, [user, selectedRondaId]);

  useEffect(() => {
    if (!user || !selectedRondaId) return;
    loadDetail(selectedRondaId).catch((err: Error) => setError(err.message));
  }, [selectedRondaId, user]);

  const rondasFiltradas =
    dashboard?.rondas.filter((r) => {
      const search = deferredFilter.trim().toLowerCase();
      if (!search) return true;
      return `${r.id} ${r.analistaNome} ${r.status}`.toLowerCase().includes(search);
    }) ?? [];

  const incidentesDaSelecionada = selectedDetail?.ronda.respostas.filter((rsp) => rsp.status === "incidente") ?? [];

  return (
    <main className="rf-page">
      <AppTopbar user={user} />

      <section className="rf-hero">
        <p className="rf-section-title">Painel do Gestor</p>
        <h1 className="rf-title">Acompanhamento de rondas, incidentes e auditoria</h1>
        <p className="rf-subtitle">
          Visão em tempo real das rondas abertas, histórico, evidências fotográficas e trajeto de localização.
        </p>
        <div className="rf-actions" style={{ marginTop: 14 }}>
          <button className="rf-btn primary" onClick={() => poll()}>
            Atualizar painel
          </button>
          <input
            className="rf-input"
            style={{ width: 280 }}
            placeholder="Filtrar por ID, analista ou status"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {error && <span className="rf-chip incidente">{error}</span>}
          {sessionLoading && <span className="rf-chip">Validando sessão...</span>}
        </div>
      </section>

      {dashboard && (
        <section className="rf-kpi-grid" style={{ marginTop: 14 }}>
          <div className="rf-kpi">
            <span>Rondas hoje</span>
            <strong>{dashboard.metricas.rondasHoje}</strong>
          </div>
          <div className="rf-kpi">
            <span>Rondas abertas</span>
            <strong>{dashboard.metricas.rondasAbertas}</strong>
          </div>
          <div className="rf-kpi">
            <span>Incidentes hoje</span>
            <strong>{dashboard.metricas.incidentesHoje}</strong>
          </div>
          <div className="rf-kpi">
            <span>Média de duração (hoje)</span>
            <strong>{dashboard.metricas.mediaDuracaoMinutosRondasFinalizadasHoje} min</strong>
          </div>
          <div className="rf-kpi">
            <span>Pings de localização (hoje)</span>
            <strong>{dashboard.metricas.totalPingsHoje}</strong>
          </div>
        </section>
      )}

      <section className="rf-grid cols-2" style={{ marginTop: 14 }}>
        <article className="rf-card">
          <div className="rf-row wrap" style={{ marginBottom: 10 }}>
            <h2 style={{ margin: 0 }}>Rondas</h2>
            <span className="rf-muted">{rondasFiltradas.length} registros</span>
          </div>
          {!dashboard ? (
            <div className="rf-empty">Carregando painel...</div>
          ) : rondasFiltradas.length === 0 ? (
            <div className="rf-empty">Nenhuma ronda encontrada para o filtro informado.</div>
          ) : (
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Analista</th>
                    <th>Status</th>
                    <th>Início</th>
                    <th>Progresso</th>
                    <th>Incidentes</th>
                    <th>Rota</th>
                  </tr>
                </thead>
                <tbody>
                  {rondasFiltradas.map((ronda) => (
                    <tr
                      key={ronda.id}
                      style={{
                        background: selectedRondaId === ronda.id ? "rgba(104,180,255,0.06)" : "transparent",
                        cursor: "pointer"
                      }}
                      onClick={() =>
                        startTransition(() => {
                          setSelectedRondaId(ronda.id);
                        })
                      }
                    >
                      <td className="rf-mono">{ronda.id}</td>
                      <td>{ronda.analistaNome}</td>
                      <td>
                        <StatusChip status={ronda.status} />
                      </td>
                      <td>{formatDateTime(ronda.iniciadaEm)}</td>
                      <td>{ronda.percentualConcluido}%</td>
                      <td>{ronda.itensIncidente}</td>
                      <td>{ronda.totalPingsLocalizacao} pts</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="rf-grid" style={{ gap: 14 }}>
          <div className="rf-card">
            <div className="rf-row wrap">
              <h2 style={{ margin: 0 }}>Detalhe da ronda selecionada</h2>
              {selectedDetail && <StatusChip status={selectedDetail.ronda.status} />}
            </div>
            {!selectedDetail ? (
              <div className="rf-empty" style={{ marginTop: 10 }}>
                Selecione uma ronda para visualizar.
              </div>
            ) : (
              <div className="rf-list" style={{ marginTop: 10 }}>
                <div className="rf-row wrap">
                  <span className="rf-mono">{selectedDetail.ronda.id}</span>
                  <span className="rf-muted">{selectedDetail.ronda.analistaNome}</span>
                </div>
                <div className="rf-muted">Início: {formatDateTime(selectedDetail.ronda.iniciadaEm)}</div>
                <div className="rf-muted">Fim: {formatDateTime(selectedDetail.ronda.finalizadaEm)}</div>
                <div className="rf-muted">
                  Duração: {formatMinutesDuration(selectedDetail.ronda.iniciadaEm, selectedDetail.ronda.finalizadaEm)}
                </div>
                <div className="rf-muted">Observação geral: {selectedDetail.ronda.observacaoGeral || "Sem observação."}</div>
              </div>
            )}
          </div>

          <div className="rf-card">
            <RouteMap
              points={selectedDetail?.ronda.localizacoes ?? []}
              title={selectedDetail ? `Trajeto da ${selectedDetail.ronda.id}` : "Trajeto"}
            />
          </div>
        </article>
      </section>

      <GestorChecklistAdmin onRondaCriada={() => poll().catch(() => undefined)} />

      <section className="rf-grid cols-2" style={{ marginTop: 14 }}>
        <article className="rf-card">
          <div className="rf-row wrap" style={{ marginBottom: 8 }}>
            <h2 style={{ margin: 0 }}>Incidentes da ronda selecionada</h2>
            {selectedDetail && <span className="rf-badge">{incidentesDaSelecionada.length} incidentes</span>}
          </div>
          {!selectedDetail ? (
            <div className="rf-empty">Selecione uma ronda para ver incidentes.</div>
          ) : incidentesDaSelecionada.length === 0 ? (
            <div className="rf-empty">Nenhum incidente registrado nesta ronda.</div>
          ) : (
            <div className="rf-list">
              {incidentesDaSelecionada.map((item) => (
                <div className="rf-check-item" key={item.id}>
                  <div className="rf-row wrap">
                    <strong>{item.titulo}</strong>
                    <StatusChip status={item.status} />
                  </div>
                  <p className="rf-muted" style={{ margin: "6px 0" }}>
                    {item.descricao}
                  </p>
                  <p style={{ margin: "0 0 6px" }}>{item.observacao || "Sem observação."}</p>
                  <p className="rf-muted" style={{ margin: 0 }}>
                    Respondido em {formatDateTime(item.respondidoEm)} • Fotos: {item.fotos.length}
                  </p>
                  {item.fotos.length > 0 && (
                    <div className="rf-photo-grid">
                      {item.fotos.map((foto) => (
                        <div className="rf-photo-card" key={foto.id}>
                          <img src={foto.dataUrl} alt={foto.nomeArquivo} />
                          <p>{foto.nomeArquivo}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="rf-card">
          <h2 style={{ marginTop: 0 }}>Auditoria recente</h2>
          <AuditTimeline logs={selectedDetail?.auditLogs ?? dashboard?.auditoriaRecente ?? []} />
        </article>
      </section>
    </main>
  );
}
