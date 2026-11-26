import "server-only";

import { unstable_cache } from "next/cache";

import { beneficiosDeputado, pessoalGabineteDeputado, remuneracaoMensalDeputado } from "./camara-paginas";
import type { Bloco, Link } from "./perfil";

/**
 * Blocos da ficha que vêm de fontes oficiais além das APIs legislativas:
 * - subsídio (valor fixado em lei, igual para deputados e senadores);
 * - benefícios e pessoal do gabinete do senador (dados abertos administrativos do Senado);
 * - secretários parlamentares do deputado (arquivo de funcionários da Câmara);
 * - emendas parlamentares (API do Portal da Transparência, que exige chave gratuita).
 *
 * Os arquivos grandes (folha do Senado, funcionários da Câmara) passam de 2 MB e não
 * cabem no cache do fetch: são baixados no máximo uma vez por dia e guardados já
 * reduzidos ao que a ficha usa (unstable_cache).
 */

const UM_DIA = 60 * 60 * 24;
const SENADO_ADM = "https://adm.senado.gov.br/adm-dadosabertos/api/v1";
const CAMARA_ARQ = "https://dadosabertos.camara.leg.br/arquivos";

// ---------------------------------------------------------------- tipos

export interface Remuneracao {
  subsidio: number;
  vigencia: string;
  base: Link;
  /** Valor efetivamente pago no último mês publicado, com os descontos quando a casa informa. */
  pagoNoMes: {
    referencia: string;
    bruto: number;
    liquido: number;
    previdencia?: number;
    imposto?: number;
    redutor?: number;
    fonte?: Link;
  } | null;
  /** Benefícios publicados por parlamentar (o Senado publica; a Câmara não). */
  beneficios: { rotulo: string; situacao: string }[];
  /** Totais do ano publicados pelo Senado, além da cota. */
  recursos: { rotulo: string; valor: number }[];
  anoRecursos: number | null;
  nota: string;
}

export interface PessoaGabinete {
  nome: string;
  cargo: string;
  local: string;
  desde: string | null;
  /** Folha do Senado: valores pagos no mês de referência. */
  bruto: number | null;
  liquido: number | null;
  /** Câmara: vencimento básico do nível na tabela oficial (sem gratificações). */
  vencimentoTabela: number | null;
}

export interface Gabinete {
  pessoas: PessoaGabinete[];
  porLocal: { local: string; n: number }[];
  referencia: string | null;
  totalBruto: number | null;
  nota: string;
  fonte: Link;
}

export interface Emenda {
  codigo: string;
  ano: number;
  tipo: string;
  funcao: string;
  local: string;
  empenhado: number;
  pago: number;
}

export interface Emendas {
  anos: number[];
  empenhado: number;
  pago: number;
  porFuncao: { funcao: string; pago: number; n: number }[];
  porLocal: { local: string; pago: number; n: number }[];
  itens: Emenda[];
}

// ------------------------------------------------------------- utilidades

const valorBr = (s: unknown): number => {
  if (typeof s === "number") return s;
  if (typeof s !== "string" || !s.trim()) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

const listaDe = <T>(j: unknown): T[] => {
  if (Array.isArray(j)) return j as T[];
  if (j && typeof j === "object") {
    const o = j as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
    const a = Object.values(o).find(Array.isArray);
    if (a) return a as T[];
  }
  return [];
};

async function json<T>(url: string, revalidate: number | false = UM_DIA, espera = 30000): Promise<T> {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
    signal: AbortSignal.timeout(espera),
  });
  if (!r.ok) throw new Error(`${new URL(url).host} respondeu ${r.status}`);
  return (await r.json()) as T;
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

// ---------------------------------------------------------------- subsídio

/**
 * Subsídio mensal de deputado federal: R$ 46.366,19 desde 01/02/2025 (Decreto
 * Legislativo nº 172/2022), conforme a tabela oficial da Câmara. O de senador é
 * idêntico por determinação da Constituição (art. 49, VII). Atualize aqui quando
 * sair novo decreto legislativo.
 */
export const SUBSIDIO = {
  valor: 46366.19,
  vigencia: "01/02/2025",
  base: {
    rotulo: "Tabela oficial da Câmara (Decreto Legislativo nº 172/2022)",
    href: "https://www2.camara.leg.br/transparencia/recursos-humanos/remuneracao/tabelas-de-remuneracao/deputadosfederais-1",
  },
};

// ----------------------------------------------------------------- Senado

