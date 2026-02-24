"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppTopbar } from "@/components/app-topbar";
import { AuditTimeline } from "@/components/audit-timeline";
import { RouteMap } from "@/components/route-map";
import { StatusChip } from "@/components/status-chip";
import { useSessionGuard } from "@/lib/use-session-guard";
import { formatDateTime } from "@/lib/format";
import type { AuditLog, ItemResposta, Ronda } from "@/lib/types";

type DetailResponse = { ronda: Ronda; auditLogs: AuditLog[] };

const ENABLE_SIMULATED_GPS = process.env.NEXT_PUBLIC_ENABLE_GPS_TEST === "true";
const MIN_GPS_INTERVAL_MS = 15000;
const MIN_GPS_MOVE_METERS = 12;
const MAX_GPS_ACCURACY_METERS = 80;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const r = 6371000;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function AnalistaRondaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rondaId = searchParams.get("id");
  const { user, loading: sessionLoading } = useSessionGuard("analista");

  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [obsGeralDraft, setObsGeralDraft] = useState("");
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [geoStatus, setGeoStatus] = useState("GPS inativo");

  const geoLastSentRef = useRef(0);
  const geoInFlightRef = useRef(false);
  const geoLastCoordsRef = useRef<{ lat: number; lng: number } | null>(null);

  async function loadDetail(showLoading = true) {
    if (!rondaId) return;
    if (showLoading) setLoading(true);
    const res = await fetch(`/api/rondas/${rondaId}`, { cache: "no-store" });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Falha ao carregar ronda.");
      setLoading(false);
      return;
    }
    const body = (await res.json()) as DetailResponse;
    setDetail(body);
    setObsGeralDraft(body.ronda.observacaoGeral ?? "");
    setDrafts(Object.fromEntries(body.ronda.respostas.map((i) => [i.id, i.observacao ?? ""])));
    setLoading(false);
  }

  useEffect(() => {
    if (!rondaId) {
      router.replace("/analista");
      return;
    }
    if (!user) return;
    loadDetail().catch(() => setError("Falha ao carregar ronda."));
  }, [rondaId, user, router]);

  async function postLocation(lat: number, lng: number, acc: number | null, origem: "gps" | "manual" | "simulada") {
    if (!rondaId || detail?.ronda.status !== "aberta" || geoInFlightRef.current) return;
    geoInFlightRef.current = true;
    try {
      const res = await fetch(`/api/rondas/${rondaId}/localizacoes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: lat, longitude: lng, precisaoMetros: acc, origem })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Falha ao registrar localizacao");
      }
      setGeoStatus(`Localização registrada (${origem})`);
      await loadDetail(false);
    } catch (err) {
      setGeoStatus("Falha ao registrar localização");
    } finally {
      geoInFlightRef.current = false;
    }
  }

  async function addManualPoint() {
    if (!("geolocation" in navigator)) {
      setGeoStatus("Navegador sem geolocalizacao");
      return;
    }

    setGeoStatus("Capturando ponto atual...");
    await new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          geoLastSentRef.current = Date.now();
          geoLastCoordsRef.current = { lat, lng };
          postLocation(lat, lng, pos.coords.accuracy ?? null, "manual")
            .catch(() => undefined)
            .finally(resolve);
        },
        (e) => {
          setGeoStatus(`GPS indisponivel: ${e.message}`);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );
    });
  }

  useEffect(() => {
    if (!gpsEnabled || !detail?.ronda || detail.ronda.status !== "aberta") return;
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setGeoStatus("GPS pode falhar sem HTTPS");
    }
    if (!("geolocation" in navigator)) {
      setGeoStatus("Navegador sem geolocalização");
      return;
    }
    setGeoStatus("Aguardando GPS...");
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        const acc = pos.coords.accuracy ?? null;
        if (typeof acc === "number" && acc > MAX_GPS_ACCURACY_METERS) {
          setGeoStatus(`GPS com baixa precisao (${Math.round(acc)}m)`);
          return;
        }
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (now - geoLastSentRef.current < MIN_GPS_INTERVAL_MS) return;
        if (geoLastCoordsRef.current) {
          const moved = distanceMeters(geoLastCoordsRef.current.lat, geoLastCoordsRef.current.lng, next.lat, next.lng);
          if (moved < MIN_GPS_MOVE_METERS) {
            setGeoStatus(`GPS parado (${Math.round(moved)}m)`);
            return;
          }
        }
        geoLastSentRef.current = now;
        geoLastCoordsRef.current = next;
        setGeoStatus("GPS monitorando...");
        postLocation(next.lat, next.lng, acc, "gps").catch(() => undefined);
      },
      (e) => setGeoStatus(`GPS indisponível: ${e.message}`),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [gpsEnabled, detail?.ronda?.id, detail?.ronda?.status]);

  async function saveItem(item: ItemResposta, status: "ok" | "incidente") {
    if (!rondaId) return;
    setSavingItemId(item.id);
    setError(null);
    const res = await fetch(`/api/rondas/${rondaId}/respostas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemRespostaId: item.id, status, observacao: drafts[item.id] ?? "" })
    });
    if (!res.ok) {
      setError("Falha ao salvar item.");
    } else {
      await loadDetail(false);
    }
    setSavingItemId(null);
  }

  async function saveObsGeral() {
    if (!rondaId) return;
    const res = await fetch(`/api/rondas/${rondaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ observacaoGeral: obsGeralDraft })
    });
    if (!res.ok) {
      setError("Falha ao salvar observação geral.");
      return;
    }
    await loadDetail(false);
  }

  async function finishRonda() {
    if (!rondaId) return;
    setFinishing(true);
    const res = await fetch(`/api/rondas/${rondaId}/finalizar`, { method: "POST" });
    if (!res.ok) {
      setError("Falha ao finalizar ronda.");
      setFinishing(false);
      return;
    }
    await loadDetail(false);
    setFinishing(false);
  }

  async function addSimulatedPoint() {
    const count = detail?.ronda.localizacoes.length ?? 0;
    await postLocation(-23.55052 + count * 0.00014, -46.633308 + (count % 2 ? 0.0002 : 0.0001), 10 + count, "simulada");
  }

  async function handlePhotoUpload(itemId: string, files: FileList | null) {
    if (!rondaId || !files || files.length === 0) return;
    setUploadingItemId(itemId);
    try {
      for (const file of Array.from(files)) {
        const dataUrl = await fileToDataUrl(file);
        const res = await fetch(`/api/rondas/${rondaId}/fotos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemRespostaId: itemId, nomeArquivo: file.name, dataUrl })
        });
        if (!res.ok) throw new Error();
      }
      await loadDetail(false);
    } catch {
      setError("Falha ao enviar fotos.");
    } finally {
      setUploadingItemId(null);
    }
  }

  if (!rondaId) return null;

  const ronda = detail?.ronda;
  const auditLogs = detail?.auditLogs ?? [];
  const totalFotos = ronda?.respostas.reduce((acc, i) => acc + i.fotos.length, 0) ?? 0;

  return (
    <main className="rf-page">
      <AppTopbar user={user} />

      <div className="rf-actions" style={{ marginBottom: 12 }}>
        <Link href="/analista" className="rf-btn">
          Voltar
        </Link>
        <button className={`rf-btn ${gpsEnabled ? "warn" : ""}`} onClick={() => setGpsEnabled((v) => !v)}>
          {gpsEnabled ? "Pausar GPS" : "Ativar GPS"}
        </button>
        <button className="rf-btn" onClick={() => addManualPoint().catch(() => setError("Falha ao capturar ponto."))}>
          Registrar ponto agora
        </button>
        {ENABLE_SIMULATED_GPS && (
          <button className="rf-btn" onClick={() => addSimulatedPoint().catch(() => setError("Falha ao gerar ponto."))}>
            Ponto de teste (simulado)
          </button>
        )}
        <span className="rf-chip">{geoStatus}</span>
        {error && <span className="rf-chip incidente">{error}</span>}
      </div>

      {sessionLoading || loading || !ronda ? (
        <section className="rf-card">
          <div className="rf-empty">Carregando ronda...</div>
        </section>
      ) : (
        <>
          <section className="rf-hero">
            <div className="rf-row wrap">
              <div>
                <p className="rf-section-title">Ronda</p>
                <h1 className="rf-title">{ronda.templateNome}</h1>
                <p className="rf-subtitle">
                  <span className="rf-mono">{ronda.id}</span> • Iniciada em {formatDateTime(ronda.iniciadaEm)}
                </p>
              </div>
              <div className="rf-actions">
                <StatusChip status={ronda.status} />
                <button className="rf-btn" onClick={() => loadDetail().catch(() => undefined)}>
                  Atualizar
                </button>
                <button className="rf-btn success" onClick={() => saveObsGeral().catch(() => undefined)} disabled={ronda.status !== "aberta"}>
                  Salvar resumo
                </button>
                <button className="rf-btn danger" onClick={() => finishRonda().catch(() => undefined)} disabled={ronda.status !== "aberta" || finishing}>
                  {finishing ? "Finalizando..." : "Finalizar"}
                </button>
              </div>
            </div>

            <div className="rf-kpi-grid" style={{ marginTop: 12 }}>
              <div className="rf-kpi">
                <span>Total de itens</span>
                <strong>{ronda.respostas.length}</strong>
              </div>
              <div className="rf-kpi">
                <span>OK</span>
                <strong>{ronda.respostas.filter((r) => r.status === "ok").length}</strong>
              </div>
              <div className="rf-kpi">
                <span>Incidentes</span>
                <strong>{ronda.respostas.filter((r) => r.status === "incidente").length}</strong>
              </div>
              <div className="rf-kpi">
                <span>Fotos</span>
                <strong>{totalFotos}</strong>
              </div>
              <div className="rf-kpi">
                <span>Pings GPS</span>
                <strong>{ronda.localizacoes.length}</strong>
              </div>
            </div>
          </section>

          <section className="rf-grid cols-2" style={{ marginTop: 14 }}>
            <article className="rf-card">
              <h2 style={{ marginTop: 0 }}>Checklist</h2>
              <div className="rf-list">
                {ronda.setoresPlanejados.map((setor) => {
                  const itens = ronda.respostas.filter((i) => i.setorId === setor.id);
                  return (
                    <div className="rf-card tight" key={setor.id}>
                      <div className="rf-row wrap">
                        <div>
                          <strong>{setor.nome}</strong>
                          <div className="rf-muted" style={{ fontSize: "0.84rem" }}>
                            {setor.checkpointHint}
                          </div>
                        </div>
                        <span className="rf-badge">
                          {itens.filter((i) => i.status !== "pendente").length}/{itens.length}
                        </span>
                      </div>

                      <div className="rf-list" style={{ marginTop: 8 }}>
                        {itens.map((item) => (
                          <div className="rf-check-item" key={item.id}>
                            <div className="rf-row wrap">
                              <div>
                                <strong>{item.titulo}</strong>
                                <p className="rf-muted" style={{ margin: "4px 0 0" }}>
                                  {item.descricao}
                                </p>
                              </div>
                              <StatusChip status={item.status} />
                            </div>

                            <label className="rf-label" style={{ marginTop: 8 }}>
                              Observação
                              <textarea
                                className="rf-textarea"
                                value={drafts[item.id] ?? ""}
                                disabled={ronda.status !== "aberta"}
                                onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                              />
                            </label>

                            <div className="rf-check-actions">
                              <button className="rf-btn success" disabled={ronda.status !== "aberta" || savingItemId === item.id} onClick={() => saveItem(item, "ok").catch(() => undefined)}>
                                {savingItemId === item.id ? "Salvando..." : "Marcar OK"}
                              </button>
                              <button className="rf-btn danger" disabled={ronda.status !== "aberta" || savingItemId === item.id} onClick={() => saveItem(item, "incidente").catch(() => undefined)}>
                                {savingItemId === item.id ? "Salvando..." : "Marcar Incidente"}
                              </button>
                              <label className="rf-btn" style={{ cursor: ronda.status !== "aberta" ? "not-allowed" : "pointer" }}>
                                {uploadingItemId === item.id ? "Enviando..." : "Foto"}
                                <input
                                  hidden
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  disabled={ronda.status !== "aberta" || uploadingItemId === item.id}
                                  onChange={(e) => handlePhotoUpload(item.id, e.target.files).catch(() => undefined)}
                                />
                              </label>
                            </div>

                            {item.respondidoEm && (
                              <p className="rf-muted" style={{ marginBottom: 0 }}>
                                Respondido em {formatDateTime(item.respondidoEm)}
                              </p>
                            )}

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
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="rf-grid" style={{ gap: 14 }}>
              <div className="rf-card">
                <h2 style={{ marginTop: 0 }}>Observação geral</h2>
                <label className="rf-label">
                  Resumo final / pendências
                  <textarea
                    className="rf-textarea"
                    value={obsGeralDraft}
                    disabled={ronda.status !== "aberta"}
                    onChange={(e) => setObsGeralDraft(e.target.value)}
                  />
                </label>
                {ronda.finalizadaEm && <p className="rf-muted">Finalizada em {formatDateTime(ronda.finalizadaEm)}</p>}
              </div>

              <div className="rf-card">
                <RouteMap points={ronda.localizacoes} title="Trajeto da ronda" />
              </div>

              <div className="rf-card">
                <h2 style={{ marginTop: 0 }}>Auditoria</h2>
                <AuditTimeline logs={auditLogs} />
              </div>
            </article>
          </section>
        </>
      )}
    </main>
  );
}

export default function AnalistaRondaPage() {
  return (
    <Suspense
      fallback={
        <main className="rf-page">
          <section className="rf-card">
            <div className="rf-empty">Carregando tela da ronda...</div>
          </section>
        </main>
      }
    >
      <AnalistaRondaContent />
    </Suspense>
  );
}
