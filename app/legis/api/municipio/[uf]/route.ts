import { CARGOS_TSE, chaveNome, codigoMunicipioTse, ELEICAO_2024, listarEleitos, UFS } from "@/lib/tse";

/**
 * Prefeito(a), vice e vereadores eleitos em 2024 num município (mandato 2025–2028).
 * Uso: /legis/api/municipio/AC?nome=Rio%20Branco
 * O TSE usa códigos de município próprios; a rota acha o código pelo nome do IBGE.
 * A CDN guarda a resposta por 7 dias.
 */
export async function GET(req: Request, { params }: { params: Promise<{ uf: string }> }) {
  const uf = (await params).uf.toUpperCase();
  const nome = new URL(req.url).searchParams.get("nome")?.trim();
  if (!UFS.includes(uf) || uf === "DF" || !nome) {
    return Response.json({ erro: "Informe uma UF válida (não há municípios no DF) e o nome do município." }, { status: 400 });
  }
  try {
    if (uf === "PE" && chaveNome(nome) === "FERNANDO DE NORONHA") {
      return Response.json(
        { erro: "Fernando de Noronha é um distrito estadual: não tem prefeitura nem câmara de vereadores." },
        { status: 404 },
      );
    }
    const codigo = await codigoMunicipioTse(uf, nome);
    if (!codigo) return Response.json({ erro: "Município não encontrado no TSE." }, { status: 404 });
    const [prefeito, vice, vereadores] = await Promise.all([
      listarEleitos(ELEICAO_2024, codigo, CARGOS_TSE.prefeito, "Prefeito(a)", uf),
      listarEleitos(ELEICAO_2024, codigo, CARGOS_TSE.vicePrefeito, "Vice-prefeito(a)", uf),
      listarEleitos(ELEICAO_2024, codigo, CARGOS_TSE.vereador, "Vereador(a)", uf),
    ]);
    return Response.json(
      { uf, nome, eleicao: 2024, prefeitura: [...prefeito, ...vice], vereadores },
      { headers: { "Cache-Control": "public, s-maxage=604800, stale-while-revalidate=2592000" } },
    );
  } catch (erro) {
    return Response.json({ erro: "Não foi possível consultar o TSE agora.", detalhe: String(erro) }, { status: 502 });
  }
}
