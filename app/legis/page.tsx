import type { Metadata } from "next";
import Link from "next/link";

import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Legislativo",
  description:
    "Proposições da Câmara, do Senado e do Congresso: o que foi apresentado, o que está em pauta e o que foi votado.",
  alternates: { canonical: absoluteUrl("/legis") },
};

const secoes = [
  {
    href: "/legis/agenda",
    titulo: "Pauta da semana",
    texto: "O que o plenário e as comissões vão analisar, dia a dia.",
  },
  {
    href: "/legis/proposicoes",
    titulo: "Proposições",
    texto: "Busca e filtros por Casa, tipo, estágio, tema e UF do autor.",
  },
  {
    href: "/radar",
    titulo: "Radar",
    texto: "Atos do Diário Oficial da União e pautas dos tribunais.",
  },
];

export default function LegisHome() {
  return (
    <>
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>O que o Legislativo está fazendo</h1>
      <p className="lead">
        Proposições da Câmara, do Senado e do Congresso, com o estágio de cada uma e o link
        para a fonte oficial.
      </p>

      <div className="grid">
        {secoes.map((s) => (
          <section key={s.href} className="card">
            <h2>
              <Link href={s.href}>{s.titulo}</Link>
            </h2>
            <p className="muted">{s.texto}</p>
          </section>
        ))}
      </div>

      <p className="notice">
        Em construção. A coleta de dados ainda não está ligada; esta página vai mostrar a
        pauta da semana, as proposições que mudaram de estágio e as mais relevantes.
      </p>
    </>
  );
}
