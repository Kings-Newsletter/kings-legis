import { buscarResumoIbge } from "@/lib/ibge";

/**
 * População estimada (Brasil, regiões e UFs) e número de municípios por UF.
 * Muda uma vez por ano: a CDN guarda a resposta por 7 dias.
 */
export async function GET() {
  try {
    const resumo = await buscarResumoIbge();
    return Response.json(resumo, {
      headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" },
    });
  } catch (erro) {
    return Response.json({ erro: "Não foi possível consultar o IBGE agora.", detalhe: String(erro) }, { status: 502 });
  }
}
