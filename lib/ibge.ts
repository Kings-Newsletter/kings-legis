import type { Regiao } from "./brasil";

/**
 * Dados do IBGE usados nos cards do mapa: estimativa de população (agregado 6579)
 * e contagem de municípios. As rotas em app/legis/api/ibge/* chamam estas funções
 * e a CDN guarda o resultado; o navegador nunca fala direto com o IBGE para isso.
 */

const AGREGADOS = "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324";
const LOCALIDADES = "https://servicodados.ibge.gov.br/api/v1/localidades";

/** Código IBGE de cada UF. */
export const CODIGO_UF: Record<string, number> = {
  RO: 11, AC: 12, AM: 13, RR: 14, PA: 15, AP: 16, TO: 17,
  MA: 21, PI: 22, CE: 23, RN: 24, PB: 25, PE: 26, AL: 27, SE: 28, BA: 29,
  MG: 31, ES: 32, RJ: 33, SP: 35,
  PR: 41, SC: 42, RS: 43,
  MS: 50, MT: 51, GO: 52, DF: 53,
};

const REGIAO_POR_CODIGO: Record<string, Regiao> = { "1": "N", "2": "NE", "3": "SE", "4": "S", "5": "CO" };

export interface ResumoIbge {
  /** Ano da estimativa de população. */
  ano: string;
  brasil: number;
  regioes: Partial<Record<Regiao, number>>;
  ufs: Record<string, number>;
  /** Municípios por UF (Brasília conta como 1 no DF). */
  municipios: Record<string, number>;
}

interface Serie {
  localidade: { id: string; nivel: { id: string } };
  serie: Record<string, string>;
}

async function obter<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`IBGE respondeu ${r.status}`);
  return (await r.json()) as T;
}

function series(json: { resultados: { series: Serie[] }[] }[]) {
  return json[0]?.resultados[0]?.series ?? [];
}

export async function buscarResumoIbge(): Promise<ResumoIbge> {
  const [pop, muns] = await Promise.all([
    obter<{ resultados: { series: Serie[] }[] }[]>(`${AGREGADOS}?localidades=N1[all]|N2[all]|N3[all]`),
    obter<{ "UF-sigla": string }[]>(`${LOCALIDADES}/municipios?view=nivelado`),
  ]);
  const ufPorCodigo = Object.fromEntries(Object.entries(CODIGO_UF).map(([uf, c]) => [String(c), uf]));
  const resumo: ResumoIbge = { ano: "", brasil: 0, regioes: {}, ufs: {}, municipios: {} };
  for (const s of series(pop)) {
    const [ano, valor] = Object.entries(s.serie)[0] ?? [];
    if (!ano || !valor) continue;
    resumo.ano = ano;
    const n = Number(valor);
    const id = s.localidade.id;
    if (s.localidade.nivel.id === "N1") resumo.brasil = n;
    else if (s.localidade.nivel.id === "N2" && REGIAO_POR_CODIGO[id]) resumo.regioes[REGIAO_POR_CODIGO[id]] = n;
    else if (s.localidade.nivel.id === "N3" && ufPorCodigo[id]) resumo.ufs[ufPorCodigo[id]] = n;
  }
  for (const m of muns) resumo.municipios[m["UF-sigla"]] = (resumo.municipios[m["UF-sigla"]] ?? 0) + 1;
  return resumo;
}

/** População estimada de cada município de uma UF, pelo código IBGE do município. */
export async function buscarPopulacaoMunicipios(uf: string): Promise<{ ano: string; populacao: Record<string, number> }> {
  const codigo = CODIGO_UF[uf];
  if (!codigo) throw new Error("UF inválida");
  const json = await obter<{ resultados: { series: Serie[] }[] }[]>(`${AGREGADOS}?localidades=N6[N3[${codigo}]]`);
  let ano = "";
  const populacao: Record<string, number> = {};
  for (const s of series(json)) {
    const [a, valor] = Object.entries(s.serie)[0] ?? [];
    if (!a || !valor) continue;
    ano = a;
    populacao[s.localidade.id] = Number(valor);
  }
  return { ano, populacao };
}

/**
 * Tamanho da assembleia (ou da Câmara Legislativa) pela regra da Constituição (art. 27):
 * o triplo da bancada federal até 36; acima disso, mais um por deputado federal além de 12.
 */
export function deputadosEstaduaisPorRegra(federais: number) {
  return federais <= 12 ? federais * 3 : 36 + (federais - 12);
}
