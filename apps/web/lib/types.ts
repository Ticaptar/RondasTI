export type UserRole = "analista" | "gestor";

export interface User {
  id: string;
  nome: string;
  username: string;
  role: UserRole;
}

export interface ChecklistItemTemplate {
  id: string;
  setorId: string;
  titulo: string;
  descricao: string;
  obrigatorioFotoIncidente: boolean;
}

export interface Setor {
  id: string;
  nome: string;
  ordem: number;
  checkpointHint: string;
}

export interface ChecklistTemplate {
  id: string;
  nome: string;
  versao: number;
  setores: Setor[];
  itens: ChecklistItemTemplate[];
}

export interface ChecklistModeloResumo {
  id: string;
  nome: string;
  versao: number;
  ativo: boolean;
  totalItens: number;
  totalSetores: number;
  criadoEm?: string;
}

export interface ChecklistModeloItemInput {
  setorId: string;
  titulo: string;
  descricao: string;
  obrigatorioFotoIncidente: boolean;
  ordem: number;
}

export type ItemStatus = "pendente" | "ok" | "incidente";
export type RondaStatus = "aberta" | "finalizada";

export interface FotoRegistro {
  id: string;
  rondaId: string;
  itemRespostaId?: string;
  nomeArquivo: string;
  dataUrl: string;
  capturadaEm: string;
  enviadaPorUserId: string;
}

export interface LocalizacaoPing {
  id: string;
  rondaId: string;
  latitude: number;
  longitude: number;
  precisaoMetros: number | null;
  coletadaEm: string;
  origem: "gps" | "manual" | "simulada";
}

export interface ItemResposta {
  id: string;
  itemTemplateId: string;
  setorId: string;
  titulo: string;
  descricao: string;
  status: ItemStatus;
  observacao: string;
  respondidoEm?: string;
  respondidoPorUserId?: string;
  fotos: FotoRegistro[];
}

export interface AuditLog {
  id: string;
  rondaId?: string;
  userId: string;
  userNome: string;
  acao:
    | "login"
    | "logout"
    | "ronda_iniciada"
    | "item_marcado_ok"
    | "item_marcado_incidente"
    | "item_observacao_atualizada"
    | "foto_adicionada"
    | "localizacao_registrada"
    | "ronda_finalizada";
  detalhes: string;
  criadoEm: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface Ronda {
  id: string;
  templateId: string;
  templateNome: string;
  templateVersao: number;
  status: RondaStatus;
  analistaId: string;
  analistaNome: string;
  iniciadaEm: string;
  finalizadaEm?: string;
  observacaoGeral: string;
  setoresPlanejados: Setor[];
  respostas: ItemResposta[];
  localizacoes: LocalizacaoPing[];
  auditLogIds: string[];
}

export interface SessionUser {
  id: string;
  nome: string;
  username: string;
  role: UserRole;
}

export interface RondaResumo {
  id: string;
  status: RondaStatus;
  analistaNome: string;
  iniciadaEm: string;
  finalizadaEm?: string;
  percentualConcluido: number;
  totalItens: number;
  itensOk: number;
  itensIncidente: number;
  incidentesAbertos: number;
  totalFotos: number;
  totalPingsLocalizacao: number;
}

export interface DashboardSnapshot {
  metricas: {
    rondasHoje: number;
    rondasAbertas: number;
    incidentesHoje: number;
    mediaDuracaoMinutosRondasFinalizadasHoje: number;
    totalPingsHoje: number;
  };
  rondas: RondaResumo[];
  auditoriaRecente: AuditLog[];
}
