import "server-only";

import { COR_PARTIDO } from "./bancadas";
import { nomeProprio } from "./tse";

/**
 * Ficha completa de um político, montada das fontes oficiais:
 * - deputado federal: API de dados abertos da Câmara;
 * - senador: dados abertos do Senado (legislativo e administrativo);
 * - eleitos pelo TSE (governo, assembleias, prefeituras, câmaras municipais): DivulgaCandContas.
 *
 * Cada bloco diz se veio ou não, e por quê. Quando uma fonte não publica ou não responde,
 * a página mostra isso em vez de esconder. Campos pessoais que não interessam ao
 * eleitor (CPF, título, endereço residencial) não são lidos.
 */

const SEIS_HORAS = 60 * 60 * 6;
const UM_DIA = 60 * 60 * 24;
const CAMARA = "https://dadosabertos.camara.leg.br/api/v2";
const SENADO = "https://legis.senado.leg.br/dadosabertos";
const SENADO_ADM = "https://adm.senado.gov.br/adm-dadosabertos/api/v1";
const TSE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";

export interface Link {
  rotulo: string;
  href: string;
}

/** Um bloco da ficha: os dados, ou o motivo de não estarem aqui e onde procurar. */
export type Bloco<T> = { ok: true; dados: T } | { ok: false; motivo: string; onde?: Link };

export interface Despesa {
  data: string | null;
  mes: number | null;
  tipo: string;
  fornecedor: string;
  documentoFornecedor: string | null;
  valor: number;
  url: string | null;
}

export interface Despesas {
  ano: number;
  nome: string;
  total: number;
  porMes: number[];
  porTipo: { tipo: string; total: number; n: number }[];
  fornecedores: { nome: string; documento: string | null; total: number; n: number }[];
  itens: Despesa[];
}

export interface Voto {
  data: string;
  descricao: string;
  materia: string | null;
  voto: string;
  resultado: string | null;
  url: string | null;
}

export interface Votacoes {
  periodo: string;
  total: number;
  registrados: number;
  porVoto: { voto: string; n: number; legenda?: string }[];
  itens: Voto[];
  nota: string;
}

export interface Projeto {
  titulo: string;
  ementa: string;
  data: string | null;
  url: string | null;
}

export interface Projetos {
  total: number | null;
  itens: Projeto[];
}

export interface Bens {
  total: number;
  itens: { tipo: string; descricao: string; valor: number }[];
  eleicao: number;
}

export interface Eleicao {
  ano: number;
  cargo: string;
  partido: string;
  local: string;
  resultado: string;
}

export interface Perfil {
  id: string;
  fonte: "camara" | "senado" | "tse";
  nome: string;
  nomeCompleto: string | null;
  cargo: string;
  partido: string;
  cor: string;
  uf: string;
  foto: string;
  urlOficial: string | null;
  fatos: { rotulo: string; valor: string }[];
  contatos: { rotulo: string; valor: string; href?: string }[];
  despesas: Bloco<Despesas> | null;
  votacoes: Bloco<Votacoes> | null;
  projetos: Bloco<Projetos> | null;
  bens: Bloco<Bens> | null;
  campanha: { rotulo: string; valor: number }[];
  eleicoes: Eleicao[];
  /** O que um eleitor deveria poder ver e esta ficha ainda não mostra, com onde procurar. */
  faltando: { item: string; porque: string; onde?: Link }[];
  fontes: Link[];
  consultadoEm: string;
}

// ------------------------------------------------------------------ util

async function obter<T>(url: string, revalidate = SEIS_HORAS, espera = 20000): Promise<{ dados: T; headers: Headers }> {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate },
    signal: AbortSignal.timeout(espera),
  });
  if (!r.ok) throw new Error(`${new URL(url).host} respondeu ${r.status}`);
  return { dados: (await r.json()) as T, headers: r.headers };
}

function lista<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

function dataBr(iso: string | null | undefined) {
  if (!iso) return null;
  const [a, m, d] = iso.slice(0, 10).split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

const hoje = () =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date());

