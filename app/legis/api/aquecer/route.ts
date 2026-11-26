import { hojeBrasilia } from "@/lib/legis/agenda";
import { aquecerCotaSenado } from "@/lib/perfil";
import { aquecerFontesDoPerfil } from "@/lib/perfil-extra";
import { ultimaEdicaoDou } from "@/lib/radar/dou";
import { TRIBUNAIS, noticiasDosTribunais } from "@/lib/radar/tribunais";

/**
 * Aquecimento dos caches do portal, chamado pelo agendador do kings-worker (o portal não
 * agenda nada na Vercel: o limite de CPU é da conta inteira).
 *
 *   GET /legis/api/aquecer?parte=radar   → edição do DOU do dia e notícias dos tribunais
 *   GET /legis/api/aquecer?parte=perfis  → arquivos pesados das fichas de políticos
 *   GET /legis/api/aquecer               → as duas partes
 *
 * Sugestão de agenda no worker: `radar` a cada 30 minutos das 6h às 22h (o DOU sai de
 * madrugada e pode ter edição extra) e `perfis` uma vez por dia, às 6h.
 *
 * Só roda com o cabeçalho `Authorization: Bearer <CRON_SECRET>` (mesmo valor configurado
 * na Vercel e no kings-worker). Em desenvolvimento, sem CRON_SECRET, fica aberta para testar.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Etapa = { etapa: string; ok: number; falhas: number; ms: number };

async function aquecerRadar(): Promise<Etapa[]> {
  const hoje = hojeBrasilia();
  const t0 = Date.now();
  const edicao = await ultimaEdicaoDou(hoje, hoje).catch(() => null);
  const t1 = Date.now();
  const noticias = await noticiasDosTribunais();
  const tribunais = Object.keys(TRIBUNAIS).length;
  return [
    { etapa: `Radar: DOU (${edicao ? `edição de ${edicao.data}, ${edicao.atos.length} atos` : "sem resposta"})`, ok: edicao ? 1 : 0, falhas: edicao ? 0 : 1, ms: t1 - t0 },
    { etapa: "Radar: notícias de STF, STJ, TSE e TST", ok: tribunais - noticias.falhas.length, falhas: noticias.falhas.length, ms: Date.now() - t1 },
  ];
}

async function aquecerPerfis(): Promise<Etapa[]> {
  const t0 = Date.now();
  const cota = await aquecerCotaSenado();
  return [
    { etapa: "Senado: cota parlamentar (ano atual e anterior)", ok: cota, falhas: 2 - cota, ms: Date.now() - t0 },
    ...(await aquecerFontesDoPerfil()),
  ];
}

export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  const emDesenvolvimento = process.env.NODE_ENV !== "production";
  if (segredo ? request.headers.get("authorization") !== `Bearer ${segredo}` : !emDesenvolvimento) {
    return Response.json({ erro: "Não autorizado." }, { status: 401 });
  }

  const parte = new URL(request.url).searchParams.get("parte");
  if (parte && parte !== "radar" && parte !== "perfis") {
    return Response.json({ erro: 'Use parte=radar, parte=perfis ou nenhuma (as duas).' }, { status: 400 });
  }

  const inicio = Date.now();
  const etapas = [
    ...(parte !== "perfis" ? await aquecerRadar() : []),
    ...(parte !== "radar" ? await aquecerPerfis() : []),
  ];
  const falhas = etapas.reduce((t, e) => t + e.falhas, 0);
  if (falhas) console.error("[legis] aquecimento com falhas", etapas);

  return Response.json(
    { ok: falhas === 0, parte: parte ?? "tudo", duracaoMs: Date.now() - inicio, etapas },
    { headers: { "Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store" } },
  );
}
