"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import { CarregandoLogo } from "@/components/carregando-logo";

/** Espaço do mapa enquanto ele carrega: mesma altura, para a página não pular. */
function MapaCarregando() {
  return (
    <section className="card mapa-lazy-carregando" aria-busy="true" aria-label="Carregando o mapa">
      <CarregandoLogo rotulo="Carregando o mapa" />
    </section>
  );
}

const MapaEstados = dynamic(
  () => import("@/components/home/mapa-estados").then((modulo) => modulo.MapaEstados),
  { loading: () => <MapaCarregando /> },
);

/** O mapa (pesado) só é baixado quando chega perto da tela. */
export function MapaLazy() {
  const ref = useRef<HTMLDivElement>(null);
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const elemento = ref.current;
    if (!elemento) return;

    if (!("IntersectionObserver" in window)) {
      setVisivel(true);
      return;
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada?.isIntersecting) {
          setVisivel(true);
          observador.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return <div ref={ref}>{visivel ? <MapaEstados /> : <MapaCarregando />}</div>;
}
