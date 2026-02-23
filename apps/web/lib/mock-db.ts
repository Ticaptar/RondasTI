import type {
  AuditLog,
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

type SessionRecord = {
  token: string;
  userId: string;
  criadoEm: string;
  atualizadoEm: string;
};

type Store = {
  seq: number;
  users: User[];
  template: ChecklistTemplate;
  rondas: Ronda[];
  auditLogs: AuditLog[];
  sessions: SessionRecord[];
};

declare global {
  // eslint-disable-next-line no-var
  var __RONDAFLOW_MOCK_STORE__: Store | undefined;
}

function nowIso() {
  return new Date().toISOString();
}

function genId(prefix: string, store: Store) {
  store.seq += 1;
  return `${prefix}_${String(store.seq).padStart(5, "0")}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createTemplate(): ChecklistTemplate {
  const setores = [
    { id: "setor-ti", nome: "CPD / Sala de TI", ordem: 1, checkpointHint: "Racks, nobreak e temperatura" },
    { id: "setor-rh", nome: "RH", ordem: 2, checkpointHint: "Equipamentos ligados e segurança física" },
    { id: "setor-fin", nome: "Financeiro", ordem: 3, checkpointHint: "Acesso, estações e impressoras" },
    { id: "setor-exp", nome: "Expedição", ordem: 4, checkpointHint: "Coletores, rede e câmeras" },
    { id: "setor-port", nome: "Portaria", ordem: 5, checkpointHint: "CFTV, link, comunicação" }
  ];

  const itens = [
    ["setor-ti", "Temperatura adequada", "Verificar ar-condicionado e temperatura do rack.", false],
    ["setor-ti", "Nobreak sem alarme", "Confirmar status visual/sonoro do nobreak.", true],
    ["setor-ti", "Links ativos", "Validar painel/monitoramento do link principal e backup.", false],
    ["setor-rh", "Estações operacionais", "Teste rápido de login/rede em estação do setor.", false],
    ["setor-rh", "Impressora sem erro", "Checar papel, erro e conectividade de impressão.", true],
    ["setor-fin", "Acesso ao ERP", "Validar abertura do sistema com usuário de teste.", true],
    ["setor-fin", "Scanner funcionando", "Verificar digitalização e integração em pasta rede.", true],
    ["setor-exp", "Wi-Fi coletores estável", "Checar sinal e sincronização de um coletor.", true],
    ["setor-exp", "Câmeras online", "Confirmar pelo menos 1 câmera de monitoramento.", true],
    ["setor-port", "Internet portaria ok", "Testar navegação e comunicação com recepção.", false],
    ["setor-port", "CFTV gravando", "Conferir status do gravador e armazenamento.", true]
  ].map((entry, idx) => ({
    id: `tmpl_item_${String(idx + 1).padStart(2, "0")}`,
    setorId: entry[0] as string,
    titulo: entry[1] as string,
    descricao: entry[2] as string,
    obrigatorioFotoIncidente: entry[3] as boolean
  }));

  return {
    id: "tmpl_ronda_ti",
    nome: "Ronda Diaria TI",
    versao: 1,
    setores,
    itens
  };
}

function seedStore(): Store {
  const template = createTemplate();
  const store: Store = {
    seq: 100,
    users: [
      { id: "user_analista_01", nome: "Marcos TI", username: "marcos", role: "analista" },
      { id: "user_analista_02", nome: "Ana Infra", username: "ana", role: "analista" },
      { id: "user_gestor_01", nome: "Carla Gestora", username: "carla", role: "gestor" }
    ],
    template,
    rondas: [],
    auditLogs: [],
    sessions: []
  };

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  ontem.setHours(8, 2, 0, 0);
  const iniciadaEm = ontem.toISOString();
  ontem.setMinutes(44);
  const finalizadaEm = ontem.toISOString();

  const respostas: ItemResposta[] = template.itens.map((item, idx) => ({
    id: genId("rsp", store),
    itemTemplateId: item.id,
    setorId: item.setorId,
    titulo: item.titulo,
    descricao: item.descricao,
    status: idx === 4 ? "incidente" : "ok",
    observacao: idx === 4 ? "Impressora com atolamento recorrente e fila travada." : "Sem anomalias.",
    respondidoEm: new Date(new Date(iniciadaEm).getTime() + (idx + 1) * 3 * 60 * 1000).toISOString(),
    respondidoPorUserId: "user_analista_01",
    fotos: []
  }));

  const fotoIncidente: FotoRegistro = {
    id: genId("foto", store),
    rondaId: "ronda_seed_01",
    itemRespostaId: respostas[4].id,
    nomeArquivo: "impressora-rh.jpg",
    dataUrl:
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSczMjAnIGhlaWdodD0nMjAwJz48cmVjdCB3aWR0aD0nMTAwJScgaGVpZ2h0PScxMDAlJyBmaWxsPScjMTQxNjIxJy8+PHRleHQgeD0nNTAlJyB5PSc1MCUnIGR5PScuMzVlbScgZmlsbD0nI2Y4ZjhmYycgZm9udC1mYW1pbHk9J0FyaWFsJyBmb250LXNpemU9JzE2JyB0ZXh0LWFuY2hvcj0nbWlkZGxlJz5Gb3RvIGRlIGluY2lkZW50ZTwvdGV4dD48L3N2Zz4=",
    capturadaEm: new Date(new Date(iniciadaEm).getTime() + 20 * 60 * 1000).toISOString(),
    enviadaPorUserId: "user_analista_01"
  };
  respostas[4].fotos.push(fotoIncidente);

  const localizacoes: LocalizacaoPing[] = Array.from({ length: 8 }).map((_, idx) => ({
    id: genId("gps", store),
    rondaId: "ronda_seed_01",
    latitude: -23.55052 + idx * 0.00018,
    longitude: -46.633308 + (idx % 2 === 0 ? 0.00013 : 0.00021),
    precisaoMetros: 8 + idx,
    coletadaEm: new Date(new Date(iniciadaEm).getTime() + idx * 5 * 60 * 1000).toISOString(),
    origem: "simulada"
  }));

  const rondaSeed: Ronda = {
    id: "ronda_seed_01",
    templateId: template.id,
    templateNome: template.nome,
    templateVersao: template.versao,
    status: "finalizada",
    analistaId: "user_analista_01",
    analistaNome: "Marcos TI",
    iniciadaEm,
    finalizadaEm,
    observacaoGeral: "Ronda concluida com incidente na impressora do RH.",
    setoresPlanejados: clone(template.setores),
    respostas,
    localizacoes,
    auditLogIds: []
  };
  store.rondas.push(rondaSeed);

  appendAudit(store, {
    userId: "user_analista_01",
    userNome: "Marcos TI",
    rondaId: rondaSeed.id,
    acao: "ronda_iniciada",
    detalhes: "Ronda diaria iniciada.",
    criadoEm: iniciadaEm
  });
  appendAudit(store, {
    userId: "user_analista_01",
    userNome: "Marcos TI",
    rondaId: rondaSeed.id,
    acao: "item_marcado_incidente",
    detalhes: "Impressora sem erro marcado como incidente no setor RH.",
    criadoEm: new Date(new Date(iniciadaEm).getTime() + 18 * 60 * 1000).toISOString(),
    metadata: { setorId: "setor-rh", item: "Impressora sem erro" }
  });
  appendAudit(store, {
    userId: "user_analista_01",
    userNome: "Marcos TI",
    rondaId: rondaSeed.id,
    acao: "foto_adicionada",
    detalhes: "Foto vinculada ao incidente de impressora.",
    criadoEm: fotoIncidente.capturadaEm,
    metadata: { itemRespostaId: respostas[4].id }
  });
  appendAudit(store, {
    userId: "user_analista_01",
    userNome: "Marcos TI",
    rondaId: rondaSeed.id,
    acao: "ronda_finalizada",
    detalhes: "Ronda finalizada pelo analista.",
    criadoEm: finalizadaEm
  });

  return store;
}

function getStore(): Store {
  if (!globalThis.__RONDAFLOW_MOCK_STORE__) {
    globalThis.__RONDAFLOW_MOCK_STORE__ = seedStore();
  }
  return globalThis.__RONDAFLOW_MOCK_STORE__;
}

function appendAudit(store: Store, log: Omit<AuditLog, "id">) {
  const row: AuditLog = {
    ...log,
    id: genId("aud", store)
  };
  store.auditLogs.unshift(row);
  if (row.rondaId) {
    const ronda = store.rondas.find((r) => r.id === row.rondaId);
    if (ronda) {
      ronda.auditLogIds.unshift(row.id);
    }
  }
  return row;
}

function getUserById(store: Store, userId: string) {
  return store.users.find((u) => u.id === userId) ?? null;
}

function calcResumo(ronda: Ronda): RondaResumo {
  const totalItens = ronda.respostas.length;
  const itensOk = ronda.respostas.filter((r) => r.status === "ok").length;
  const itensIncidente = ronda.respostas.filter((r) => r.status === "incidente").length;
  const pendentes = ronda.respostas.filter((r) => r.status === "pendente").length;
  const percentualConcluido = totalItens === 0 ? 0 : Math.round(((totalItens - pendentes) / totalItens) * 100);
  const totalFotos = ronda.respostas.reduce((acc, r) => acc + r.fotos.length, 0);

  return {
    id: ronda.id,
    status: ronda.status,
    analistaNome: ronda.analistaNome,
    iniciadaEm: ronda.iniciadaEm,
    finalizadaEm: ronda.finalizadaEm,
    percentualConcluido,
    totalItens,
    itensOk,
    itensIncidente,
    incidentesAbertos: ronda.status === "aberta" ? itensIncidente : 0,
    totalFotos,
    totalPingsLocalizacao: ronda.localizacoes.length
  };
}

export function getTemplate() {
  return clone(getStore().template);
}

export function listUsersByRole(role: UserRole) {
  return clone(getStore().users.filter((u) => u.role === role));
}

export function loginUser(username: string, role: UserRole) {
  const store = getStore();
  const normalized = username.trim().toLowerCase();
  const user =
    store.users.find((u) => u.role === role && u.username.toLowerCase() === normalized) ??
    store.users.find((u) => u.role === role) ??
    null;

  if (!user) return null;
  const token = genId("sess", store);
  const now = nowIso();
  store.sessions.push({ token, userId: user.id, criadoEm: now, atualizadoEm: now });
  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    acao: "login",
    detalhes: `Login realizado no perfil ${user.role}.`,
    criadoEm: now
  });
  return {
    token,
    user: clone(user) as SessionUser
  };
}

export function logoutSession(token: string) {
  const store = getStore();
  const session = store.sessions.find((s) => s.token === token);
  if (session) {
    const user = getUserById(store, session.userId);
    if (user) {
      appendAudit(store, {
        userId: user.id,
        userNome: user.nome,
        acao: "logout",
        detalhes: `Logout realizado no perfil ${user.role}.`,
        criadoEm: nowIso()
      });
    }
  }
  store.sessions = store.sessions.filter((s) => s.token !== token);
}

export function getSessionUserByToken(token: string): SessionUser | null {
  const store = getStore();
  const session = store.sessions.find((s) => s.token === token);
  if (!session) return null;
  session.atualizadoEm = nowIso();
  const user = getUserById(store, session.userId);
  if (!user) return null;
  return clone(user);
}

export function listRondas(params?: { analistaId?: string }) {
  const store = getStore();
  const filtered = params?.analistaId ? store.rondas.filter((r) => r.analistaId === params.analistaId) : store.rondas;
  return clone(
    [...filtered]
      .sort((a, b) => new Date(b.iniciadaEm).getTime() - new Date(a.iniciadaEm).getTime())
      .map((r) => calcResumo(r))
  );
}

export function getRondaById(rondaId: string) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === rondaId);
  return ronda ? clone(ronda) : null;
}

export function startRonda(analistaId: string) {
  const store = getStore();
  const user = getUserById(store, analistaId);
  if (!user) return null;

  const abertasDoAnalista = store.rondas.filter((r) => r.analistaId === analistaId && r.status === "aberta");
  if (abertasDoAnalista.length > 0) {
    return clone(abertasDoAnalista[0]);
  }

  const iniciadaEm = nowIso();
  const rondaId = genId("ronda", store);
  const respostas: ItemResposta[] = store.template.itens.map((item) => ({
    id: genId("rsp", store),
    itemTemplateId: item.id,
    setorId: item.setorId,
    titulo: item.titulo,
    descricao: item.descricao,
    status: "pendente",
    observacao: "",
    fotos: []
  }));

  const ronda: Ronda = {
    id: rondaId,
    templateId: store.template.id,
    templateNome: store.template.nome,
    templateVersao: store.template.versao,
    status: "aberta",
    analistaId: user.id,
    analistaNome: user.nome,
    iniciadaEm,
    observacaoGeral: "",
    setoresPlanejados: clone(store.template.setores),
    respostas,
    localizacoes: [],
    auditLogIds: []
  };
  store.rondas.unshift(ronda);
  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: "ronda_iniciada",
    detalhes: "Nova ronda iniciada.",
    criadoEm: iniciadaEm
  });
  return clone(ronda);
}

export function updateResposta(params: {
  rondaId: string;
  itemRespostaId: string;
  status: ItemStatus;
  observacao?: string;
  userId: string;
}) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === params.rondaId);
  const user = getUserById(store, params.userId);
  if (!ronda || !user) return null;
  const resposta = ronda.respostas.find((r) => r.id === params.itemRespostaId);
  if (!resposta) return null;

  resposta.status = params.status;
  if (typeof params.observacao === "string") {
    resposta.observacao = params.observacao;
  }
  resposta.respondidoEm = nowIso();
  resposta.respondidoPorUserId = user.id;

  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: params.status === "incidente" ? "item_marcado_incidente" : "item_marcado_ok",
    detalhes: `Item "${resposta.titulo}" marcado como ${params.status.toUpperCase()}.`,
    criadoEm: resposta.respondidoEm,
    metadata: { itemRespostaId: resposta.id, setorId: resposta.setorId }
  });

  if (typeof params.observacao === "string" && params.observacao.trim()) {
    appendAudit(store, {
      userId: user.id,
      userNome: user.nome,
      rondaId: ronda.id,
      acao: "item_observacao_atualizada",
      detalhes: `Observação registrada no item "${resposta.titulo}".`,
      criadoEm: nowIso(),
      metadata: { itemRespostaId: resposta.id }
    });
  }

  return clone(ronda);
}

export function updateRondaObservacaoGeral(params: { rondaId: string; observacaoGeral: string; userId: string }) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === params.rondaId);
  if (!ronda) return null;
  const user = getUserById(store, params.userId);
  if (!user) return null;
  ronda.observacaoGeral = params.observacaoGeral;
  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: "item_observacao_atualizada",
    detalhes: "Observação geral da ronda atualizada.",
    criadoEm: nowIso()
  });
  return clone(ronda);
}

export function addFotoToRonda(params: {
  rondaId: string;
  itemRespostaId?: string;
  nomeArquivo: string;
  dataUrl: string;
  userId: string;
}) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === params.rondaId);
  const user = getUserById(store, params.userId);
  if (!ronda || !user) return null;

  let target: ItemResposta | undefined;
  if (params.itemRespostaId) {
    target = ronda.respostas.find((r) => r.id === params.itemRespostaId);
    if (!target) return null;
  }

  const foto: FotoRegistro = {
    id: genId("foto", store),
    rondaId: ronda.id,
    itemRespostaId: target?.id,
    nomeArquivo: params.nomeArquivo,
    dataUrl: params.dataUrl,
    capturadaEm: nowIso(),
    enviadaPorUserId: user.id
  };

  if (target) {
    target.fotos.unshift(foto);
  }

  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: "foto_adicionada",
    detalhes: `Foto adicionada${target ? ` ao item "${target.titulo}"` : " na ronda"}.`,
    criadoEm: foto.capturadaEm,
    metadata: { itemRespostaId: target?.id ?? null }
  });

  return clone(foto);
}

export function addLocalizacao(params: {
  rondaId: string;
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  origem: "gps" | "manual" | "simulada";
  userId: string;
}) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === params.rondaId);
  const user = getUserById(store, params.userId);
  if (!ronda || !user) return null;

  const ping: LocalizacaoPing = {
    id: genId("gps", store),
    rondaId: ronda.id,
    latitude: params.latitude,
    longitude: params.longitude,
    precisaoMetros: params.precisaoMetros,
    coletadaEm: nowIso(),
    origem: params.origem
  };
  ronda.localizacoes.push(ping);

  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: "localizacao_registrada",
    detalhes: `Ponto de localização registrado (${params.origem}).`,
    criadoEm: ping.coletadaEm,
    metadata: { lat: params.latitude, lng: params.longitude }
  });

  return clone(ping);
}

export function finalizeRonda(params: { rondaId: string; userId: string }) {
  const store = getStore();
  const ronda = store.rondas.find((r) => r.id === params.rondaId);
  const user = getUserById(store, params.userId);
  if (!ronda || !user) return null;
  ronda.status = "finalizada";
  ronda.finalizadaEm = nowIso();

  appendAudit(store, {
    userId: user.id,
    userNome: user.nome,
    rondaId: ronda.id,
    acao: "ronda_finalizada",
    detalhes: "Ronda finalizada.",
    criadoEm: ronda.finalizadaEm
  });
  return clone(ronda);
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const store = getStore();
  const hoje = new Date();
  const keyHoje = hoje.toISOString().slice(0, 10);
  const rondasResumo = listRondas();
  const rondasHojeRaw = store.rondas.filter((r) => r.iniciadaEm.slice(0, 10) === keyHoje);
  const rondasFinalizadasHoje = rondasHojeRaw.filter((r) => r.status === "finalizada" && r.finalizadaEm);
  const incidentesHoje = rondasHojeRaw.reduce(
    (acc, r) => acc + r.respostas.filter((rsp) => rsp.status === "incidente").length,
    0
  );
  const totalPingsHoje = rondasHojeRaw.reduce((acc, r) => acc + r.localizacoes.length, 0);

  const mediaDuracaoMinutosRondasFinalizadasHoje =
    rondasFinalizadasHoje.length === 0
      ? 0
      : Math.round(
          rondasFinalizadasHoje.reduce((acc, r) => {
            const fim = new Date(r.finalizadaEm as string).getTime();
            const ini = new Date(r.iniciadaEm).getTime();
            return acc + (fim - ini) / (1000 * 60);
          }, 0) / rondasFinalizadasHoje.length
        );

  return clone({
    metricas: {
      rondasHoje: rondasHojeRaw.length,
      rondasAbertas: store.rondas.filter((r) => r.status === "aberta").length,
      incidentesHoje,
      mediaDuracaoMinutosRondasFinalizadasHoje,
      totalPingsHoje
    },
    rondas: rondasResumo,
    auditoriaRecente: store.auditLogs.slice(0, 50)
  });
}

export function listAuditLogsByRonda(rondaId: string) {
  const store = getStore();
  return clone(store.auditLogs.filter((log) => log.rondaId === rondaId));
}
