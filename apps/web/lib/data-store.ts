import crypto from "node:crypto";
import type {
  AuditLog,
  ChecklistModeloItemInput,
  ChecklistModeloResumo,
  ChecklistTemplate,
  DashboardSnapshot,
  FotoRegistro,
  ItemResposta,
  ItemStatus,
  LocalizacaoPing,
  Ronda,
  RondaResumo,
  SessionUser,
  User,
  UserRole
} from "@/lib/types";
import { query, withTransaction, type DbClient } from "@/lib/pg";

type Queryable = Pick<DbClient, "query">;

type SessionRecord = {
  token: string;
  user: SessionUser;
  criadoEm: string;
  atualizadoEm: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __RONDAFLOW_SESSIONS__: Map<string, SessionRecord> | undefined;
}

function getSessionMap() {
  if (!globalThis.__RONDAFLOW_SESSIONS__) {
    globalThis.__RONDAFLOW_SESSIONS__ = new Map<string, SessionRecord>();
  }
  return globalThis.__RONDAFLOW_SESSIONS__;
}

function nowIso() {
  return new Date().toISOString();
}

function genToken() {
  return `sess_${crypto.randomUUID()}`;
}

function parseImageDataUrlForDb(dataUrl: string) {
  // Compatível com targets antigos (sem flag dotAll /s)
  const match = /^data:([^;]+);base64,([\s\S]+)$/.exec(dataUrl.trim());
  if (!match) {
    throw new Error("Formato de imagem inválido (data URL).");
  }
  const mimeType = match[1].toLowerCase();
  if (!mimeType.startsWith("image/")) {
    throw new Error("Arquivo enviado não é imagem.");
  }
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length) {
    throw new Error("Imagem vazia.");
  }
  return {
    mimeType,
    bytes,
    sizeBytes: bytes.byteLength
  };
}

function isTodayLocal(iso: string | undefined) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

async function appendAudit(
  db: Queryable,
  params: {
    rondaId?: string;
    userId: string;
    acao: AuditLog["acao"];
    detalhes: string;
    metadata?: Record<string, string | number | boolean | null>;
    criadoEm?: string;
  }
) {
  await db.query(
    `
      insert into audit_logs (ronda_id, usuario_id, acao, detalhes, metadata, criado_em)
      values ($1::uuid, $2::uuid, $3, $4, coalesce($5::jsonb, '{}'::jsonb), coalesce($6::timestamptz, now()))
    `,
    [
      params.rondaId ?? null,
      params.userId,
      params.acao,
      params.detalhes,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.criadoEm ?? null
    ]
  );
}

type UserRow = {
  id: string;
  nome: string;
  username: string;
  perfil: UserRole;
};

function mapUserRow(row: UserRow): SessionUser {
  return {
    id: row.id,
    nome: row.nome,
    username: row.username,
    role: row.perfil
  };
}

async function getUserById(userId: string) {
  const res = await query<UserRow>(
    `
      select id::text as id, nome, username, perfil
      from usuarios
      where id = $1::uuid and ativo = true
      limit 1
    `,
    [userId]
  );
  return res.rows[0] ? mapUserRow(res.rows[0]) : null;
}

async function getRondaHeader(rondaId: string) {
  const res = await query<{
    id: string;
    template_id: string;
    template_nome: string;
    template_versao: number;
    status: "aberta" | "finalizada" | "cancelada";
    analista_id: string;
    analista_nome: string;
    iniciada_em: string;
    finalizada_em: string | null;
    observacao_geral: string;
  }>(
    `
      select
        r.id::text as id,
        r.checklist_modelo_id::text as template_id,
        cm.nome as template_nome,
        r.checklist_modelo_versao as template_versao,
        r.status,
        r.analista_id::text as analista_id,
        u.nome as analista_nome,
        r.iniciada_em::text as iniciada_em,
        r.finalizada_em::text as finalizada_em,
        r.observacao_geral
      from rondas r
      join checklist_modelos cm on cm.id = r.checklist_modelo_id
      join usuarios u on u.id = r.analista_id
      where r.id = $1::uuid
      limit 1
    `,
    [rondaId]
  );

  return res.rows[0] ?? null;
}

async function getSetoresPlanejadosByRonda(rondaId: string) {
  const res = await query<{
    id: string;
    nome: string;
    ordem: number;
    checkpoint_hint: string | null;
  }>(
    `
      select distinct
        s.id::text as id,
        s.nome,
        s.ordem,
        s.checkpoint_hint
      from ronda_respostas rr
      join setores s on s.id = rr.setor_id
      where rr.ronda_id = $1::uuid
      order by s.ordem asc, s.nome asc
    `,
    [rondaId]
  );

  return res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    nome: row.nome,
    ordem: Number(row.ordem),
    checkpointHint: row.checkpoint_hint ?? ""
  }));
}

