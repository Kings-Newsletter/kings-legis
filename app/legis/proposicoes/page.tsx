import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/site";
import { ESTAGIOS, ESTAGIO_LABEL } from "@/lib/types";

export const metadata: Metadata = {
  title: "Proposições",
  description: "Proposições em tramitação na Câmara, no Senado e no Congresso.",
  alternates: { canonical: absoluteUrl("/legis/proposicoes") },
};

export default function Proposicoes() {
  return (
    <>
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Proposições</h1>
      <p className="lead">
        Cada proposição mostra o estágio em que está, a situação como a fonte oficial
        escreve e o link para a página da Casa.
      </p>

      <section className="card">
        <h2>Estágios acompanhados</h2>
        <p className="muted">{ESTAGIOS.map((e) => ESTAGIO_LABEL[e]).join(" · ")}</p>
      </section>

      <p className="notice">
        Em construção. A lista com filtros entra quando a coleta da Câmara estiver ligada.
      </p>
    </>
  );
}