function resumirDespesas(ano: number, nome: string, itens: Despesa[]): Despesas {
  const porMes = Array.from({ length: 12 }, () => 0);
  const tipos = new Map<string, { total: number; n: number }>();
  const forn = new Map<string, { nome: string; documento: string | null; total: number; n: number }>();
  for (const d of itens) {
    if (d.mes && d.mes >= 1 && d.mes <= 12) porMes[d.mes - 1]! += d.valor;
    const t = tipos.get(d.tipo) ?? { total: 0, n: 0 };
    t.total += d.valor;
    t.n++;
    tipos.set(d.tipo, t);
    const chave = d.documentoFornecedor || d.fornecedor;
    const f = forn.get(chave) ?? { nome: d.fornecedor, documento: d.documentoFornecedor, total: 0, n: 0 };
    f.total += d.valor;
    f.n++;
    forn.set(chave, f);
  }
  return {
    ano,
    nome,
    total: itens.reduce((t, d) => t + d.valor, 0),
    porMes,
    porTipo: [...tipos.entries()].map(([tipo, v]) => ({ tipo, ...v })).sort((a, b) => b.total - a.total),
    fornecedores: [...forn.values()].sort((a, b) => b.total - a.total).slice(0, 10),
    itens: [...itens].sort((a, b) => (b.data ?? "").localeCompare(a.data ?? "") || b.valor - a.valor),
  };
}

// ---------------------------------------------------------------- Câmara

interface DeputadoDetalhe {
  nomeCivil: string;
  escolaridade: string | null;
  dataNascimento: string | null;
  municipioNascimento: string | null;
  ufNascimento: string | null;
  urlWebsite: string | null;
  redeSocial: string[];
  ultimoStatus: {
    nome: string;
    nomeEleitoral: string;
    siglaPartido: string;
    siglaUf: string;
    urlFoto: string;
    email: string | null;
    situacao: string | null;
    condicaoEleitoral: string | null;
    gabinete: { nome: string | null; predio: string | null; sala: string | null; andar: string | null; telefone: string | null; email: string | null };
  };
}

interface DespesaCamara {
  ano: number;
  mes: number;
  tipoDespesa: string;
  dataDocumento: string | null;
  nomeFornecedor: string;
  cnpjCpfFornecedor: string | null;
  valorDocumento: number;
  valorGlosa: number;
  valorLiquido: number;
  urlDocumento: string | null;
}

async function despesasCamara(id: string): Promise<Bloco<Despesas>> {
  const onde = { rotulo: "Gastos na página oficial do deputado", href: `https://www.camara.leg.br/deputados/${id}` };
  const anoAtual = new Date().getFullYear();
  try {
    for (const ano of [anoAtual, anoAtual - 1]) {
      const itens: Despesa[] = [];
      for (let pagina = 1; pagina <= 20; pagina++) {
        const { dados } = await obter<{ dados: DespesaCamara[] }>(
          `${CAMARA}/deputados/${id}/despesas?ano=${ano}&itens=100&pagina=${pagina}&ordem=DESC&ordenarPor=dataDocumento`,
        );
        itens.push(
          ...dados.dados.map((d) => ({
            data: d.dataDocumento?.slice(0, 10) ?? null,
            mes: d.mes,
            tipo: d.tipoDespesa,
            fornecedor: d.nomeFornecedor,
            documentoFornecedor: d.cnpjCpfFornecedor || null,
            // Valor reembolsado = valor do documento menos o que a Câmara glosou. Não usamos
            // valorLiquido, que a API passou a publicar com o sinal trocado.
            valor: Math.round(((d.valorDocumento ?? 0) - (d.valorGlosa ?? 0)) * 100) / 100,
            url: d.urlDocumento ? d.urlDocumento.replace(/^http:/, "https:") : null,
          })),
        );
        if (dados.dados.length < 100) break;
      }
      if (itens.length) return { ok: true, dados: resumirDespesas(ano, "Cota parlamentar (CEAP)", itens) };
    }
    return {
      ok: false,
      motivo: `A API de dados abertos da Câmara não devolveu nenhuma despesa da cota parlamentar deste deputado em ${anoAtual} nem em ${anoAtual - 1} (consulta em ${hoje()}). Os gastos deveriam estar lá: a Câmara é obrigada a publicá-los.`,
      onde,
    };
  } catch (e) {
    return { ok: false, motivo: `A API da Câmara não respondeu (${String(e)}).`, onde };
  }
}

interface VotacaoCamara {
  id: string;
  data: string;
  descricao: string;
  aprovacao: number | null;
}

interface VotoCamara {
  tipoVoto: string;
  deputado_: { id: number };
}

