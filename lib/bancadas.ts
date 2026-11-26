/**
 * Composição da Câmara e do Senado: tipos, cores dos partidos e a montagem a partir
 * da lista de parlamentares em exercício.
 *
 * Os números vêm direto das APIs oficiais (ver lib/composicao.ts):
 * - Câmara: /api/v2/deputados, contados por siglaPartido e siglaUf.
 * - Senado: /dadosabertos/senador/lista/atual.json, contados por SiglaPartidoParlamentar.
 * O retrato de 15/11/2026 abaixo só aparece se as duas fontes falharem.
 *
 * Cada partido com a sua cor. Ordem por tamanho da bancada, nunca por posição
 * ideológica. Este arquivo não acessa a rede: pode ser importado no cliente.
 */

export type Casa = "camara" | "senado";

export interface Grupo {
  sigla: string;
  n: number;
  cor: string;
}

/**
 * Cor de cada partido, aproximada da identidade visual (logo e material oficial) de
 * cada um. Não há tabela oficial de cores no TSE: ajuste aqui se algum tom estiver
 * diferente do que o partido usa.
 */
export const COR_PARTIDO: Record<string, string> = {
  PL: "#1b3f8b",
  PT: "#cc0000",
  "UNIÃO": "#2ba3d8",
  PSD: "#f2a900",
  PP: "#2f7fc1",
  REPUBLICANOS: "#12558a",
  MDB: "#2e9b4e",
  PODE: "#7cc242",
  PSB: "#ffd84d",
  PSDB: "#8fc3ea",
  PSOL: "#f4b400",
  PCdoB: "#a30d11",
  PDT: "#e05b5b",
  PV: "#00a651",
  AVANTE: "#8a63b8",
  NOVO: "#f47920",
  SOLIDARIEDADE: "#e65100",
  PRD: "#335c99",
  REDE: "#00a39a",
  CIDADANIA: "#e6007e",
  "MISSÃO": "#9aa5b1",
  "S/Partido": "#b0b8c1",
};
const COR_SEM_DADO = "#c9d2dc";

/** Todos os partidos com a própria cor, do maior para o menor. */
function montar(contagem: Record<string, number>) {
  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const grupos: Grupo[] = ordenado.map(([sigla, n]) => ({ sigla, n, cor: COR_PARTIDO[sigla] ?? COR_SEM_DADO }));
  return { grupos, total: ordenado.reduce((s, [, n]) => s + n, 0) };
}

export interface DadosCasa {
  grupos: Grupo[];
  total: number;
  nome: string;
  fileiras: number;
  maioria: string;
}

export interface Composicao {
  camara: DadosCasa;
  senado: DadosCasa;
  /** Deputados federais em exercício por UF. */
  deputadosPorUf: Record<string, number>;
  /** ISO 8601: hora em que a Câmara e o Senado responderam. */
  consultadoEm: string;
  /** "api" quando veio das fontes agora; "retrato" quando as fontes falharam. */
  origem: "api" | "retrato";
}

export function montarComposicao(
  camara: Record<string, number>,
  senado: Record<string, number>,
  deputadosPorUf: Record<string, number>,
  consultadoEm: string,
  origem: Composicao["origem"],
): Composicao {
  return {
    camara: { ...montar(camara), nome: "Câmara dos Deputados", fileiras: 12, maioria: "Maioria simples: 257 · PEC: 308" },
    senado: { ...montar(senado), nome: "Senado Federal", fileiras: 5, maioria: "Maioria simples: 41 · PEC: 49" },
    deputadosPorUf,
    consultadoEm,
    origem,
  };
}

/** Retrato da consulta de 15/11/2026, usado só quando a Câmara e o Senado não respondem. */
export const RETRATO: Composicao = montarComposicao(
  {
    PL: 98, PT: 66, "UNIÃO": 50, PSD: 48, PP: 47, REPUBLICANOS: 43, MDB: 38, PODE: 27,
    PSB: 17, PSDB: 17, PSOL: 13, PCdoB: 11, PDT: 9, PV: 6, AVANTE: 5, NOVO: 5,
    SOLIDARIEDADE: 4, PRD: 3, REDE: 3, CIDADANIA: 2, "MISSÃO": 1,
  },
  {
    PL: 15, PSD: 14, MDB: 9, PT: 9, PP: 8, PSB: 7, REPUBLICANOS: 6, PSDB: 4,
    PODE: 3, "UNIÃO": 3, AVANTE: 1, PDT: 1, "S/Partido": 1,
  },
  {
    AC: 8, AL: 9, AM: 8, AP: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18, MG: 53,
    MS: 8, MT: 8, PA: 17, PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN: 8, RO: 8, RR: 8,
    RS: 31, SC: 16, SE: 8, SP: 70, TO: 8,
  },
  "2026-11-15T12:00:00-03:00",
  "retrato",
);

const CONSULTA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "25/11/2026 às 19:27" (horário de Brasília). */
export function formatarConsulta(iso: string): string {
  const partes = Object.fromEntries(CONSULTA.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
}

/** Só a data: "25/11/2026". */
export function dataDaConsulta(iso: string): string {
  return formatarConsulta(iso).slice(0, 10);
}
