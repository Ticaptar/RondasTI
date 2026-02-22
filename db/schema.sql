-- RondaFlow - schema inicial (PostgreSQL)
-- Foco: checklist de ronda auditado com fotos, localizacao e painel gerencial

create extension if not exists pgcrypto;

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  username text not null unique,
  perfil text not null check (perfil in ('analista', 'gestor')),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ordem integer not null,
  checkpoint_hint text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table checklist_modelos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  versao integer not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (nome, versao)
);

create table checklist_modelo_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_modelo_id uuid not null references checklist_modelos(id) on delete cascade,
  setor_id uuid not null references setores(id),
  titulo text not null,
  descricao text not null,
  obrigatorio_foto_incidente boolean not null default false,
  ordem integer not null default 0
);

create table rondas (
  id uuid primary key default gen_random_uuid(),
  checklist_modelo_id uuid not null references checklist_modelos(id),
  checklist_modelo_versao integer not null,
  analista_id uuid not null references usuarios(id),
  status text not null check (status in ('aberta', 'finalizada', 'cancelada')),
  observacao_geral text not null default '',
  iniciada_em timestamptz not null default now(),
  finalizada_em timestamptz
);

create index ix_rondas_analista_iniciada_em on rondas (analista_id, iniciada_em desc);
create index ix_rondas_status on rondas (status);

create table ronda_respostas (
  id uuid primary key default gen_random_uuid(),
  ronda_id uuid not null references rondas(id) on delete cascade,
  checklist_modelo_item_id uuid not null references checklist_modelo_itens(id),
  setor_id uuid not null references setores(id),
  status text not null check (status in ('pendente', 'ok', 'incidente')),
  observacao text not null default '',
  respondido_por uuid references usuarios(id),
  respondido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index ix_ronda_respostas_ronda on ronda_respostas (ronda_id);
create index ix_ronda_respostas_status on ronda_respostas (status);

create table ronda_fotos (
  id uuid primary key default gen_random_uuid(),
  ronda_id uuid not null references rondas(id) on delete cascade,
  ronda_resposta_id uuid references ronda_respostas(id) on delete cascade,
  storage_path text not null,
  arquivo_bytes bytea,
  nome_arquivo text not null,
  mime_type text not null,
  tamanho_bytes bigint,
  capturada_em timestamptz,
  enviada_por uuid not null references usuarios(id),
  criado_em timestamptz not null default now()
);

create index ix_ronda_fotos_ronda on ronda_fotos (ronda_id);
create index ix_ronda_fotos_resposta on ronda_fotos (ronda_resposta_id);

create table ronda_localizacoes (
  id bigserial primary key,
  ronda_id uuid not null references rondas(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  precisao_metros double precision,
  origem text not null check (origem in ('gps', 'manual', 'simulada')),
  coletada_em timestamptz not null default now()
);

create index ix_ronda_localizacoes_ronda_coletada on ronda_localizacoes (ronda_id, coletada_em);

create table audit_logs (
  id bigserial primary key,
  ronda_id uuid references rondas(id) on delete set null,
  usuario_id uuid not null references usuarios(id),
  acao text not null,
  detalhes text not null,
  metadata jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);

create index ix_audit_logs_ronda_criado on audit_logs (ronda_id, criado_em desc);
create index ix_audit_logs_usuario_criado on audit_logs (usuario_id, criado_em desc);

-- Possiveis evolucoes:
-- 1) Geofencing por setor (poligonos/raio)
-- 2) Assinatura digital e hash das evidencias
-- 3) Tabela de incidentes com workflow/SLA