/** Últimas votações nominais do Plenário, com os votos: a mesma lista para todos os deputados. */
async function votacoesPlenario(): Promise<{ votacao: VotacaoCamara; votos: VotoCamara[] }[]> {
  const { dados } = await obter<{ dados: VotacaoCamara[] }>(
    `${CAMARA}/votacoes?idOrgao=180&ordem=DESC&ordenarPor=dataHoraRegistro&itens=36`,
  );
  const comVotos: { votacao: VotacaoCamara; votos: VotoCamara[] }[] = [];
  for (let i = 0; i < dados.dados.length && comVotos.length < 30; i += 12) {
    const lote = dados.dados.slice(i, i + 12);
    const res = await Promise.all(
      lote.map((v) =>
        obter<{ dados: VotoCamara[] }>(`${CAMARA}/votacoes/${v.id}/votos`, UM_DIA)
          .then((r) => r.dados.dados)
          .catch(() => []),
      ),
    );
    lote.forEach((v, j) => {
      if (res[j]?.length) comVotos.push({ votacao: v, votos: res[j]! });
    });
  }
  return comVotos.slice(0, 30);
}

async function votacoesCamara(id: string): Promise<Bloco<Votacoes>> {
  const onde = { rotulo: "Votações na página oficial do deputado", href: `https://www.camara.leg.br/deputados/${id}` };
  try {
    const todas = await votacoesPlenario();
    if (!todas.length)
      return {
        ok: false,
        motivo: `A API de dados abertos da Câmara não está devolvendo os votos individuais das votações recentes do Plenário: as 36 mais recentes vieram sem nenhum voto (consulta em ${hoje()}). Sem isso não dá para calcular presença nem mostrar como o deputado votou.`,
        onde,
      };
    const itens: Voto[] = todas.map(({ votacao, votos }) => {
      const v = votos.find((x) => String(x.deputado_?.id) === id);
      return {
        data: votacao.data,
        descricao: votacao.descricao,
        materia: null,
        voto: v?.tipoVoto ?? "Sem voto registrado",
        resultado: votacao.aprovacao === 1 ? "Aprovado" : votacao.aprovacao === 0 ? "Rejeitado" : null,
        url: null,
      };
    });
    const conta = new Map<string, number>();
    for (const v of itens) conta.set(v.voto, (conta.get(v.voto) ?? 0) + 1);
    const registrados = itens.filter((v) => v.voto !== "Sem voto registrado").length;
    const datas = itens.map((v) => v.data).sort();
    return {
      ok: true,
      dados: {
        periodo: `${dataBr(datas[0])} a ${dataBr(datas[datas.length - 1])}`,
        total: itens.length,
        registrados,
        porVoto: [...conta.entries()].map(([voto, n]) => ({ voto, n })).sort((a, b) => b.n - a.n),
        itens,
        nota:
          "Últimas votações nominais do Plenário. A Câmara lista só quem votou: sem voto registrado pode ser falta, licença, missão oficial ou estar presidindo a sessão, e a API não diz qual.",
      },
    };
  } catch (e) {
    return { ok: false, motivo: `A API da Câmara não respondeu (${String(e)}).`, onde };
  }
}

interface ProposicaoCamara {
  id: number;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  dataApresentacao: string | null;
}

async function projetosCamara(id: string): Promise<Bloco<Projetos>> {
  const onde = { rotulo: "Projetos na página oficial do deputado", href: `https://www.camara.leg.br/deputados/${id}` };
  try {
    const { dados, headers } = await obter<{ dados: ProposicaoCamara[] }>(
      `${CAMARA}/proposicoes?idDeputadoAutor=${id}&ordem=DESC&ordenarPor=id&itens=20`,
    );
    const total = Number(headers.get("x-total-count"));
    return {
      ok: true,
      dados: {
        total: Number.isFinite(total) && total > 0 ? total : null,
        itens: dados.dados.map((p) => ({
          titulo: `${p.siglaTipo} ${p.numero}/${p.ano || (p.dataApresentacao ?? "").slice(0, 4)}`,
          ementa: p.ementa,
          data: dataBr(p.dataApresentacao),
          url: `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${p.id}`,
        })),
      },
    };
  } catch (e) {
    return { ok: false, motivo: `A API da Câmara não respondeu (${String(e)}).`, onde };
  }
}

