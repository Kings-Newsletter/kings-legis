import { buscarPopulacaoMunicipios, CODIGO_UF } from "@/lib/ibge";

/**
 * População estimada de cada município de uma UF, pelo código IBGE.
 * A CDN guarda a resposta por 7 dias.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const uf = (await params).uf.toUpperCase();
  if (!CODIGO_UF[uf]) return Response.json({ erro: "UF inválida." }, { status: 404 });
  try {
    const dados = await buscarPopulacaoMunicipios(uf);
    return Response.json(
      { uf, ...dados },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
    );
  } catch (erro) {
    return Response.json({ erro: "Não foi possível consultar o IBGE agora.", detalhe: String(erro) }, { status: 502 });
  }
}