interface RecursosSenado {
  ano: number;
  cotas?: { totalValor?: number };
  gastosNaoInclusos?: { despesas?: { recurso: string; valor: number }[]; totalValor?: number };
  beneficios?: { beneficio: string; utilizacao: string }[];
  pessoal?: { local: string; quantidade: number }[];
}

export async function remuneracaoSenado(cod: string, nomeCompleto: string | null): Promise<Bloco<Remuneracao>> {
  let r: RecursosSenado | undefined;
  const [recursosAno, folha] = await Promise.all([
    json<unknown>(`${SENADO_ADM}/senadores/${cod}/recursos-utilizados`).catch(() => null),
    ultimaFolhaSenado().catch(() => null),
  ]);
  if (recursosAno) r = listaDe<RecursosSenado>(recursosAno)[0];
  // O senador está na folha do Senado pelo nome civil: dá o valor pago no mês, com descontos.
  const pago = folha && nomeCompleto ? naFolha(folha.folha, nomeCompleto) : null;
  const recursos: { rotulo: string; valor: number }[] = [];
  if (r?.cotas?.totalValor != null) recursos.push({ rotulo: "Cota parlamentar (CEAPS) usada no ano", valor: r.cotas.totalValor });
  for (const d of r?.gastosNaoInclusos?.despesas ?? []) if (d.valor > 0) recursos.push({ rotulo: d.recurso, valor: d.valor });
  return {
    ok: true,
    dados: {
      subsidio: SUBSIDIO.valor,
      vigencia: SUBSIDIO.vigencia,
      base: SUBSIDIO.base,
      pagoNoMes: pago && folha ? { referencia: `${MESES[folha.mes - 1]}/${folha.ano}`, bruto: pago[0], liquido: pago[1] } : null,
      beneficios: (r?.beneficios ?? []).map((b) => ({ rotulo: b.beneficio, situacao: b.utilizacao })),
      recursos,
      anoRecursos: r?.ano ?? null,
      nota: [
        "O subsídio é igual para todos os senadores e deputados.",
        pago ? "O valor recebido no mês vem da folha do Senado; o líquido é depois de previdência e imposto." : "",
        r ? "Benefícios e gastos fora da cota como o Senado publica para este senador." : "O Senado não devolveu agora os benefícios deste senador.",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

interface ServidorSenado {
  sequencial: number;
  nome: string;
  vinculo?: string;
  cargo?: { nome?: string };
  funcao?: { nome?: string };
  lotacao?: { sigla?: string; nome?: string };
  ano_admissao?: number;
}

/**
 * Folha do mês, reduzida a [bruto, líquido] por nome. Baixada no máximo uma vez por dia.
 *
 * A ligação é pelo nome porque o campo "sequencial" da folha não é o mesmo do cadastro de
 * servidores. Nomes que aparecem com mais de um sequencial (homônimos) ficam sem valor,
 * para não somar o salário de duas pessoas.
 */
type Folha = Record<string, Record<string, [number, number]>>;

const folhaSenado = unstable_cache(
  async (ano: number, mes: number): Promise<Folha> => {
    const linhas = listaDe<Record<string, unknown>>(
      await json(`${SENADO_ADM}/servidores/remuneracoes/${ano}/${mes}`, false, 90000),
    );
    const BRUTO = [
      "remuneracao_basica",
      "vantagens_pessoais",
      "funcao_comissionada",
      "gratificacao_natalina",
      "horas_extras",
      "outras_eventuais",
      "abono_permanencia",
    ];
    const folha: Folha = {};
    for (const l of linhas) {
      const nome = normalizar(String(l.nome ?? ""));
      if (!nome) continue;
      const porSeq = (folha[nome] ??= {});
      const seq = String(l.sequencial);
      const atual = porSeq[seq] ?? [0, 0];
      atual[0] = Math.round((atual[0] + BRUTO.reduce((t, c) => t + valorBr(l[c]), 0)) * 100) / 100;
      atual[1] = Math.round((atual[1] + valorBr(l.remuneracao_liquida)) * 100) / 100;
      porSeq[seq] = atual;
    }
    return folha;
  },
  ["senado-folha-v3"],
  { revalidate: UM_DIA },
);

/** Último mês com folha publicada (o Senado publica com algumas semanas de atraso). */
/**
 * Valor de uma pessoa na folha: pelo nome e, se o nome aparece com mais de um sequencial
 * (homônimos ou dois vínculos), pelo sequencial do cadastro; sem como decidir, fica sem valor.
 */
function naFolha(folha: Folha, nome: string, sequencial?: number): [number, number] | null {
  const porSeq = folha[normalizar(nome)];
  if (!porSeq) return null;
  const seqs = Object.keys(porSeq);
  if (seqs.length === 1) return porSeq[seqs[0]!]!;
  return sequencial != null ? (porSeq[String(sequencial)] ?? null) : null;
}

async function ultimaFolhaSenado(): Promise<{ ano: number; mes: number; folha: Folha } | null> {
  const agora = new Date();
  for (let volta = 1; volta <= 3; volta++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - volta, 1);
    try {
      const folha = await folhaSenado(d.getFullYear(), d.getMonth() + 1);
      if (Object.keys(folha).length > 100) return { ano: d.getFullYear(), mes: d.getMonth() + 1, folha };
    } catch {
      // tenta o mês anterior
    }
  }
  return null;
}

export async function gabineteSenado(nomeParlamentar: string, nomeCompleto: string | null): Promise<Bloco<Gabinete>> {
  const fonte = { rotulo: "Senado: dados abertos administrativos", href: "https://adm.senado.gov.br/adm-dadosabertos/swagger-ui/index.html" };
  const onde = { rotulo: "Transparência do Senado: servidores", href: "https://www12.senado.leg.br/transparencia" };
  try {
    // A sigla do gabinete (ex.: GSRROD) vem da lista de lotações, pelo nome do senador.
    const lotacoes = listaDe<{ sigla: string; nome: string }>(await json(`${SENADO_ADM}/servidores/lotacoes`));
    const alvo = normalizar(nomeParlamentar);
    const gabinete = lotacoes.find((l) => /^GABINETE D[OA] SENADOR/.test(normalizar(l.nome)) && normalizar(l.nome).endsWith(alvo));
    if (!gabinete) {
      return { ok: false, motivo: "Não achamos o gabinete deste senador na lista de lotações do Senado.", onde };
    }
    // Escritórios de apoio nos estados: E1 + sufixo da sigla do gabinete (GSRROD → E1RROD), até 3.
    const sufixo = gabinete.sigla.replace(/^GS/, "");
    const siglas = [gabinete.sigla, `E1${sufixo}`, `E2${sufixo}`, `E3${sufixo}`];
    const [listas, folha] = await Promise.all([
      Promise.all(
        siglas.map((s) =>
          json<unknown>(`${SENADO_ADM}/servidores/servidores?lotacaoEquals=${s}`)
            .then((j) => listaDe<ServidorSenado>(j))
            .catch(() => [] as ServidorSenado[]),
        ),
      ),
      ultimaFolhaSenado(),
    ]);
    // O próprio senador aparece lotado no gabinete; ele tem a seção de salário à parte.
    const senador = nomeCompleto ? normalizar(nomeCompleto) : null;
    const pessoas: PessoaGabinete[] = listas
      .flat()
      .filter((s) => normalizar(s.nome) !== senador)
      .map((s) => {
      const pago = folha ? naFolha(folha.folha, s.nome, s.sequencial) : null;
      const lot = s.lotacao?.sigla ?? "";
      return {
        nome: s.nome,
        cargo: s.funcao?.nome || s.cargo?.nome || "—",
        local: lot.startsWith("GS") ? "Gabinete em Brasília" : `Escritório de apoio ${lot.slice(1, 2)}`,
        desde: s.ano_admissao ? String(s.ano_admissao) : null,
        bruto: pago ? pago[0] : null,
        liquido: pago ? pago[1] : null,
        vencimentoTabela: null,
      };
    });
    if (!pessoas.length) return { ok: false, motivo: "O Senado não lista servidores lotados neste gabinete agora.", onde };
    const porLocal = [...pessoas.reduce((m, p) => m.set(p.local, (m.get(p.local) ?? 0) + 1), new Map<string, number>())].map(
      ([local, n]) => ({ local, n }),
    );
    const comValor = pessoas.filter((p) => p.bruto != null);
    return {
      ok: true,
      dados: {
        pessoas: pessoas.sort((a, b) => (b.bruto ?? 0) - (a.bruto ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")),
        porLocal,
        referencia: folha ? `${MESES[folha.mes - 1]}/${folha.ano}` : null,
        totalBruto: comValor.length ? comValor.reduce((t, p) => t + (p.bruto ?? 0), 0) : null,
        nota: folha
          ? `Valores da folha de ${MESES[folha.mes - 1]}/${folha.ano}, ligados pelo nome: bruto é a soma de remuneração básica, vantagens pessoais, função, 13º, horas extras e eventuais; líquido é o que o Senado informa depois dos descontos. Auxílios e diárias não entram. Sem valor: quem entrou depois da folha ou tem homônimo no Senado.`
          : "A folha de pagamento do Senado não respondeu agora; a lista de pessoas está completa.",
        fonte,
      },
    };
  } catch (e) {
    return { ok: false, motivo: `Os dados administrativos do Senado não responderam (${String(e)}).`, onde };
  }
}

// ----------------------------------------------------------------- Câmara

/**
 * Vencimento básico dos níveis de secretário parlamentar (SP-01 a SP-25), tabela oficial
 * da Câmara com vigência a partir de 18/02/2026 (Lei nº 15.349/2026). Não inclui a
 * gratificação de representação de gabinete nem benefícios: a Câmara não publica o
 * valor pago a cada secretário em dados abertos.
 */
const VENCIMENTO_SP: number[] = [
  1710.83, 1906.12, 2101.45, 2296.72, 2492.06, 2687.34, 2882.65, 3077.95, 3273.26, 3468.54, 3663.85, 4054.45, 4445.03,
  4835.65, 5226.24, 5616.84, 6202.74, 6788.64, 7374.54, 7960.44, 8546.34, 9327.56, 10108.74, 11544.1, 12979.45,
];
const TABELA_SP = {
  rotulo: "Tabela oficial de cargos em comissão da Câmara",
  href: "https://www2.camara.leg.br/transparencia/recursos-humanos/remuneracao/tabelas-de-remuneracao/tabelafuncaocomissionada",
};

interface FuncionarioCamara {
  grupo: string;
  nome: string;
  cargo: string;
  lotacao: string;
  dataNomeacao: string;
  uriLotacao: string;
}

/** Funcionários da Câmara reduzidos a quem está lotado em gabinete de deputado: id → [nome, cargo, desde]. */
const gabinetesCamara = unstable_cache(
  async (): Promise<Record<string, [string, string, string][]>> => {
    const { dados } = await json<{ dados: FuncionarioCamara[] }>(`${CAMARA_ARQ}/funcionarios/json/funcionarios.json`, false, 90000);
    const porDeputado: Record<string, [string, string, string][]> = {};
    for (const f of dados) {
      if (f.grupo === "Parlamentar") continue;
      const id = f.uriLotacao?.match(/\/deputados\/(\d+)/)?.[1];
      if (!id) continue;
      (porDeputado[id] ??= []).push([f.nome, f.cargo || f.grupo, f.dataNomeacao || ""]);
    }
    return porDeputado;
  },
  ["camara-gabinetes-v1"],
  { revalidate: UM_DIA },
);

/** Reserva: secretários pelo arquivo de funcionários (sem o valor pago a cada um). */
async function gabineteCamaraPorArquivo(id: string): Promise<Bloco<Gabinete>> {
  const onde = { rotulo: "Pessoal de gabinete na página do deputado", href: `https://www.camara.leg.br/deputados/${id}` };
  try {
    const lista = (await gabinetesCamara())[id] ?? [];
    if (!lista.length) return { ok: false, motivo: "O arquivo de funcionários da Câmara não lista ninguém neste gabinete agora.", onde };
    const pessoas: PessoaGabinete[] = lista.map(([nome, cargo, desde]) => {
      const nivel = Number(cargo.match(/^SP\s*-?\s*(\d{1,2})/i)?.[1]);
      return {
        nome,
        cargo: Number.isFinite(nivel) ? `Secretário parlamentar SP-${String(nivel).padStart(2, "0")}` : cargo,
        local: "Gabinete",
        desde: desde ? desde.slice(0, 10).split("-").reverse().join("/") : null,
        bruto: null,
        liquido: null,
        vencimentoTabela: Number.isFinite(nivel) ? (VENCIMENTO_SP[nivel - 1] ?? null) : null,
      };
    });
    return {
      ok: true,
      dados: {
        pessoas: pessoas.sort((a, b) => (b.vencimentoTabela ?? 0) - (a.vencimentoTabela ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")),
        porLocal: [{ local: "Gabinete", n: pessoas.length }],
        referencia: null,
        totalBruto: null,
        nota: "Valor é o vencimento básico do nível na tabela oficial (vigência 18/02/2026), sem a gratificação de representação de gabinete e sem benefícios. A Câmara não publica em dados abertos quanto cada secretário recebe.",
        fonte: TABELA_SP,
      },
    };
  } catch (e) {
    return { ok: false, motivo: `O arquivo de funcionários da Câmara não respondeu (${String(e)}).`, onde };
  }
}

const MES_CURTO = (ref: string | null) => {
  const m = ref?.match(/^(\d{2})\/(\d{4})$/);
  return m ? `${MESES[Number(m[1]) - 1]}/${m[2]}` : ref;
};

/**
 * Secretários do gabinete com o valor pago a cada um, pela página oficial do deputado
 * (a API de dados abertos não traz esse valor). Se a página falhar, volta ao arquivo de
 * funcionários, que traz só o nível de cada um.
 */
export async function gabineteCamara(id: string): Promise<Bloco<Gabinete>> {
  const pagina = `https://www.camara.leg.br/deputados/${id}/pessoal-gabinete?ano=${new Date().getFullYear()}`;
  try {
    const lista = await pessoalGabineteDeputado(id);
    if (!lista.length) return gabineteCamaraPorArquivo(id);
    const pessoas: PessoaGabinete[] = lista.map((s) => {
      const nivel = Number(s.nivel.match(/SP\s*-?\s*(\d{1,2})/i)?.[1]);
      return {
        nome: s.nome,
        cargo: Number.isFinite(nivel) ? `Secretário parlamentar SP-${String(nivel).padStart(2, "0")}` : s.nivel,
        local: "Gabinete",
        desde: s.desde,
        bruto: s.contracheque ? s.contracheque.bruto : null,
        liquido: s.contracheque ? s.contracheque.liquido : null,
        vencimentoTabela: Number.isFinite(nivel) ? (VENCIMENTO_SP[nivel - 1] ?? null) : null,
      };
    });
    const referencia = MES_CURTO(lista.find((s) => s.contracheque?.referencia)?.contracheque?.referencia ?? null);
    const comValor = pessoas.filter((p) => p.bruto != null);
    return {
      ok: true,
      dados: {
        pessoas: pessoas.sort((a, b) => (b.bruto ?? 0) - (a.bruto ?? 0) || a.nome.localeCompare(b.nome, "pt-BR")),
        porLocal: [{ local: "Gabinete", n: pessoas.length }],
        referencia: referencia ?? "último mês",
        totalBruto: comValor.length ? comValor.reduce((t, p) => t + (p.bruto ?? 0), 0) : null,
        nota: `Valores do contracheque de cada secretário no último mês publicado pela Câmara${referencia ? ` (${referencia})` : ""}: bruto é a soma de remuneração, função, 13º, férias e eventuais; líquido é depois de previdência e imposto. O auxílio-alimentação e outros auxílios não entram. Sem valor: quem entrou depois da última folha.`,
        fonte: { rotulo: "Pessoal de gabinete na página oficial do deputado", href: pagina },
      },
    };
  } catch {
    return gabineteCamaraPorArquivo(id);
  }
}

/** Subsídio, contracheque do último mês e moradia, pela página oficial do deputado. */
export async function remuneracaoCamara(id: string): Promise<Bloco<Remuneracao>> {
  const paginaRemuneracao = `https://www.camara.leg.br/deputados/${id}/remuneracao?ano=${new Date().getFullYear()}`;
  const [contracheque, beneficios] = await Promise.all([
    remuneracaoMensalDeputado(id).catch(() => null),
    beneficiosDeputado(id).catch(() => null),
  ]);
  const lista = [
    beneficios?.imovelFuncional && { rotulo: "Imóvel funcional", situacao: beneficios.imovelFuncional },
    beneficios?.auxilioMoradia && { rotulo: "Auxílio-moradia", situacao: beneficios.auxilioMoradia },
  ].filter((b): b is { rotulo: string; situacao: string } => Boolean(b));
  return {
    ok: true,
    dados: {
      subsidio: SUBSIDIO.valor,
      vigencia: SUBSIDIO.vigencia,
      base: SUBSIDIO.base,
      pagoNoMes: contracheque
        ? {
            referencia: MES_CURTO(contracheque.referencia) ?? "último mês",
            bruto: contracheque.bruto,
            liquido: contracheque.liquido,
            previdencia: contracheque.previdencia,
            imposto: contracheque.imposto,
            redutor: contracheque.redutor,
            fonte: { rotulo: "Remuneração na página oficial do deputado", href: paginaRemuneracao },
          }
        : null,
      beneficios: lista,
      recursos: [],
      anoRecursos: null,
      nota: [
        "O subsídio é igual para todos os deputados e senadores.",
        contracheque
          ? "O valor recebido e os descontos vêm do contracheque publicado pela Câmara; faltas a sessões deliberativas aparecem como desconto quando há."
          : "A Câmara não devolveu o contracheque deste mês agora.",
        lista.length ? "Imóvel funcional e auxílio-moradia como a página oficial do deputado informa." : "",
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

// ------------------------------------------------------------------ Emendas

/**
 * Emendas parlamentares pela API do Portal da Transparência (CGU). A API exige uma
 * chave gratuita, cadastrada com conta gov.br em
 * https://portaldatransparencia.gov.br/api-de-dados/cadastrar-email
 * e guardada em PORTAL_TRANSPARENCIA_CHAVE. Sem ela, a ficha explica e aponta o portal.
 */
export async function emendasDoParlamentar(nome: string): Promise<Bloco<Emendas>> {
  const onde = { rotulo: "Portal da Transparência: emendas", href: "https://portaldatransparencia.gov.br/emendas" };
  const chave = process.env.PORTAL_TRANSPARENCIA_CHAVE;
  if (!chave) {
    return {
      ok: false,
      motivo: "A API de emendas do Portal da Transparência exige uma chave de acesso, que este site ainda não tem.",
      onde,
    };
  }
  const anoAtual = new Date().getFullYear();
  const anos = [anoAtual, anoAtual - 1];
  const autor = normalizar(nome);
  try {
    const itens: Emenda[] = [];
    for (const ano of anos) {
      for (let pagina = 1; pagina <= 10; pagina++) {
        const r = await fetch(
          // A API só acha o autor em maiúsculas e sem acento ("TALIRIA PETRONE").
          `https://api.portaldatransparencia.gov.br/api-de-dados/emendas?nomeAutor=${encodeURIComponent(autor)}&ano=${ano}&pagina=${pagina}`,
          { headers: { Accept: "application/json", "chave-api-dados": chave }, next: { revalidate: UM_DIA }, signal: AbortSignal.timeout(30000) },
        );
        if (!r.ok) throw new Error(`Portal da Transparência respondeu ${r.status}`);
        const lote = (await r.json()) as Record<string, unknown>[];
        for (const e of lote) {
          // A busca é por trecho do nome e pode trazer outros autores ("RANDOLFE" acha
          // "RANDOLFE RODRIGUES" e quem mais tiver esse trecho): fica só o mesmo nome,
          // ignorando observações entre parênteses ("(EX-PARLAMENTAR ...)").
          const doAutor = normalizar(String(e.nomeAutor ?? e.autor ?? "")).replace(/\s*\(.*$/, "");
          if (doAutor !== autor) continue;
          itens.push({
            codigo: String(e.codigoEmenda ?? ""),
            ano: Number(e.ano ?? ano),
            tipo: String(e.tipoEmenda ?? ""),
            funcao: String(e.funcao ?? "—"),
            local: String(e.localidadeDoGasto ?? "—"),
            empenhado: valorBr(e.valorEmpenhado),
            pago: valorBr(e.valorPago) + valorBr(e.valorRestoPago),
          });
        }
        if (lote.length < 15) break;
      }
    }
    if (!itens.length) {
      return { ok: false, motivo: `O Portal da Transparência não traz emendas com este nome de autor em ${anos.join(" e ")}.`, onde };
    }
    const agrupar = (chave: (e: Emenda) => string) =>
      [...itens.reduce((m, e) => {
        const k = chave(e);
        const v = m.get(k) ?? { pago: 0, n: 0 };
        v.pago += e.pago;
        v.n++;
        return m.set(k, v);
      }, new Map<string, { pago: number; n: number }>())]
        .map(([k, v]) => ({ k, ...v }))
        .sort((a, b) => b.pago - a.pago);
    return {
      ok: true,
      dados: {
        anos,
        empenhado: itens.reduce((t, e) => t + e.empenhado, 0),
        pago: itens.reduce((t, e) => t + e.pago, 0),
        porFuncao: agrupar((e) => e.funcao).slice(0, 8).map(({ k, pago, n }) => ({ funcao: k, pago, n })),
        porLocal: agrupar((e) => e.local).slice(0, 8).map(({ k, pago, n }) => ({ local: k, pago, n })),
        itens: itens.sort((a, b) => b.pago - a.pago).slice(0, 40),
      },
    };
  } catch (e) {
    return { ok: false, motivo: `O Portal da Transparência não respondeu (${String(e)}).`, onde };
  }
}

// --------------------------------------------------------------------- TSE

/** Eleições gerais no DivulgaCandContas (ano e código da eleição). */
export const ELEICOES_GERAIS = {
  2018: "2022802018",
  2022: "2040602022",
  2026: "20322002026",
} as const;

/** Candidatos de um cargo numa UF, reduzidos a id e nomes (a lista completa passa de 2 MB). */
const candidatosTse = unstable_cache(
  async (ano: number, eleicao: string, uf: string, cargo: number): Promise<[number, string, string, string][]> => {
    const { candidatos } = await json<{ candidatos: { id: number; nomeCompleto?: string; nomeUrna?: string; descricaoTotalizacao?: string }[] }>(
      `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/candidatura/listar/${ano}/${uf}/${eleicao}/${cargo}/candidatos`,
      false,
      60000,
    );
    return candidatos.map((c) => [c.id, normalizar(c.nomeCompleto ?? ""), normalizar(c.nomeUrna ?? ""), c.descricaoTotalizacao ?? ""]);
  },
  ["tse-candidatos-v1"],
  { revalidate: UM_DIA * 7 },
);

/**
 * Candidatura de um parlamentar no TSE, pelo nome civil (e, sem ele, pelo nome de urna),
 * na UF e no cargo. Tenta as eleições na ordem dada; entre homônimos, fica com quem foi eleito.
 */
export async function candidaturaTse(opcoes: {
  uf: string;
  cargo: 5 | 6;
  nomeCompleto: string | null;
  nomeUrna: string;
  anos: (keyof typeof ELEICOES_GERAIS)[];
}): Promise<{ ano: number; eleicao: string; id: number } | null> {
  const civil = opcoes.nomeCompleto ? normalizar(opcoes.nomeCompleto) : null;
  const urna = normalizar(opcoes.nomeUrna);
  for (const ano of opcoes.anos) {
    const eleicao = ELEICOES_GERAIS[ano];
    let lista: [number, string, string, string][];
    try {
      lista = await candidatosTse(ano, eleicao, opcoes.uf, opcoes.cargo);
    } catch {
      continue;
    }
    const achados = civil ? lista.filter((c) => c[1] === civil) : lista.filter((c) => c[2] === urna);
    const escolhido = achados.find((c) => /eleit/i.test(c[3]) && !/n[aã]o eleit/i.test(c[3])) ?? (achados.length === 1 ? achados[0] : undefined);
    if (escolhido) return { ano, eleicao, id: escolhido[0] };
  }
  return null;
}

// --------------------------------------------------------------- aquecimento

/** Roda tarefas com no máximo `n` ao mesmo tempo, para não sobrecarregar as fontes. */
async function emLotes<T>(tarefas: (() => Promise<T>)[], n: number): Promise<PromiseSettledResult<T>[]> {
  const resultados: PromiseSettledResult<T>[] = [];
  let i = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (i < tarefas.length) {
        const k = i++;
        try {
          resultados[k] = { status: "fulfilled", value: await tarefas[k]!() };
        } catch (reason) {
          resultados[k] = { status: "rejected", reason };
        }
      }
    }),
  );
  return resultados;
}

const UFS_TSE = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

/**
 * Carrega de antemão os arquivos grandes que as fichas usam (folha do Senado,
 * funcionários da Câmara e listas de candidatos do TSE nos 27 estados), para a primeira
 * visita do dia não esperar por eles. Chamado pela rota /legis/api/aquecer.
 */
export async function aquecerFontesDoPerfil(): Promise<{ etapa: string; ok: number; falhas: number; ms: number }[]> {
  const relatorio: { etapa: string; ok: number; falhas: number; ms: number }[] = [];
  const medir = async (etapa: string, tarefas: (() => Promise<unknown>)[], n: number) => {
    const t0 = Date.now();
    const r = await emLotes(tarefas, n);
    relatorio.push({
      etapa,
      ok: r.filter((x) => x.status === "fulfilled").length,
      falhas: r.filter((x) => x.status === "rejected").length,
      ms: Date.now() - t0,
    });
  };

  await medir("Senado: folha de pagamento", [() => ultimaFolhaSenado()], 1);
  await medir("Câmara: funcionários de gabinete", [() => gabinetesCamara()], 1);
  // Os mesmos anos e cargos que candidaturaTse consulta: deputados (6) e senadores (5).
  const tse: (() => Promise<unknown>)[] = [];
  for (const uf of UFS_TSE) {
    for (const ano of [2026, 2022] as const) tse.push(() => candidatosTse(ano, ELEICOES_GERAIS[ano], uf, 6));
    for (const ano of [2026, 2022, 2018] as const) tse.push(() => candidatosTse(ano, ELEICOES_GERAIS[ano], uf, 5));
  }
  await medir("TSE: candidatos a deputado federal e senador", tse, 4);
  return relatorio;
}

// ------------------------------------------------------ contas de campanha

export interface ContasCampanha {
  ano: number;
  atualizadaEm: string | null;
  recebido: number;
  gasto: number;
  limite: number | null;
  /** De quem veio o dinheiro (partidos, pessoas, o próprio candidato...). */
  origens: { rotulo: string; valor: number; n: number }[];
  /** Fundos públicos e outros recursos usados nas despesas. */
  fundos: { rotulo: string; valor: number }[];
  doadores: { nome: string; valor: number; n: number }[];
  fornecedores: { nome: string; valor: number; n: number }[];
  despesasPorTipo: { tipo: string; valor: number; n: number }[];
}

interface PrestadorTse {
  dataUltimaAtualizacaoContas?: string;
  dadosConsolidados?: Record<string, number | null>;
  despesas?: Record<string, number | null>;
  rankingDoadores?: { nome: string; qntd: string; valor: number }[];
  rankingFornecedores?: { nome: string; qntd: string; valor: number }[];
  concentracaoDespesas?: { dsDRD: string; qtdeDespesas: string; valor: number }[];
}

/**
 * Prestação de contas da campanha no DivulgaCandContas (TSE): quanto entrou, de onde,
 * quanto foi gasto e com quem. Só os nomes de doadores e fornecedores são mostrados,
 * sem CPF ou CNPJ.
 */
export async function contasCampanhaTse(c: {
  ano: number;
  eleicao: string;
  uf: string;
  cargo: number;
  partido: number;
  numero: number;
  id: number | string;
  ficha: string;
}): Promise<Bloco<ContasCampanha>> {
  const onde = { rotulo: "Prestação de contas no TSE", href: c.ficha };
  let p: PrestadorTse;
  try {
    p = await json<PrestadorTse>(
      `https://divulgacandcontas.tse.jus.br/divulga/rest/v1/prestador/consulta/${c.eleicao}/${c.ano}/${c.uf}/${c.cargo}/${c.partido}/${c.numero}/${c.id}`,
      UM_DIA,
    );
  } catch (e) {
    return { ok: false, motivo: `O TSE não devolveu a prestação de contas agora (${String(e)}).`, onde };
  }
  const d = p.dadosConsolidados ?? {};
  const v = (k: string) => Number(d[k] ?? 0) || 0;
  if (!v("totalRecebido") && !(p.despesas?.totalDespesasContratadas ?? 0)) {
    return { ok: false, motivo: `A campanha de ${c.ano} ainda não tem prestação de contas publicada no TSE.`, onde };
  }
  const origens = [
    { rotulo: "Partidos", valor: v("totalPartidos"), n: v("qtdPartidos") },
    { rotulo: "Pessoas físicas", valor: v("totalReceitaPF"), n: v("qtdReceitaPF") },
    { rotulo: "Recursos próprios", valor: v("totalProprios"), n: v("qtdProprios") },
    { rotulo: "Outros candidatos", valor: v("totalReceitaOutCand"), n: v("qtdReceitaOutCand") },
    { rotulo: "Financiamento coletivo", valor: v("totalDoacaoFcc"), n: v("qtdDoacaoFcc") },
    { rotulo: "Internet", valor: v("totalInternet"), n: v("qtdInternet") },
    { rotulo: "Empresas", valor: v("totalReceitaPJ"), n: v("qtdReceitaPJ") },
    { rotulo: "Origem não identificada", valor: v("totalRoni"), n: v("qtdRoni") },
  ].filter((o) => o.valor > 0);
  const des = p.despesas ?? {};
  const fundos = [
    { rotulo: "Fundo Especial de Financiamento de Campanha", valor: Number(des.fundoEspecial ?? 0) },
    { rotulo: "Fundo Partidário", valor: Number(des.fundosPartidarios ?? 0) },
    { rotulo: "Outros recursos", valor: Number(des.outrosRecursos ?? 0) },
  ].filter((f) => f.valor > 0);
  return {
    ok: true,
    dados: {
      ano: c.ano,
      atualizadaEm: p.dataUltimaAtualizacaoContas ?? null,
      recebido: v("totalRecebido"),
      gasto: Number(des.totalDespesasContratadas ?? 0),
      limite: des.valorLimiteDeGastos != null ? Number(des.valorLimiteDeGastos) : null,
      origens,
      fundos,
      doadores: (p.rankingDoadores ?? []).slice(0, 10).map((x) => ({ nome: x.nome, valor: x.valor, n: Number(x.qntd) || 1 })),
      fornecedores: (p.rankingFornecedores ?? []).slice(0, 10).map((x) => ({ nome: x.nome, valor: x.valor, n: Number(x.qntd) || 1 })),
      despesasPorTipo: (p.concentracaoDespesas ?? [])
        .map((x) => ({ tipo: x.dsDRD, valor: x.valor, n: Number(x.qtdeDespesas) || 0 }))
        .sort((a, b) => b.valor - a.valor)
        .slice(0, 10),
    },
  };
}
