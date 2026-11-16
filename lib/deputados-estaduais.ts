import type { Parlamentar } from "./parlamentares";
import { CARGOS_TSE, ELEICAO_2022, listarEleitos } from "./tse";

export { UFS, nomeProprio } from "./tse";

/**
 * Deputados estaduais (ou distritais, no DF) eleitos em 2022, mandato 2023–2027.
 * Ver lib/tse.ts sobre o que essa lista não cobre (suplentes, trocas de partido).
 */
export function buscarDeputadosEstaduais(uf: string): Promise<Parlamentar[]> {
  return uf === "DF"
    ? listarEleitos(ELEICAO_2022, uf, CARGOS_TSE.deputadoDistrital, "Deputado(a) distrital", uf)
    : listarEleitos(ELEICAO_2022, uf, CARGOS_TSE.deputadoEstadual, "Deputado(a) estadual", uf);
}
