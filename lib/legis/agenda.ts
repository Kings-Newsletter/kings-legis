import "server-only";

import { unstable_cache } from "next/cache";

import { getJson, qs } from "./fontes/http";

/**
 * Agenda do plenário e das comissões, direto das APIs oficiais:
 * - Câmara: /api/v2/eventos (e /eventos/{id}/pauta para as sessões deliberativas do plenário);
 * - Senado: /plenario/agenda/mes (com as matérias da pauta) e /comissao/agenda.
 *
 * A agenda muda ao longo do dia (sessões convocadas, canceladas, encerradas): cada
 * consulta fica no cache por 30 minutos.
 */

const MEIA_HORA = 60 * 30;
const CAMARA = "https://dadosabertos.camara.leg.br/api/v2";
const SENADO = "https://legis.senado.leg.br/dadosabertos";

export type CasaAgenda = "camara" | "senado";

export interface ItemPauta {
  identificacao: string;
  ementa: string;
  detalhe: string | null;
  /** Ficha no portal (Câmara) ou busca pela proposição (Senado). */
  href: string | null;
}

export interface EventoAgenda {
  id: string;
  casa: CasaAgenda;
  /** ISO 8601 com fuso de Brasília. */
  inicio: string;
  tipo: string;
  descricao: string | null;
  orgao: string;
  plenario: boolean;
  deliberativo: boolean;
  situacao: string;
  local: string | null;
  urlOficial: string;
  video: string | null;
  pauta: ItemPauta[];
}

// ------------------------------------------------------------------ datas

/** Hoje em Brasília, AAAA-MM-DD. */
export const hojeBrasilia = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const somarDias = (d: string, n: number) => {
  const [a, m, dia] = d.split("-").map(Number);
  const x = new Date(Date.UTC(a!, m! - 1, dia! + n));
  return x.toISOString().slice(0, 10);
};

/** Segunda-feira da semana de uma data (AAAA-MM-DD). */
export function segundaDaSemana(d: string): string {
  const [a, m, dia] = d.split("-").map(Number);
  const semana = new Date(Date.UTC(a!, m! - 1, dia!)).getUTCDay(); // 0 = domingo
  return somarDias(d, semana === 0 ? -6 : 1 - semana);
}

export const fimDaSemana = (segunda: string) => somarDias(segunda, 6);
export const outraSemana = (segunda: string, n: number) => somarDias(segunda, 7 * n);

/** "2026-11-26T10:00" (Brasília, sem fuso) → ISO com fuso. */
const comFuso = (s: string) => {
  const t = s.replace(" ", "T").replace(/\.\d+$/, "");
  return /[+-]\d{2}:\d{2}$|Z$/.test(t) ? t : `${t.length === 16 ? `${t}:00` : t}-03:00`;
};

// ----------------------------------------------------------------- Câmara

interface EventoCamara {
  id: number;
  dataHoraInicio: string;
  situacao: string;
  descricaoTipo: string;
  descricao: string | null;
  orgaos: { sigla: string; nome: string; apelido?: string }[];
  localCamara?: { nome?: string | null } | null;
  localExterno?: string | null;
  urlRegistro?: string | null;
}

interface PautaCamara {
  ordem: number;
  topico?: string | null;
  regime?: string | null;
  titulo: string;
  proposicao_?: { id: number; ementa?: string } | null;
  relator?: { nome?: string } | null;
}

const limparDescricao = (s: string | null) => {
  if (!s) return null;
  // A Câmara costuma repetir a descrição em duas linhas quase iguais.
  const linhas = s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  return (linhas[0] ?? "").slice(0, 400) || null;
};

