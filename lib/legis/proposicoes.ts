import "server-only";

import type { Estagio, LegisEvent, LegisItem } from "@/lib/types";

import { POR_PAGINA, lerNumero, type Filtros } from "./filtros";
import { avancosCamara, detalheCamara, eventosCamara, idNaCamara, listarCamara, temasCamara } from "./fontes/camara";
import { avancosSenado, detalheSenado, eventosSenado, idNoSenado, listarSenado } from "./fontes/senado";

/**
 * Proposições e tramitação direto das APIs oficiais da Câmara e do Senado.
 *
 * Cada consulta fica no cache do servidor (lib/legis/fontes/http.ts) e as páginas
 * no cache da CDN, então a visita quase nunca chega às fontes.
 *
 * Em desenvolvimento, LEGIS_EXEMPLOS=1 troca as fontes por dados de exemplo
 * fictícios (lib/legis/exemplos.ts), para testar telas sem rede.
 */
export type Origem = "oficial" | "exemplo";

export function origemDosDados(): Origem {
  return process.env.NODE_ENV !== "production" && process.env.LEGIS_EXEMPLOS === "1" ? "exemplo" : "oficial";
}

const exemplos = () => import("./exemplos");

export type ItemLista = Pick<
  LegisItem,
  | "_id"
  | "casa"
  | "sigla"
  | "numero"
  | "ano"
  | "ementa"
  | "autores"
  | "temas"
  | "dataApresentacao"
  | "estagio"
  | "situacaoFonte"
  | "ultimaAtualizacao"
  | "urlOficial"
>;

