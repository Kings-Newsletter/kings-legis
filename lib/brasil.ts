import mapa from "@svg-maps/brazil";

/**
 * Mapa do Brasil por estado. Fonte do desenho: svg-maps, de Victor Cazanave,
 * licença CC BY 4.0 (https://github.com/VictorCazanave/svg-maps). O crédito
 * precisa ficar visível onde o mapa aparece.
 */

export type Regiao = "N" | "NE" | "CO" | "SE" | "S";

export const REGIOES: Record<Regiao, { nome: string; cor: string }> = {
  N: { nome: "Norte", cor: "#9fd6d2" },
  NE: { nome: "Nordeste", cor: "#a9c8ea" },
  CO: { nome: "Centro-Oeste", cor: "#c4cbe6" },
  SE: { nome: "Sudeste", cor: "#6f9fc4" },
  S: { nome: "Sul", cor: "#8fb7b3" },
};

const REGIAO_DA_UF: Record<string, Regiao> = {
  AC: "N", AM: "N", AP: "N", PA: "N", RO: "N", RR: "N", TO: "N",
  AL: "NE", BA: "NE", CE: "NE", MA: "NE", PB: "NE", PE: "NE", PI: "NE", RN: "NE", SE: "NE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  ES: "SE", MG: "SE", RJ: "SE", SP: "SE",
  PR: "S", RS: "S", SC: "S",
};

export interface Estado {
  uf: string;
  nome: string;
  regiao: Regiao;
  path: string;
}

interface MapaSvg {
  viewBox: string;
  locations: { id: string; name: string; path: string }[];
}

const dados = mapa as unknown as MapaSvg;

export const MAPA_VIEWBOX = dados.viewBox;

export const ESTADOS: Estado[] = dados.locations.map((l) => {
  const uf = l.id.toUpperCase();
  return { uf, nome: l.name, regiao: REGIAO_DA_UF[uf] ?? "N", path: l.path };
});
