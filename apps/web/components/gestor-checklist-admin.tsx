"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { ChecklistModeloItemInput, ChecklistModeloResumo, Setor, User } from "@/lib/types";

type DraftItem = ChecklistModeloItemInput & { id: string };

function genDraftId() {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function newDraftItem(ordem: number, setorId = ""): DraftItem {
  return {
    id: genDraftId(),
    setorId,
    titulo: "",
    descricao: "",
    obrigatorioFotoIncidente: false,
    ordem
  };
}

export function GestorChecklistAdmin({ onRondaCriada }: { onRondaCriada?: () => void }) {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [modelos, setModelos] = useState<ChecklistModeloResumo[]>([]);
  const [analistas, setAnalistas] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [modeloNome, setModeloNome] = useState("");
  const [modeloSetorId, setModeloSetorId] = useState("");
  const [itens, setItens] = useState<DraftItem[]>([]);
  const [savingModel, setSavingModel] = useState(false);

  const [novoSetorNome, setNovoSetorNome] = useState("");
  const [novoSetorOrdem, setNovoSetorOrdem] = useState<number>(1);
  const [novoSetorHint, setNovoSetorHint] = useState("");
  const [savingSetor, setSavingSetor] = useState(false);

  const [analistaId, setAnalistaId] = useState("");
  const [modeloSelecionadoId, setModeloSelecionadoId] = useState("");
  const [creatingRonda, setCreatingRonda] = useState(false);

  async function loadData() {
    setLoading(true);
    setError(null);

    const [setoresRes, modelosRes, usuariosRes] = await Promise.all([
      fetch("/api/setores", { cache: "no-store" }),
      fetch("/api/checklist-modelos", { cache: "no-store" }),
      fetch("/api/usuarios?perfil=analista", { cache: "no-store" })
    ]);

    if (!setoresRes.ok || !modelosRes.ok || !usuariosRes.ok) {
      throw new Error("Falha ao carregar dados de configuração do gestor.");
    }

    const setoresBody = (await setoresRes.json()) as { setores: Setor[] };
    const modelosBody = (await modelosRes.json()) as { modelos: ChecklistModeloResumo[] };
    const usuariosBody = (await usuariosRes.json()) as { usuarios: User[] };

    setSetores(setoresBody.setores);
    setModelos(modelosBody.modelos);
    setAnalistas(usuariosBody.usuarios);

    if (!analistaId && usuariosBody.usuarios[0]) {
      setAnalistaId(usuariosBody.usuarios[0].id);
    }
    if (!modeloSelecionadoId) {
      const primeiroAtivo = modelosBody.modelos.find((m) => m.ativo);
      if (primeiroAtivo) setModeloSelecionadoId(primeiroAtivo.id);
    }
    if (!modeloSetorId && setoresBody.setores[0]) {
      setModeloSetorId(setoresBody.setores[0].id);
    }

    setItens((prev) => {
      if (prev.length > 0) return prev;
      return [newDraftItem(1, setoresBody.setores[0]?.id ?? "")];
    });

    if (setoresBody.setores.length > 0) {
      const nextOrder = Math.max(...setoresBody.setores.map((s) => s.ordem)) + 1;
      setNovoSetorOrdem(Number.isFinite(nextOrder) ? nextOrder : 1);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadData().catch((e: Error) => {
      setError(e.message);
      setLoading(false);
    });
  }, []);

  function reindex(next: DraftItem[]) {
    return next.map((item, idx) => ({ ...item, ordem: idx + 1 }));
  }

  function trocarSetorDoChecklist(setorId: string) {
    setModeloSetorId(setorId);
    setItens((prev) => reindex(prev.map((item) => ({ ...item, setorId }))));
  }

  function addItem() {
    const setorId = modeloSetorId || setores[0]?.id || "";
    setItens((prev) => reindex([...prev, newDraftItem(prev.length + 1, setorId)]));
  }

  function duplicateItem(itemId: string) {
    setItens((prev) => {
      const target = prev.find((item) => item.id === itemId);
      if (!target) return prev;
      return reindex([
        ...prev,
        {
          ...target,
          id: genDraftId(),
          titulo: target.titulo ? `${target.titulo} (cópia)` : ""
        }
      ]);
    });
  }

  function removeItem(itemId: string) {
    setItens((prev) => reindex(prev.filter((item) => item.id !== itemId)));
  }

  function updateItem(itemId: string, patch: Partial<DraftItem>) {
    setItens((prev) => reindex(prev.map((item) => (item.id === itemId ? { ...item, ...patch } : item))));
  }

  async function salvarModelo() {
    if (!modeloSetorId) {
      setError("Selecione o setor do checklist.");
      return;
    }

    setSavingModel(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/checklist-modelos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: modeloNome,
        itens: itens.map(({ id, ...item }) => ({ ...item, setorId: modeloSetorId }))
      })
    });

    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "Falha ao criar modelo.");
      setSavingModel(false);
      return;
    }

    setSuccess("Modelo criado com sucesso.");
    setModeloNome("");
    setItens([newDraftItem(1, modeloSetorId)]);
    await loadData().catch(() => undefined);
    setSavingModel(false);
  }

  async function salvarSetor() {
    setSavingSetor(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/setores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: novoSetorNome,
        ordem: Number(novoSetorOrdem),
        checkpointHint: novoSetorHint
      })
    });
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    if (!res.ok) {
      setError(body?.error ?? "Falha ao criar setor.");
      setSavingSetor(false);
      return;
    }

    setSuccess("Setor criado com sucesso.");
    setNovoSetorNome("");
    setNovoSetorHint("");
    await loadData().catch(() => undefined);
    setSavingSetor(false);
  }

  async function criarRonda() {
    if (!analistaId || !modeloSelecionadoId) {
      setError("Selecione analista e modelo.");
      return;
    }

    setCreatingRonda(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/gestao/rondas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analistaId, checklistModeloId: modeloSelecionadoId })
    });
    const body = (await res.json().catch(() => null)) as { error?: string; ronda?: { id: string } } | null;
    if (!res.ok) {
      setError(body?.error ?? "Falha ao criar ronda.");
      setCreatingRonda(false);
      return;
    }

    setSuccess(`Ronda criada: ${body?.ronda?.id ?? ""}`);
    onRondaCriada?.();
    setCreatingRonda(false);
  }

  const modelosAtivos = modelos.filter((m) => m.ativo);
  const setorChecklistAtual = setores.find((s) => s.id === modeloSetorId) ?? null;
  const itensDoChecklist = itens
    .filter((item) => item.setorId === (modeloSetorId || item.setorId))
    .slice()
    .sort((a, b) => a.ordem - b.ordem);

  return (
    <section className="rf-grid cols-2" style={{ marginTop: 14 }}>
      <article className="rf-card">
        <div className="rf-row wrap" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Criar Ronda para Analista</h2>
          <span className="rf-muted">Gestor inicia checklist no banco</span>
        </div>

        {loading ? (
          <div className="rf-empty">Carregando configurações...</div>
        ) : (
          <div className="rf-grid" style={{ gap: 10 }}>
            <label className="rf-label">
              Analista
              <select className="rf-select" value={analistaId} onChange={(e) => setAnalistaId(e.target.value)}>
                <option value="">Selecione</option>
                {analistas.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome} ({u.username})
                  </option>
                ))}
              </select>
            </label>

            <label className="rf-label">
              Modelo de checklist
              <select
                className="rf-select"
                value={modeloSelecionadoId}
                onChange={(e) => setModeloSelecionadoId(e.target.value)}
              >
                <option value="">Selecione</option>
                {modelosAtivos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome} v{m.versao} ({m.totalItens} itens)
                  </option>
                ))}
              </select>
            </label>

            <div className="rf-actions">
              <button
                className="rf-btn primary"
                onClick={() => criarRonda().catch(() => undefined)}
                disabled={creatingRonda}
              >
                {creatingRonda ? "Criando..." : "Criar ronda"}
              </button>
              <button className="rf-btn" onClick={() => loadData().catch(() => undefined)}>
                Atualizar listas
              </button>
            </div>
          </div>
        )}

        {(error || success) && (
          <div className="rf-actions" style={{ marginTop: 10 }}>
            {error && <span className="rf-chip incidente">{error}</span>}
            {success && <span className="rf-chip ok">{success}</span>}
          </div>
        )}
      </article>

      <article className="rf-card">
        <div className="rf-row wrap" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Modelos de Checklist</h2>
          <span className="rf-muted">{modelos.length} modelos</span>
        </div>

        <div className="rf-card tight" style={{ marginBottom: 10 }}>
          <div className="rf-row wrap" style={{ marginBottom: 8 }}>
            <strong>Criar Setor</strong>
            <span className="rf-muted">{setores.length} setores ativos</span>
          </div>
          <div className="rf-grid cols-2" style={{ gap: 8 }}>
            <label className="rf-label">
              Nome
              <input
                className="rf-input"
                value={novoSetorNome}
                onChange={(e) => setNovoSetorNome(e.target.value)}
                placeholder="Ex.: RH"
              />
            </label>
            <label className="rf-label">
              Ordem
              <input
                className="rf-input"
                type="number"
                min={1}
                value={novoSetorOrdem}
                onChange={(e) => setNovoSetorOrdem(Number(e.target.value || 1))}
              />
            </label>
          </div>
          <label className="rf-label" style={{ marginTop: 8 }}>
            Checkpoint / dica
            <input
              className="rf-input"
              value={novoSetorHint}
              onChange={(e) => setNovoSetorHint(e.target.value)}
              placeholder="Ex.: impressoras, rede e acesso"
            />
          </label>
          <div className="rf-actions" style={{ marginTop: 8 }}>
            <button
              className="rf-btn"
              type="button"
              onClick={() => salvarSetor().catch(() => undefined)}
              disabled={savingSetor}
            >
              {savingSetor ? "Salvando setor..." : "Criar setor"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rf-empty">Carregando modelos...</div>
        ) : modelos.length === 0 ? (
          <div className="rf-empty">Nenhum modelo cadastrado ainda.</div>
        ) : (
          <>
            <div className="rf-table-wrap">
              <table className="rf-table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Versão</th>
                    <th>Itens</th>
                    <th>Setores</th>
                    <th>Status</th>
                    <th>Criado</th>
                  </tr>
                </thead>
                <tbody>
                  {modelos.map((m) => (
                    <tr key={m.id}>
                      <td>{m.nome}</td>
                      <td>v{m.versao}</td>
                      <td>{m.totalItens}</td>
                      <td>{m.totalSetores}</td>
                      <td>{m.ativo ? <span className="rf-chip ok">Ativo</span> : <span className="rf-chip">Inativo</span>}</td>
                      <td>{formatDateTime(m.criadoEm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rf-list" style={{ marginTop: 10 }}>
              {modelos.map((m) => (
                <div className="rf-card tight" key={`${m.id}-itens`}>
                  <div className="rf-row wrap" style={{ marginBottom: 6 }}>
                    <strong>
                      {m.nome} (v{m.versao})
                    </strong>
                    <span className="rf-badge">{m.itens?.length ?? 0} itens</span>
                  </div>
                  {!m.itens || m.itens.length === 0 ? (
                    <div className="rf-empty" style={{ padding: "8px 0" }}>
                      Modelo sem itens cadastrados.
                    </div>
                  ) : (
                    <div className="rf-list" style={{ gap: 8 }}>
                      {Object.entries(
                        m.itens.reduce<Record<string, NonNullable<ChecklistModeloResumo["itens"]>>>((acc, item) => {
                          const key = item.setorNome || "Sem setor";
                          acc[key] = [...(acc[key] ?? []), item];
                          return acc;
                        }, {})
                      ).map(([setorNome, itensSetor]) => (
                        <div key={`${m.id}-${setorNome}`} className="rf-card tight" style={{ padding: "10px 12px" }}>
                          <div className="rf-row wrap" style={{ marginBottom: 6 }}>
                            <strong>{setorNome}</strong>
                            <span className="rf-muted">{itensSetor.length} item(ns)</span>
                          </div>
                          <div className="rf-list" style={{ gap: 4 }}>
                            {itensSetor
                              .slice()
                              .sort((a, b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo))
                              .map((item, idx) => (
                                <div key={item.id} className="rf-row wrap" style={{ gap: 8 }}>
                                  <span>
                                    Item {idx + 1} - {item.titulo}
                                  </span>
                                </div>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </article>

      <article className="rf-card" style={{ gridColumn: "1 / -1" }}>
        <div className="rf-row wrap" style={{ marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>Novo Modelo de Checklist</h2>
          <span className="rf-muted">Nome + setor + itens do checklist</span>
        </div>

        <div className="rf-grid" style={{ gap: 10 }}>
          <div className="rf-grid cols-2">
            <label className="rf-label">
              Nome do checklist
              <input
                className="rf-input"
                value={modeloNome}
                onChange={(e) => setModeloNome(e.target.value)}
                placeholder="Ex.: RH"
              />
            </label>

            <label className="rf-label">
              Setor do checklist
              <select
                className="rf-select"
                value={modeloSetorId}
                onChange={(e) => trocarSetorDoChecklist(e.target.value)}
              >
                <option value="">Selecione</option>
                {setores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.ordem}. {s.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="rf-card tight">
            <div className="rf-row wrap" style={{ marginBottom: 8 }}>
              <div>
                <strong>Itens deste checklist</strong>
                <div className="rf-muted" style={{ fontSize: "0.85rem" }}>
                  {setorChecklistAtual
                    ? `Checklist do setor ${setorChecklistAtual.nome}. Adicione os itens abaixo.`
                    : "Selecione um setor para começar."}
                </div>
              </div>
              <div className="rf-actions">
                <span className="rf-badge">{itensDoChecklist.length} item(ns)</span>
                <button className="rf-btn" type="button" onClick={addItem} disabled={!modeloSetorId}>
                  + Adicionar item
                </button>
              </div>
            </div>
          </div>

          {!modeloSetorId ? (
            <div className="rf-empty">Selecione o setor do checklist.</div>
          ) : itensDoChecklist.length === 0 ? (
            <div className="rf-empty">Nenhum item cadastrado ainda. Clique em “+ Adicionar item”.</div>
          ) : (
            <div className="rf-list">
              {itensDoChecklist.map((item, idx) => (
                <div key={item.id} className="rf-check-item">
                  <div className="rf-row wrap" style={{ marginBottom: 8 }}>
                    <strong>Item {idx + 1}</strong>
                    <div className="rf-actions">
                      <button className="rf-btn" type="button" onClick={() => duplicateItem(item.id)}>
                        Duplicar
                      </button>
                      <button
                        className="rf-btn"
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={itens.length <= 1}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <label className="rf-label">
                    Título
                    <input
                      className="rf-input"
                      value={item.titulo}
                      onChange={(e) => updateItem(item.id, { titulo: e.target.value })}
                      placeholder="Ex.: Olhar Wi-Fi"
                    />
                  </label>

                  <label className="rf-label" style={{ marginTop: 8 }}>
                    Descrição
                    <textarea
                      className="rf-textarea"
                      value={item.descricao}
                      onChange={(e) => updateItem(item.id, { descricao: e.target.value })}
                      placeholder="Descreva a verificação"
                    />
                  </label>

                  <label
                    className="rf-label"
                    style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <input
                      type="checkbox"
                      checked={item.obrigatorioFotoIncidente}
                      onChange={(e) => updateItem(item.id, { obrigatorioFotoIncidente: e.target.checked })}
                    />
                    Foto obrigatória se houver incidente
                  </label>
                </div>
              ))}
            </div>
          )}

          <div className="rf-actions">
            <button
              className="rf-btn primary"
              type="button"
              onClick={() => salvarModelo().catch(() => undefined)}
              disabled={savingModel}
            >
              {savingModel ? "Salvando..." : "Salvar modelo"}
            </button>
          </div>
        </div>
      </article>
    </section>
  );
}
