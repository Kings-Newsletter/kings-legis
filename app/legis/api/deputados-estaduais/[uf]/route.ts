import { buscarDeputadosEstaduais, UFS } from "@/lib/deputados-estaduais";

/**
 * Deputados estaduais (ou distritais, no DF) eleitos em 2022 numa UF.
 * O resultado de 2022 não muda: a CDN guarda a resposta por 7 dias, então o TSE
 * é consultado no máximo uma vez por semana para cada estado.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const { uf: bruto } = await params;
  const uf = bruto.toUpperCase();
  if (!UFS.includes(uf)) {
    return Response.json({ erro: "UF inválida." }, { status: 404 });
  }
  try {
    const deputados = await buscarDeputadosEstaduais(uf);
    return Response.json(
      { uf, eleicao: 2022, deputados },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
    );
  } catch (erro) {
    return Response.json({ erro: "Não foi possível consultar o TSE agora.", detalhe: String(erro) }, { status: 502 });
  }
}
