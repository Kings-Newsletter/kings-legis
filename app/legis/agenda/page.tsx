import type { Metadata } from "next";
import Link from "next/link";

import { EventoDaAgenda } from "@/components/agenda/evento";
import {
  agendaDoPeriodo,
  diaDe,
  hojeBrasilia,
  limitesDoMes,
  outroMes,
  type CasaAgenda,
  type EventoAgenda,
} from "@/lib/legis/agenda";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agenda",
  description: "Calendário das sessões do plenário e das reuniões das comissões da Câmara e do Senado, com a pauta de cada sessão.",
  alternates: { canonical: absoluteUrl("/legis/agenda") },
};

type Ver = "plenario" | "comissoes" | "tudo";
type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const MES = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });
const DIA_LONGO = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const HORA = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
const SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
const data = (d: string) => new Date(`${d}T12:00:00Z`);
const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const somar = (d: string, n: number) => new Date(data(d).getTime() + n * 86400000).toISOString().slice(0, 10);
/** 0 = segunda ... 6 = domingo */
const diaDaSemana = (d: string) => (data(d).getUTCDay() + 6) % 7;

const ROTULO_VER: Record<Ver, string> = { plenario: "Plenário", comissoes: "Comissões", tudo: "Tudo" };

/** Rótulo curto da sessão para caber na célula do calendário. */
function rotuloCurto(e: EventoAgenda) {
  const t = e.tipo.toLowerCase();
  if (/solene/.test(t)) return "Solene";
  if (/especial/.test(t)) return "Especial";
  if (/n[ãa]o deliberativ/.test(t)) return "Não deliberativa";
  if (/deliberativ/.test(t)) return "Deliberativa";
  if (/congresso/.test(t)) return "Congresso";
  return e.tipo.split(" ")[0] ?? e.tipo;
}

