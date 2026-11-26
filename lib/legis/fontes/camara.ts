import "server-only";

import { buscarParlamentares } from "@/lib/parlamentares";
import type { Autor, Estagio, LegisEvent, LegisItem } from "@/lib/types";

import { TIPOS } from "../catalogo";
import { estagioDaSituacao, tipoDoEvento } from "../estagio";
import { POR_PAGINA, dataBrasilia, lerNumero, type Filtros } from "../filtros";
import { CACHE, getJson, qs } from "./http";

/**
 * Proposições direto da API de Dados Abertos da Câmara (v2), sem chave.
 * https://dadosabertos.camara.leg.br/swagger/api.html
 */
const API = "https://dadosabertos.camara.leg.br/api/v2";

/** Só os tipos acompanhados (a Câmara também lista requerimentos, sugestões, indicações…). */
const SIGLAS = TIPOS.map((t) => t.sigla).join(",");

export const urlOficialCamara = (id: number | string) =>
  `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`;

interface Status {
  dataHora: string;
  sequencia: number;
  siglaOrgao?: string;
  descricaoTramitacao?: string;
  descricaoSituacao?: string | null;
  despacho?: string;
  url?: string | null;
}

interface PropResumo {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao: string;
}

interface PropDetalhe extends PropResumo {
  statusProposicao: Status;
  descricaoTipo?: string;
  urlInteiroTeor?: string | null;
}

interface Referencia {
  cod: string;
  nome: string;
}

// ------------------------------------------------------------ referências

