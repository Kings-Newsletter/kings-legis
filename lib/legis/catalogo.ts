/**
 * Rótulos e listas fixas do Legis, usados por páginas e filtros. Sem acesso ao
 * banco: pode ser importado por componentes de cliente.
 */

import { ESTAGIO_LABEL, type Casa, type Estagio } from "@/lib/types";

export const CASA_LABEL: Record<Casa, string> = {
  camara: "Câmara",
  senado: "Senado",
  congresso: "Congresso",
  assembleia: "Assembleia",
};

/** Com artigo, para frases: "a Câmara", "o Senado". */
export const CASA_COM_ARTIGO: Record<Casa, { o: string; do: string }> = {
  camara: { o: "a Câmara", do: "da Câmara" },
  senado: { o: "o Senado", do: "do Senado" },
  congresso: { o: "o Congresso", do: "do Congresso" },
  assembleia: { o: "a Assembleia", do: "da Assembleia" },
};

/** Casas da lista de proposições (as assembleias entram numa fase seguinte). */
export const CASAS_FILTRO = ["camara", "senado"] as const;

/** Tipos de proposição acompanhados (o mesmo catálogo do kings-worker). */
export const TIPOS: { sigla: string; nome: string }[] = [
  { sigla: "PL", nome: "Projeto de lei" },
  { sigla: "PLP", nome: "Projeto de lei complementar" },
  { sigla: "PEC", nome: "Proposta de emenda à Constituição" },
  { sigla: "MPV", nome: "Medida provisória" },
  { sigla: "PDL", nome: "Projeto de decreto legislativo" },
  { sigla: "PLV", nome: "Projeto de lei de conversão" },
  { sigla: "VET", nome: "Veto" },
];

/**
 * Caminho normal de uma proposição, na ordem. "vetada" e "arquivada" são saídas
 * do caminho e aparecem à parte na trilha.
 */
export const TRILHA: Estagio[] = [
  "apresentada",
  "em_analise",
  "pautada",
  "aprovada_em_uma_casa",
  "aprovada",
  "sancionada",
];

export function rotuloEstagio(e: Estagio): string {
  return ESTAGIO_LABEL[e] ?? e;
}

/** Ex.: "PL 1234/2026". */
export function identificacao(p: { sigla: string; numero: number; ano: number }): string {
  return `${p.sigla} ${p.numero}/${p.ano}`;
}

/**
 * O _id do banco tem o prefixo da Casa com dois-pontos ("camara:2345678"); na URL
 * vira hífen ("camara-2345678"), que é mais limpo e não precisa de escape.
 */
export function urlProposicao(id: string): string {
  return `/legis/proposicoes/${id.replace(":", "-")}`;
}

export function idDaUrl(slug: string): string {
  const s = decodeURIComponent(slug);
  return s.includes(":") ? s : s.replace("-", ":");
}

const DATA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short",
  timeStyle: "short",
});

export const dataBr = (d: Date | string | undefined) => (d ? DATA.format(new Date(d)) : "—");
export const dataHoraBr = (d: Date | string | undefined) => (d ? DATA_HORA.format(new Date(d)) : "—");
