import type { Metadata } from "next";

import { formatarConsulta } from "@/lib/bancadas";
import { buscarComposicao } from "@/lib/composicao";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Como atualizamos",
  description: "De onde vêm os dados do King's Legis e com que frequência são atualizados.",
  alternates: { canonical: absoluteUrl("/legis/como-atualizamos") },
};

const fontes = [
  { nome: "Câmara dos Deputados — Dados Abertos", url: "https://dadosabertos.camara.leg.br/", uso: "Deputados em exercício, partidos, proposições, tramitação e votações." },
  { nome: "Senado Federal — Dados Abertos", url: "https://legis.senado.leg.br/dadosabertos/", uso: "Senadores em exercício, matérias, votações, medidas provisórias e vetos." },
  { nome: "Imprensa Nacional — INLABS", url: "https://github.com/Imprensa-Nacional/inlabs", uso: "Atos do Diário Oficial da União (Radar)." },
];

export default async function ComoAtualizamos() {
  const composicao = await buscarComposicao();
  return (
    <div className="container pagina">
      <p className="eyebrow">King&apos;s Legis</p>
      <h1>Como atualizamos</h1>
      <p className="lead">
        Todo número do site vem de uma fonte oficial, com o link ao lado. Nada é estimado e nenhum
        dado é preenchido à mão.
      </p>
      <section className="card">
        <h2>Situação atual</h2>
        <p className="muted">
          A composição da Câmara e do Senado e os deputados por estado vêm direto das APIs de dados
          abertos das duas Casas e são consultados de novo a cada 6 horas. Última consulta:{" "}
          {formatarConsulta(composicao.consultadoEm)}.
          {composicao.origem === "retrato" &&
            " As fontes não responderam agora, então a página mostra a última consulta guardada."}
        </p>
      </section>
      <section className="card">
        <h2>Fontes</h2>
        <ul className="fontes">
          {fontes.map((f) => (
            <li key={f.url}>
              <a href={f.url}>{f.nome}</a>
              <p className="muted">{f.uso}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
