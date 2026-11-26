import "server-only";

/**
 * Diário Oficial da União, direto do site da Imprensa Nacional (in.gov.br): a página
 * de leitura de cada seção traz, num bloco JSON, todos os atos da edição com tipo,
 * título, órgão, resumo e o endereço de cada um.
 *
 * - Seção 1: leis, decretos, medidas provisórias, vetos e atos normativos.
 * - Seção 2: atos de pessoal; aqui entram só os decretos do Presidente (nomeações e
 *   exonerações de alto escalão).
 * - Edições extras (do1e, do2e) entram junto da seção.
 */

const SITE = "https://www.in.gov.br";

export type CategoriaDou =
  | "emenda"
  | "lei"
  | "mp"
  | "decreto"
  | "decreto_legislativo"
  | "presidente"
  | "pessoal"
  | "outros";

export const CATEGORIAS_DOU: { id: CategoriaDou; rotulo: string }[] = [
  { id: "emenda", rotulo: "Emendas à Constituição" },
  { id: "lei", rotulo: "Leis" },
  { id: "mp", rotulo: "Medidas provisórias" },
  { id: "decreto", rotulo: "Decretos" },
  { id: "decreto_legislativo", rotulo: "Decretos legislativos" },
  { id: "presidente", rotulo: "Despachos e vetos do Presidente" },
  { id: "pessoal", rotulo: "Nomeações e exonerações do Presidente" },
];

export interface AtoDou {
  id: string;
  secao: "1" | "2";
  extra: boolean;
  tipo: string;
  titulo: string;
  /** Primeiro nível da hierarquia ("Ministério da Saúde"). */
  orgao: string;
  orgaoCompleto: string;
  resumo: string;
  pagina: string | null;
  url: string;
  categoria: CategoriaDou;
}

export interface EdicaoDou {
  /** AAAA-MM-DD */
  data: string;
  numero: string | null;
  atos: AtoDou[];
}

interface AtoBruto {
  urlTitle: string;
  title?: string;
  titulo?: string;
  artType?: string;
  hierarchyStr?: string;
  content?: string;
  numberPage?: string;
  editionNumber?: string;
}

function categoria(a: AtoBruto, secao: "1" | "2"): CategoriaDou {
  const tipo = (a.artType ?? "").toLowerCase();
  const orgao = a.hierarchyStr ?? "";
  if (secao === "2") return /decreto/.test(tipo) || /^Atos do Poder Executivo/.test(orgao) ? "pessoal" : "outros";
  if (/emenda constitucional/.test(tipo)) return "emenda";
  if (/^medida provis/.test(tipo)) return "mp";
  if (/^lei/.test(tipo)) return "lei";
  if (/decreto legislativo/.test(tipo)) return "decreto_legislativo";
  if (/^decreto/.test(tipo) && /^Atos do Poder Executivo|^Presid[êe]ncia da Rep[úu]blica$/.test(orgao)) return "decreto";
  if (/^mensagem|^despacho/.test(tipo) && /^Presid[êe]ncia da Rep[úu]blica$/.test(orgao)) return "presidente";
  return "outros";
}

/** O resumo do site começa repetindo o título; fica só o texto. */
function resumo(a: AtoBruto) {
  const t = (a.title ?? "").trim();
  let c = (a.content ?? "").replace(/\s+/g, " ").trim();
  if (t && c.toUpperCase().startsWith(t.toUpperCase())) c = c.slice(t.length).trim();
  return c;
}

/** "AAAA-MM-DD" → "DD-MM-AAAA" (formato do site). */
const dataSite = (d: string) => d.split("-").reverse().join("-");

async function lerSecao(data: string, secao: string, revalidar: number): Promise<{ atos: AtoBruto[]; numero: string | null }> {
  const r = await fetch(`${SITE}/leiturajornal?data=${dataSite(data)}&secao=${secao}`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KingsRadar/1.0)", Accept: "text/html" },
    next: { revalidate: revalidar },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error(`in.gov.br respondeu ${r.status}`);
  const html = await r.text();
  const bloco = html.match(/<script[^>]*id="params"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!bloco) throw new Error("A página do DOU mudou: não achamos a lista de atos.");
  const j = JSON.parse(bloco) as { jsonArray?: AtoBruto[] };
  const atos = j.jsonArray ?? [];
  return { atos, numero: atos[0]?.editionNumber ?? null };
}

/** Atos de uma data. Edição de hoje: cache de 30 min (pode sair edição extra); dias passados: 1 dia. */
export async function edicaoDou(data: string, hoje: string): Promise<EdicaoDou> {
  const revalidar = data >= hoje ? 60 * 30 : 60 * 60 * 24;
  const secoes: [string, "1" | "2", boolean][] = [
    ["do1", "1", false],
    ["do1e", "1", true],
    ["do2", "2", false],
    ["do2e", "2", true],
  ];
  const lidas = await Promise.all(
    secoes.map(([s, secao, extra]) =>
      lerSecao(data, s, revalidar)
        .then((r) => ({ ...r, secao, extra }))
        .catch((e) => {
          // A Seção 1 é obrigatória; as demais podem faltar.
          if (s === "do1") throw e;
          return { atos: [] as AtoBruto[], numero: null, secao, extra };
        }),
    ),
  );
  const atos: AtoDou[] = [];
  for (const l of lidas) {
    for (const a of l.atos) {
      const cat = categoria(a, l.secao);
      if (l.secao === "2" && cat !== "pessoal") continue;
      const hierarquia = (a.hierarchyStr ?? "").trim();
      atos.push({
        id: a.urlTitle,
        secao: l.secao,
        extra: l.extra,
        tipo: a.artType ?? "Ato",
        titulo: (a.title || a.titulo || a.artType || "Ato").trim(),
        orgao: hierarquia.split("/")[0] || "—",
        orgaoCompleto: hierarquia.replace(/\//g, " › ") || "—",
        resumo: resumo(a),
        pagina: a.numberPage ?? null,
        url: `${SITE}/web/dou/-/${a.urlTitle}`,
        categoria: cat,
      });
    }
  }
  return { data, numero: lidas[0]?.numero ?? null, atos };
}

const somarDias = (d: string, n: number) => {
  const [a, m, dia] = d.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1, dia! + n)).toISOString().slice(0, 10);
};

/**
 * A edição mais recente até a data pedida: fins de semana e feriados não têm DOU, e a
 * de hoje só sai de madrugada. Volta até 7 dias.
 */
export async function ultimaEdicaoDou(ate: string, hoje: string): Promise<EdicaoDou | null> {
  for (let i = 0; i < 7; i++) {
    const data = somarDias(ate, -i);
    try {
      const e = await edicaoDou(data, hoje);
      if (e.atos.length) return e;
    } catch {
      // tenta o dia anterior
    }
  }
  return null;
}

export { somarDias };