export interface Resultado {
  origem: Origem;
  itens: ItemLista[];
  total: number;
  erro?: boolean;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const inicioDoDia = (d: string) => new Date(`${d}T00:00:00-03:00`);
const fimDoDia = (d: string) => new Date(`${d}T23:59:59.999-03:00`);

function exemploCasaComFiltros(item: LegisItem, f: Filtros): boolean {
  if (item.casa !== f.casa) return false;
  if (f.sigla && item.sigla !== f.sigla) return false;
  if (f.estagio && item.estagio !== f.estagio) return false;
  if (f.tema && !item.temas.includes(f.tema)) return false;
  if (f.uf && !item.autores.some((a) => a.uf === f.uf)) return false;
  if (f.de && item.dataApresentacao < inicioDoDia(f.de)) return false;
  if (f.ate && item.dataApresentacao > fimDoDia(f.ate)) return false;
  if (f.q) {
    const n = lerNumero(f.q);
    if (n) return item.sigla === n.sigla && item.numero === n.numero && (!n.ano || item.ano === n.ano);
    const texto = semAcento(`${item.ementa} ${item.autores.map((a) => a.nome).join(" ")}`);
    return semAcento(f.q).split(/\s+/).filter(Boolean).every((t) => texto.includes(t));
  }
  return true;
}

export async function listarProposicoes(f: Filtros): Promise<Resultado> {
  const origem = origemDosDados();
  const pular = (f.pagina - 1) * POR_PAGINA;

  if (origem === "exemplo") {
    const { ITENS_EXEMPLO } = await exemplos();
    const todos = ITENS_EXEMPLO.filter((i) => exemploCasaComFiltros(i, f)).sort(
      (a, b) => b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime(),
    );
    return { origem, itens: todos.slice(pular, pular + POR_PAGINA), total: todos.length };
  }

  try {
    if (f.casa === "camara") return { origem, ...(await listarCamara(f)) };
    const todos = await listarSenado(f);
    return { origem, itens: todos.slice(pular, pular + POR_PAGINA), total: todos.length };
  } catch (erro) {
    console.error(`[legis] lista ${f.casa}`, erro);
    return { origem, itens: [], total: 0, erro: true };
  }
}

/** Temas para o filtro. Só a Câmara publica uma lista de temas. */
export async function temasDisponiveis(casa: Filtros["casa"]): Promise<string[]> {
  if (origemDosDados() === "exemplo") {
    const { ITENS_EXEMPLO } = await exemplos();
    return [...new Set(ITENS_EXEMPLO.filter((i) => i.casa === casa).flatMap((i) => i.temas))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  }
  if (casa !== "camara") return [];
  try {
    return (await temasCamara()).map((t) => t.nome);
  } catch (erro) {
    console.error("[legis] temas", erro);
    return [];
  }
}

/** "camara:2345678" → Casa e id na fonte. */
function separar(id: string): { casa: string; idFonte: string } {
  const [casa = "", idFonte = ""] = id.split(":");
  return { casa, idFonte };
}

/** null quando a proposição não existe; lança erro quando a fonte está fora do ar. */
export async function buscarProposicao(id: string): Promise<LegisItem | null> {
  if (origemDosDados() === "exemplo") {
    const { ITENS_EXEMPLO } = await exemplos();
    return ITENS_EXEMPLO.find((i) => i._id === id) ?? null;
  }
  const { casa, idFonte } = separar(id);
  if (casa === "camara") return detalheCamara(idFonte);
  if (casa === "senado") return detalheSenado(idFonte);
  return null;
}

export async function eventosDaProposicao(itemId: string): Promise<LegisEvent[]> {
  if (origemDosDados() === "exemplo") {
    const { EVENTOS_EXEMPLO } = await exemplos();
    return EVENTOS_EXEMPLO.filter((e) => e.itemId === itemId).sort((a, b) => b.data.getTime() - a.data.getTime());
  }
  const { casa, idFonte } = separar(itemId);
  try {
    if (casa === "camara") return await eventosCamara(idFonte);
    if (casa === "senado") return await eventosSenado(idFonte);
  } catch (erro) {
    console.error("[legis] tramitação", erro);
  }
  return [];
}

/**
 * A mesma matéria na outra Casa. Desde 2019 Câmara e Senado usam a mesma
 * numeração, então basta procurar a mesma sigla, número e ano do outro lado.
 */
export async function mesmaMateriaNaOutraCasa(item: LegisItem): Promise<ItemLista[]> {
  if (origemDosDados() === "exemplo") {
    const { ITENS_EXEMPLO } = await exemplos();
    return ITENS_EXEMPLO.filter((i) => item.outrasCasas?.includes(i._id));
  }
  if (item.ano < 2019) return [];
  try {
    const outro =
      item.casa === "camara"
        ? await idNoSenado(item.sigla, item.numero, item.ano).then((id) => (id ? detalheSenado(id) : null))
        : await idNaCamara(item.sigla, item.numero, item.ano).then((id) => (id ? detalheCamara(id) : null));
    return outro ? [outro] : [];
  } catch (erro) {
    console.error("[legis] outra Casa", erro);
    return [];
  }
}

/** Estágios que contam como "avançou" na home. */
const AVANCO: Estagio[] = ["pautada", "aprovada_em_uma_casa", "aprovada", "sancionada", "vetada"];

/** Proposições com movimento nos últimos 7 dias que estão num estágio de avanço, das duas Casas. */
export async function avancosDaSemana(limite = 5): Promise<Resultado> {
  const origem = origemDosDados();
  const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  if (origem === "exemplo") {
    const { ITENS_EXEMPLO } = await exemplos();
    const itens = ITENS_EXEMPLO.filter((i) => i.ultimaAtualizacao >= desde && AVANCO.includes(i.estagio)).sort(
      (a, b) => b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime(),
    );
    return { origem, itens: itens.slice(0, limite), total: itens.length };
  }

  const dia = desde.toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const [camara, senado] = await Promise.allSettled([avancosCamara(dia, AVANCO, limite), avancosSenado(7, AVANCO)]);
  const itens = [camara, senado]
    .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
    .sort((a, b) => b.ultimaAtualizacao.getTime() - a.ultimaAtualizacao.getTime());
  const erro = camara.status === "rejected" && senado.status === "rejected";
  if (erro) console.error("[legis] avanços", camara.reason, senado.reason);
  return { origem, itens: itens.slice(0, limite), total: itens.length, erro };
}
