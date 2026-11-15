import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Pauta da semana",
  description: "Pauta do plenário e das comissões da Câmara e do Senado.",
  alternates: { canonical: absoluteUrl("/legis/agenda") },
};

export default function Agenda() {
  return (
    <>
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Pauta da semana</h1>
      <p className="lead">O que o plenário e as comissões vão analisar, dia a dia.</p>
      <p className="notice">
        Em construção. A agenda entra junto com a coleta da Câmara e do Senado.
      </p>
    </>
  );
}