export default async function Agenda({ searchParams }: Props) {
  const sp = await searchParams;
  const casa: CasaAgenda = um(sp.casa) === "senado" ? "senado" : "camara";
  const ver: Ver = um(sp.ver) === "comissoes" ? "comissoes" : um(sp.ver) === "tudo" ? "tudo" : "plenario";
  const hoje = hojeBrasilia();
  const mesPedido = um(sp.mes);
  const mes = mesPedido && /^\d{4}-\d{2}$/.test(mesPedido) ? mesPedido : hoje.slice(0, 7);
  const { inicio, fim } = limitesDoMes(mes);
  const diaPedido = um(sp.dia);
  const temDia = diaPedido && /^\d{4}-\d{2}-\d{2}$/.test(diaPedido) && diaPedido.startsWith(mes);

  // O dia aberto: o pedido; senão hoje (se for deste mês); senão o primeiro dia com sessão.
  const agendaMes = await agendaDoPeriodo(casa, inicio, fim, temDia ? diaPedido : hoje.startsWith(mes) ? hoje : undefined);
  const doFiltro = (e: EventoAgenda) => (ver === "tudo" ? true : ver === "plenario" ? e.plenario : !e.plenario);
  const porDia = new Map<string, EventoAgenda[]>();
  for (const e of agendaMes.eventos) porDia.set(diaDe(e.inicio), [...(porDia.get(diaDe(e.inicio)) ?? []), e]);
  const primeiroComSessao = [...porDia.entries()].find(([, l]) => l.some(doFiltro))?.[0];
  const dia = temDia ? diaPedido! : hoje.startsWith(mes) ? hoje : (primeiroComSessao ?? inicio);

  // Se o dia aberto não é o que guiou a busca da pauta (ex.: primeiro dia com sessão), busca de novo só ele.
  let eventosDoDia = (porDia.get(dia) ?? []).filter(doFiltro);
  const precisaPauta = casa === "camara" && eventosDoDia.some((e) => e.plenario && e.deliberativo && !e.pauta.length);
  if (precisaPauta) {
    const soDia = await agendaDoPeriodo(casa, dia, dia, dia);
    eventosDoDia = soDia.eventos.filter(doFiltro);
  }

  // Grade de segunda a domingo cobrindo o mês inteiro.
  const primeiraCelula = somar(inicio, -diaDaSemana(inicio));
  const ultimaCelula = somar(fim, 6 - diaDaSemana(fim));
  const celulas: string[] = [];
  for (let d = primeiraCelula; d <= ultimaCelula; d = somar(d, 1)) celulas.push(d);

  const url = (troca: Partial<{ casa: CasaAgenda; ver: Ver; mes: string; dia: string | null }>) => {
    const v = { casa, ver, mes, dia: temDia ? diaPedido! : null, ...troca };
    const q = new URLSearchParams();
    if (v.casa !== "camara") q.set("casa", v.casa);
    if (v.ver !== "plenario") q.set("ver", v.ver);
    if (v.mes !== hoje.slice(0, 7)) q.set("mes", v.mes);
    if (v.dia) q.set("dia", v.dia);
    const s = q.toString();
    return `/legis/agenda${s ? `?${s}` : ""}`;
  };

  const nomeCasa = casa === "camara" ? "Câmara dos Deputados" : "Senado Federal";

  return (
    <div className="container pagina">
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Agenda</h1>
      <p className="lead">Sessões do plenário e reuniões das comissões, direto da agenda oficial de cada Casa.</p>

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

      <section className="card agenda-calendario" aria-labelledby="mes-titulo">
        <div className="agenda-calendario-topo">
          <Link href={url({ mes: outroMes(mes, -1), dia: null })} className="calendario-nav" aria-label="Mês anterior" rel="prev">
            ‹
          </Link>
          <h2 id="mes-titulo">{maiuscula(MES.format(data(inicio)))}</h2>
          <Link href={url({ mes: outroMes(mes, 1), dia: null })} className="calendario-nav" aria-label="Próximo mês" rel="next">
            ›
          </Link>
          {mes !== hoje.slice(0, 7) && (
            <Link href={url({ mes: hoje.slice(0, 7), dia: null })} className="calendario-hoje-link">
              Hoje
            </Link>
          )}
        </div>

        {agendaMes.erro ? (
          <div className="vazio">
            <p className="vazio-titulo">A agenda {casa === "camara" ? "da Câmara" : "do Senado"} não respondeu agora.</p>
            <p className="muted">Tente de novo em alguns minutos.</p>
          </div>
        ) : (
          <div className="calendario-grade-mes" role="grid" aria-label={`Agenda de ${MES.format(data(inicio))}`}>
            <div className="calendario-linha calendario-dias-semana" role="row">
              {SEMANA.map((s) => (
                <span key={s} role="columnheader">
                  {s}
                </span>
              ))}
            </div>
            {Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7)).map((semana) => (
              <div key={semana[0]} className="calendario-linha" role="row">
                {semana.map((d) => {
                  const doMes = d.startsWith(mes);
                  const lista = (porDia.get(d) ?? []).filter(doFiltro);
                  const plenario = lista.filter((e) => e.plenario);
                  const comissoes = lista.filter((e) => !e.plenario);
                  const classes = [
                    "calendario-celula",
                    doMes ? "" : "calendario-celula-fora",
                    d === hoje ? "calendario-celula-hoje" : "",
                    d === dia ? "calendario-celula-aberta" : "",
                    lista.length ? "calendario-celula-com" : "",
                  ].join(" ");
                  const conteudo = (
                    <>
                      <span className="calendario-numero">{Number(d.slice(8))}</span>
                      {plenario.slice(0, 2).map((e) => (
                        <span key={e.id} className={`calendario-sessao${e.deliberativo ? " calendario-sessao-deliberativa" : ""}${/cancelad/i.test(e.situacao) ? " calendario-sessao-cancelada" : ""}`}>
                          <b>{HORA.format(new Date(e.inicio))}</b> {rotuloCurto(e)}
                        </span>
                      ))}
                      {plenario.length > 2 && <span className="calendario-mais">+{plenario.length - 2} sessões</span>}
                      {comissoes.length > 0 && (
                        <span className="calendario-comissoes">
                          {comissoes.length} {comissoes.length === 1 ? "comissão" : "comissões"}
                        </span>
                      )}
                      {lista.length > 0 && <span className="calendario-ponto" aria-hidden="true" />}
                    </>
                  );
                  return doMes ? (
                    <Link
                      key={d}
                      href={`${url({ dia: d })}#dia-aberto`}
                      role="gridcell"
                      className={classes}
                      aria-current={d === dia ? "date" : undefined}
                      aria-label={`${DIA_LONGO.format(data(d))}: ${lista.length ? `${plenario.length} sessões no plenário, ${comissoes.length} reuniões de comissão` : "nada na agenda"}`}
                      scroll={false}
                    >
                      {conteudo}
                    </Link>
                  ) : (
                    <span key={d} role="gridcell" className={classes} aria-hidden="true">
                      <span className="calendario-numero">{Number(d.slice(8))}</span>
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        <p className="calendario-legenda muted small">
          <span className="calendario-sessao calendario-sessao-deliberativa">Deliberativa</span> vota proposições ·{" "}
          <span className="calendario-sessao">Outras sessões</span> solenes, especiais e de debates
        </p>
      </section>

      <section id="dia-aberto" className="card agenda-dia" aria-labelledby="dia-titulo">
        <h2 id="dia-titulo">
          {maiuscula(DIA_LONGO.format(data(dia)))}
          {dia === hoje && <span className="agenda-hoje-selo">hoje</span>}
        </h2>
        {eventosDoDia.length ? (
          <ul className="agenda-lista">
            {eventosDoDia.map((e) => (
              <EventoDaAgenda key={e.id} e={e} />
            ))}
          </ul>
        ) : (
          <p className="muted">
            Nada {ver === "comissoes" ? "nas comissões" : ver === "plenario" ? "no plenário" : "na agenda"} neste dia.
            {ver === "plenario" && (
              <>
                {" "}
                <Link href={url({ ver: "comissoes", dia })}>Ver as comissões</Link>
              </>
            )}
          </p>
        )}
      </section>

      <p className="muted small">
        Fonte: {nomeCasa}, dados abertos (consultados a cada 30 minutos). A pauta aparece nas sessões deliberativas do
        plenário; nas comissões, o link oficial leva à pauta de cada reunião.
      </p>
    </div>
  );
}
