import { buscarParlamentares } from "@/lib/parlamentares";

/**
 * Lista de deputados federais e senadores em exercício.
 * Gerada no servidor no máximo uma vez por dia e servida do cache da CDN.
 */
export const revalidate = 86400;

export async function GET() {
  try {
    const parlamentares = await buscarParlamentares();
    return Response.json(
      { atualizadoEm: new Date().toISOString(), parlamentares },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (erro) {
    return Response.json(
      { erro: "Não foi possível consultar a Câmara ou o Senado agora.", detalhe: String(erro) },
      { status: 502 },
    );
  }
}
