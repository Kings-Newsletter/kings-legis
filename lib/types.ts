/**
 * Formato dos documentos que o kings-worker grava e o portal lê.
 * Fonte: documento "King's Legis e King's Radar — Desenho do projeto",
 * seção "Modelo de dados". Mudou aqui, muda no worker junto.
 */

export type Casa = "camara" | "senado" | "congresso" | "assembleia";

/** Estágio normalizado. A situação original da fonte fica em `situacaoFonte`. */
export const ESTAGIOS = [
  "apresentada",
  "em_analise",
  "pautada",
  "aprovada_em_uma_casa",
  "aprovada",
  "sancionada",
  "vetada",
  "arquivada",
] as const;
export type Estagio = (typeof ESTAGIOS)[number];

export const ESTAGIO_LABEL: Record<Estagio, string> = {
  apresentada: "Apresentada",
  em_analise: "Em análise",
  pautada: "Pautada",
  aprovada_em_uma_casa: "Aprovada em uma Casa",
  aprovada: "Aprovada",
  sancionada: "Sancionada",
  vetada: "Vetada",
  arquivada: "Arquivada",
};

export type ExplicacaoStatus = "sem" | "rascunho" | "aprovada" | "rejeitada";

/** Texto da redação. O portal só exibe quando status === "aprovada". */
export interface Explicacao {
  status: ExplicacaoStatus;
  texto?: string;
  contextLabel?: string;
  geradoEm?: Date;
  aprovadoEm?: Date;
  modelo?: string;
}

export interface Relevancia {
  score: number;
  motivos: string[];
}

export interface Autor {
  nome: string;
  partido?: string;
  uf?: string;
  tipo?: string;
  /** Id da página do político no portal ("camara-204524", "senado-5012"), quando houver. */
  idPolitico?: string;
}

/** Coleção legis_items: uma proposição. `_id` com prefixo da Casa (ex.: "camara:2345678"). */
export interface LegisItem {
  _id: string;
  casa: Casa;
  uf?: string;
  sigla: string;
  numero: number;
  ano: number;
  ementa: string;
  autores: Autor[];
  temas: string[];
  dataApresentacao: Date;
  estagio: Estagio;
  situacaoFonte: string;
  ultimaAtualizacao: Date;
  urlOficial: string;
  relevancia?: Relevancia;
  explicacao?: Explicacao;
  outrasCasas?: string[];
}

export type LegisEventTipo = "tramitacao" | "pauta" | "votacao" | "sancao" | "veto";

/** Coleção legis_events: um evento de uma proposição. */
export interface LegisEvent {
  _id: string;
  itemId: string;
  tipo: LegisEventTipo;
  data: Date;
  orgao?: string;
  descricao: string;
  urlOficial?: string;
}

export type RadarFonte = "dou" | "stf" | "tse" | "stj" | "tst" | "stm";

/** Coleção radar_items: ato do DOU ou pauta/decisão de tribunal. */
export interface RadarItem {
  _id: string;
  fonte: RadarFonte;
  orgao: string;
  tipoAto: string;
  titulo: string;
  data: Date;
  secaoDou?: 1 | 2 | 3;
  urlOficial: string;
  relevancia?: Relevancia;
  explicacao?: Explicacao;
  legisItemId?: string;
}