async function getFotosByRonda(rondaId: string) {
  const res = await query<{
    id: string;
    ronda_id: string;
    ronda_resposta_id: string | null;
    nome_arquivo: string;
    mime_type: string;
    arquivo_base64: string | null;
    capturada_em: string | null;
    enviada_por: string;
  }>(
    `
      select
        f.id::text as id,
        f.ronda_id::text as ronda_id,
        f.ronda_resposta_id::text as ronda_resposta_id,
        f.nome_arquivo,
        f.mime_type,
        case when f.arquivo_bytes is null then null else encode(f.arquivo_bytes, 'base64') end as arquivo_base64,
        f.capturada_em::text as capturada_em,
        f.enviada_por::text as enviada_por
      from ronda_fotos f
      where f.ronda_id = $1::uuid
      order by f.criado_em desc
    `,
    [rondaId]
  );

  const fotos = res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    rondaId: row.ronda_id,
    itemRespostaId: row.ronda_resposta_id ?? undefined,
    nomeArquivo: row.nome_arquivo,
    dataUrl: row.arquivo_base64 ? `data:${row.mime_type};base64,${row.arquivo_base64}` : "",
    capturadaEm: row.capturada_em ?? nowIso(),
    enviadaPorUserId: row.enviada_por
  }));

  const byResposta = new Map<string, FotoRegistro[]>();
  for (const foto of fotos) {
    if (!foto.itemRespostaId) continue;
    const list = byResposta.get(foto.itemRespostaId) ?? [];
    list.push(foto);
    byResposta.set(foto.itemRespostaId, list);
  }
  return byResposta;
}

async function getRespostasByRonda(rondaId: string): Promise<ItemResposta[]> {
  const [respostasRes, fotosByResposta] = await Promise.all([
    query<{
      id: string;
      item_template_id: string;
      setor_id: string;
      titulo: string;
      descricao: string;
      status: ItemStatus;
      observacao: string;
      respondido_em: string | null;
      respondido_por: string | null;
    }>(
      `
        select
          rr.id::text as id,
          rr.checklist_modelo_item_id::text as item_template_id,
          rr.setor_id::text as setor_id,
          cmi.titulo,
          cmi.descricao,
          rr.status,
          rr.observacao,
          rr.respondido_em::text as respondido_em,
          rr.respondido_por::text as respondido_por
        from ronda_respostas rr
        join checklist_modelo_itens cmi on cmi.id = rr.checklist_modelo_item_id
        join setores s on s.id = rr.setor_id
        where rr.ronda_id = $1::uuid
        order by s.ordem asc, cmi.ordem asc, cmi.titulo asc
      `,
      [rondaId]
    ),
    getFotosByRonda(rondaId)
  ]);

  return respostasRes.rows.map((row: (typeof respostasRes.rows)[number]) => ({
    id: row.id,
    itemTemplateId: row.item_template_id,
    setorId: row.setor_id,
    titulo: row.titulo,
    descricao: row.descricao,
    status: row.status,
    observacao: row.observacao ?? "",
    respondidoEm: row.respondido_em ?? undefined,
    respondidoPorUserId: row.respondido_por ?? undefined,
    fotos: fotosByResposta.get(row.id) ?? []
  }));
}

async function getLocalizacoesByRonda(rondaId: string): Promise<LocalizacaoPing[]> {
  const res = await query<{
    id: string;
    ronda_id: string;
    latitude: number;
    longitude: number;
    precisao_metros: number | null;
    coletada_em: string;
    origem: "gps" | "manual" | "simulada";
  }>(
    `
      select
        id::text as id,
        ronda_id::text as ronda_id,
        latitude,
        longitude,
        precisao_metros,
        coletada_em::text as coletada_em,
        origem
      from ronda_localizacoes
      where ronda_id = $1::uuid
      order by coletada_em asc
    `,
    [rondaId]
  );

  return res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    rondaId: row.ronda_id,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    precisaoMetros: row.precisao_metros === null ? null : Number(row.precisao_metros),
    coletadaEm: row.coletada_em,
    origem: row.origem
  }));
}

export async function getRondaById(rondaId: string): Promise<Ronda | null> {
  const header = await getRondaHeader(rondaId);
  if (!header) return null;

  const [setoresPlanejados, respostas, localizacoes] = await Promise.all([
    getSetoresPlanejadosByRonda(rondaId),
    getRespostasByRonda(rondaId),
    getLocalizacoesByRonda(rondaId)
  ]);

  return {
    id: header.id,
    templateId: header.template_id,
    templateNome: header.template_nome,
    templateVersao: Number(header.template_versao),
    status: header.status === "cancelada" ? "finalizada" : header.status,
    analistaId: header.analista_id,
    analistaNome: header.analista_nome,
    iniciadaEm: header.iniciada_em,
    finalizadaEm: header.finalizada_em ?? undefined,
    observacaoGeral: header.observacao_geral ?? "",
    setoresPlanejados,
    respostas,
    localizacoes,
    auditLogIds: []
  };
}

export async function listAuditLogsByRonda(rondaId: string): Promise<AuditLog[]> {
  const res = await query<{
    id: string;
    ronda_id: string | null;
    usuario_id: string;
    user_nome: string;
    acao: AuditLog["acao"];
    detalhes: string;
    metadata: Record<string, string | number | boolean | null> | null;
    criado_em: string;
  }>(
    `
      select
        a.id::text as id,
        a.ronda_id::text as ronda_id,
        a.usuario_id::text as usuario_id,
        u.nome as user_nome,
        a.acao,
        a.detalhes,
        a.metadata,
        a.criado_em::text as criado_em
      from audit_logs a
      join usuarios u on u.id = a.usuario_id
      where a.ronda_id = $1::uuid
      order by a.criado_em desc, a.id desc
    `,
    [rondaId]
  );

  return res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    rondaId: row.ronda_id ?? undefined,
    userId: row.usuario_id,
    userNome: row.user_nome,
    acao: row.acao,
    detalhes: row.detalhes,
    metadata: row.metadata ?? undefined,
    criadoEm: row.criado_em
  }));
}