async function pautaCamara(id: number): Promise<ItemPauta[]> {
  try {
    const { dados } = await getJson<{ dados: PautaCamara[] }>(`${CAMARA}/eventos/${id}/pauta`, MEIA_HORA);
    return dados.dados
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => ({
        identificacao: p.titulo,
        ementa: p.proposicao_?.ementa?.trim() ?? "",
        detalhe: [p.topico, p.regime, p.relator?.nome ? `Relator(a): ${p.relator.nome}` : null].filter(Boolean).join(" · ") || null,
        href: p.proposicao_?.id ? `/legis/proposicoes/camara-${p.proposicao_.id}` : null,
      }));
  } catch {
    return [];
  }
}

async function agendaCamara(inicio: string, fim: string, pautaNoDia?: string): Promise<EventoAgenda[]> {
  const eventos: EventoCamara[] = [];
  // Um mês tem algumas centenas de eventos (100 por página).
  // A página pode vir com menos de 100 itens antes do fim: o total real vem em x-total-count.
  for (let pagina = 1; pagina <= 12; pagina++) {
    const { dados, headers } = await getJson<{ dados: EventoCamara[] }>(
      `${CAMARA}/eventos?${qs({ dataInicio: inicio, dataFim: fim, itens: 100, pagina, ordem: "ASC", ordenarPor: "dataHoraInicio" })}`,
      MEIA_HORA,
    );
    eventos.push(...dados.dados);
    const total = Number(headers.get("x-total-count"));
    if (!dados.dados.length || (Number.isFinite(total) && total > 0 ? pagina * 100 >= total : dados.dados.length < 100)) break;
  }
  const lista = eventos.map((e): EventoAgenda => {
    const orgao = e.orgaos[0];
    const plenario = e.orgaos.some((o) => o.sigla === "PLEN");
    return {
      id: `camara:${e.id}`,
      casa: "camara",
      inicio: comFuso(e.dataHoraInicio),
      tipo: e.descricaoTipo,
      descricao: limparDescricao(e.descricao),
      orgao: plenario ? "Plenário" : (orgao?.sigla ?? orgao?.apelido ?? orgao?.nome ?? "—"),
      plenario,
      deliberativo: /deliberativ/i.test(e.descricaoTipo) && !/n[ãa]o deliberativ/i.test(e.descricaoTipo),
      situacao: e.situacao,
      local: e.localCamara?.nome ?? e.localExterno ?? null,
      urlOficial: `https://www.camara.leg.br/evento-legislativo/${e.id}`,
      video: e.urlRegistro ?? null,
      pauta: [],
    };
  });
  // Pauta só das sessões deliberativas do plenário (e, num mês, só as do dia escolhido);
  // as comissões levam ao link oficial.
  await Promise.all(
    lista
      .filter((e) => e.plenario && e.deliberativo && !/cancelad/i.test(e.situacao))
      .filter((e) => !pautaNoDia || diaDe(e.inicio) === pautaNoDia)
      .map(async (e) => {
        e.pauta = await pautaCamara(Number(e.id.split(":")[1]));
      }),
  );
  return lista;
}

// ----------------------------------------------------------------- Senado

interface MateriaSenado {
  DescricaoIdentificacaoMateria?: string;
  SiglaMateria?: string;
  NumeroMateria?: string;
  AnoMateria?: string;
  Ementa?: string;
  Parecer?: string;
  NomeAutor?: string;
  DescricaoTipoPauta?: string;
}

interface SessaoSenado {
  Data: string;
  Hora?: string;
  NumeroSessao?: string;
  TipoSessao?: string;
  LocalSessao?: string;
  CodigoSessao: string;
  Casa?: string;
  SituacaoSessao?: string;
  Materias?: { Materia?: MateriaSenado | MateriaSenado[] };
}

