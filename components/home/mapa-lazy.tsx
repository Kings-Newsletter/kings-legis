"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

const MapaEstados = dynamic(
  () => import("@/components/home/mapa-estados").then((modulo) => modulo.MapaEstados),
  {
    loading: () => (
      <section className="card mapa-carregando" aria-busy="true" aria-label="Carregando mapa">
        <div className="skeleton mapa-skeleton" aria-hidden="true" />
      </section>
    ),
  },
);

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

  return (
    <div ref={ref}>
      {visivel ? (
        <MapaEstados />
      ) : (
        <section className="card mapa-carregando" aria-busy="true" aria-label="Mapa carregando">
          <div className="skeleton mapa-skeleton" aria-hidden="true" />
        </section>
      )}
    </div>
  );
}
