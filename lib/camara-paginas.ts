import "server-only";

/**
 * Dados que a Câmara publica só nas páginas oficiais de cada deputado (não na API de
 * dados abertos): remuneração mês a mês com descontos, imóvel funcional e
 * auxílio-moradia, e a remuneração de cada secretário parlamentar.
 *
 * Cada página fica no cache do servidor por um dia. Se a Câmara mudar o desenho da
 * página, a leitura falha e a ficha volta a mostrar o item em "O que falta".
 */

const UM_DIA = 60 * 60 * 24;
const SITE = "https://www.camara.leg.br";

async function pagina(url: string): Promise<string> {
  const r = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; KingsLegis/1.0)", Accept: "text/html" },
    next: { revalidate: UM_DIA },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`camara.leg.br respondeu ${r.status}`);
  return r.text();
}

const texto = (html: string) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a role="button"[\s\S]*?<\/a>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const valorBr = (s: string | undefined) => {
  if (!s) return 0;
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/** Itens de uma tabela "Descrição / Valor R$" da Câmara (deputado ou servidor). */
export interface Contracheque {
  referencia: string | null;
  remuneracaoFixa: number;
  vantagensPessoais: number;
  funcao: number;
  natalina: number;
  ferias: number;
  eventuais: number;
  abono: number;
  redutor: number;
  previdencia: number;
  imposto: number;
  liquido: number;
  diarias: number;
  auxilios: number;
  indenizatorias: number;
  bruto: number;
}

function lerContracheque(html: string): Contracheque | null {
  const tabela = [...html.matchAll(/<table[\s\S]*?<\/table>/gi)].map((m) => m[0]).find((t) => /Remunera[çc][ãa]o Fixa/i.test(t));
  if (!tabela) return null;
  const linhas = [...tabela.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) =>
    [...m[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => texto(c[1] ?? "")),
  );
  // A tabela tem linhas de grupo ("5 - Remuneração após Descontos Obrigatórios") sem valor
  // e, logo abaixo, a linha com o valor ("a - Remuneração após Descontos..."): só conta a
  // linha cuja última célula é um número.
  const numero = /^-?[\d.]+(,\d+)?$/;
  const valor = (rotulo: RegExp) => {
    const l = linhas.filter((cs) => cs.some((c) => rotulo.test(c)) && numero.test(cs[cs.length - 1] ?? "")).pop();
    return valorBr(l?.[l.length - 1]);
  };
  // Mês de referência: "10/2026 -FOLHA NORMAL" (deputado) ou o mês escolhido no seletor (servidor).
  const seletor = html.match(/<option selected value="[^"]*\?ano=(\d{4})&(?:amp;)?mes=(\d{1,2})"/i);
  const ref =
    texto(html).match(/(\d{2}\/\d{4})\s*-\s*FOLHA NORMAL/i)?.[1] ??
    (seletor ? `${seletor[2]!.padStart(2, "0")}/${seletor[1]}` : null);
  const c = {
    referencia: ref,
    remuneracaoFixa: valor(/Remunera[çc][ãa]o Fixa/i),
    vantagensPessoais: valor(/Vantagens de Natureza Pessoal/i),
    funcao: valor(/Fun[çc][ãa]o ou Cargo em Comiss[ãa]o/i),
    natalina: valor(/Gratifica[çc][ãa]o Natalina/i),
    ferias: valor(/F[ée]rias/i),
    eventuais: valor(/Outras Remunera[çc][õo]es Eventuais/i),
    abono: valor(/Abono Perman[êe]ncia/i),
    redutor: valor(/Redutor Constitucional/i),
    previdencia: valor(/Contribui[çc][ãa]o Previdenci[áa]ria/i),
    imposto: valor(/Imposto de Renda/i),
    liquido: valor(/Remunera[çc][ãa]o ap[óo]s Descontos/i),
    diarias: valor(/Di[áa]rias/i),
    auxilios: valor(/Aux[íi]lios/i),
    indenizatorias: valor(/Vantagens Indenizat[óo]rias/i),
    bruto: 0,
  };
  c.bruto = c.remuneracaoFixa + c.vantagensPessoais + c.funcao + c.natalina + c.ferias + c.eventuais + c.abono;
  return c;
}

// ------------------------------------------------------------- deputado

export interface BeneficiosDeputado {
  imovelFuncional: string | null;
  auxilioMoradia: string | null;
}

/** "Imóvel funcional: Faz uso desde 30/12/2022", "Auxílio-moradia: Não recebe o auxílio". */
export async function beneficiosDeputado(id: string): Promise<BeneficiosDeputado> {
  const html = await pagina(`${SITE}/deputados/${id}`);
  const bloco = (titulo: string) => {
    const i = html.indexOf(`beneficio__titulo">${titulo}`);
    if (i < 0) return null;
    // O texto do benefício vai do título até o próximo título.
    const proximo = html.indexOf("beneficio__titulo", i + 20);
    // Corta antes da tag que abre o próximo título, para não sobrar "<span class=" no texto.
    const fim = proximo > 0 ? html.lastIndexOf("<", proximo) : i + 1500;
    const t = texto(html.slice(i, fim)).replace(/^beneficio__titulo">/, "");
    return t.replace(new RegExp(`^${titulo}\\s*`), "").trim() || null;
  };
  return { imovelFuncional: bloco("Imóvel funcional"), auxilioMoradia: bloco("Auxílio-moradia") };
}

/** Contracheque do deputado no último mês publicado do ano atual (ou do anterior). */
export async function remuneracaoMensalDeputado(id: string): Promise<Contracheque | null> {
  const anoAtual = new Date().getFullYear();
  for (const ano of [anoAtual, anoAtual - 1]) {
    const lista = await pagina(`${SITE}/deputados/${id}/remuneracao?ano=${ano}`);
    const meses = [...lista.matchAll(/remuneracao-deputado-detalhado\?mesAno=(\d{2})(\d{4})/g)].map((m) => `${m[1]}${m[2]}`);
    const ultimo = meses.sort((a, b) => Number(b.slice(0, 2)) - Number(a.slice(0, 2)))[0];
    if (!ultimo) continue;
    const c = lerContracheque(await pagina(`${SITE}/deputados/${id}/remuneracao-deputado-detalhado?mesAno=${ultimo}`));
    if (c) return { ...c, referencia: c.referencia ?? `${ultimo.slice(0, 2)}/${ultimo.slice(2)}` };
  }
  return null;
}

// ------------------------------------------------------ pessoal de gabinete

export interface SecretarioCamara {
  nome: string;
  nivel: string;
  desde: string | null;
  contracheque: Contracheque | null;
}

/** Secretários ativos no gabinete, com o contracheque do último mês de cada um. */
export async function pessoalGabineteDeputado(id: string): Promise<SecretarioCamara[]> {
  const ano = new Date().getFullYear();
  const html = await pagina(`${SITE}/deputados/${id}/pessoal-gabinete?ano=${ano}`);
  const tabela = html.match(/<table[\s\S]*?<\/table>/i)?.[0] ?? "";
  const linhas = [...tabela.matchAll(/<tr[\s\S]*?<\/tr>/gi)]
    .map((m) => {
      const celulas = [...m[0].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) => c[1] ?? "");
      if (celulas.length < 4) return null;
      const periodo = texto(celulas[3]!);
      const desde = periodo.match(/^Desde (\d{2}\/\d{2}\/\d{4})/i)?.[1];
      if (!desde) return null; // quem já saiu do gabinete
      const link = celulas[4]?.match(/href="([^"]+\/remuneracao\/[^"]+)"/)?.[1] ?? null;
      return { nome: texto(celulas[0]!), nivel: texto(celulas[2]!), desde, link };
    })
    .filter((l): l is { nome: string; nivel: string; desde: string; link: string | null } => l !== null);

  // Uma página por secretário: no máximo 4 ao mesmo tempo, para não sobrecarregar o site.
  const resultado: SecretarioCamara[] = new Array(linhas.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (i < linhas.length) {
        const k = i++;
        const l = linhas[k]!;
        let contracheque: Contracheque | null = null;
        if (l.link) {
          try {
            contracheque = lerContracheque(await pagina(l.link));
          } catch {
            contracheque = null;
          }
        }
        resultado[k] = { nome: l.nome, nivel: l.nivel, desde: l.desde, contracheque };
      }
    }),
  );
  return resultado;
}
