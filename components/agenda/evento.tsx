import Link from "next/link";

import type { EventoAgenda } from "@/lib/legis/agenda";

const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });

/** Situação com a cor certa: convocada/agendada, em andamento, encerrada, cancelada. */
function classeSituacao(s: string) {
  if (/cancelad|suspens|adiad/i.test(s)) return "situacao-cancelada";
  if (/andamento|aberta|iniciad/i.test(s)) return "situacao-andamento";
  if (/encerrad|realizad/i.test(s)) return "situacao-encerrada";
  return "situacao-prevista";
}

/** Um evento da agenda: horário, órgão, tipo, situação e, nas sessões deliberativas, a pauta. */
export function EventoDaAgenda({
  e,
  compacto = false,
  maxPauta = 12,
  mostrarDia = false,
}: {
  e: EventoAgenda;
  compacto?: boolean;
  maxPauta?: number;
  mostrarDia?: boolean;
}) {
  const visiveis = e.pauta.slice(0, maxPauta);
  return (
    <li className={`agenda-evento${e.plenario ? " agenda-evento-plenario" : ""}`}>
      <div className="agenda-hora">
        {mostrarDia && <span className="agenda-home-dia">{DIA.format(new Date(e.inicio))}</span>}
        <time dateTime={e.inicio}>{HORA.format(new Date(e.inicio))}</time>
      </div>
      <div className="agenda-corpo">
        <p className="agenda-topo">
          <span className="agenda-orgao">{e.orgao}</span>
          <span className="agenda-tipo">{e.tipo}</span>
          <span className={`agenda-situacao ${classeSituacao(e.situacao)}`}>{e.situacao}</span>
        </p>
        {e.descricao && !compacto && <p className="agenda-descricao">{e.descricao}</p>}

        {e.pauta.length > 0 && (
          <details className="agenda-pauta" open={!compacto && e.pauta.length <= 6}>
            <summary>
              {e.pauta.length} {e.pauta.length === 1 ? "item na pauta" : "itens na pauta"}
            </summary>
            <ol>
              {visiveis.map((p, i) => (
                <li key={`${p.identificacao}-${i}`}>
                  <p className="agenda-item-id">
                    {p.href ? <Link href={p.href}>{p.identificacao}</Link> : p.identificacao}
                  </p>
                  {p.ementa && <p className="agenda-item-ementa">{p.ementa}</p>}
                  {p.detalhe && !compacto && <p className="muted small">{p.detalhe}</p>}
                </li>
              ))}
            </ol>
            {e.pauta.length > visiveis.length && (
              <p className="muted small">
                E mais {e.pauta.length - visiveis.length}.{" "}
                <a href={e.urlOficial} target="_blank" rel="noopener noreferrer">
                  Pauta completa ↗
                </a>
              </p>
            )}
          </details>
        )}

        {!compacto && (
          <p className="agenda-links muted small">
            {e.local && <span>{e.local}</span>}
            <a href={e.urlOficial} target="_blank" rel="noopener noreferrer">
              Página oficial ↗
            </a>
            {e.video && (
              <a href={e.video} target="_blank" rel="noopener noreferrer">
                Vídeo ↗
              </a>
            )}
          </p>
        )}
      </div>
    </li>
  );
}
