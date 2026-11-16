import type { Metadata } from "next";

import { PaginaPartidos } from "@/components/partidos/pagina-partidos";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Partidos no Congresso",
  description:
    "Como a Câmara e o Senado se dividem entre os partidos, com cada deputado e senador na sua cadeira e a bancada de cada partido por estado.",
  alternates: { canonical: absoluteUrl("/legis/partidos") },
};

export default function Partidos() {
  return (
    <div className="container pagina pagina-partidos">
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Partidos no Congresso</h1>
      <p className="lead">
        Como a Câmara e o Senado se dividem entre os partidos hoje, da esquerda para a direita. Cada bolinha é a cadeira
        de um deputado ou senador: passe o mouse para ver quem está nela, toque em esquerda, centro, direita ou num
        partido para ver só aquelas cadeiras, ou escolha um estado.
      </p>
      <PaginaPartidos />
    </div>
  );
}
