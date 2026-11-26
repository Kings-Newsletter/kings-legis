import type { Estagio, LegisEventTipo } from "@/lib/types";

/**
 * Traduz a situação como a Câmara ou o Senado escrevem ("Pronta para Pauta",
 * "REMETIDA À CÂMARA DOS DEPUTADOS") para o estágio normalizado do Legis. A
 * situação original continua sendo mostrada ao lado, sempre.
 *
 * A ordem importa: "Transformada em norma jurídica com veto parcial" é sancionada,
 * não vetada; "Aguardando apreciação pelo Senado" é aprovada em uma Casa.
 */
const REGRAS: [RegExp, Estagio][] = [
  [/transformad[oa] em norma|norma juridica|sancionad/, "sancionada"],
  [/vetad|veto/, "vetada"],
  [
    /arquiv|retirad|devolvid|perdeu a eficacia|recusad|prejudic|rejeitad|tramitacao finalizada|transformad[oa] em nova|desmembrad/,
    "arquivada",
  ],
  [/sancao|promulga|envio ao executivo/, "aprovada"],
  // "APROVADA" sem destino: aprovada na Casa que informa; pode ainda ir à outra.
  [/^aprovad[oa]$/, "aprovada_em_uma_casa"],
  [/(remetid|enviad|envio a|apreciacao pel).*(senado|camara)/, "aprovada_em_uma_casa"],
  [/pront[oa] para|pauta|ordem do dia/, "pautada"],
  [
    /aguardando (despacho|distribuicao|recebimento|leitura|indexacao|autuacao)|protocolo digital|apresentad/,
    "apresentada",
  ],
];

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function estagioDaSituacao(situacao: string | null | undefined): Estagio {
  if (!situacao) return "apresentada";
  const n = normalizar(situacao);
  for (const [regra, estagio] of REGRAS) if (regra.test(n)) return estagio;
  return "em_analise";
}

/** Tipo de um evento de tramitação, pela descrição oficial. */
export function tipoDoEvento(descricao: string): LegisEventTipo {
  const n = normalizar(descricao);
  if (/\bveto\b|vetad/.test(n)) return "veto";
  if (/sancao|sancionad|transformad[oa] em norma/.test(n)) return "sancao";
  if (/votac|aprovad[oa]|aprovacao|rejeitad|deliberad/.test(n)) return "votacao";
  if (/pauta|ordem do dia/.test(n)) return "pauta";
  return "tramitacao";
}

/** "Pronta para Pauta" e "PRONTO PARA DELIBERAÇÃO DO PLENÁRIO" no mesmo formato. */
export function situacaoLegivel(s: string): string {
  if (s !== s.toUpperCase()) return s.trim();
  const t = s.toLowerCase().trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
