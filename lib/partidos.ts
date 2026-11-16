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
