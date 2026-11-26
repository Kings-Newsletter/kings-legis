import "server-only";

import type { LegisEvent, LegisItem } from "@/lib/types";

/**
 * Dados de EXEMPLO para desenvolver as telas antes de a coleta do kings-worker
 * estar ligada. Só são usados com LEGIS_EXEMPLOS=1 fora de produção e sem
 * MONGODB_URI (ver proposicoes.ts). Números, autores e ementas são fictícios e
 * marcados como exemplo: nada aqui pode ir ao ar.
 */

const dia = 24 * 60 * 60 * 1000;
const agora = Date.now();
const haDias = (n: number) => new Date(agora - n * dia);

const url = (casa: string, n: number) =>
  casa === "senado"
    ? `https://www25.senado.leg.br/web/atividade/materias?exemplo=${n}`
    : `https://www.camara.leg.br/busca-portal/proposicoes/pesquisa-simplificada?exemplo=${n}`;

interface Semente {
  casa: LegisItem["casa"];
  sigla: string;
  numero: number;
  ementa: string;
  autores: LegisItem["autores"];
  temas: string[];
  apresentada: number;
  atualizada: number;
  estagio: LegisItem["estagio"];
  situacao: string;
  explicada?: boolean;
  outra?: string;
}

const sementes: Semente[] = [
  {
    casa: "camara", sigla: "PL", numero: 9001,
    ementa: "[Exemplo] Altera a lei de licitações para exigir publicação dos contratos em formato aberto.",
    autores: [{ nome: "Deputada Exemplo A", partido: "PXA", uf: "SP", tipo: "Deputado" }],
    temas: ["transparência", "administração pública"], apresentada: 120, atualizada: 1,
    estagio: "pautada", situacao: "Pronta para Pauta no Plenário (PLEN)", explicada: true,
  },
  {
    casa: "camara", sigla: "PEC", numero: 9002,
    ementa: "[Exemplo] Dá nova redação ao art. 37 da Constituição para limitar verbas indenizatórias.",
    autores: [
      { nome: "Deputado Exemplo B", partido: "PXB", uf: "MG", tipo: "Deputado" },
      { nome: "Deputada Exemplo C", partido: "PXC", uf: "BA", tipo: "Deputado" },
    ],
    temas: ["economia", "administração pública"], apresentada: 300, atualizada: 3,
    estagio: "em_analise", situacao: "Aguardando Parecer do Relator na Comissão de Constituição e Justiça e de Cidadania (CCJC)",
  },
  {
    casa: "senado", sigla: "PL", numero: 9003,
    ementa: "[Exemplo] Cria regras para o uso de reconhecimento facial em espaços públicos.",
    autores: [{ nome: "Senadora Exemplo D", partido: "PXA", uf: "RS", tipo: "Senador" }],
    temas: ["tecnologia", "segurança"], apresentada: 200, atualizada: 2,
    estagio: "aprovada_em_uma_casa", situacao: "Remetida à Câmara dos Deputados", outra: "camara:9010",
  },
  {
    casa: "camara", sigla: "PL", numero: 9010,
    ementa: "[Exemplo] Cria regras para o uso de reconhecimento facial em espaços públicos.",
    autores: [{ nome: "Senadora Exemplo D", partido: "PXA", uf: "RS", tipo: "Senador" }],
    temas: ["tecnologia", "segurança"], apresentada: 20, atualizada: 2,
    estagio: "em_analise", situacao: "Aguardando Designação de Relator", outra: "senado:9003",
  },
  {
    casa: "camara", sigla: "MPV", numero: 9004,
    ementa: "[Exemplo] Abre crédito extraordinário para ações de defesa civil em municípios atingidos por enchentes.",
    autores: [{ nome: "Poder Executivo", tipo: "Órgão do Poder Executivo" }],
    temas: ["orçamento", "defesa civil"], apresentada: 40, atualizada: 0,
    estagio: "aprovada", situacao: "Aguardando sanção", explicada: true,
  },
  {
    casa: "camara", sigla: "PLP", numero: 9005,
    ementa: "[Exemplo] Altera o regime do Simples Nacional para microempreendedores individuais.",
    autores: [{ nome: "Deputado Exemplo E", partido: "PXD", uf: "PE", tipo: "Deputado" }],
    temas: ["tributos", "economia"], apresentada: 500, atualizada: 5,
    estagio: "sancionada", situacao: "Transformado na Lei Complementar nº 0/2026 (exemplo)",
  },
  {
    casa: "senado", sigla: "PL", numero: 9006,
    ementa: "[Exemplo] Institui o Dia Nacional de uma data comemorativa fictícia.",
    autores: [{ nome: "Senador Exemplo F", partido: "PXB", uf: "GO", tipo: "Senador" }],
    temas: ["homenagens"], apresentada: 60, atualizada: 30,
    estagio: "apresentada", situacao: "Aguardando distribuição",
  },
  {
    casa: "camara", sigla: "PL", numero: 9007,
    ementa: "[Exemplo] Obriga escolas públicas a oferecer educação financeira no ensino médio.",
    autores: [{ nome: "Deputada Exemplo G", partido: "PXC", uf: "CE", tipo: "Deputado" }],
    temas: ["educação"], apresentada: 700, atualizada: 90,
    estagio: "arquivada", situacao: "Arquivada nos termos do Artigo 105 do Regimento Interno da Câmara dos Deputados",
  },
  {
    casa: "senado", sigla: "VET", numero: 9008,
    ementa: "[Exemplo] Veto parcial ao projeto que trata da renegociação de dívidas rurais.",
    autores: [{ nome: "Presidência da República", tipo: "Órgão do Poder Executivo" }],
    temas: ["agro", "economia"], apresentada: 15, atualizada: 4,
    estagio: "vetada", situacao: "Aguardando deliberação do veto em sessão conjunta",
  },
  {
    casa: "camara", sigla: "PL", numero: 9009,
    ementa: "[Exemplo] Amplia a licença-paternidade para trabalhadores com carteira assinada.",
    autores: [{ nome: "Deputado Exemplo H", partido: "PXA", uf: "PR", tipo: "Deputado" }],
    temas: ["trabalho", "saúde"], apresentada: 250, atualizada: 6,
    estagio: "pautada", situacao: "Pauta da Comissão de Trabalho (CTRAB) desta semana",
  },
];

