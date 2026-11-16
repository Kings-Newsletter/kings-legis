import type { Cargo, Parlamentar } from "./parlamentares";

/**
 * Eleitos segundo o DivulgaCandContas do TSE.
 *
 * Importante: é a lista de quem foi ELEITO, não de quem está no cargo hoje.
 * Renúncias (como as de governadores que saíram em 2026 para disputar outro
 * cargo), cassações e suplentes que assumiram depois não aparecem, e o partido
 * é o da eleição. A interface sempre informa o ano da eleição.
 *
 * Só nome de urna, partido e foto saem daqui; CPF, título, bens e os demais
 * campos pessoais do TSE são descartados.
 */

const BASE = "https://divulgacandcontas.tse.jus.br/divulga/rest/v1";

export const ELEICAO_2022 = { ano: 2022, id: "2040602022" };
export const ELEICAO_2024 = { ano: 2024, id: "2045202024" };

export const CARGOS_TSE = {
  governador: 3,
  viceGovernador: 4,
  deputadoEstadual: 7,
  deputadoDistrital: 8,
  prefeito: 11,
  vicePrefeito: 12,
  vereador: 13,
} as const;

export const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
  "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du"]);

/** "JOSÉ DA SILVA" → "José da Silva". */
export function nomeProprio(texto: string) {
  return texto
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1)))
    .join(" ");
}

/** Para comparar nomes de municípios entre IBGE e TSE: sem acento, caixa ou pontuação. */
export function chaveNome(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** O TSE escreve algumas siglas de outro jeito; aqui ficam iguais às da Câmara e do Senado. */
const SIGLAS: Record<string, string> = {
  "PC do B": "PCdoB",
  PCDOB: "PCdoB",
  SOLIDARIEDADE: "SOLIDARIEDADE",
  "UNIÃO BRASIL": "UNIÃO",
  UNIAO: "UNIÃO",
  PODEMOS: "PODE",
};

function siglaPartido(sigla: string | null | undefined) {
  const s = (sigla ?? "").trim();
  return s ? (SIGLAS[s] ?? SIGLAS[s.toUpperCase()] ?? s) : "—";
}

interface CandidatoTse {
  id: number;
  nomeUrna: string;
  descricaoTotalizacao: string | null;
  partido: { sigla: string | null } | null;
}

async function obter<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!r.ok) throw new Error(`TSE respondeu ${r.status}`);
  return (await r.json()) as T;
}

/**
 * Eleitos de um cargo numa unidade eleitoral (sigla da UF ou código TSE do município).
 * `ufFoto` é a UF usada no endereço da foto.
 */
export async function listarEleitos(
  eleicao: { ano: number; id: string },
  unidade: string,
  cargoTse: number,
  cargo: Cargo,
  uf: string,
): Promise<Parlamentar[]> {
  const json = await obter<{ candidatos: CandidatoTse[] | null }>(
    `${BASE}/candidatura/listar/${eleicao.ano}/${unidade}/${eleicao.id}/${cargoTse}/candidatos`,
  );
  return (json.candidatos ?? [])
    .filter((c) => (c.descricaoTotalizacao ?? "").startsWith("Eleito"))
    .map((c) => ({
      id: `tse-${c.id}`,
      nome: nomeProprio(c.nomeUrna),
      partido: siglaPartido(c.partido?.sigla),
      uf,
      cargo,
      foto: `https://divulgacandcontas.tse.jus.br/divulga/rest/arquivo/img/${eleicao.id}/${c.id}/${unidade}`,
      url: "",
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const LIGACOES = new Set(["DE", "DA", "DO", "DAS", "DOS", "D", "E"]);

/** Chave mais solta: sem preposições e com grafias antigas igualadas (TH → T, Z → S, Y → I). */
function chaveSolta(texto: string) {
  return chaveNome(texto)
    .split(" ")
    .filter((p) => !LIGACOES.has(p))
    .join(" ")
    .replace(/TH/g, "T")
    .replace(/Z/g, "S")
    .replace(/Y/g, "I");
}

function distancia(a: string, b: string) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0]!;
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j]!;
      linha[j] = Math.min(linha[j]! + 1, linha[j - 1]! + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length]!;
}

/**
 * Código TSE de um município (diferente do código do IBGE), procurado pelo nome.
 * Algumas grafias divergem entre IBGE e TSE ("Camacan" × "Camacã", "Espigão D'Oeste" ×
 * "Espigão do Oeste", "São Luiz do Anauá" × "São Luiz"): tenta o nome exato, depois uma
 * comparação mais solta e, por fim, o nome mais parecido, se for parecido o bastante.
 */
export async function codigoMunicipioTse(uf: string, nome: string): Promise<string | null> {
  const json = await obter<{ municipios: { codigo: string; nome: string }[] }>(
    `${BASE}/eleicao/buscar/${uf}/${ELEICAO_2024.id}/municipios`,
  );
  const lista = json.municipios;
  const exato = lista.find((m) => chaveNome(m.nome) === chaveNome(nome));
  if (exato) return exato.codigo;

  const alvo = chaveSolta(nome);
  const solto = lista.find((m) => chaveSolta(m.nome) === alvo);
  if (solto) return solto.codigo;

  let melhor: { codigo: string; d: number } | null = null;
  for (const m of lista) {
    const k = chaveSolta(m.nome);
    const d = alvo.startsWith(k + " ") || k.startsWith(alvo + " ") ? 1 : distancia(alvo, k);
    if (!melhor || d < melhor.d) melhor = { codigo: m.codigo, d };
  }
  return melhor && melhor.d <= 2 ? melhor.codigo : null;
}
