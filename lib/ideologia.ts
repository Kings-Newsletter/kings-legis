/**
 * Posição dos partidos no eixo esquerda–direita (0 a 10).
 *
 * Fonte: Bolognesi, Ribeiro e Codato, "Uma nova classificação ideológica dos partidos
 * políticos brasileiros", revista Dados, v. 66, n. 2, 2023 (survey com cientistas
 * políticos em 2018), tabela 1. https://doi.org/10.1590/dados.2023.66.2.303
 *
 * Partidos que mudaram de nome levam a nota da sigla antiga (PPS → Cidadania, PRB →
 * Republicanos, PR → PL, SDD → Solidariedade, PTC → Agir, PMN → Mobiliza). Partidos
 * nascidos de fusão depois da pesquisa não têm nota própria: ficam no campo em que as
 * duas siglas de origem estavam (União = DEM + PSL; PRD = PTB + Patriota, ambas à
 * direita). Partido criado depois da pesquisa (Missão) fica sem nota.
 */

export type Campo = "esquerda" | "centro" | "direita";

export const CAMPOS: { id: Campo; rotulo: string; cor: string }[] = [
  { id: "esquerda", rotulo: "Esquerda", cor: "#c8574b" },
  { id: "centro", rotulo: "Centro", cor: "#8a96a3" },
  { id: "direita", rotulo: "Direita", cor: "#3f6fa8" },
];

/** Nota média da pesquisa (0 = extrema-esquerda, 10 = extrema-direita). */
export const NOTA: Record<string, number> = {
  PSTU: 0.51,
  PCO: 0.61,
  PCB: 0.91,
  PSOL: 1.28,
  PCdoB: 1.92,
  PT: 2.97,
  PDT: 3.92,
  PSB: 4.05,
  REDE: 4.77,
  CIDADANIA: 4.92,
  PV: 5.29,
  AVANTE: 6.32,
  SOLIDARIEDADE: 6.5,
  MOBILIZA: 6.88,
  PMB: 6.9,
  MDB: 7.01,
  PSD: 7.09,
  PSDB: 7.11,
  PODE: 7.24,
  PRTB: 7.45,
  REPUBLICANOS: 7.78,
  PL: 7.78,
  AGIR: 7.86,
  DC: 8.11,
  NOVO: 8.13,
  PP: 8.2,
};

/** Fusões posteriores à pesquisa: campo das siglas de origem, sem nota própria. */
const FUSOES: Record<string, { campo: Campo; origem: string }> = {
  UNIÃO: { campo: "direita", origem: "DEM e PSL" },
  PRD: { campo: "direita", origem: "PTB e Patriota" },
};

/** Faixas da pesquisa: esquerda até 4,49; centro de 4,5 a 5,5; direita acima de 5,5. */
export function campoDe(sigla: string): Campo | null {
  const nota = NOTA[sigla];
  if (nota !== undefined) return nota < 4.5 ? "esquerda" : nota <= 5.5 ? "centro" : "direita";
  return FUSOES[sigla]?.campo ?? null;
}

/** Valor usado para ordenar da esquerda para a direita (fusões: média das origens). */
export function posicaoNoEixo(sigla: string): number {
  const nota = NOTA[sigla];
  if (nota !== undefined) return nota;
  if (sigla === "UNIÃO") return (8.57 + 8.11) / 2;
  if (sigla === "PRD") return (6.1 + 8.55) / 2;
  return 11; // sem nota: no fim
}

/** Texto curto sobre a posição do partido, para cartões e minicards. */
export function descricaoCampo(sigla: string): string {
  const nota = NOTA[sigla];
  const campo = campoDe(sigla);
  if (nota !== undefined && campo) return `${campo} · nota ${nota.toFixed(2).replace(".", ",")}`;
  const fusao = FUSOES[sigla];
  if (fusao) return `${fusao.campo} · fusão de ${fusao.origem}`;
  return "sem nota na pesquisa";
}

export const FONTE_IDEOLOGIA =
  "Bolognesi, Ribeiro e Codato, “Uma nova classificação ideológica dos partidos políticos brasileiros”, revista Dados, 2023 (pesquisa com cientistas políticos em 2018).";