export async function listRondas(params?: { analistaId?: string }): Promise<RondaResumo[]> {
  const rondasRes = await query<{
    id: string;
    status: "aberta" | "finalizada" | "cancelada";
    analista_nome: string;
    iniciada_em: string;
    finalizada_em: string | null;
  }>(
    `
      select
        r.id::text as id,
        r.status,
        u.nome as analista_nome,
        r.iniciada_em::text as iniciada_em,
        r.finalizada_em::text as finalizada_em
      from rondas r
      join usuarios u on u.id = r.analista_id
      where ($1::uuid is null or r.analista_id = $1::uuid)
      order by r.iniciada_em desc
      limit 200
    `,
    [params?.analistaId ?? null]
  );

  const rondaIds = rondasRes.rows.map((r: (typeof rondasRes.rows)[number]) => r.id);
  if (rondaIds.length === 0) return [];

  const [respostasAgg, fotosAgg, gpsAgg] = await Promise.all([
    query<{
      ronda_id: string;
      total_itens: number;
      itens_ok: number;
      itens_incidente: number;
      itens_pendentes: number;
    }>(
      `
        select
          rr.ronda_id::text as ronda_id,
          count(*)::int as total_itens,
          count(*) filter (where rr.status = 'ok')::int as itens_ok,
          count(*) filter (where rr.status = 'incidente')::int as itens_incidente,
          count(*) filter (where rr.status = 'pendente')::int as itens_pendentes
        from ronda_respostas rr
        where rr.ronda_id = any($1::uuid[])
        group by rr.ronda_id
      `,
      [rondaIds]
    ),
    query<{ ronda_id: string; total_fotos: number }>(
      `
        select ronda_id::text as ronda_id, count(*)::int as total_fotos
        from ronda_fotos
        where ronda_id = any($1::uuid[])
        group by ronda_id
      `,
      [rondaIds]
    ),
    query<{ ronda_id: string; total_pings: number }>(
      `
        select ronda_id::text as ronda_id, count(*)::int as total_pings
        from ronda_localizacoes
        where ronda_id = any($1::uuid[])
        group by ronda_id
      `,
      [rondaIds]
    )
  ]);

  type RondaStatsAgg = {
    totalItens: number;
    itensOk: number;
    itensIncidente: number;
    itensPendentes: number;
  };

  const respostasMap = new Map<string, RondaStatsAgg>(
    respostasAgg.rows.map((row: (typeof respostasAgg.rows)[number]) => [
      row.ronda_id,
      {
        totalItens: Number(row.total_itens),
        itensOk: Number(row.itens_ok),
        itensIncidente: Number(row.itens_incidente),
        itensPendentes: Number(row.itens_pendentes)
      }
    ])
  );
  const fotosMap = new Map(fotosAgg.rows.map((row: (typeof fotosAgg.rows)[number]) => [row.ronda_id, Number(row.total_fotos)]));
  const gpsMap = new Map(gpsAgg.rows.map((row: (typeof gpsAgg.rows)[number]) => [row.ronda_id, Number(row.total_pings)]));

  return rondasRes.rows.map((row: (typeof rondasRes.rows)[number]) => {
    const stats: RondaStatsAgg =
      respostasMap.get(row.id) ?? { totalItens: 0, itensOk: 0, itensIncidente: 0, itensPendentes: 0 };
    const percentualConcluido =
      stats.totalItens === 0 ? 0 : Math.round(((stats.totalItens - stats.itensPendentes) / stats.totalItens) * 100);

    return {
      id: row.id,
      status: row.status === "cancelada" ? "finalizada" : row.status,
      analistaNome: row.analista_nome,
      iniciadaEm: row.iniciada_em,
      finalizadaEm: row.finalizada_em ?? undefined,
      percentualConcluido,
      totalItens: stats.totalItens,
      itensOk: stats.itensOk,
      itensIncidente: stats.itensIncidente,
      incidentesAbertos: row.status === "aberta" ? stats.itensIncidente : 0,
      totalFotos: fotosMap.get(row.id) ?? 0,
      totalPingsLocalizacao: gpsMap.get(row.id) ?? 0
    };
  });
}

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const [rondas, auditoriaRecente] = await Promise.all([
    listRondas(),
    query<{
      id: string;
      ronda_id: string | null;
      usuario_id: string;
      user_nome: string;
      acao: AuditLog["acao"];
      detalhes: string;
      metadata: Record<string, string | number | boolean | null> | null;
      criado_em: string;
    }>(
      `
        select
          a.id::text as id,
          a.ronda_id::text as ronda_id,
          a.usuario_id::text as usuario_id,
          u.nome as user_nome,
          a.acao,
          a.detalhes,
          a.metadata,
          a.criado_em::text as criado_em
        from audit_logs a
        join usuarios u on u.id = a.usuario_id
        order by a.criado_em desc, a.id desc
        limit 50
      `
    )
  ]);

  const rondasHoje = rondas.filter((r: RondaResumo) => isTodayLocal(r.iniciadaEm));
  const finalizadasHoje = rondasHoje.filter((r: RondaResumo) => r.finalizadaEm);
  const mediaDuracao =
    finalizadasHoje.length === 0
      ? 0
      : Math.round(
          finalizadasHoje.reduce((acc: number, r: RondaResumo) => {
            const ini = new Date(r.iniciadaEm).getTime();
            const fim = new Date(r.finalizadaEm as string).getTime();
            return acc + Math.max(0, (fim - ini) / 60000);
          }, 0) / finalizadasHoje.length
        );

  return {
    metricas: {
      rondasHoje: rondasHoje.length,
      rondasAbertas: rondas.filter((r: RondaResumo) => r.status === "aberta").length,
      incidentesHoje: rondasHoje.reduce((acc: number, r: RondaResumo) => acc + r.itensIncidente, 0),
      mediaDuracaoMinutosRondasFinalizadasHoje: mediaDuracao,
      totalPingsHoje: rondasHoje.reduce((acc: number, r: RondaResumo) => acc + r.totalPingsLocalizacao, 0)
    },
    rondas,
    auditoriaRecente: auditoriaRecente.rows.map((row: (typeof auditoriaRecente.rows)[number]) => ({
      id: row.id,
      rondaId: row.ronda_id ?? undefined,
      userId: row.usuario_id,
      userNome: row.user_nome,
      acao: row.acao,
      detalhes: row.detalhes,
      metadata: row.metadata ?? undefined,
      criadoEm: row.criado_em
    }))
  };
}

