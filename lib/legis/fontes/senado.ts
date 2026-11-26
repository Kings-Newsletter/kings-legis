import "server-only";

import type { Autor, Estagio, LegisEvent, LegisItem } from "@/lib/types";

import { TIPOS } from "../catalogo";
import { estagioDaSituacao, situacaoLegivel, tipoDoEvento } from "../estagio";
import { dataBrasilia, lerNumero, type Filtros } from "../filtros";
import { CACHE, getJson, qs } from "./http";

/**
 * Proposições direto da API de Dados Abertos do Senado (serviço /processo, que
 * substituiu /materia em 2026), sem chave. Cobre também MPs e vetos do Congresso.
 * https://legis.senado.leg.br/dadosabertos/v3/swagger-ui/index.html
 */
const API = "https://legis.senado.leg.br/dadosabertos";

export const urlOficialSenado = (codigoMateria: number | string) =>
  `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigoMateria}`;

interface ProcessoResumo {
  id: number;
  codigoMateria: number;
  identificacao: string;
  ementa?: string;
  autoria?: string;
  dataApresentacao?: string;
  situacaoAtual?: string;
  dataSituacaoAtual?: string;
  dataUltimaAtualizacao?: string;
  tipoDocumento?: string;
}

/** "PL 2/2026" → sigla, número e ano. Emendas e substitutivos ("PL 159/2026 (Substitutivo-CD)") ficam de fora. */
function lerIdentificacao(s: string): { sigla: string; numero: number; ano: number } | null {
  const m = s.trim().match(/^([A-Z]{2,4}) (\d+)\/(\d{4})$/);
  return m ? { sigla: m[1]!, numero: Number(m[2]), ano: Number(m[3]) } : null;
}

/** "Senador Randolfe Rodrigues (PT/AP)" → nome, partido e UF. */
function lerAutoria(s: string | undefined): Autor[] {
  if (!s) return [];
  return s
    .split(/,\s*(?=(?:Senador|Senadora|Deputad|Comiss|Presid|Poder|Câmara|Mesa))/)
    .map((parte) => {
      const m = parte.trim().match(/^(.*?)\s*\(([^/()]+)\/([A-Z]{2})\)$/);
      return m ? { nome: m[1]!, partido: m[2]!, uf: m[3]! } : { nome: parte.trim() };
    });
}

function paraItem(p: ProcessoResumo): LegisItem | null {
  const id = lerIdentificacao(p.identificacao);
  if (!id) return null;
  const situacao = p.situacaoAtual ? situacaoLegivel(p.situacaoAtual) : "Apresentada";
  return {
    _id: `senado:${p.id}`,
    casa: "senado",
    ...id,
    ementa: p.ementa?.trim() || "(O Senado não publicou a ementa.)",
    autores: lerAutoria(p.autoria),
    temas: [],
    dataApresentacao: dataBrasilia(p.dataApresentacao),
    estagio: estagioDaSituacao(p.situacaoAtual),
    situacaoFonte: situacao,
    ultimaAtualizacao: dataBrasilia(p.dataUltimaAtualizacao ?? p.dataSituacaoAtual ?? p.dataApresentacao),
    urlOficial: urlOficialSenado(p.codigoMateria),
  };
}

const SIGLAS = TIPOS.map((t) => t.sigla);

async function buscar(params: Record<string, string | number | undefined>): Promise<LegisItem[]> {
  const { dados } = await getJson<ProcessoResumo[]>(`${API}/processo?${qs(params)}`, CACHE.lista);
  return dados.map(paraItem).filter((i): i is LegisItem => i !== null && SIGLAS.includes(i.sigla));
}

const diasAtras = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/**
 * O /processo devolve tudo de uma vez, sem paginação: a lista é filtrada e
 * paginada aqui. Sem busca nem período, traz o que foi apresentado nos últimos
 * 30 dias.
 *
 * O tipo é filtrado aqui e não na API: com `sigla` junto de um período, o
 * /processo leva mais de 30 segundos; sem ela, cerca de 1 segundo.
 */
export async function listarSenado(f: Filtros): Promise<LegisItem[]> {
  const numero = f.q ? lerNumero(f.q) : null;
  const params: Record<string, string | number | undefined> = numero
    ? { sigla: numero.sigla, numero: numero.numero, ano: numero.ano }
    : {
        termo: f.q,
        dataInicioApresentacao: f.de ?? (f.q || f.ate ? undefined : diasAtras(30)),
        dataFimApresentacao: f.ate,
      };

  return (await buscar(params))
    .filter((i) => !f.sigla || i.sigla === f.sigla)
    .filter((i) => !f.uf || i.autores.some((a) => a.uf === f.uf))
    .filter((i) => !f.estagio || i.estagio === f.estagio)
    .sort((a, b) => b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime());
}