export const ITENS_EXEMPLO: LegisItem[] = sementes.map((s) => ({
  _id: `${s.casa}:${s.numero}`,
  casa: s.casa,
  sigla: s.sigla,
  numero: s.numero,
  ano: haDias(s.apresentada).getFullYear(),
  ementa: s.ementa,
  autores: s.autores,
  temas: s.temas,
  dataApresentacao: haDias(s.apresentada),
  estagio: s.estagio,
  situacaoFonte: s.situacao,
  ultimaAtualizacao: haDias(s.atualizada),
  urlOficial: url(s.casa, s.numero),
  outrasCasas: s.outra ? [s.outra] : undefined,
  relevancia: { score: 50, motivos: ["exemplo"] },
  explicacao: s.explicada
    ? {
        status: "aprovada",
        contextLabel: "Exemplo",
        texto:
          "Texto de exemplo da redação. Aqui entra o que muda se a proposta for aprovada, quem é afetado e em que estágio ela está, sempre a partir do texto oficial.",
        aprovadoEm: haDias(s.atualizada),
      }
    : { status: "rascunho", texto: "Rascunho: nunca aparece no portal." },
}));

export const EVENTOS_EXEMPLO: LegisEvent[] = ITENS_EXEMPLO.flatMap((item) => {
  const inicio = item.dataApresentacao.getTime();
  const fim = item.ultimaAtualizacao.getTime();
  const passos: [LegisEvent["tipo"], string, string][] = [
    ["tramitacao", "Mesa Diretora", "Apresentação da proposição."],
    ["tramitacao", "Mesa Diretora", "Distribuída às comissões."],
  ];
  if (item.estagio !== "apresentada") passos.push(["tramitacao", "Comissão", "Designado relator."]);
  if (["pautada", "aprovada_em_uma_casa", "aprovada", "sancionada"].includes(item.estagio))
    passos.push(["pauta", "Plenário", "Incluída na pauta."]);
  if (["aprovada_em_uma_casa", "aprovada", "sancionada", "vetada"].includes(item.estagio))
    passos.push(["votacao", "Plenário", "Aprovada em votação simbólica."]);
  if (item.estagio === "sancionada") passos.push(["sancao", "Presidência da República", "Sancionada."]);
  if (item.estagio === "vetada") passos.push(["veto", "Presidência da República", "Vetada parcialmente."]);
  passos.push(["tramitacao", "", item.situacaoFonte]);

  return passos.map(([tipo, orgao, descricao], i) => ({
    _id: `${item._id}:${i}`,
    itemId: item._id,
    tipo,
    data: new Date(inicio + ((fim - inicio) * i) / Math.max(1, passos.length - 1)),
    orgao: orgao || undefined,
    descricao,
  }));
});