export async function startRonda(analistaId: string): Promise<Ronda | null> {
  const aberta = await query<{ id: string }>(
    `
      select id::text as id
      from rondas
      where analista_id = $1::uuid and status = 'aberta'
      order by iniciada_em desc
      limit 1
    `,
    [analistaId]
  );
  if (aberta.rows[0]) {
    return getRondaById(aberta.rows[0].id);
  }

  const createdRondaId = await withTransaction(async (client) => {
    const userRes = await client.query<UserRow>(
      `
        select id::text as id, nome, username, perfil
        from usuarios
        where id = $1::uuid and ativo = true and perfil = 'analista'
        limit 1
      `,
      [analistaId]
    );
    if (!userRes.rows[0]) {
      return null;
    }

    const modeloRes = await client.query<{
      id: string;
      nome: string;
      versao: number;
    }>(
      `
        select id::text as id, nome, versao
        from checklist_modelos
        where ativo = true
        order by versao desc, criado_em desc
        limit 1
      `
    );
    const modelo = modeloRes.rows[0];
    if (!modelo) return null;

    const rondaInsert = await client.query<{ id: string }>(
      `
        insert into rondas (checklist_modelo_id, checklist_modelo_versao, analista_id, status, observacao_geral)
        values ($1::uuid, $2, $3::uuid, 'aberta', '')
        returning id::text as id
      `,
      [modelo.id, modelo.versao, analistaId]
    );
    const rondaId = rondaInsert.rows[0]?.id;
    if (!rondaId) return null;

    await client.query(
      `
        insert into ronda_respostas (ronda_id, checklist_modelo_item_id, setor_id, status, observacao)
        select
          $1::uuid,
          cmi.id,
          cmi.setor_id,
          'pendente',
          ''
        from checklist_modelo_itens cmi
        where cmi.checklist_modelo_id = $2::uuid
        order by cmi.ordem asc, cmi.titulo asc
      `,
      [rondaId, modelo.id]
    );

    await appendAudit(client, {
      rondaId,
      userId: analistaId,
      acao: "ronda_iniciada",
      detalhes: "Nova ronda iniciada."
    });

    return rondaId;
  });

  if (!createdRondaId) return null;
  return getRondaById(createdRondaId);
}