async function perfilCamara(id: string, chave: string): Promise<Perfil | null> {
  let d: DeputadoDetalhe;
  try {
    d = (await obter<{ dados: DeputadoDetalhe }>(`${CAMARA}/deputados/${id}`, UM_DIA)).dados.dados;
  } catch {
    return null;
  }
  const s = d.ultimoStatus;
  const g = s.gabinete ?? {};
  const [despesas, votacoes, projetos] = await Promise.all([despesasCamara(id), votacoesCamara(id), projetosCamara(id)]);
  const pagina = `https://www.camara.leg.br/deputados/${id}`;
  return {
    id: chave,
    fonte: "camara",
    nome: s.nomeEleitoral || s.nome,
    nomeCompleto: d.nomeCivil ? nomeProprio(d.nomeCivil) : null,
    cargo: "Deputado(a) federal",
    partido: s.siglaPartido,
    cor: COR_PARTIDO[s.siglaPartido] ?? "#9aa5b1",
    uf: s.siglaUf,
    foto: s.urlFoto,
    urlOficial: pagina,
    fatos: [
      d.dataNascimento && { rotulo: "Nascimento", valor: `${dataBr(d.dataNascimento)}${d.municipioNascimento ? `, ${d.municipioNascimento}${d.ufNascimento ? ` (${d.ufNascimento})` : ""}` : ""}` },
      d.escolaridade && { rotulo: "Escolaridade", valor: d.escolaridade },
      s.situacao && { rotulo: "Situação", valor: s.situacao },
      s.condicaoEleitoral && { rotulo: "Condição", valor: s.condicaoEleitoral },
      (g.predio || g.sala) && { rotulo: "Gabinete", valor: `Anexo ${g.predio ?? "—"}, sala ${g.sala ?? "—"}${g.andar ? `, ${g.andar}º andar` : ""}` },
    ].filter((x): x is { rotulo: string; valor: string } => Boolean(x)),
    contatos: [
      (g.email || s.email) && { rotulo: "E-mail", valor: (g.email || s.email)!, href: `mailto:${g.email || s.email}` },
      g.telefone && { rotulo: "Telefone", valor: `(61) ${g.telefone}`, href: `tel:+5561${g.telefone.replace(/\D/g, "")}` },
      d.urlWebsite && { rotulo: "Site", valor: d.urlWebsite, href: d.urlWebsite },
      ...lista(d.redeSocial).map((r) => ({ rotulo: "Rede social", valor: r.replace(/^https?:\/\/(www\.)?/, ""), href: r })),
    ].filter((x): x is { rotulo: string; valor: string; href?: string } => Boolean(x)),
    despesas,
    votacoes,
    projetos,
    bens: null,
    campanha: [],
    eleicoes: [],
    faltando: [
      {
        item: "Salário (subsídio) e descontos deste deputado",
        porque: "A API de dados abertos não traz a remuneração por pessoa.",
        onde: { rotulo: "Portal da Transparência da Câmara", href: "https://www.camara.leg.br/transparencia/" },
      },
      {
        item: "Auxílio-moradia ou apartamento funcional",
        porque: "Não está na API por deputado; a Câmara divulga em relatórios à parte.",
        onde: { rotulo: "Transparência da Câmara", href: "https://www.camara.leg.br/transparencia/" },
      },
      {
        item: "Verba de gabinete: quem trabalha no gabinete e quanto ganha",
        porque: "Ainda não coletamos esses dados.",
        onde: { rotulo: "Pessoal de gabinete na página do deputado", href: pagina },
      },
      {
        item: "Emendas parlamentares indicadas e pagas",
        porque: "Estão no Portal da Transparência do governo federal, que ainda não coletamos.",
        onde: { rotulo: "Portal da Transparência: emendas", href: "https://portaldatransparencia.gov.br/emendas" },
      },
      {
        item: "Bens declarados e contas de campanha",
        porque: "Ficam no TSE, na candidatura de 2022, e ainda não ligamos as duas fontes.",
        onde: { rotulo: "DivulgaCandContas (TSE)", href: "https://divulgacandcontas.tse.jus.br/" },
      },
    ],
    fontes: [
      { rotulo: "Câmara dos Deputados: dados abertos", href: "https://dadosabertos.camara.leg.br/" },
      { rotulo: "Página oficial do deputado", href: pagina },
    ],
    consultadoEm: hoje(),
  };
}

// ---------------------------------------------------------------- Senado

interface SenadorDetalhe {
  DetalheParlamentar: {
    Parlamentar: {
      IdentificacaoParlamentar: {
        NomeParlamentar: string;
        NomeCompletoParlamentar?: string;
        SiglaPartidoParlamentar?: string;
        UfParlamentar: string;
        UrlFotoParlamentar: string;
        UrlPaginaParlamentar?: string;
        EmailParlamentar?: string;
      };
      DadosBasicosParlamentar?: {
        DataNascimento?: string;
        Naturalidade?: string;
        UfNaturalidade?: string;
        EnderecoParlamentar?: string;
      };
      Telefones?: { Telefone: { NumeroTelefone: string } | { NumeroTelefone: string }[] };
    };
  };
}