const lista = <T,>(v: T | T[] | undefined | null): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);
const titulo = (s: string) => {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

async function plenarioSenado(inicio: string, fim: string): Promise<EventoAgenda[]> {
  // A agenda do mês vem "da data informada até o fim do mês": uma consulta por mês da semana.
  const meses = [...new Set([inicio, fim].map((d) => d.slice(0, 7)))];
  const sessoes: SessaoSenado[] = [];
  for (const mes of meses) {
    const desde = mes === inicio.slice(0, 7) ? inicio : `${mes}-01`;
    const { dados } = await getJson<{ AgendaPlenario?: { Sessoes?: { Sessao?: SessaoSenado | SessaoSenado[] } } }>(
      `${SENADO}/plenario/agenda/mes/${desde.replace(/-/g, "")}`,
      MEIA_HORA,
    );
    sessoes.push(...lista(dados.AgendaPlenario?.Sessoes?.Sessao));
  }
  return sessoes
    .filter((s) => s.Data >= inicio && s.Data <= fim)
    .map((s): EventoAgenda => {
      const tipo = titulo(s.TipoSessao ?? "Sessão");
      const congresso = s.Casa === "CN";
      return {
        id: `senado:sessao:${s.CodigoSessao}`,
        casa: "senado",
        inicio: comFuso(`${s.Data}T${s.Hora ?? "00:00"}`),
        tipo: congresso ? `${tipo} do Congresso` : tipo,
        descricao: s.NumeroSessao?.trim() ? titulo(s.NumeroSessao) : null,
        orgao: congresso ? "Congresso Nacional" : "Plenário",
        plenario: true,
        deliberativo: /deliberativ/i.test(tipo) && !/n[ãa]o deliberativ/i.test(tipo),
        situacao: s.SituacaoSessao ?? "—",
        local: s.LocalSessao ?? null,
        urlOficial: `https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/${s.CodigoSessao}`,
        video: null,
        pauta: lista(s.Materias?.Materia).map((m) => {
          const id = m.DescricaoIdentificacaoMateria?.trim() ?? "Matéria";
          return {
            identificacao: id,
            ementa: m.Ementa?.trim() ?? "",
            detalhe: [m.NomeAutor ? `Autoria: ${m.NomeAutor}` : null, m.Parecer?.trim() || null].filter(Boolean).join(" · ") || null,
            href: /^[A-Z]{2,4} \d+\/\d{4}$/.test(id) ? `/legis/proposicoes?casa=senado&q=${encodeURIComponent(id)}` : null,
          };
        }),
      };
    });
}

interface ReuniaoSenado {
  codigo: string;
  titulo?: string;
  dataInicio: string;
  situacao?: string;
  local?: string;
  colegiadoCriador?: { sigla?: string; nome?: string };
  urlUltimaPautaSimplesPublicada?: string;
  partes?: { descricaoTipo?: string; isDeliberativa?: string; evento?: { finalidade?: string } } | { descricaoTipo?: string; isDeliberativa?: string; evento?: { finalidade?: string } }[];
}

/**
 * Reuniões das comissões do Senado numa semana. A resposta da semana passa de 1 MB e
 * pode passar de 2 MB, o limite do cache do fetch: guarda só o que a agenda usa.
 */
const comissoesSenado = unstable_cache(
  async (inicio: string, fim: string): Promise<EventoAgenda[]> => {
    const r = await fetch(`${SENADO}/comissao/agenda/${inicio.replace(/-/g, "")}/${fim.replace(/-/g, "")}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok) throw new Error(`Senado respondeu ${r.status}`);
    const j = (await r.json()) as { AgendaReuniao?: { reunioes?: { reuniao?: ReuniaoSenado | ReuniaoSenado[] } } };
    return lista(j.AgendaReuniao?.reunioes?.reuniao).map((m): EventoAgenda => {
      const partes = lista(m.partes);
      const tipo = partes[0]?.descricaoTipo ?? "Reunião";
      const finalidade = partes.map((p) => p.evento?.finalidade?.trim()).find(Boolean) ?? null;
      return {
        id: `senado:reuniao:${m.codigo}`,
        casa: "senado",
        inicio: comFuso(m.dataInicio),
        tipo,
        descricao: finalidade ? finalidade.split(/\r?\n/)[0]!.slice(0, 400) : null,
        orgao: m.colegiadoCriador?.sigla ?? m.colegiadoCriador?.nome ?? "Comissão",
        plenario: false,
        deliberativo: partes.some((p) => p.isDeliberativa === "true"),
        situacao: m.situacao ?? "—",
        local: m.local ?? null,
        urlOficial: `https://legis.senado.leg.br/comissoes/reuniao?reuniao=${m.codigo}`,
        video: null,
        pauta: [],
      };
    });
  },
  ["senado-comissoes-agenda-v1"],
  { revalidate: MEIA_HORA },
);