export async function createRondaForAnalista(params: {
  analistaId: string;
  checklistModeloId: string;
  gestorUserId: string;
}): Promise<Ronda | null> {
  const aberta = await query<{ id: string }>(
    `
      select id::text as id
      from rondas
      where analista_id = $1::uuid and status = 'aberta'
      order by iniciada_em desc
      limit 1
    `,
    [params.analistaId]
  );
  if (aberta.rows[0]) {
    return getRondaById(aberta.rows[0].id);
  }

  const createdRondaId = await withTransaction(async (client) => {
    const analistaRes = await client.query<UserRow>(
      `
        select id::text as id, nome, username, perfil
        from usuarios
        where id = $1::uuid and ativo = true and perfil = 'analista'
        limit 1
      `,
      [params.analistaId]
    );
    if (!analistaRes.rows[0]) return null;

    const modeloRes = await client.query<{ id: string; versao: number; nome: string }>(
      `
        select id::text as id, versao, nome
        from checklist_modelos
        where id = $1::uuid and ativo = true
        limit 1
      `,
      [params.checklistModeloId]
    );
    const modelo = modeloRes.rows[0];
    if (!modelo) return null;

    const rondaInsert = await client.query<{ id: string }>(
      `
        insert into rondas (checklist_modelo_id, checklist_modelo_versao, analista_id, status, observacao_geral)
        values ($1::uuid, $2, $3::uuid, 'aberta', '')
        returning id::text as id
      `,
      [modelo.id, modelo.versao, params.analistaId]
    );
    const rondaId = rondaInsert.rows[0]?.id;
    if (!rondaId) return null;

    await client.query(
      `
        insert into ronda_respostas (ronda_id, checklist_modelo_item_id, setor_id, status, observacao)
        select $1::uuid, cmi.id, cmi.setor_id, 'pendente', ''
        from checklist_modelo_itens cmi
        where cmi.checklist_modelo_id = $2::uuid
        order by cmi.ordem asc, cmi.titulo asc
      `,
      [rondaId, modelo.id]
    );

    await appendAudit(client, {
      rondaId,
      userId: params.gestorUserId,
      acao: "ronda_iniciada",
      detalhes: `Ronda criada pelo gestor para o analista (${analistaRes.rows[0].nome}).`,
      metadata: { criadoPorGestor: true, checklistModeloId: modelo.id }
    });
    return rondaId;
  });

  return createdRondaId ? getRondaById(createdRondaId) : null;
}

export async function updateResposta(params: {
  rondaId: string;
  itemRespostaId: string;
  status: ItemStatus;
  observacao?: string;
  userId: string;
}): Promise<Ronda | null> {
  const updated = await withTransaction(async (client) => {
    const itemRes = await client.query<{
      id: string;
      ronda_id: string;
      setor_id: string;
      titulo: string;
    }>(
      `
        select
          rr.id::text as id,
          rr.ronda_id::text as ronda_id,
          rr.setor_id::text as setor_id,
          cmi.titulo
        from ronda_respostas rr
        join checklist_modelo_itens cmi on cmi.id = rr.checklist_modelo_item_id
        where rr.id = $1::uuid and rr.ronda_id = $2::uuid
        limit 1
      `,
      [params.itemRespostaId, params.rondaId]
    );
    const item = itemRes.rows[0];
    if (!item) return false;

    await client.query(
      `
        update ronda_respostas
        set
          status = $1,
          observacao = coalesce($2, observacao),
          respondido_por = $3::uuid,
          respondido_em = now()
        where id = $4::uuid and ronda_id = $5::uuid
      `,
      [params.status, params.observacao ?? null, params.userId, params.itemRespostaId, params.rondaId]
    );

    if (params.status === "ok" || params.status === "incidente") {
      await appendAudit(client, {
        rondaId: params.rondaId,
        userId: params.userId,
        acao: params.status === "ok" ? "item_marcado_ok" : "item_marcado_incidente",
        detalhes: `Item "${item.titulo}" marcado como ${params.status.toUpperCase()}.`,
        metadata: { itemRespostaId: params.itemRespostaId, setorId: item.setor_id }
      });
    }

    if (typeof params.observacao === "string" && params.observacao.trim()) {
      await appendAudit(client, {
        rondaId: params.rondaId,
        userId: params.userId,
        acao: "item_observacao_atualizada",
        detalhes: `Observação registrada no item "${item.titulo}".`,
        metadata: { itemRespostaId: params.itemRespostaId }
      });
    }

    return true;
  });

  if (!updated) return null;
  return getRondaById(params.rondaId);
}

export async function updateRondaObservacaoGeral(params: {
  rondaId: string;
  observacaoGeral: string;
  userId: string;
}): Promise<Ronda | null> {
  const updated = await withTransaction(async (client) => {
    const res = await client.query<{ id: string }>(
      `
        update rondas
        set observacao_geral = $1
        where id = $2::uuid
        returning id::text as id
      `,
      [params.observacaoGeral, params.rondaId]
    );
    if (!res.rows[0]) return false;

    await appendAudit(client, {
      rondaId: params.rondaId,
      userId: params.userId,
      acao: "item_observacao_atualizada",
      detalhes: "Observação geral da ronda atualizada."
    });
    return true;
  });

  if (!updated) return null;
  return getRondaById(params.rondaId);
}

export async function addLocalizacao(params: {
  rondaId: string;
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  origem: "gps" | "manual" | "simulada";
  userId: string;
}): Promise<LocalizacaoPing | null> {
  const inserted = await withTransaction(async (client) => {
    const exists = await client.query<{ id: string }>(
      `select id::text as id from rondas where id = $1::uuid limit 1`,
      [params.rondaId]
    );
    if (!exists.rows[0]) return null;

    const ins = await client.query<{
      id: string;
      coletada_em: string;
    }>(
      `
        insert into ronda_localizacoes (ronda_id, latitude, longitude, precisao_metros, origem)
        values ($1::uuid, $2, $3, $4, $5)
        returning id::text as id, coletada_em::text as coletada_em
      `,
      [params.rondaId, params.latitude, params.longitude, params.precisaoMetros, params.origem]
    );
    const row = ins.rows[0];

    await appendAudit(client, {
      rondaId: params.rondaId,
      userId: params.userId,
      acao: "localizacao_registrada",
      detalhes: `Ponto de localização registrado (${params.origem}).`,
      metadata: { lat: params.latitude, lng: params.longitude }
    });

    return row;
  });

  if (!inserted) return null;
  return {
    id: inserted.id,
    rondaId: params.rondaId,
    latitude: params.latitude,
    longitude: params.longitude,
    precisaoMetros: params.precisaoMetros,
    coletadaEm: inserted.coletada_em,
    origem: params.origem
  };
}

