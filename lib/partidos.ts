/**
 * Nome e número eleitoral dos partidos com cadeira no Congresso, pelas siglas usadas
 * pela Câmara e pelo Senado. Fonte: TSE (partidos registrados).
 */
export const PARTIDOS: Record<string, { nome: string; numero?: number }> = {
  AVANTE: { nome: "Avante", numero: 70 },
  CIDADANIA: { nome: "Cidadania", numero: 23 },
  MDB: { nome: "Movimento Democrático Brasileiro", numero: 15 },
  MISSÃO: { nome: "Partido Missão", numero: 14 },
  NOVO: { nome: "Partido Novo", numero: 30 },
  PCdoB: { nome: "Partido Comunista do Brasil", numero: 65 },
  PDT: { nome: "Partido Democrático Trabalhista", numero: 12 },
  PL: { nome: "Partido Liberal", numero: 22 },
  PODE: { nome: "Podemos", numero: 20 },
  PP: { nome: "Progressistas", numero: 11 },
  PRD: { nome: "Partido Renovação Democrática", numero: 25 },
  PSB: { nome: "Partido Socialista Brasileiro", numero: 40 },
  PSD: { nome: "Partido Social Democrático", numero: 55 },
  PSDB: { nome: "Partido da Social Democracia Brasileira", numero: 45 },
  PSOL: { nome: "Partido Socialismo e Liberdade", numero: 50 },
  PT: { nome: "Partido dos Trabalhadores", numero: 13 },
  PV: { nome: "Partido Verde", numero: 43 },
  REDE: { nome: "Rede Sustentabilidade", numero: 18 },
  REPUBLICANOS: { nome: "Republicanos", numero: 10 },
  SOLIDARIEDADE: { nome: "Solidariedade", numero: 77 },
  UNIÃO: { nome: "União Brasil", numero: 44 },
  "S/Partido": { nome: "Sem partido" },
};

export interface LogoPartido {
  /** Caminho em /public. */
  src: string;
  /** Logos com texto branco, feitos para fundo escuro. */
  escuro?: boolean;
  /** De onde o arquivo foi baixado (site oficial do partido ou API da Câmara). */
  fonte: string;
}

/**
 * Logo de cada partido, baixado do site oficial em 26/11/2026 e guardado em
 * public/partidos (WebP, 120 px de altura). O PV usa o logo da API de Dados Abertos
 * da Câmara, porque o site do partido bloqueia acesso automático. O Cidadania não
 * publica logo no site (cidadania23.org.br leva à plataforma Rede 23) nem a Câmara
 * tem um: aparece com o selo da sigla.
 *
 * Quando um partido trocar de logo, baixe o novo do site oficial, gere o WebP com a
 * mesma altura e atualize a fonte aqui.
 */
export const LOGOS: Record<string, LogoPartido> = {
  AVANTE: { src: "/partidos/avante.webp", fonte: "https://avante70.org.br" },
  MDB: { src: "/partidos/mdb.webp", fonte: "https://www.mdb.org.br" },
  MISSÃO: { src: "/partidos/missao.webp", escuro: true, fonte: "https://missao.org.br" },
  NOVO: { src: "/partidos/novo.webp", fonte: "https://novo.org.br" },
  PCdoB: { src: "/partidos/pcdob.webp", escuro: true, fonte: "https://pcdob.org.br" },
  PDT: { src: "/partidos/pdt.webp", fonte: "https://pdt.org.br" },
  PL: { src: "/partidos/pl.webp", fonte: "https://partidoliberal.org.br" },
  PODE: { src: "/partidos/pode.webp", fonte: "https://podemos.org.br" },
  PP: { src: "/partidos/pp.webp", fonte: "https://progressistas.org.br" },
  PRD: { src: "/partidos/prd.webp", fonte: "https://prd25.org.br" },
  PSB: { src: "/partidos/psb.webp", fonte: "https://psb40.org.br" },
  PSD: { src: "/partidos/psd.webp", fonte: "https://psd.org.br" },
  PSDB: { src: "/partidos/psdb.webp", escuro: true, fonte: "https://www.psdb.org.br" },
  PSOL: { src: "/partidos/psol.webp", fonte: "https://psol50.org.br" },
  PT: { src: "/partidos/pt.webp", fonte: "https://pt.org.br" },
  PV: { src: "/partidos/pv.webp", fonte: "https://dadosabertos.camara.leg.br (Câmara dos Deputados)" },
  REDE: { src: "/partidos/rede.webp", fonte: "https://redesustentabilidade.org.br" },
  REPUBLICANOS: { src: "/partidos/republicanos.webp", fonte: "https://republicanos10.org.br" },
  SOLIDARIEDADE: { src: "/partidos/solidariedade.webp", fonte: "https://solidariedade.org.br" },
  UNIÃO: { src: "/partidos/uniao.webp", escuro: true, fonte: "https://uniaobrasil.org.br" },
};
