/**
 * Deputados federais e senadores em exercício, das APIs oficiais da Câmara e do
 * Senado. Usado pela rota /legis/api/parlamentares, que guarda o resultado em cache
 * por um dia: as páginas não chamam as APIs externas a cada visita.
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

const UM_DIA = 60 * 60 * 24;

interface DeputadoApi {
  id: number;
  nome: string;
  siglaPartido: string;
  siglaUf: string;
  urlFoto: string;
}

async function deputados(): Promise<Parlamentar[]> {
  const todos: DeputadoApi[] = [];
  for (let pagina = 1; pagina <= 8; pagina++) {
    const r = await fetch(
      `https://dadosabertos.camara.leg.br/api/v2/deputados?itens=100&pagina=${pagina}&ordem=ASC&ordenarPor=nome`,
      { headers: { Accept: "application/json" }, next: { revalidate: UM_DIA } },
    );
    if (!r.ok) throw new Error(`Câmara respondeu ${r.status}`);
    const json = (await r.json()) as { dados: DeputadoApi[] };
    todos.push(...json.dados);
    if (json.dados.length < 100) break;
  }
  return todos.map((d) => ({
    id: `camara-${d.id}`,
    nome: d.nome,
    partido: d.siglaPartido,
    uf: d.siglaUf,
    cargo: "Deputado(a) federal",
    foto: d.urlFoto,
    url: `https://www.camara.leg.br/deputados/${d.id}`,
  }));
}

interface SenadorApi {
  IdentificacaoParlamentar: {
    CodigoParlamentar: string;
    NomeParlamentar: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar: string;
    UrlFotoParlamentar: string;
    UrlPaginaParlamentar?: string;
  };
}

async function senadores(): Promise<Parlamentar[]> {
  const r = await fetch("https://legis.senado.leg.br/dadosabertos/senador/lista/atual.json", {
    headers: { Accept: "application/json" },
    next: { revalidate: UM_DIA },
  });
  if (!r.ok) throw new Error(`Senado respondeu ${r.status}`);
  const json = (await r.json()) as {
    ListaParlamentarEmExercicio: { Parlamentares: { Parlamentar: SenadorApi[] } };
  };
  return json.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.map(({ IdentificacaoParlamentar: s }) => ({
    id: `senado-${s.CodigoParlamentar}`,
    nome: s.NomeParlamentar,
    partido: s.SiglaPartidoParlamentar ?? "S/Partido",
    uf: s.UfParlamentar,
    cargo: "Senador(a)",
    // O Senado publica os endereços com http://; o site é servido em https.
    foto: s.UrlFotoParlamentar.replace(/^http:/, "https:"),
    url: (s.UrlPaginaParlamentar ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${s.CodigoParlamentar}`).replace(
      /^http:/,
      "https:",
    ),
  }));
}

export async function buscarParlamentares(): Promise<Parlamentar[]> {
  const [d, s] = await Promise.all([deputados(), senadores()]);
  return [...s, ...d];
}
