/**
 * Composição atual da Câmara e do Senado.
 *
 * Retrato provisório, até a coleta do kings-worker gravar a composição no banco.
 * Consulta em 15/11/2026:
 * - Câmara: /api/v2/deputados (deputados em exercício), contados por siglaPartido e siglaUf.
 * - Senado: /dadosabertos/senador/lista/atual.json, contados por SiglaPartidoParlamentar.
 *
 * Cores frias e neutras, sem as cores oficiais dos partidos. Ordem por tamanho da
 * bancada, nunca por posição ideológica.
 */

export const DATA_CONSULTA = "15/11/2026";

export type Casa = "camara" | "senado";

export interface Grupo {
  sigla: string;
  n: number;
  cor: string;
}

const PALETA = [
  "#1f4e79", "#3f8fa8", "#8cc5cc", "#2b6f62", "#7ea6d8",
  "#4a5fa8", "#a9b4dc", "#2f8f84", "#bcd9e8", "#5d6f86",
];
const COR_DEMAIS = "#c9d2dc";

/** Os maiores ganham cor própria; os demais viram um grupo só. */
function montar(contagem: Record<string, number>, comCor: number) {
  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const principais = ordenado.slice(0, comCor);
  const demais = ordenado.slice(comCor);
  const grupos: Grupo[] = principais.map(([sigla, n], i) => ({ sigla, n, cor: PALETA[i % PALETA.length]! }));
  if (demais.length) {
    grupos.push({ sigla: "Demais", n: demais.reduce((s, [, n]) => s + n, 0), cor: COR_DEMAIS });
  }
  return { grupos, demais, total: ordenado.reduce((s, [, n]) => s + n, 0) };
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
  camara: { ...montar(CAMARA, 10), nome: "Câmara dos Deputados", fileiras: 12, maioria: "Maioria simples: 257 · PEC: 308" },
  senado: { ...montar(SENADO, 10), nome: "Senado Federal", fileiras: 5, maioria: "Maioria simples: 41 · PEC: 49" },
};

/** Deputados federais em exercício por UF. */
export const DEPUTADOS_POR_UF: Record<string, number> = {
  AC: 8, AL: 9, AM: 8, AP: 8, BA: 39, CE: 22, DF: 8, ES: 10, GO: 17, MA: 18, MG: 53,
  MS: 8, MT: 8, PA: 17, PB: 12, PE: 25, PI: 10, PR: 30, RJ: 46, RN: 8, RO: 8, RR: 8,
  RS: 31, SC: 16, SE: 8, SP: 70, TO: 8,
};
