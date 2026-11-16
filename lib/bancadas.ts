/**
 * Bancadas da Câmara dos Deputados.
 *
 * Retrato provisório, até a coleta do kings-worker gravar a composição no banco.
 * Fonte: API de Dados Abertos da Câmara, /api/v2/partidos/{id} (status.totalMembros),
 * consulta em 15/11/2026. Os partidos somam 511 de 513 cadeiras; as 2 restantes
 * aparecem como "Sem dado" em vez de serem atribuídas a alguém.
 *
 * Cores frias e neutras, sem as cores oficiais dos partidos. Ordem por tamanho da
 * bancada, nunca por posição ideológica.
 */

export const TOTAL_CADEIRAS = 513;
export const BANCADAS_CONSULTA = "15/11/2026";

export interface Grupo {
  sigla: string;
  n: number;
  cor: string;
}

const principais: Grupo[] = [
  { sigla: "PL", n: 98, cor: "#1f4e79" },
  { sigla: "PT", n: 66, cor: "#3f8fa8" },
  { sigla: "UNIÃO", n: 50, cor: "#8cc5cc" },
  { sigla: "PSD", n: 48, cor: "#2b6f62" },
  { sigla: "PP", n: 46, cor: "#7ea6d8" },
  { sigla: "REPUBLICANOS", n: 42, cor: "#4a5fa8" },
  { sigla: "MDB", n: 38, cor: "#a9b4dc" },
  { sigla: "PODE", n: 27, cor: "#2f8f84" },
  { sigla: "PSB", n: 17, cor: "#bcd9e8" },
  { sigla: "PSDB", n: 17, cor: "#5d6f86" },
];

export const DEMAIS: [string, number][] = [
  ["PSOL", 13],
  ["PCdoB", 11],
  ["PDT", 9],
  ["PV", 6],
  ["AVANTE", 5],
  ["NOVO", 5],
  ["SOLIDARIEDADE", 4],
  ["PRD", 3],
  ["REDE", 3],
  ["CIDADANIA", 2],
  ["MISSÃO", 1],
];

function montarGrupos(): Grupo[] {
  const demais = DEMAIS.reduce((s, [, n]) => s + n, 0);
  const grupos = [...principais, { sigla: "Demais", n: demais, cor: "#c9d2dc" }];
  const somados = grupos.reduce((s, g) => s + g.n, 0);
  if (somados < TOTAL_CADEIRAS) {
    grupos.push({ sigla: "Sem dado", n: TOTAL_CADEIRAS - somados, cor: "#eef2f6" });
  }
  return grupos;
}

export const GRUPOS = montarGrupos();
