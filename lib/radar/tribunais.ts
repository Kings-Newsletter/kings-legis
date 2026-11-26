import "server-only";

/**
 * Notícias oficiais dos tribunais superiores, pelos canais RSS de cada um. São o que o
 * próprio tribunal divulga sobre julgamentos, sessões e decisões do dia.
 *
 * O STM não publica RSS (o endereço do feed responde 404): fica de fora até haver fonte.
 */

export type Tribunal = "stf" | "stj" | "tse" | "tst";

export const TRIBUNAIS: Record<Tribunal, { sigla: string; nome: string; feed: string; site: string }> = {
  stf: { sigla: "STF", nome: "Supremo Tribunal Federal", feed: "https://noticias.stf.jus.br/feed/", site: "https://noticias.stf.jus.br/" },
  stj: {
    sigla: "STJ",
    nome: "Superior Tribunal de Justiça",
    feed: "https://res.stj.jus.br/hrestp-c-portalp/RSS.xml",
    site: "https://www.stj.jus.br/sites/portalp/Comunicacao/Ultimas-noticias",
  },
  tse: { sigla: "TSE", nome: "Tribunal Superior Eleitoral", feed: "https://www.tse.jus.br/comunicacao/noticias/rss", site: "https://www.tse.jus.br/comunicacao/noticias" },
  tst: { sigla: "TST", nome: "Tribunal Superior do Trabalho", feed: "https://www.tst.jus.br/rss", site: "https://www.tst.jus.br/noticias" },
};

export interface NoticiaTribunal {
  tribunal: Tribunal;
  titulo: string;
  resumo: string;
  url: string;
  /** ISO 8601 */
  data: string | null;
}

const entidades: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodificar = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => entidades[e.toLowerCase()] ?? m);
const semTags = (s: string) => decodificar(decodificar(s)).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const campo = (item: string, tag: string) => item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1] ?? "";

async function noticiasDe(t: Tribunal): Promise<NoticiaTribunal[]> {
  const r = await fetch(TRIBUNAIS[t].feed, {
    // O STJ só entrega o feed a requisições com cabeçalhos de navegador comum.
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36",
      Accept: "application/rss+xml,text/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR",
    },
    next: { revalidate: 60 * 30 },
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error(`${TRIBUNAIS[t].sigla} respondeu ${r.status}`);
  const xml = await r.text();
  return [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)]
    .map((m) => {
      const item = m[0];
      const data = campo(item, "pubDate") || campo(item, "dc:date");
      const d = data ? new Date(decodificar(data).trim()) : null;
      const resumo = semTags(campo(item, "description"));
      return {
        tribunal: t,
        titulo: semTags(campo(item, "title")),
        resumo: resumo.length > 320 ? `${resumo.slice(0, 317).trimEnd()}…` : resumo,
        url: semTags(campo(item, "link")) || semTags(campo(item, "guid")),
        data: d && !Number.isNaN(d.getTime()) ? d.toISOString() : null,
      };
    })
    .filter((n) => n.titulo && n.url.startsWith("http"));
}

export interface Noticias {
  porTribunal: Record<Tribunal, NoticiaTribunal[]>;
  falhas: Tribunal[];
}

/** Notícias recentes de cada tribunal (no máximo `limite` por tribunal), da mais nova para a mais antiga. */
export async function noticiasDosTribunais(limite = 8): Promise<Noticias> {
  const lista = Object.keys(TRIBUNAIS) as Tribunal[];
  const resultados = await Promise.allSettled(lista.map(noticiasDe));
  const porTribunal = {} as Record<Tribunal, NoticiaTribunal[]>;
  const falhas: Tribunal[] = [];
  resultados.forEach((r, i) => {
    const t = lista[i]!;
    if (r.status === "fulfilled") {
      porTribunal[t] = r.value.sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "")).slice(0, limite);
    } else {
      console.error(`[radar] ${t}`, r.reason);
      porTribunal[t] = [];
      falhas.push(t);
    }
  });
  return { porTribunal, falhas };
}
