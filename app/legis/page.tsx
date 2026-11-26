import type { Metadata } from "next";
import Link from "next/link";

import { Agenda } from "@/components/home/agenda";
import { MapaLazy } from "@/components/home/mapa-lazy";
import { ResumoCongresso } from "@/components/home/resumo-congresso";
import { ItemProposicao } from "@/components/proposicoes/item-proposicao";
import { buscarComposicao } from "@/lib/composicao";
import { hojeBrasilia, proximasSessoes } from "@/lib/legis/agenda";
import { avancosDaSemana } from "@/lib/legis/proposicoes";
import { CATEGORIAS_DOU, ultimaEdicaoDou } from "@/lib/radar/dou";
import { TRIBUNAIS, noticiasDosTribunais, type Tribunal } from "@/lib/radar/tribunais";
import { absoluteUrl } from "@/lib/site";

/** "Avançaram esta semana" vem direto da Câmara e do Senado; a página é refeita a cada 5 minutos. */
export const revalidate = 300;

export const metadata: Metadata = {
  title: "O que o Congresso decidiu, em linguagem clara",
  description:
    "Proposições, votações e composição do Congresso, com a fonte oficial em cada item.",
  alternates: { canonical: absoluteUrl("/legis") },
};

const etapas = ["Apresentada", "Comissões", "Plenário · 1ª Casa", "2ª Casa", "Sanção", "Lei"];

const DATA_DOU = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const DATA_NOTICIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" });
/** Tribunais que aparecem na home (os outros estão no Radar). */
const TRIBUNAIS_HOME: Tribunal[] = ["stf", "tse"];

export default async function LegisHome() {
  const hoje = hojeBrasilia();
  const [avancos, composicao, agendaCamara, agendaSenado, edicao, noticias] = await Promise.all([
    avancosDaSemana(5),
    buscarComposicao(),
    proximasSessoes("camara"),
    proximasSessoes("senado"),
    ultimaEdicaoDou(hoje, hoje).catch(() => null),
    noticiasDosTribunais(3),
  ]);
  // Destaques do DOU na ordem de importância (emendas, leis, MPs, decretos...).
  const destaquesDou = edicao
    ? CATEGORIAS_DOU.flatMap((c) => edicao.atos.filter((a) => a.categoria === c.id))
    : [];
  const numeros = [
    { valor: String(composicao.camara.total), rotulo: "deputados federais em exercício" },
    { valor: String(composicao.senado.total), rotulo: "senadores em exercício" },
    { valor: "27", rotulo: "unidades da federação" },
    {
      valor: String(composicao.camara.grupos.filter((g) => g.sigla !== "S/Partido").length),
      rotulo: "partidos com deputados",
    },
  ];

  return (
    <div className="container home">
      <section className="hero">
        <div className="hero-texto">
          <p className="eyebrow">King&apos;s Legis</p>
          <h1>O que o Congresso decidiu, em linguagem clara</h1>
          <p className="lead">
            Proposições, votações e a composição da Câmara e do Senado, com a fonte oficial em cada
            item.
          </p>
          <form className="busca" action="/legis/proposicoes">
            <label className="busca-campo">
              <span className="sr-only">Buscar</span>
              <input type="search" name="q" placeholder="Número do projeto, tema ou parlamentar" />
            </label>
            <button type="submit" className="btn btn-primario">
              Buscar
            </button>
          </form>
        </div>
        <ResumoCongresso />
      </section>

      <section aria-label="O Congresso em números" className="numeros">
        {numeros.map((n) => (
          <div key={n.rotulo} className="numero">
            <p className="numero-valor">{n.valor}</p>
            <p className="numero-rotulo">{n.rotulo}</p>
          </div>
        ))}
      </section>

      <section className="duas-colunas">
        <Agenda camara={agendaCamara} senado={agendaSenado} />
        <section className="card" aria-labelledby="avancos-titulo">
          <div className="card-head">
            <h2 id="avancos-titulo">Avançaram esta semana</h2>
            <Link href="/legis/proposicoes">Ver todas</Link>
          </div>
          {avancos.itens.length > 0 ? (
            <ul className="proposicoes avancos">
              {avancos.itens.map((item) => (
                <ItemProposicao key={item._id} item={item} compacto />
              ))}
            </ul>
          ) : (
            <>
              <p className="muted">
                Cada proposição mostra em que etapa está, do protocolo até virar lei:
              </p>
              <div className="etapas" aria-hidden="true">
                {etapas.map((e, i) => (
                  <span key={e} className={i < 2 ? "etapa feita" : i === 2 ? "etapa atual" : "etapa"} />
                ))}
              </div>
              <div className="etapas-nomes">
                {etapas.map((e) => (
                  <span key={e}>{e}</span>
                ))}
              </div>
              <div className="vazio">
                <p className="muted">
                  {avancos.erro
                    ? "A Câmara e o Senado não responderam agora. Tente de novo em alguns minutos."
                    : "Nenhuma proposição mudou de etapa nos últimos 7 dias."}
                </p>
              </div>
            </>
          )}
        </section>
      </section>

      <MapaLazy />

      <section aria-labelledby="radar-titulo" className="radar">
        <div className="card-head">
          <h2 id="radar-titulo">Radar do dia</h2>
          <Link href="/radar">Abrir o Radar</Link>
        </div>
        <div className="radar-cards">
          <article className="card">
            <p className="eyebrow">
              Diário Oficial da União{edicao ? ` · ${DATA_DOU.format(new Date(`${edicao.data}T12:00:00Z`))}` : ""}
            </p>
            {!edicao ? (
              <p className="muted">O site da Imprensa Nacional não respondeu agora.</p>
            ) : destaquesDou.length ? (
              <ul className="radar-atos">
                {destaquesDou.slice(0, 4).map((a) => (
                  <li key={a.id} className="radar-ato">
                    <a href={a.url} target="_blank" rel="noopener noreferrer" className="radar-ato-titulo">
                      {a.titulo}
                    </a>
                    {a.resumo && <p className="muted small">{a.resumo.length > 140 ? `${a.resumo.slice(0, 139).trimEnd()}…` : a.resumo}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="radar-texto">
                Nenhuma lei, decreto ou medida provisória nesta edição; {edicao.atos.length} outros atos na Seção 1.
              </p>
            )}
            <Link href="/radar?ver=dou" className="small">
              {destaquesDou.length > 4 ? `Mais ${destaquesDou.length - 4} destaques e todos os atos →` : "Todos os atos da edição →"}
            </Link>
          </article>
          {TRIBUNAIS_HOME.map((t) => (
            <article key={t} className="card">
              <p className="eyebrow">{TRIBUNAIS[t].sigla}</p>
              {noticias.falhas.includes(t) || !noticias.porTribunal[t].length ? (
                <p className="muted">O canal de notícias do {TRIBUNAIS[t].sigla} não respondeu agora.</p>
              ) : (
                <ul className="radar-atos">
                  {noticias.porTribunal[t].map((n) => (
                    <li key={n.url} className="radar-ato">
                      <a href={n.url} target="_blank" rel="noopener noreferrer" className="radar-ato-titulo">
                        {n.titulo}
                      </a>
                      {n.data && <p className="muted small">{DATA_NOTICIA.format(new Date(n.data))}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/radar?ver=tribunais" className="small">
                STF, STJ, TSE e TST no Radar →
              </Link>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