export async function finalizeRonda(params: { rondaId: string; userId: string }): Promise<Ronda | null> {
  const updated = await withTransaction(async (client) => {
    const res = await client.query<{ id: string }>(
      `
        update rondas
        set status = 'finalizada', finalizada_em = coalesce(finalizada_em, now())
        where id = $1::uuid
        returning id::text as id
      `,
      [params.rondaId]
    );
    if (!res.rows[0]) return false;

    await appendAudit(client, {
      rondaId: params.rondaId,
      userId: params.userId,
      acao: "ronda_finalizada",
      detalhes: "Ronda finalizada."
    });
    return true;
  });

  if (!updated) return null;
  return getRondaById(params.rondaId);
}

export async function addFotoToRonda(params: {
  rondaId: string;
  itemRespostaId?: string;
  nomeArquivo: string;
  dataUrl: string;
  userId: string;
}): Promise<FotoRegistro | null> {
  const parsed = parseImageDataUrlForDb(params.dataUrl);

  const created = await withTransaction(async (client) => {
    const rondaRes = await client.query<{ id: string }>(
      `select id::text as id from rondas where id = $1::uuid limit 1`,
      [params.rondaId]
    );
    if (!rondaRes.rows[0]) return null;

    if (params.itemRespostaId) {
      const itemRes = await client.query<{ id: string; titulo: string }>(
        `
          select rr.id::text as id, cmi.titulo
          from ronda_respostas rr
          join checklist_modelo_itens cmi on cmi.id = rr.checklist_modelo_item_id
          where rr.id = $1::uuid and rr.ronda_id = $2::uuid
          limit 1
        `,
        [params.itemRespostaId, params.rondaId]
      );
      if (!itemRes.rows[0]) return null;
    }

    const ins = await client.query<{
      id: string;
      capturada_em: string;
    }>(
      `
        insert into ronda_fotos (
          ronda_id,
          ronda_resposta_id,
          storage_path,
          nome_arquivo,
          mime_type,
          tamanho_bytes,
          arquivo_bytes,
          capturada_em,
          enviada_por
        )
        values (
          $1::uuid,
          $2::uuid,
          $3,
          $4,
          $5,
          $6,
          $7,
          now(),
          $8::uuid
        )
        returning id::text as id, capturada_em::text as capturada_em
      `,
      [
        params.rondaId,
        params.itemRespostaId ?? null,
        "pg-bytea",
        params.nomeArquivo,
        parsed.mimeType,
        parsed.sizeBytes,
        parsed.bytes,
        params.userId
      ]
    );

    await appendAudit(client, {
      rondaId: params.rondaId,
      userId: params.userId,
      acao: "foto_adicionada",
      detalhes: params.itemRespostaId ? "Foto adicionada ao item da ronda." : "Foto adicionada na ronda.",
      metadata: {
        itemRespostaId: params.itemRespostaId ?? null,
        storage: "postgres-bytea",
        bytes: parsed.sizeBytes
      }
    });

    return ins.rows[0] ?? null;
  });

  if (!created) return null;

  return {
    id: created.id,
    rondaId: params.rondaId,
    itemRespostaId: params.itemRespostaId,
    nomeArquivo: params.nomeArquivo,
    dataUrl: params.dataUrl,
    capturadaEm: created.capturada_em,
    enviadaPorUserId: params.userId
  };
}

export async function getTemplate(): Promise<ChecklistTemplate | null> {
  const modelRes = await query<{ id: string; nome: string; versao: number }>(
    `
      select id::text as id, nome, versao
      from checklist_modelos
      where ativo = true
      order by versao desc, criado_em desc
      limit 1
    `
  );
  const model = modelRes.rows[0];
  if (!model) return null;

  const [setoresRes, itensRes] = await Promise.all([
    query<{ id: string; nome: string; ordem: number; checkpoint_hint: string | null }>(
      `
        select distinct s.id::text as id, s.nome, s.ordem, s.checkpoint_hint
        from checklist_modelo_itens cmi
        join setores s on s.id = cmi.setor_id
        where cmi.checklist_modelo_id = $1::uuid
        order by s.ordem asc
      `,
      [model.id]
    ),
    query<{
      id: string;
      setor_id: string;
      titulo: string;
      descricao: string;
      obrigatorio_foto_incidente: boolean;
    }>(
      `
        select
          id::text as id,
          setor_id::text as setor_id,
          titulo,
          descricao,
          obrigatorio_foto_incidente
        from checklist_modelo_itens
        where checklist_modelo_id = $1::uuid
        order by ordem asc, titulo asc
      `,
      [model.id]
    )
  ]);

  return {
    id: model.id,
    nome: model.nome,
    versao: Number(model.versao),
    setores: setoresRes.rows.map((s: (typeof setoresRes.rows)[number]) => ({
      id: s.id,
      nome: s.nome,
      ordem: Number(s.ordem),
      checkpointHint: s.checkpoint_hint ?? ""
    })),
    itens: itensRes.rows.map((i: (typeof itensRes.rows)[number]) => ({
      id: i.id,
      setorId: i.setor_id,
      titulo: i.titulo,
      descricao: i.descricao,
      obrigatorioFotoIncidente: i.obrigatorio_foto_incidente
    }))
  };
}