interface VotacaoSenado {
  SessaoPlenaria?: { DataSessao?: string };
  Materia?: { DescricaoIdentificacao?: string; Ementa?: string; Codigo?: string };
  DescricaoVotacao?: string;
  DescricaoResultado?: string;
  SiglaDescricaoVoto?: string;
}

/** Siglas que o Senado usa no lugar do voto. */
const LEGENDA_SENADO: Record<string, string> = {
  Sim: "votou sim",
  Não: "votou não",
  Abstenção: "absteve-se",
  Votou: "votou (votação secreta)",
  "P-NRV": "presente, não registrou voto",
  NCom: "não compareceu",
  AP: "em atividade parlamentar",
  LS: "licença saúde",
  LP: "licença particular",
  LAP: "licença atividade parlamentar",
  MIS: "em missão oficial",
  "Presidente (art. 51 RISF)": "presidindo a sessão",
  "P-OD": "presente, em obstrução declarada",
  Obstrução: "obstrução",
  REP: "em representação da Casa",
};

const VOTO_REGISTRADO = new Set(["Sim", "Não", "Abstenção", "Votou"]);

async function votacoesSenado(cod: string): Promise<Bloco<Votacoes>> {
  const onde = { rotulo: "Votações na página do senador", href: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${cod}` };
  try {
    const ano = new Date().getFullYear();
    const { dados } = await obter<{ VotacaoParlamentar?: { Parlamentar?: { Votacoes?: { Votacao: VotacaoSenado | VotacaoSenado[] } } } }>(
      `${SENADO}/senador/${cod}/votacoes.json?ano=${ano}`,
    );
    const vs = lista(dados.VotacaoParlamentar?.Parlamentar?.Votacoes?.Votacao);
    if (!vs.length) return { ok: false, motivo: `O Senado não registra votações nominais deste senador em ${ano}.`, onde };
    const itens: Voto[] = vs
      .map((v) => ({
        data: v.SessaoPlenaria?.DataSessao ?? "",
        descricao: v.DescricaoVotacao ?? v.Materia?.Ementa ?? "Votação",
        materia: v.Materia?.DescricaoIdentificacao ?? null,
        voto: v.SiglaDescricaoVoto ?? "—",
        resultado: v.DescricaoResultado ?? null,
        url: v.Materia?.Codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${v.Materia.Codigo}` : null,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));
    const conta = new Map<string, number>();
    for (const v of itens) conta.set(v.voto, (conta.get(v.voto) ?? 0) + 1);
    const datas = itens.map((v) => v.data).filter(Boolean).sort();
    return {
      ok: true,
      dados: {
        periodo: `${dataBr(datas[0])} a ${dataBr(datas[datas.length - 1])}`,
        total: itens.length,
        registrados: itens.filter((v) => VOTO_REGISTRADO.has(v.voto)).length,
        porVoto: [...conta.entries()]
          .map(([voto, n]) => ({ voto, n, legenda: LEGENDA_SENADO[voto] }))
          .sort((a, b) => b.n - a.n),
        itens,
        nota: `Votações nominais do Plenário em ${ano}, com a sigla que o Senado registra para cada senador.`,
      },
    };
  } catch (e) {
    return { ok: false, motivo: `O Senado não respondeu (${String(e)}).`, onde };
  }
}

interface AutoriaSenado {
  Materia?: { Codigo?: string; Sigla?: string; Numero?: string; Ano?: string; Ementa?: string; Data?: string; DescricaoIdentificacao?: string };
  IdentificacaoMateria?: { CodigoMateria?: string; SiglaSubtipoMateria?: string; NumeroMateria?: string; AnoMateria?: string };
  EmentaMateria?: string;
}

