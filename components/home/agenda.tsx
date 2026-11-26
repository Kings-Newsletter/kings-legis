"use client";

import Link from "next/link";
import { useState } from "react";

import { EventoDaAgenda } from "@/components/agenda/evento";
import type { CasaAgenda, EventoAgenda } from "@/lib/legis/agenda";

export interface SessoesDaCasa {
  eventos: EventoAgenda[];
  /** false quando não há sessão marcada daqui em diante e a lista mostra as últimas. */
  futuras: boolean;
  erro?: boolean;
}

/** Próximas sessões do plenário na home, com a troca Câmara/Senado. Os dados vêm do servidor. */
export function Agenda({ camara, senado }: { camara: SessoesDaCasa; senado: SessoesDaCasa }) {
  const [casa, setCasa] = useState<CasaAgenda>("camara");
  const dados = casa === "camara" ? camara : senado;
  const nome = casa === "camara" ? "da Câmara" : "do Senado";

  return (
    <section className="card agenda-home" aria-labelledby="agenda-titulo">
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

      {dados.erro ? (
        <div className="vazio">
          <p className="vazio-titulo">A agenda {nome} não respondeu agora.</p>
          <p className="muted">Tente de novo em alguns minutos.</p>
        </div>
      ) : dados.eventos.length === 0 ? (
        <div className="vazio">
          <p className="vazio-titulo">Nenhuma sessão do plenário {nome} marcada nesta semana nem na próxima.</p>
        </div>
      ) : (
        <>
          <p className="muted small">
            {dados.futuras ? "Próximas sessões, com a pauta de cada uma." : "Sem sessão marcada por enquanto; estas foram as últimas."}
          </p>
          <ul className="agenda-lista">
            {dados.eventos.map((e) => (
              <EventoDaAgenda key={e.id} e={e} compacto mostrarDia maxPauta={3} />
            ))}
          </ul>
        </>
      )}

      <Link href={`/legis/agenda${casa === "senado" ? "?casa=senado" : ""}`} className="agenda-ver-tudo">
        Ver a agenda da semana, com as comissões →
      </Link>
    </section>
  );
}
