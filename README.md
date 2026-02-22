# RondaFlow (MVP)

Checklist de ronda TI com:

- fluxo do analista (checklist por setor)
- fotos por item
- horario de inicio/fim
- geolocalizacao e trajeto percorrido
- trilha de auditoria
- painel do gestor com acompanhamento

## Stack

- `Next.js 15`
- `React 19`
- `TypeScript`
- API mock em memoria (para demo)

## Como rodar

```bash
corepack pnpm install
corepack pnpm dev:web
```

Abrir em `http://localhost:3000`.

## Logins de demo

- Analista: `marcos`
- Analista: `ana`
- Gestor: `carla`

Use a tela `/login` para escolher o perfil.

## Fluxos implementados

### Analista

- iniciar/continuar ronda aberta
- checklist por setor
- marcar item como `OK` ou `Incidente`
- observacao por item
- upload de fotos por item (base64 no mock)
- observacao geral da ronda
- captura de localizacao por GPS (quando permitido)
- botao de ponto simulado (para demo)
- finalizacao da ronda

### Gestor

- KPIs (rondas, incidentes, duracao media, pings)
- lista/historico de rondas
- filtro por ID/analista/status
- detalhe da ronda
- visualizacao do trajeto
- incidentes com fotos
- timeline de auditoria

## Auditoria (MVP)

Eventos auditados no mock:

- login/logout
- inicio/finalizacao da ronda
- marcacao de item
- observacao
- foto adicionada
- localizacao registrada

## Persistencia atual (demo)

O projeto usa `apps/web/lib/mock-db.ts` (memoria em `globalThis`).

Isso permite validar UI/fluxo rapidamente, mas **nao** substitui banco real.

## Producao (proximo passo)

1. Trocar mock por PostgreSQL (`db/schema.sql`)
2. Subir storage para fotos (S3/MinIO/Supabase)
3. Autenticacao real (JWT/session + permissao)
4. Geolocalizacao com politica de coleta (ex.: 15-30s)
5. Geofence/QR por setor para prova de presenca
6. Offline sync (PWA) para areas sem sinal

## Estrutura

- `apps/web/app/analista` fluxo operacional
- `apps/web/app/gestor` painel gerencial
- `apps/web/app/api` APIs mock
- `apps/web/lib/mock-db.ts` dados/auditoria em memoria
- `db/schema.sql` modelagem PostgreSQL inicial
