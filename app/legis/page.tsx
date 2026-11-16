import type { Metadata } from "next";
import Link from "next/link";

import { Agenda } from "@/components/home/agenda";
import { MapaEstados } from "@/components/home/mapa-estados";
import { ResumoCongresso } from "@/components/home/resumo-congresso";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "O que o Congresso decidiu, em linguagem clara",
  description:
    "Proposições, votações e composição do Congresso, com a fonte oficial em cada item.",
  alternates: { canonical: absoluteUrl("/legis") },
};

const etapas = ["Apresentada", "Comissões", "Plenário · 1ª Casa", "2ª Casa", "Sanção", "Lei"];

const numeros = [
  { valor: "513", rotulo: "deputados federais" },
  { valor: "81", rotulo: "senadores" },
  { valor: "27", rotulo: "unidades da federação" },
  { valor: "21", rotulo: "partidos com deputados" },
];

const radar = [
  { fonte: "Diário Oficial da União", texto: "Leis, decretos, medidas provisórias e nomeações do dia." },
  { fonte: "STF", texto: "Pauta do plenário e o que está em julgamento." },
  { fonte: "TSE", texto: "Sessões e decisões da Justiça Eleitoral." },
];

export default function LegisHome() {
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
        <Agenda />
        <section className="card" aria-labelledby="avancos-titulo">
          <div className="card-head">
            <h2 id="avancos-titulo">Avançaram esta semana</h2>
            <Link href="/legis/proposicoes">Ver todas</Link>
          </div>
          <p className="muted">
            Cada proposição vai mostrar em que etapa está, do protocolo até virar lei:
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
              A lista entra quando a coleta da Câmara estiver ligada.
            </p>
          </div>
        </section>
      </section>

      <MapaEstados />

      <section aria-labelledby="radar-titulo" className="radar">
        <div className="card-head">
          <h2 id="radar-titulo">Radar do dia</h2>
          <Link href="/radar">Abrir o Radar</Link>
        </div>
        <div className="radar-cards">
          {radar.map((r) => (
            <article key={r.fonte} className="card">
              <p className="eyebrow">{r.fonte}</p>
              <p className="radar-texto">{r.texto}</p>
              <p className="muted small">Em construção.</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
