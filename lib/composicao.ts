import "server-only";

import { RETRATO, montarComposicao, type Composicao } from "./bancadas";
import { buscarParlamentaresComData } from "./parlamentares";

const contar = (chaves: string[]) =>
  chaves.reduce<Record<string, number>>((c, k) => ((c[k] = (c[k] ?? 0) + 1), c), {});

/**
 * Composição do Congresso direto da Câmara e do Senado (deputados e senadores em
 * exercício), contada por partido e por UF. O fetch fica no cache do servidor por
 * 6 horas, então a visita não chama as fontes. Se as duas falharem, volta o retrato
 * de 15/11/2026, e a faixa do topo avisa.
 */
export async function buscarComposicao(): Promise<Composicao> {
  try {
    const { parlamentares, consultadoEm } = await buscarParlamentaresComData();
    const deputados = parlamentares.filter((p) => p.cargo === "Deputado(a) federal");
    const senadores = parlamentares.filter((p) => p.cargo === "Senador(a)");
    if (!deputados.length || !senadores.length) throw new Error("lista vazia");
    return montarComposicao(
      contar(deputados.map((p) => p.partido)),
      contar(senadores.map((p) => p.partido)),
      contar(deputados.map((p) => p.uf)),
      consultadoEm.toISOString(),
      "api",
    );
  } catch (erro) {
    console.error("[legis] composição: usando o retrato de 15/11/2026", erro);
    return RETRATO;
  }
}
