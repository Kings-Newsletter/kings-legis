import { CARGOS_TSE, ELEICAO_2022, listarEleitos, UFS } from "@/lib/tse";

/**
 * Governador(a) e vice eleitos em 2022 numa UF (mandato 2023–2026).
 * A CDN guarda a resposta por 7 dias.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const uf = (await params).uf.toUpperCase();
  if (!UFS.includes(uf)) return Response.json({ erro: "UF inválida." }, { status: 404 });
  try {
    const [governador, vice] = await Promise.all([
      listarEleitos(ELEICAO_2022, uf, CARGOS_TSE.governador, "Governador(a)", uf),
      listarEleitos(ELEICAO_2022, uf, CARGOS_TSE.viceGovernador, "Vice-governador(a)", uf),
    ]);
    return Response.json(
      { uf, eleicao: 2022, pessoas: [...governador, ...vice] },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
    );
  } catch (erro) {
    return Response.json({ erro: "Não foi possível consultar o TSE agora.", detalhe: String(erro) }, { status: 502 });
  }
}
