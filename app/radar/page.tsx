import type { Metadata } from "next";
import Link from "next/link";

import { AccordionOrgao } from "@/components/radar/accordion-orgao";
import { hojeBrasilia } from "@/lib/legis/agenda";
import { CATEGORIAS_DOU, somarDias, ultimaEdicaoDou, type AtoDou } from "@/lib/radar/dou";
import { TRIBUNAIS, noticiasDosTribunais, type Tribunal } from "@/lib/radar/tribunais";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Radar",
  description: "Leis, decretos, medidas provisórias e nomeações do Diário Oficial da União, e o que os tribunais superiores decidiram, com o link oficial de cada item.",
  alternates: { canonical: absoluteUrl("/radar") },
};

type Ver = "tudo" | "dou" | "tribunais";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DATA_LONGA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const NUM = new Intl.NumberFormat("pt-BR");
const dia = (d: string) => new Date(`${d}T12:00:00Z`);
const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
/** Dia útil seguinte: o DOU não sai no sábado nem no domingo. */
const proximoDiaUtil = (d: string) => {
  let x = somarDias(d, 1);
  while ([0, 6].includes(dia(x).getUTCDay())) x = somarDias(x, 1);
  return x;
};

export default async function RadarHome({ searchParams }: Props) {
  const sp = await searchParams;
  const ver: Ver = um(sp.ver) === "dou" ? "dou" : um(sp.ver) === "tribunais" ? "tribunais" : "tudo";
  const hoje = hojeBrasilia();
  const pedida = um(sp.data);
  const ate = pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida <= hoje ? pedida : hoje;
  const busca = um(sp.q)?.trim().slice(0, 80) ?? "";

  const [edicao, noticias] = await Promise.all([
    ver === "tribunais" ? Promise.resolve(null) : ultimaEdicaoDou(ate, hoje),
    ver === "dou" ? Promise.resolve(null) : noticiasDosTribunais(6),
  ]);

  const url = (troca: Partial<{ ver: Ver; data: string; q: string }>) => {
    const v = { ver, data: edicao?.data ?? ate, q: busca, ...troca };
    const q = new URLSearchParams();
    if (v.ver !== "tudo") q.set("ver", v.ver);
    if (v.data && v.data !== hoje) q.set("data", v.data);
    if (v.q) q.set("q", v.q);
    const s = q.toString();
    return `/radar${s ? `?${s}` : ""}`;
  };

  const destaques = edicao ? CATEGORIAS_DOU.map((c) => ({ ...c, atos: edicao.atos.filter((a) => a.categoria === c.id) })).filter((c) => c.atos.length) : [];
  const termos = semAcento(busca).split(/\s+/).filter(Boolean);
  const demais = (edicao?.atos ?? [])
    .filter((a) => a.categoria === "outros")
    .filter((a) => !termos.length || termos.every((t) => semAcento(`${a.titulo} ${a.orgaoCompleto} ${a.tipo} ${a.resumo}`).includes(t)));
  const porOrgao = [...demais.reduce((m, a) => m.set(a.orgao, [...(m.get(a.orgao) ?? []), a]), new Map<string, AtoDou[]>())].sort(
    (a, b) => b[1].length - a[1].length,
  );

  return (
    <div className="container pagina radar-pagina">
      <span className="eyebrow">King&apos;s Radar</span>
      <h1>O que foi publicado</h1>
      <p className="lead">
        Leis, decretos, medidas provisórias e nomeações do Diário Oficial da União, e o que o STF, o STJ, o TSE e o TST
        divulgaram, com o link oficial de cada item.
      </p>

      <nav className="segmentado abas-casa" aria-label="O que mostrar">
        {(
          [
            ["tudo", "Tudo"],
            ["dou", "Diário Oficial"],
            ["tribunais", "Tribunais"],
          ] as const
        ).map(([v, r]) => (
          <Link key={v} href={url({ ver: v })} aria-current={ver === v ? "page" : undefined}>
            {r}
          </Link>
        ))}
      </nav>

      {ver !== "tribunais" && (
        <section className="radar-bloco" aria-labelledby="dou-titulo">
          <div className="radar-bloco-topo">
            <h2 id="dou-titulo">Diário Oficial da União</h2>
            {edicao && (
              <nav className="agenda-semana" aria-label="Edição">
                <Link href={url({ data: somarDias(edicao.data, -1), q: "" })} rel="prev">
                  ← Edição anterior
                </Link>
                <p>
                  <strong>{DATA_LONGA.format(dia(edicao.data))}</strong>
                  {edicao.numero && <span className="muted small"> · edição nº {edicao.numero}</span>}
                  {edicao.data !== hoje && (
                    <>
                      {" · "}
                      <Link href={url({ data: hoje, q: "" })}>Ir para hoje</Link>
                    </>
                  )}
                </p>
                {proximoDiaUtil(edicao.data) <= hoje ? (
                  <Link href={url({ data: proximoDiaUtil(edicao.data), q: "" })} rel="next">
                    Próxima →
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            )}
          </div>

          {!edicao ? (
            <div className="vazio">
              <p className="vazio-titulo">O site da Imprensa Nacional não respondeu agora.</p>
              <p className="muted">Tente de novo em alguns minutos.</p>
            </div>
          ) : (
            <>
              {edicao.data !== ate && (
                <p className="notice">
                  Não há edição em {DATA_LONGA.format(dia(ate))}; esta é a mais recente antes dessa data.
                </p>
              )}

              {destaques.length ? (
                <div className="radar-destaques">
                  {destaques.map((c) => (
                    <section key={c.id} className="card" aria-labelledby={`cat-${c.id}`}>
                      <div className="card-head">
                        <h3 id={`cat-${c.id}`}>{c.rotulo}</h3>
                        <span className="radar-contagem">
                          {NUM.format(c.atos.length)}
                          <span className="sr-only"> {c.atos.length === 1 ? "ato" : "atos"}</span>
                        </span>
                      </div>
                      <ul className="radar-atos">
                        {c.atos.slice(0, 12).map((a) => (
                          <Ato key={a.id} a={a} />
                        ))}
                      </ul>
                      {c.atos.length > 12 && <p className="muted small">E mais {c.atos.length - 12} nesta edição.</p>}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="vazio">
                  <p className="vazio-titulo">Nenhuma lei, decreto, medida provisória ou nomeação do Presidente nesta edição.</p>
                  <p className="muted">Os demais atos da Seção 1 estão abaixo.</p>
                </div>
              )}

              <section className="card" aria-labelledby="demais-titulo">
                <div className="card-head">
                  <h3 id="demais-titulo">Demais atos da Seção 1</h3>
                  <span className="radar-contagem radar-contagem-resumo">
                    {NUM.format(demais.length)}{" "}
                    {busca ? (demais.length === 1 ? "encontrado" : "encontrados") : demais.length === 1 ? "ato" : "atos"} em{" "}
                    {NUM.format(porOrgao.length)} {porOrgao.length === 1 ? "órgão" : "órgãos"}
                  </span>
                </div>
                <form className="radar-busca" action="/radar" role="search">
                  {ver !== "tudo" && <input type="hidden" name="ver" value={ver} />}
                  {edicao.data !== hoje && <input type="hidden" name="data" value={edicao.data} />}
                  <label className="campo campo-busca">
                    <span className="sr-only">Buscar nesta edição</span>
                    <input type="search" name="q" defaultValue={busca} placeholder="Buscar nesta edição: órgão, tipo ou assunto" />
                  </label>
                  <button type="submit" className="btn btn-primario">
                    Buscar
                  </button>
                </form>
                <div className="radar-orgaos">
                  {porOrgao.map(([orgao, atos]) => (
                    <AccordionOrgao
                      key={`${orgao}-${busca}`}
                      name={orgao}
                      count={atos.length}
                      defaultOpen={Boolean(busca) && porOrgao.length <= 3}
                    >
                      <ul className="radar-atos">
                        {atos.map((a) => (
                          <Ato key={a.id} a={a} mostrarOrgao />
                        ))}
                      </ul>
                    </AccordionOrgao>
                  ))}
                </div>
                {!porOrgao.length && <p className="muted">Nada encontrado com essa busca nesta edição.</p>}
              </section>
              <p className="muted small">
                Fonte: Imprensa Nacional,{" "}
                <a href={`https://www.in.gov.br/leiturajornal?data=${edicao.data.split("-").reverse().join("-")}&secao=do1`} target="_blank" rel="noopener noreferrer">
                  leitura do jornal
                </a>
                . Seção 1 inteira, edições extras e, da Seção 2, só os decretos do Presidente.
              </p>
            </>
          )}
        </section>
      )}

      {ver !== "dou" && noticias && (
        <section className="radar-bloco" aria-labelledby="tribunais-titulo">
          <div className="radar-bloco-topo">
            <h2 id="tribunais-titulo">Tribunais superiores</h2>
          </div>
          <div className="radar-tribunais">
            {(Object.keys(TRIBUNAIS) as Tribunal[]).map((t) => (
              <section key={t} className="card" aria-labelledby={`trib-${t}`}>
                <div className="card-head">
                  <h3 id={`trib-${t}`}>
                    {TRIBUNAIS[t].sigla} <span className="muted small">{TRIBUNAIS[t].nome}</span>
                  </h3>
                  {!noticias.falhas.includes(t) && (
                    <span className="radar-contagem">
                      {NUM.format(noticias.porTribunal[t].length)}
                      <span className="sr-only">{noticias.porTribunal[t].length === 1 ? " notícia" : " notícias"}</span>
                    </span>
                  )}
                </div>
                {noticias.falhas.includes(t) ? (
                  <p className="muted">O canal de notícias do {TRIBUNAIS[t].sigla} não respondeu agora.</p>
                ) : (
                  <ul className="radar-atos">
                    {noticias.porTribunal[t].map((n) => (
                      <li key={n.url} className="radar-ato">
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="radar-ato-titulo">
                          {n.titulo}
                        </a>
                        {n.data && <p className="muted small">{DATA_HORA.format(new Date(n.data))}</p>}
                        {n.resumo && <p className="radar-ato-resumo">{cortar(n.resumo, 220)}</p>}
                      </li>
                    ))}
                  </ul>
                )}
                <a href={TRIBUNAIS[t].site} target="_blank" rel="noopener noreferrer" className="small">
                  Todas as notícias do {TRIBUNAIS[t].sigla} ↗
                </a>
              </section>
            ))}
          </div>
          <p className="muted small">
            Fonte: canais oficiais de notícias (RSS) de cada tribunal, consultados a cada 30 minutos. O STM não publica canal
            de notícias e fica de fora por enquanto.
          </p>
        </section>
      )}
    </div>
  );
}

function Ato({ a, mostrarOrgao = false }: { a: AtoDou; mostrarOrgao?: boolean }) {
  return (
    <li className="radar-ato">
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="radar-ato-titulo">
        {a.titulo}
      </a>
      <p className="muted small">
        {a.tipo}
        {mostrarOrgao ? ` · ${a.orgaoCompleto}` : a.orgao !== "Atos do Poder Executivo" && a.orgao !== "Atos do Poder Legislativo" ? ` · ${a.orgao}` : ""}
        {a.extra ? " · edição extra" : ""}
        {a.pagina ? ` · Seção ${a.secao}, p. ${a.pagina}` : ""}
      </p>
      {a.resumo && <p className="radar-ato-resumo">{cortar(a.resumo, 260)}</p>}
    </li>
  );
}
