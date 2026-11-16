/**
 * Composição atual da Câmara e do Senado.
 *
 * Retrato provisório, até a coleta do kings-worker gravar a composição no banco.
 * Consulta em 15/11/2026:
 * - Câmara: /api/v2/deputados (deputados em exercício), contados por siglaPartido e siglaUf.
 * - Senado: /dadosabertos/senador/lista/atual.json, contados por SiglaPartidoParlamentar.
 *
 * Cada partido com a sua cor. Ordem por tamanho da bancada, nunca por posição
 * ideológica.
 */

export const DATA_CONSULTA = "15/11/2026";

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

const CAMARA = {
  PL: 98, PT: 66, "UNIÃO": 50, PSD: 48, PP: 47, REPUBLICANOS: 43, MDB: 38, PODE: 27,
  PSB: 17, PSDB: 17, PSOL: 13, PCdoB: 11, PDT: 9, PV: 6, AVANTE: 5, NOVO: 5,
  SOLIDARIEDADE: 4, PRD: 3, REDE: 3, CIDADANIA: 2, "MISSÃO": 1,
};

const SENADO = {
  PL: 15, PSD: 14, MDB: 9, PT: 9, PP: 8, PSB: 7, REPUBLICANOS: 6, PSDB: 4,
  PODE: 3, "UNIÃO": 3, AVANTE: 1, PDT: 1, "S/Partido": 1,
};

export const COMPOSICAO: Record<Casa, ReturnType<typeof montar> & { nome: string; fileiras: number; maioria: string }> = {
  camara: { ...montar(CAMARA), nome: "Câmara dos Deputados", fileiras: 12, maioria: "Maioria simples: 257 · PEC: 308" },
  senado: { ...montar(SENADO), nome: "Senado Federal", fileiras: 5, maioria: "Maioria simples: 41 · PEC: 49" },
};

/** Deputados federais em exercício por UF. */
export const DEPUTADOS_POR_UF: Record<string, number> = {
  AC: 8, AL: 9, AM: 8, AP: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18, MG: 53,
  MS: 8, MT: 8, PA: 17, PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN: 8, RO: 8, RR: 8,
  RS: 31, SC: 16, SE: 8, SP: 70, TO: 8,
};
