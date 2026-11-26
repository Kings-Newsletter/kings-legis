import type { Metadata } from "next";
import Link from "next/link";

import { EventoDaAgenda } from "@/components/agenda/evento";
import {
  agendaDaSemana,
  fimDaSemana,
  hojeBrasilia,
  outraSemana,
  segundaDaSemana,
  type CasaAgenda,
  type EventoAgenda,
} from "@/lib/legis/agenda";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agenda da semana",
  description: "Sessões do plenário e reuniões das comissões da Câmara e do Senado, dia a dia, com a pauta de cada sessão.",
  alternates: { canonical: absoluteUrl("/legis/agenda") },
};

type Ver = "plenario" | "comissoes" | "tudo";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const DIA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "2-digit", month: "2-digit" });
const CURTA = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
const data = (d: string) => new Date(`${d}T12:00:00Z`);
/** "segunda-feira, 23/11" → "Segunda-feira, 23/11" (o text-transform do CSS faria "Segunda-Feira"). */
const nomeDoDia = (d: string) => {
  const t = DIA.format(data(d));
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const ROTULO_VER: Record<Ver, string> = { plenario: "Plenário", comissoes: "Comissões", tudo: "Tudo" };

export default async function Agenda({ searchParams }: Props) {
  const sp = await searchParams;
  const casa: CasaAgenda = um(sp.casa) === "senado" ? "senado" : "camara";
  const ver: Ver = um(sp.ver) === "comissoes" ? "comissoes" : um(sp.ver) === "tudo" ? "tudo" : "plenario";
  const hoje = hojeBrasilia();
  const pedida = um(sp.semana);
  const segunda = segundaDaSemana(pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : hoje);
  const estaSemana = segundaDaSemana(hoje);

  const agenda = await agendaDaSemana(casa, segunda);
  const eventos = agenda.eventos.filter((e) => (ver === "tudo" ? true : ver === "plenario" ? e.plenario : !e.plenario));

  // Agrupa por dia (de segunda a domingo), na ordem dos horários.
  const dias = new Map<string, EventoAgenda[]>();
  for (const e of eventos) {
    const dia = new Date(e.inicio).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    dias.set(dia, [...(dias.get(dia) ?? []), e]);
  }

  const url = (troca: Partial<{ casa: CasaAgenda; ver: Ver; semana: string }>) => {
    const v = { casa, ver, semana: segunda, ...troca };
    const q = new URLSearchParams();
    if (v.casa !== "camara") q.set("casa", v.casa);
    if (v.ver !== "plenario") q.set("ver", v.ver);
    if (v.semana !== estaSemana) q.set("semana", v.semana);
    const s = q.toString();
    return `/legis/agenda${s ? `?${s}` : ""}`;
  };

  const nomeCasa = casa === "camara" ? "Câmara dos Deputados" : "Senado Federal";

  return (
    <div className="container pagina">
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Agenda da semana</h1>
      <p className="lead">
        O que o plenário e as comissões vão analisar, dia a dia, direto da agenda oficial de cada Casa.
      </p>

      <div className="agenda-controles">
        <nav className="segmentado abas-casa" aria-label="Casa">
          {(["camara", "senado"] as const).map((c) => (
            <Link key={c} href={url({ casa: c })} aria-current={casa === c ? "page" : undefined}>
              {c === "camara" ? "Câmara" : "Senado"}
            </Link>
          ))}
        </nav>
        <nav className="segmentado abas-casa" aria-label="O que mostrar">
          {(["plenario", "comissoes", "tudo"] as const).map((v) => (
            <Link key={v} href={url({ ver: v })} aria-current={ver === v ? "page" : undefined}>
              {ROTULO_VER[v]}
            </Link>
          ))}
        </nav>
      </div>

      <nav className="agenda-semana" aria-label="Semana">
        <Link href={url({ semana: outraSemana(segunda, -1) })} rel="prev">
          ← Semana anterior
        </Link>
        <p>
          <strong>
            {CURTA.format(data(segunda))} a {CURTA.format(data(fimDaSemana(segunda)))}
          </strong>
          {segunda === estaSemana ? (
            <span className="muted small"> · esta semana</span>
          ) : (
            <>
              {" · "}
              <Link href={url({ semana: estaSemana })}>Voltar para esta semana</Link>
            </>
          )}
        </p>
        <Link href={url({ semana: outraSemana(segunda, 1) })} rel="next">
          Próxima semana →
        </Link>
      </nav>

      {agenda.erro ? (
        <div className="vazio">
          <p className="vazio-titulo">A agenda {casa === "camara" ? "da Câmara" : "do Senado"} não respondeu agora.</p>
          <p className="muted">Tente de novo em alguns minutos.</p>
        </div>
      ) : dias.size === 0 ? (
        <div className="vazio">
          <p className="vazio-titulo">
            Nada {ver === "comissoes" ? "nas comissões" : ver === "plenario" ? "no plenário" : "na agenda"} nesta semana.
          </p>
          <p className="muted">
            {ver === "plenario" ? <Link href={url({ ver: "comissoes" })}>Ver as comissões</Link> : "Confira outra semana."}
          </p>
        </div>
      ) : (
        <div className="agenda-dias">
          {[...dias.entries()].map(([dia, lista]) => (
            <section key={dia} className={`card agenda-dia${dia === hoje ? " agenda-hoje" : ""}`} aria-labelledby={`dia-${dia}`}>
              <h2 id={`dia-${dia}`}>
                {nomeDoDia(dia)}
                {dia === hoje && <span className="agenda-hoje-selo">hoje</span>}
              </h2>
              <ul className="agenda-lista">
                {lista.map((e) => (
                  <EventoDaAgenda key={e.id} e={e} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="muted small">
        Fonte: {nomeCasa}, dados abertos (consultados a cada 30 minutos). A pauta aparece nas sessões deliberativas do
        plenário; nas comissões, o link oficial leva à pauta de cada reunião.
      </p>
    </div>
  );
}