interface ProcessoDetalhe {
  id: number;
  codigoMateria: number;
  identificacao: string;
  sigla: string;
  numero: string;
  ano: number;
  conteudo?: { ementa?: string };
  documento?: { dataApresentacao?: string };
  situacaoAtual?: string;
  dataSituacaoAtual?: string;
  dthUltimaAtualizacao?: string;
  classificacoes?: { descricao: string }[];
  autoriaIniciativa?: {
    autor: string;
    descricaoTipo?: string;
    codigoParlamentar?: number;
    uf?: string;
    siglaPartido?: string;
    cargo?: string;
    ente?: string;
  }[];
  autuacoes?: {
    informesLegislativos?: {
      id: number;
      data: string;
      descricao: string;
      colegiado?: { sigla?: string };
    }[];
  }[];
}

async function detalheBruto(id: string): Promise<ProcessoDetalhe> {
  const { dados } = await getJson<ProcessoDetalhe>(`${API}/processo/${id}`, CACHE.detalhe);
  return dados;
}

export async function detalheSenado(id: string): Promise<LegisItem | null> {
  if (!/^\d+$/.test(id)) return null;
  let d: ProcessoDetalhe;
  try {
    d = await detalheBruto(id);
  } catch (erro) {
    if (String(erro).includes("404")) return null;
    throw erro;
  }
  if (!d?.id) return null;

  const autores: Autor[] = (d.autoriaIniciativa ?? []).map((a) => {
    const parlamentar = a.codigoParlamentar && (a.cargo === "Senador" || a.descricaoTipo === "SENADOR");
    return {
      nome: a.autor,
      partido: a.siglaPartido,
      uf: a.uf,
      tipo: a.cargo ?? a.ente,
      idPolitico: parlamentar ? `senado-${a.codigoParlamentar}` : undefined,
    };
  });

  return {
    _id: `senado:${d.id}`,
    casa: "senado",
    sigla: d.sigla,
    numero: Number(d.numero),
    ano: d.ano,
    ementa: d.conteudo?.ementa?.trim() || "(O Senado não publicou a ementa.)",
    autores,
    temas: (d.classificacoes ?? []).map((c) => c.descricao),
    dataApresentacao: dataBrasilia(d.documento?.dataApresentacao),
    estagio: estagioDaSituacao(d.situacaoAtual),
    situacaoFonte: d.situacaoAtual ? situacaoLegivel(d.situacaoAtual) : "Apresentada",
    ultimaAtualizacao: dataBrasilia(d.dthUltimaAtualizacao ?? d.dataSituacaoAtual),
    urlOficial: urlOficialSenado(d.codigoMateria),
  };
}

export async function eventosSenado(id: string): Promise<LegisEvent[]> {
  const d = await detalheBruto(id);
  return (d.autuacoes ?? [])
    .flatMap((a) => a.informesLegislativos ?? [])
    .map((i) => ({
      _id: `senado:${id}:${i.id}`,
      itemId: `senado:${id}`,
      tipo: tipoDoEvento(i.descricao),
      data: dataBrasilia(i.data),
      orgao: i.colegiado?.sigla,
      descricao: i.descricao.trim(),
    }))
    .sort((a, b) => b.data.getTime() - a.data.getTime());
}

/** Id do processo no Senado com a mesma sigla, número e ano (numeração única desde 2019). */
export async function idNoSenado(sigla: string, numero: number, ano: number): Promise<string | null> {
  const { dados } = await getJson<ProcessoResumo[]>(`${API}/processo?${qs({ sigla, numero, ano })}`, CACHE.detalhe);
  const achado = dados.find((p) => p.identificacao.trim() === `${sigla} ${numero}/${ano}`);
  return achado ? String(achado.id) : null;
}

/** Deliberadas (votadas, sancionadas, vetadas…) nos últimos `dias` e num estágio de avanço. */
export async function avancosSenado(dias: number, estagios: Estagio[]): Promise<LegisItem[]> {
  return (await buscar({ dataInicioDeliberacao: diasAtras(dias) })).filter((i) => estagios.includes(i.estagio));
}