export async function temasCamara(): Promise<Referencia[]> {
  const { dados } = await getJson<{ dados: Referencia[] }>(`${API}/referencias/proposicoes/codTema`, CACHE.referencia);
  return dados.dados.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

// ------------------------------------------------------------ conversão

function situacaoDe(st: Status): { situacao: string; estagio: Estagio } {
  if (st.descricaoSituacao) return { situacao: st.descricaoSituacao.trim(), estagio: estagioDaSituacao(st.descricaoSituacao) };
  // Recém-apresentada: a Câmara ainda não atribuiu situação.
  const situacao = st.descricaoTramitacao?.trim() || "Apresentada";
  return { situacao, estagio: st.sequencia <= 1 ? "apresentada" : estagioDaSituacao(situacao) };
}

function paraItem(d: PropDetalhe, autores: Autor[] = [], temas: string[] = []): LegisItem {
  const { situacao, estagio } = situacaoDe(d.statusProposicao);
  return {
    _id: `camara:${d.id}`,
    casa: "camara",
    sigla: d.siglaTipo,
    numero: d.numero,
    ano: d.ano,
    ementa: d.ementa?.trim() || "(A Câmara não publicou a ementa.)",
    autores,
    temas,
    dataApresentacao: dataBrasilia(d.dataApresentacao),
    estagio,
    situacaoFonte: situacao,
    ultimaAtualizacao: dataBrasilia(d.statusProposicao.dataHora),
    urlOficial: urlOficialCamara(d.id),
  };
}

async function detalheBruto(id: number | string): Promise<PropDetalhe> {
  const { dados } = await getJson<{ dados: PropDetalhe }>(`${API}/proposicoes/${id}`, CACHE.detalhe);
  return dados.dados;
}

/** A lista da Câmara não traz a situação: busca o detalhe de cada item (cada um com cache). */
async function comSituacao(resumos: PropResumo[]): Promise<LegisItem[]> {
  const detalhes = await Promise.allSettled(resumos.map((r) => detalheBruto(r.id)));
  return detalhes.map((d, i) =>
    d.status === "fulfilled"
      ? paraItem(d.value)
      : paraItem({
          ...resumos[i]!,
          statusProposicao: { dataHora: resumos[i]!.dataApresentacao, sequencia: 1, descricaoTramitacao: "Situação indisponível agora" },
        }),
  );
}

// ------------------------------------------------------------ consultas

/**
 * Lista paginada pela própria Câmara. A API não filtra por situação (o parâmetro
 * codSituacao é ignorado), então o filtro de estágio não vale para a Câmara.
 */
export async function listarCamara(f: Filtros): Promise<{ itens: LegisItem[]; total: number }> {
  const numero = f.q ? lerNumero(f.q) : null;

  let codTema: string | undefined;
  if (f.tema) {
    codTema = (await temasCamara()).find((t) => t.nome === f.tema)?.cod;
    if (!codTema) return { itens: [], total: 0 };
  }

  const params = qs({
    siglaTipo: numero?.sigla ?? f.sigla ?? SIGLAS,
    numero: numero?.numero,
    ano: numero?.ano,
    keywords: numero ? undefined : f.q,
    dataApresentacaoInicio: f.de,
    dataApresentacaoFim: f.ate,
    siglaUfAutor: f.uf,
    codTema,
    ordem: "DESC",
    ordenarPor: "id",
    itens: POR_PAGINA,
    pagina: f.pagina,
  });
  const { dados, headers } = await getJson<{ dados: PropResumo[] }>(`${API}/proposicoes?${params}`, CACHE.lista);
  const total = Number(headers.get("x-total-count") ?? dados.dados.length);
  return { itens: await comSituacao(dados.dados), total: Number.isFinite(total) ? total : dados.dados.length };
}

interface AutorApi {
  uri?: string | null;
  nome: string;
  tipo?: string;
}

interface TemaApi {
  tema: string;
}

export async function detalheCamara(id: string): Promise<LegisItem | null> {
  if (!/^\d+$/.test(id)) return null;
  let d: PropDetalhe;
  try {
    d = await detalheBruto(id);
  } catch (erro) {
    if (String(erro).includes("404")) return null;
    throw erro;
  }

  const [autoresApi, temasApi, parlamentares] = await Promise.all([
    getJson<{ dados: AutorApi[] }>(`${API}/proposicoes/${id}/autores`, CACHE.detalhe).then((r) => r.dados.dados).catch(() => []),
    getJson<{ dados: TemaApi[] }>(`${API}/proposicoes/${id}/temas`, CACHE.detalhe).then((r) => r.dados.dados).catch(() => []),
    buscarParlamentares().catch(() => []),
  ]);
  const porId = new Map(parlamentares.map((p) => [p.id, p]));

  const autores: Autor[] = autoresApi.map((a) => {
    const idDeputado = a.uri?.match(/\/deputados\/(\d+)/)?.[1];
    const idSenador = a.uri?.match(/\/senadores\/(\d+)/)?.[1];
    const idPolitico = idDeputado ? `camara-${idDeputado}` : idSenador ? `senado-${idSenador}` : undefined;
    const p = idPolitico ? porId.get(idPolitico) : undefined;
    return {
      nome: a.nome,
      tipo: a.tipo,
      partido: p?.partido,
      uf: p?.uf,
      // Só linka quem está em exercício (a página do político depende disso).
      idPolitico: p ? idPolitico : undefined,
    };
  });

  return paraItem(d, autores, temasApi.map((t) => t.tema));
}

interface TramitacaoApi extends Status {
  despacho?: string;
}

export async function eventosCamara(id: string): Promise<LegisEvent[]> {
  const { dados } = await getJson<{ dados: TramitacaoApi[] }>(`${API}/proposicoes/${id}/tramitacoes`, CACHE.detalhe);
  return dados.dados
    .map((t) => {
      const titulo = t.descricaoTramitacao?.trim() ?? "";
      const despacho = t.despacho?.trim();
      const descricao = despacho && despacho !== titulo ? `${titulo}${titulo ? ": " : ""}${despacho}` : titulo;
      return {
        _id: `camara:${id}:${t.sequencia}`,
        itemId: `camara:${id}`,
        tipo: tipoDoEvento(titulo),
        data: dataBrasilia(t.dataHora),
        orgao: t.siglaOrgao,
        descricao: descricao || "Movimentação sem descrição",
        urlOficial: t.url ?? undefined,
      };
    })
    .sort((a, b) => b.data.getTime() - a.data.getTime());
}

/** Id da proposição na Câmara com a mesma sigla, número e ano (numeração única desde 2019). */
export async function idNaCamara(sigla: string, numero: number, ano: number): Promise<string | null> {
  const { dados } = await getJson<{ dados: PropResumo[] }>(
    `${API}/proposicoes?${qs({ siglaTipo: sigla, numero, ano, itens: 5 })}`,
    CACHE.detalhe,
  );
  const achada = dados.dados.find((p) => p.siglaTipo === sigla && p.numero === numero && p.ano === ano);
  return achada ? String(achada.id) : null;
}

interface VotacaoResumo {
  uri: string;
  siglaOrgao?: string;
  aprovacao?: number | null;
}

interface VotacaoDetalhe {
  proposicoesAfetadas?: PropResumo[];
}

/**
 * Proposições aprovadas no plenário da Câmara desde `desde` (AAAA-MM-DD) que estão
 * num estágio de avanço. Vem das votações: a lista de proposições não filtra por
 * situação.
 */
export async function avancosCamara(desde: string, estagios: Estagio[], limite: number): Promise<LegisItem[]> {
  const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const { dados } = await getJson<{ dados: VotacaoResumo[] }>(
    `${API}/votacoes?${qs({ dataInicio: desde, dataFim: hoje, ordem: "DESC", ordenarPor: "dataHoraRegistro", itens: 200 })}`,
    CACHE.lista,
  );
  const plenario = dados.dados.filter((v) => v.siglaOrgao === "PLEN" && v.aprovacao === 1).slice(0, 30);
  const detalhes = await Promise.allSettled(plenario.map((v) => getJson<{ dados: VotacaoDetalhe }>(v.uri, CACHE.detalhe)));

  const vistos = new Set<number>();
  const props: PropResumo[] = [];
  for (const d of detalhes) {
    if (d.status !== "fulfilled") continue;
    for (const p of d.value.dados.dados.proposicoesAfetadas ?? []) {
      if (vistos.has(p.id) || !SIGLAS.split(",").includes(p.siglaTipo)) continue;
      vistos.add(p.id);
      props.push(p);
    }
  }
  const itens = await comSituacao(props.slice(0, limite * 2));
  return itens.filter((i) => estagios.includes(i.estagio));
}
