"use client";

import { useState } from "react";

type Casa = "camara" | "senado";

export function Agenda() {
  const [casa, setCasa] = useState<Casa>("camara");
  const nome = casa === "camara" ? "Câmara" : "Senado";

  return (
    <section className="card" aria-labelledby="agenda-titulo">
      <div className="card-head">
        <h2 id="agenda-titulo">Agenda do plenário</h2>
        <div className="segmentado" role="group" aria-label="Casa">
          <button type="button" aria-pressed={casa === "camara"} onClick={() => setCasa("camara")}>
            Câmara
          </button>
          <button type="button" aria-pressed={casa === "senado"} onClick={() => setCasa("senado")}>
            Senado
          </button>
        </div>
      </div>
      <div className="vazio">
        <p className="vazio-titulo">Pauta do plenário do {nome}</p>
        <p className="muted">
          A pauta da semana aparece aqui, dia a dia, quando a coleta do {nome} estiver ligada. Cada
          item vai levar à ficha da proposição e ao link oficial.
        </p>
      </div>
    </section>
  );
}
