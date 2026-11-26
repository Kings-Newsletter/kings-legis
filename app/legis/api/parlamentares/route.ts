import { buscarParlamentaresComData } from "@/lib/parlamentares";

/**
 * Lista de deputados federais e senadores em exercício, direto da Câmara e do Senado.
 * Gerada no servidor no máximo a cada 6 horas e servida do cache da CDN.
 */
export const revalidate = 21600;

export async function GET() {
  try {
    const { parlamentares, consultadoEm } = await buscarParlamentaresComData();
    return Response.json(
      { atualizadoEm: consultadoEm.toISOString(), parlamentares },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } },
    );
  } catch (erro) {
    return Response.json(
      { erro: "Não foi possível consultar a Câmara ou o Senado agora.", detalhe: String(erro) },
      { status: 502 },
    );
  }
}
