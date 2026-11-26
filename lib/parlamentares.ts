/**
 * Deputados federais e senadores em exercício, das APIs oficiais da Câmara e do
 * Senado. Usado pela composição do Congresso (lib/composicao.ts) e pela rota
 * /legis/api/parlamentares, sempre com cache: a visita não chama as APIs externas.
 */

export type Cargo =
  | "Senador(a)"
  | "Deputado(a) federal"
  | "Deputado(a) estadual"
  | "Deputado(a) distrital"
  | "Governador(a)"
  | "Vice-governador(a)"
  | "Prefeito(a)"
  | "Vice-prefeito(a)"
  | "Vereador(a)";

export interface Parlamentar {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  cargo: Cargo;
  foto: string;
  /** Página oficial; vazio quando a fonte não tem uma página por pessoa. */
  url: string;
}

/**
 * As listas são refeitas no máximo a cada 6 horas (cache do fetch no servidor):
 * a visita nunca chama a Câmara ou o Senado diretamente.
 */
export const SEIS_HORAS = 60 * 60 * 6;

/** Hora em que a fonte respondeu, pelo cabeçalho Date da resposta (fica guardado no cache). */
function horaDaResposta(r: Response): Date {
  const d = new Date(r.headers.get("date") ?? "");
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

interface DeputadoApi {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
}

async function deputados(): Promise<{ lista: Parlamentar[]; consultadoEm: Date }> {
  const todos: DeputadoApi[] = [];
  let consultadoEm = new Date();
  for (let pagina = 1; pagina <= 8; pagina++) {
    const r = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=${pagina}&ordem=ASC&ordenarPor=nome`,
      { headers: { Accept: "application/json" }, next: { revalidate: SEIS_HORAS } },
    );
    if (!r.ok) throw new Error(`Câmara respondeu ${r.status}`);
    if (pagina === 1) consultadoEm = horaDaResposta(r);
    const json = (await r.json()) as { dados: DeputadoApi[] };
    todos.push(...json.dados);
    if (json.dados.length < 100) break;
  }
  const lista: Parlamentar[] = todos.map((d) => ({
    id: `camara-${d.id}`,
    nome: d.nome,
    partido: d.siglaPartido,
    uf: d.siglaUf,
    cargo: "Deputado(a) federal",
    foto: d.urlFoto,
    url: `https://www.camara.leg.br/deputados/${d.id}`,
  }));
  return { lista, consultadoEm };
}

interface ExercicioApi {
  DataInicio?: string;
  DataFim?: string;
  SiglaCausaAfastamento?: string;
}

interface SenadorApi {
  IdentificacaoParlamentar: {
    CodigoParlamentar: string;
    NomeParlamentar: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar?: string;
    UrlFotoParlamentar: string;
    UrlPaginaParlamentar?: string;
  };
  Mandato?: {
    UfParlamentar?: string;
    Exercicios?: { Exercicio?: ExercicioApi | ExercicioApi[] };
  };
}

const comoLista = <T,>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** Hoje em Brasília, AAAA-MM-DD. */
const hojeBrasilia = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

/**
 * A lista "atual" do Senado às vezes traz o titular e o suplente juntos, no dia em
 * que um afastamento começa ou termina. Fica de fora quem tem afastamento que cobre hoje.
 */
function afastadoHoje(s: SenadorApi, hoje: string): boolean {
  return comoLista(s.Mandato?.Exercicios?.Exercicio).some(
    (e) => e.SiglaCausaAfastamento && e.DataInicio && e.DataInicio <= hoje && (!e.DataFim || e.DataFim >= hoje),
  );
}

async function senadores(): Promise<{ lista: Parlamentar[]; consultadoEm: Date }> {
  const r = await fetch("https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json", {
    headers: { Accept: "application/json" },
    next: { revalidate: SEIS_HORAS },
  });
  if (!r.ok) throw new Error(`Senado respondeu ${r.status}`);
  const json = (await r.json()) as {
    ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: SenadorApi[] } };
  };
  const hoje = hojeBrasilia();
  const lista: Parlamentar[] = json.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.filter(
    (p) => !afastadoHoje(p, hoje),
  ).map(({ IdentificacaoParlamentar: s, Mandato: m }) => ({
    id: `senado-${s.CodigoParlamentar}`,
    nome: s.NomeParlamentar,
    partido: s.SiglaPartidoParlamentar ?? "S/Partido",
    // Alguns registros trazem a UF só no mandato.
    uf: s.UfParlamentar ?? m?.UfParlamentar ?? "",
    cargo: "Senador(a)",
    // O Senado publica os endereços com http://; o site é servido em https.
    foto: s.UrlFotoParlamentar.replace(/^http:/, "https:"),
    url: (s.UrlPaginaParlamentar ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${s.CodigoParlamentar}`).replace(
      /^http:/,
      "https:",
    ),
  }));
  return { lista, consultadoEm: horaDaResposta(r) };
}

export interface ListaParlamentares {
  parlamentares: Parlamentar[];
  /** Hora da consulta mais antiga entre Câmara e Senado. */
  consultadoEm: Date;
}

export async function buscarParlamentaresComData(): Promise<ListaParlamentares> {
  const [d, s] = await Promise.all([deputados(), senadores()]);
  return {
    parlamentares: [...s.lista, ...d.lista],
    consultadoEm: d.consultadoEm < s.consultadoEm ? d.consultadoEm : s.consultadoEm,
  };
}

export async function buscarParlamentares(): Promise<Parlamentar[]> {
  return (await buscarParlamentaresComData()).parlamentares;
}