export async function listUsersByRole(role: UserRole): Promise<User[]> {
  const res = await query<UserRow>(
    `
      select id::text as id, nome, username, perfil
      from usuarios
      where ativo = true and perfil = $1
      order by nome asc
    `,
    [role]
  );
  return res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    nome: row.nome,
    username: row.username,
    role: row.perfil
  }));
}

export async function listSetores(): Promise<ChecklistTemplate["setores"]> {
  const res = await query<{ id: string; nome: string; ordem: number; checkpoint_hint: string | null }>(
    `
      select id::text as id, nome, ordem, checkpoint_hint
      from setores
      where ativo = true
      order by ordem asc, nome asc
    `
  );
  return res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    nome: row.nome,
    ordem: Number(row.ordem),
    checkpointHint: row.checkpoint_hint ?? ""
  }));
}

export async function createSetor(params: {
  nome: string;
  ordem: number;
  checkpointHint?: string;
  gestorUserId: string;
}) {
  const nome = params.nome.trim();
  if (!nome) {
    throw new Error("Nome do setor obrigatório.");
  }
  if (!Number.isFinite(params.ordem) || params.ordem <= 0) {
    throw new Error("Ordem do setor inválida.");
  }

  const res = await query<{
    id: string;
    nome: string;
    ordem: number;
    checkpoint_hint: string | null;
  }>(
    `
      insert into setores (nome, ordem, checkpoint_hint, ativo)
      values ($1, $2, $3, true)
      returning id::text as id, nome, ordem, checkpoint_hint
    `,
    [nome, Math.trunc(params.ordem), params.checkpointHint?.trim() || null]
  );

  const setor = res.rows[0];
  if (!setor) return null;

  try {
    await appendAudit({ query }, {
      userId: params.gestorUserId,
      acao: "item_observacao_atualizada",
      detalhes: `Setor criado: ${setor.nome}.`,
      metadata: { setorId: setor.id, ordem: Number(setor.ordem) }
    });
  } catch {
    // noop
  }

  return {
    id: setor.id,
    nome: setor.nome,
    ordem: Number(setor.ordem),
    checkpointHint: setor.checkpoint_hint ?? ""
  };
}

export async function listChecklistModelos(): Promise<ChecklistModeloResumo[]> {
  const res = await query<{
    id: string;
    nome: string;
    versao: number;
    ativo: boolean;
    criado_em: string;
    total_itens: number;
    total_setores: number;
  }>(
    `
      select
        cm.id::text as id,
        cm.nome,
        cm.versao,
        cm.ativo,
        cm.criado_em::text as criado_em,
        count(cmi.id)::int as total_itens,
        count(distinct cmi.setor_id)::int as total_setores
      from checklist_modelos cm
      left join checklist_modelo_itens cmi on cmi.checklist_modelo_id = cm.id
      group by cm.id, cm.nome, cm.versao, cm.ativo, cm.criado_em
      order by cm.nome asc, cm.versao desc
      `
    );
  const base = res.rows.map((row: (typeof res.rows)[number]) => ({
    id: row.id,
    nome: row.nome,
    versao: Number(row.versao),
    ativo: row.ativo,
    totalItens: Number(row.total_itens),
    totalSetores: Number(row.total_setores),
    criadoEm: row.criado_em
  }));

  if (base.length === 0) return base;

  const itensRes = await query<{
    id: string;
    checklist_modelo_id: string;
    titulo: string;
    setor_id: string;
    setor_nome: string;
    ordem: number;
  }>(
    `
      select
        cmi.id::text as id,
        cmi.checklist_modelo_id::text as checklist_modelo_id,
        cmi.titulo,
        cmi.setor_id::text as setor_id,
        s.nome as setor_nome,
        cmi.ordem
      from checklist_modelo_itens cmi
      join setores s on s.id = cmi.setor_id
      where cmi.checklist_modelo_id = any($1::uuid[])
      order by cmi.checklist_modelo_id, cmi.ordem asc, cmi.titulo asc
    `,
    [base.map((m) => m.id)]
  );

  const itensPorModelo = new Map<
    string,
    NonNullable<ChecklistModeloResumo["itens"]>
  >();

  for (const row of itensRes.rows) {
    const atual = itensPorModelo.get(row.checklist_modelo_id) ?? [];
    atual.push({
      id: row.id,
      titulo: row.titulo,
      setorId: row.setor_id,
      setorNome: row.setor_nome,
      ordem: Number(row.ordem)
    });
    itensPorModelo.set(row.checklist_modelo_id, atual);
  }

  return base.map((modelo) => ({
    ...modelo,
    itens: itensPorModelo.get(modelo.id) ?? []
  }));
}

