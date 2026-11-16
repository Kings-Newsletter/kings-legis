import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Radar",
  description: "Atos do Diário Oficial da União e pautas e decisões dos tribunais superiores.",
  alternates: { canonical: absoluteUrl("/radar") },
};

export default function RadarHome() {
  return (
    <div className="container pagina">
      <span className="eyebrow">King&apos;s Radar</span>
      <h1>O que foi publicado hoje</h1>
      <p className="lead">
        Leis, decretos, medidas provisórias e nomeações do Diário Oficial da União, e as
        pautas do STF, do TSE e dos demais tribunais superiores.
      </p>
      <p className="notice">
        Em construção. O Radar entra depois do Legis, começando pelo Diário Oficial da União.
      </p>
    </div>
  );
}
