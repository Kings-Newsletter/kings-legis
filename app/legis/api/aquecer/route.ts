import { aquecerCotaSenado } from "@/lib/perfil";
import { aquecerFontesDoPerfil } from "@/lib/perfil-extra";

/**
 * Aquecimento diário dos caches das fichas de políticos (cron da Vercel, ver vercel.json).
 *
 * Os arquivos oficiais mais pesados (cota e folha do Senado, funcionários da Câmara,
 * candidatos do TSE) são baixados aqui, uma vez por dia, em vez de na primeira visita.
 *
 * Só roda com o cabeçalho `Authorization: Bearer <CRON_SECRET>`, que a Vercel envia nas
 * chamadas de cron quando a variável CRON_SECRET está configurada no projeto. Em
 * desenvolvimento, sem CRON_SECRET, a rota fica aberta para testar.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const emDesenvolvimento = process.env.NODE_ENV !== "production";
  if (segredo ? request.headers.get("authorization") !== `Bearer ${segredo}` : !emDesenvolvimento) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const inicio = Date.now();
  const t0 = Date.now();
  const cota = await aquecerCotaSenado();
  const etapas = [
    { etapa: "Senado: cota parlamentar (ano atual e anterior)", ok: cota, falhas: 2 - cota, ms: Date.now() - t0 },
    ...(await aquecerFontesDoPerfil()),
  ];
  const falhas = etapas.reduce((t, e) => t + e.falhas, 0);
  if (falhas) console.error("[legis] aquecimento com falhas", etapas);

  return Response.json(
    { ok: falhas === 0, duracaoMs: Date.now() - inicio, etapas },
    { headers: { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } },
  );
}