export async function createChecklistModelo(params: {
  nome: string;
  itens: ChecklistModeloItemInput[];
  gestorUserId: string;
}): Promise<ChecklistTemplate | null> {
  const nome = params.nome.trim();
  const itens = params.itens
    .map((item) => ({
      ...item,
      titulo: item.titulo.trim(),
      descricao: item.descricao.trim()
    }))
    .filter((item) => item.setorId && item.titulo && item.descricao);

  if (!nome || itens.length === 0) {
    throw new Error("Modelo inválido: informe nome e pelo menos 1 item.");
  }

  const modelId = await withTransaction(async (client) => {
    const versaoRes = await client.query<{ next_versao: number }>(
      `
        select coalesce(max(versao), 0) + 1 as next_versao
        from checklist_modelos
        where lower(nome) = lower($1)
      `,
      [nome]
    );
    const nextVersao = Number(versaoRes.rows[0]?.next_versao ?? 1);

    const modelInsert = await client.query<{ id: string }>(
      `
        insert into checklist_modelos (nome, versao, ativo)
        values ($1, $2, true)
        returning id::text as id
      `,
      [nome, nextVersao]
    );
    const checklistModeloId = modelInsert.rows[0]?.id;
    if (!checklistModeloId) return null;

    for (const item of itens) {
      await client.query(
        `
          insert into checklist_modelo_itens (
            checklist_modelo_id,
            setor_id,
            titulo,
            descricao,
            obrigatorio_foto_incidente,
            ordem
          )
          values ($1::uuid, $2::uuid, $3, $4, $5, $6)
        `,
        [
          checklistModeloId,
          item.setorId,
          item.titulo,
          item.descricao,
          item.obrigatorioFotoIncidente,
          item.ordem
        ]
      );
    }

    await appendAudit(client, {
      userId: params.gestorUserId,
      acao: "item_observacao_atualizada",
      detalhes: `Modelo de checklist criado: ${nome} v${nextVersao}.`,
      metadata: { checklistModeloId, totalItens: itens.length }
    });

    return checklistModeloId;
  });

  if (!modelId) return null;

  const modelRes = await query<{ id: string; nome: string; versao: number }>(
    `select id::text as id, nome, versao from checklist_modelos where id = $1::uuid limit 1`,
    [modelId]
  );
  const model = modelRes.rows[0];
  if (!model) return null;

  const [setores, itensRaw] = await Promise.all([
    query<{ id: string; nome: string; ordem: number; checkpoint_hint: string | null }>(
      `
        select distinct s.id::text as id, s.nome, s.ordem, s.checkpoint_hint
        from checklist_modelo_itens cmi
        join setores s on s.id = cmi.setor_id
        where cmi.checklist_modelo_id = $1::uuid
        order by s.ordem asc
      `,
      [modelId]
    ),
    query<{
      id: string;
      setor_id: string;
      titulo: string;
      descricao: string;
      obrigatorio_foto_incidente: boolean;
    }>(
      `
        select id::text as id, setor_id::text as setor_id, titulo, descricao, obrigatorio_foto_incidente
        from checklist_modelo_itens
        where checklist_modelo_id = $1::uuid
        order by ordem asc, titulo asc
      `,
      [modelId]
    )
  ]);

  return {
    id: model.id,
    nome: model.nome,
    versao: Number(model.versao),
    setores: setores.rows.map((s: (typeof setores.rows)[number]) => ({
      id: s.id,
      nome: s.nome,
      ordem: Number(s.ordem),
      checkpointHint: s.checkpoint_hint ?? ""
    })),
    itens: itensRaw.rows.map((i: (typeof itensRaw.rows)[number]) => ({
      id: i.id,
      setorId: i.setor_id,
      titulo: i.titulo,
      descricao: i.descricao,
      obrigatorioFotoIncidente: i.obrigatorio_foto_incidente
    }))
  };
}

export async function loginUser(username: string, role: UserRole) {
  const normalized = username.trim().toLowerCase();
  const userRes = await query<UserRow>(
    `
      select id::text as id, nome, username, perfil
      from usuarios
      where ativo = true and perfil = $1 and lower(username) = $2
      limit 1
    `,
    [role, normalized]
  );
  const user = userRes.rows[0];
  if (!user) return null;

  const sessionUser = mapUserRow(user);
  const token = genToken();
  const record: SessionRecord = {
    token,
    user: sessionUser,
    criadoEm: nowIso(),
    atualizadoEm: nowIso()
  };
  getSessionMap().set(token, record);

  try {
    await appendAudit({ query }, {
      userId: sessionUser.id,
      acao: "login",
      detalhes: `Login realizado no perfil ${sessionUser.role}.`
    });
  } catch {
    // login não deve falhar por audit log
  }

  return { token, user: sessionUser };
}

export function logoutSession(token: string) {
  const sessions = getSessionMap();
  const session = sessions.get(token);
  sessions.delete(token);
  if (!session) return;
  void appendAudit({ query }, {
    userId: session.user.id,
    acao: "logout",
    detalhes: `Logout realizado no perfil ${session.user.role}.`
  }).catch(() => undefined);
}

export function getSessionUserByToken(token: string): SessionUser | null {
  const session = getSessionMap().get(token);
  if (!session) return null;
  session.atualizadoEm = nowIso();
  return session.user;
}