// ------------------------------------------------------------------ API

/** Dia (AAAA-MM-DD, Brasília) de um horário ISO. */
export const diaDe = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/** Primeiro e último dia de um mês "AAAA-MM". */
export function limitesDoMes(mes: string): { inicio: string; fim: string } {
  const [a, m] = mes.split("-").map(Number);
  const fim = new Date(Date.UTC(a!, m!, 0)).toISOString().slice(0, 10);
  return { inicio: `${mes}-01`, fim };
}

/** Mês anterior ou seguinte de "AAAA-MM". */
export function outroMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  return new Date(Date.UTC(a!, m! - 1 + n, 1)).toISOString().slice(0, 7);
}

/**
 * Agenda de uma Casa entre duas datas, em ordem de horário. Com `pautaNoDia`, a pauta da
 * Câmara (uma consulta por sessão) é buscada só para as sessões daquele dia.
 */
export async function agendaDoPeriodo(casa: CasaAgenda, inicio: string, fim: string, pautaNoDia?: string): Promise<Agenda> {
  try {
    const eventos =
      casa === "camara"
        ? await agendaCamara(inicio, fim, pautaNoDia)
        : [
            ...(await plenarioSenado(inicio, fim)),
            ...(await comissoesSenado(inicio, fim).catch((e) => {
              console.error("[legis] comissões do Senado", e);
              return [] as EventoAgenda[];
            })),
          ];
    return { inicio, fim, eventos: eventos.sort((a, b) => a.inicio.localeCompare(b.inicio)) };
  } catch (e) {
    console.error(`[legis] agenda ${casa}`, e);
    return { inicio, fim, eventos: [], erro: true };
  }
}

export interface Agenda {
  inicio: string;
  fim: string;
  eventos: EventoAgenda[];
  erro?: boolean;
}

/** Agenda de uma Casa numa semana (segunda a domingo), em ordem de horário. */
export async function agendaDaSemana(casa: CasaAgenda, segunda: string): Promise<Agenda> {
  return agendaDoPeriodo(casa, segunda, fimDaSemana(segunda));
}

/**
 * Próximas sessões do plenário (de hoje em diante, nesta semana e na próxima), para a home.
 * Se não houver nenhuma, devolve as últimas da semana.
 */
export async function proximasSessoes(casa: CasaAgenda, limite = 4): Promise<{ eventos: EventoAgenda[]; futuras: boolean; erro?: boolean }> {
  const hoje = hojeBrasilia();
  const segunda = segundaDaSemana(hoje);
  const [esta, proxima] = await Promise.all([agendaDaSemana(casa, segunda), agendaDaSemana(casa, outraSemana(segunda, 1))]);
  const plenario = [...esta.eventos, ...proxima.eventos].filter((e) => e.plenario && !/cancelad/i.test(e.situacao));
  // De hoje em diante e ainda não encerradas (as de hoje já realizadas ficam de fora).
  const futuras = plenario.filter((e) => e.inicio.slice(0, 10) >= hoje && !/encerrad|realizad/i.test(e.situacao));
  if (futuras.length) return { eventos: futuras.slice(0, limite), futuras: true };
  return { eventos: plenario.slice(-limite).reverse(), futuras: false, erro: esta.erro && proxima.erro };
}