async function projetosSenado(cod: string): Promise<Bloco<Projetos>> {
  const onde = { rotulo: "Projetos na página do senador", href: `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${cod}` };
  try {
    const { dados } = await obter<Record<string, unknown>>(`${SENADO}/senador/${cod}/autorias.json`, UM_DIA);
    const raiz = (dados.MateriasAutoriaParlamentar ?? dados.AutoriaParlamentar) as
      | { Parlamentar?: { Autorias?: { Autoria: AutoriaSenado | AutoriaSenado[] } } }
      | undefined;
    const autorias = lista(raiz?.Parlamentar?.Autorias?.Autoria);
    if (!autorias.length) return { ok: false, motivo: "O Senado não devolveu projetos de autoria deste senador.", onde };
    const itens = autorias
      .map((a) => {
        const m = a.Materia;
        const id = a.IdentificacaoMateria;
        const codigo = m?.Codigo ?? id?.CodigoMateria;
        return {
          titulo: m?.DescricaoIdentificacao ?? `${m?.Sigla ?? id?.SiglaSubtipoMateria ?? ""} ${m?.Numero ?? id?.NumeroMateria ?? ""}/${m?.Ano ?? id?.AnoMateria ?? ""}`.trim(),
          ementa: m?.Ementa ?? a.EmentaMateria ?? "",
          data: dataBr(m?.Data),
          url: codigo ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}` : null,
        };
      })
      .reverse();
    return { ok: true, dados: { total: itens.length, itens: itens.slice(0, 20) } };
  } catch {
    return { ok: false, motivo: "O Senado não devolveu a lista de autorias por esta API.", onde };
  }
}

async function despesasSenado(cod: string, nome: string): Promise<Bloco<Despesas>> {
  const onde = {
    rotulo: "Cota parlamentar no Portal da Transparência do Senado",
    href: "https://www6g.senado.leg.br/transparencia/sen/",
  };
  const anoAtual = new Date().getFullYear();
  const chaveNome = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  try {
    for (const ano of [anoAtual, anoAtual - 1]) {
      const { dados } = await obter<Record<string, unknown>[] | { despesas?: Record<string, unknown>[] }>(
        `${SENADO_ADM}/senadores/despesas_ceaps/${ano}`,
        UM_DIA,
        45000,
      );
      const linhas = Array.isArray(dados) ? dados : lista(dados.despesas);
      const doSenador = linhas.filter((l) => {
        const codigo = l.codSenador ?? l.codigoSenador ?? l.codigoParlamentar;
        if (codigo != null) return String(codigo) === cod;
        const n = l.nomeSenador ?? l.senador ?? l.nomeParlamentar;
        return typeof n === "string" && chaveNome(n) === chaveNome(nome);
      });
      if (!doSenador.length) continue;
      const texto = (l: Record<string, unknown>, ...ks: string[]) => {
        for (const k of ks) if (typeof l[k] === "string" && l[k]) return l[k] as string;
        return null;
      };
      const itens: Despesa[] = doSenador.map((l) => {
        const data = texto(l, "data", "dataDocumento", "dataEmissao");
        const mes = Number(l.mes ?? (data ? data.slice(5, 7) : NaN));
        return {
          data: data ? data.slice(0, 10) : null,
          mes: Number.isFinite(mes) ? mes : null,
          tipo: texto(l, "tipoDespesa", "tipo", "descricaoTipoDespesa") ?? "Outros",
          fornecedor: texto(l, "fornecedor", "nomeFornecedor") ?? "—",
          documentoFornecedor: texto(l, "cpfCnpj", "cnpjCpf", "cnpjCpfFornecedor"),
          valor: Number(l.valorReembolsado ?? l.valor ?? 0),
          url: null,
        };
      });
      return { ok: true, dados: resumirDespesas(ano, "Cota parlamentar (CEAPS)", itens) };
    }
    return {
      ok: false,
      motivo: `Os dados abertos administrativos do Senado não trazem despesas da cota deste senador em ${anoAtual} nem em ${anoAtual - 1} (consulta em ${hoje()}).`,
      onde,
    };
  } catch (e) {
    return { ok: false, motivo: `O serviço de dados administrativos do Senado não respondeu (${String(e)}).`, onde };
  }
}

async function perfilSenado(cod: string, chave: string): Promise<Perfil | null> {
  let p: SenadorDetalhe["DetalheParlamentar"]["Parlamentar"];
  try {
    p = (await obter<SenadorDetalhe>(`${SENADO}/senador/${cod}.json`, UM_DIA)).dados.DetalheParlamentar.Parlamentar;
  } catch {
    return null;
  }
  const i = p.IdentificacaoParlamentar;
  const b = p.DadosBasicosParlamentar ?? {};
  const partido = i.SiglaPartidoParlamentar ?? "S/Partido";
  const pagina = i.UrlPaginaParlamentar?.replace(/^http:/, "https:") ?? `https://www25.senado.leg.br/web/senadores/senador/-/perfil/${cod}`;
  const [despesas, votacoes, projetos] = await Promise.all([
    despesasSenado(cod, i.NomeParlamentar),
    votacoesSenado(cod),
    projetosSenado(cod),
  ]);
  return {
    id: chave,
    fonte: "senado",
    nome: i.NomeParlamentar,
    nomeCompleto: i.NomeCompletoParlamentar ? nomeProprio(i.NomeCompletoParlamentar) : null,
    cargo: "Senador(a)",
    partido,
    cor: COR_PARTIDO[partido] ?? "#9aa5b1",
    uf: i.UfParlamentar,
    foto: i.UrlFotoParlamentar.replace(/^http:/, "https:"),
    urlOficial: pagina,
    fatos: [
      b.DataNascimento && { rotulo: "Nascimento", valor: `${dataBr(b.DataNascimento)}${b.Naturalidade ? `, ${b.Naturalidade}${b.UfNaturalidade ? ` (${b.UfNaturalidade})` : ""}` : ""}` },
      b.EnderecoParlamentar && { rotulo: "Gabinete", valor: b.EnderecoParlamentar.replace(/\s+/g, " ") },
    ].filter((x): x is { rotulo: string; valor: string } => Boolean(x)),
    contatos: [
      i.EmailParlamentar && { rotulo: "E-mail", valor: i.EmailParlamentar, href: `mailto:${i.EmailParlamentar}` },
      ...lista(p.Telefones?.Telefone).map((t) => ({
        rotulo: "Telefone",
        valor: `(61) ${t.NumeroTelefone}`,
        href: `tel:+5561${t.NumeroTelefone.replace(/\D/g, "")}`,
      })),
    ].filter((x): x is { rotulo: string; valor: string; href?: string } => Boolean(x)),
    despesas,
    votacoes,
    projetos,
    bens: null,
    campanha: [],
    eleicoes: [],
    faltando: [
      {
        item: "Salário (subsídio) e descontos deste senador",
        porque: "Não vem nos dados abertos por senador.",
        onde: { rotulo: "Portal da Transparência do Senado", href: "https://www6g.senado.leg.br/transparencia/sen/" },
      },
      {
        item: "Auxílio-moradia, imóvel funcional e assistência à saúde",
        porque: "O Senado publica em relatórios e planilhas à parte, nem sempre por senador.",
        onde: { rotulo: "Transparência do Senado", href: "https://www12.senado.leg.br/transparencia" },
      },
      {
        item: "Servidores do gabinete e quanto ganham",
        porque: "Ainda não coletamos esses dados.",
        onde: { rotulo: "Transparência do Senado", href: "https://www12.senado.leg.br/transparencia" },
      },
      {
        item: "Emendas parlamentares indicadas e pagas",
        porque: "Estão no Portal da Transparência do governo federal, que ainda não coletamos.",
        onde: { rotulo: "Portal da Transparência: emendas", href: "https://portaldatransparencia.gov.br/emendas" },
      },
    ],
    fontes: [
      { rotulo: "Senado Federal: dados abertos", href: "https://www12.senado.leg.br/dados-abertos" },
      { rotulo: "Página oficial do senador", href: pagina },
    ],
    consultadoEm: hoje(),
  };
}

// ------------------------------------------------------------------- TSE

interface CandidatoTse {
  id: number;
  nomeUrna: string;
  nomeCompleto?: string;
  grauInstrucao?: string;
  ocupacao?: string;
  dataDeNascimento?: string;
  nomeMunicipioNascimento?: string;
  sgUfNascimento?: string;
  descricaoTotalizacao?: string;
  gastoCampanha1T?: number;
  gastoCampanha2T?: number;
  totalDeBens?: number;
  bens?: { descricao?: string; descricaoDeTipoDeBem?: string; valor?: number }[];
  partido?: { sigla?: string };
  cargo?: { nome?: string };
  emails?: string[] | null;
  sites?: string[] | null;
  fotoUrl?: string;
  eleicoesAnteriores?: { nrAno: number; cargo: string; partido: string; local: string; situacaoTotalizacao: string }[];
}

async function perfilTse(ano: string, eleicao: string, unidade: string, idCand: string, chave: string): Promise<Perfil | null> {
  let c: CandidatoTse;
  try {
    c = (await obter<CandidatoTse>(`${TSE}/candidatura/buscar/${ano}/${unidade}/${eleicao}/candidato/${idCand}`, UM_DIA)).dados;
  } catch {
    return null;
  }
  const partido = c.partido?.sigla ?? "—";
  const sigla = partido === "PC do B" ? "PCdoB" : partido === "UNIÃO BRASIL" ? "UNIÃO" : partido;
  const cargo = c.cargo?.nome ?? "Eleito(a)";
  const ficha = `https://divulgacandcontas.tse.jus.br/divulga/#/candidato/${ano}/${eleicao}/${unidade}/${idCand}`;
  const bens = lista(c.bens);
  const ehMunicipal = /^\d+$/.test(unidade);
  return {
    id: chave,
    fonte: "tse",
    nome: nomeProprio(c.nomeUrna),
    nomeCompleto: c.nomeCompleto ? nomeProprio(c.nomeCompleto) : null,
    cargo,
    partido: sigla,
    cor: COR_PARTIDO[sigla] ?? "#9aa5b1",
    uf: ehMunicipal ? "" : unidade,
    foto: `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${eleicao}/${idCand}/${unidade}`,
    urlOficial: ficha,
    fatos: [
      { rotulo: "Eleição", valor: `${ano}: ${c.descricaoTotalizacao ?? "—"}` },
      c.dataDeNascimento && { rotulo: "Nascimento", valor: `${dataBr(c.dataDeNascimento)}${c.nomeMunicipioNascimento ? `, ${nomeProprio(c.nomeMunicipioNascimento)}${c.sgUfNascimento ? ` (${c.sgUfNascimento})` : ""}` : ""}` },
      c.grauInstrucao && { rotulo: "Escolaridade", valor: c.grauInstrucao },
      c.ocupacao && { rotulo: "Ocupação declarada", valor: c.ocupacao },
    ].filter((x): x is { rotulo: string; valor: string } => Boolean(x)),
    contatos: [
      ...lista(c.emails).map((e) => ({ rotulo: "E-mail de campanha", valor: e.toLowerCase(), href: `mailto:${e.toLowerCase()}` })),
      ...lista(c.sites).map((s) => ({ rotulo: "Site ou rede", valor: s.replace(/^https?:\/\/(www\.)?/, ""), href: s.startsWith("http") ? s : `https://${s}` })),
    ],
    despesas: null,
    votacoes: null,
    projetos: null,
    bens: bens.length
      ? {
          ok: true,
          dados: {
            total: c.totalDeBens ?? bens.reduce((t, b) => t + (b.valor ?? 0), 0),
            itens: bens.map((b) => ({ tipo: b.descricaoDeTipoDeBem ?? "—", descricao: b.descricao ?? "", valor: b.valor ?? 0 })).sort((a, b) => b.valor - a.valor),
            eleicao: Number(ano),
          },
        }
      : { ok: false, motivo: `Nenhum bem declarado ao TSE na candidatura de ${ano}.`, onde: { rotulo: "Ficha no TSE", href: ficha } },
    campanha: [
      c.gastoCampanha1T ? { rotulo: "Limite de gastos da campanha (1º turno)", valor: c.gastoCampanha1T } : null,
      c.gastoCampanha2T ? { rotulo: "Limite de gastos da campanha (2º turno)", valor: c.gastoCampanha2T } : null,
    ].filter((x): x is { rotulo: string; valor: number } => x !== null),
    eleicoes: lista(c.eleicoesAnteriores)
      .map((e) => ({ ano: e.nrAno, cargo: e.cargo, partido: e.partido, local: nomeProprio(e.local ?? ""), resultado: e.situacaoTotalizacao }))
      .sort((a, b) => b.ano - a.ano),
    faltando: [
      {
        item: ehMunicipal ? "Votações e presença na Câmara Municipal" : cargo.toLowerCase().includes("governador") ? "Atos e decretos do governo" : "Votações e presença na Assembleia",
        porque: "Cada casa publica de um jeito, quando publica; ainda não coletamos.",
      },
      {
        item: "Salário, verbas de gabinete e diárias",
        porque: "Ficam no portal da transparência de cada assembleia, câmara ou governo, sem um padrão nacional.",
      },
      {
        item: "Receitas e despesas declaradas da campanha",
        porque: "O TSE publica na prestação de contas; ainda não lemos esses arquivos.",
        onde: { rotulo: "Ficha no TSE", href: ficha },
      },
    ],
    fontes: [
      { rotulo: "TSE: DivulgaCandContas", href: ficha },
    ],
    consultadoEm: hoje(),
  };
}

// --------------------------------------------------------------- entrada

/** Ids: camara-<id>, senado-<código>, tse-<ano>-<eleição>-<unidade>-<candidato>. */
export async function buscarPerfil(chave: string): Promise<Perfil | null> {
  const [fonte, ...resto] = chave.split("-");
  if (fonte === "camara" && /^\d+$/.test(resto[0] ?? "")) return perfilCamara(resto[0]!, chave);
  if (fonte === "senado" && /^\d+$/.test(resto[0] ?? "")) return perfilSenado(resto[0]!, chave);
  if (fonte === "tse" && resto.length === 4 && resto.every((p) => /^[A-Z0-9]+$/.test(p))) {
    const [ano, eleicao, unidade, id] = resto as [string, string, string, string];
    return perfilTse(ano, eleicao, unidade, id, chave);
  }
  return null;
}
