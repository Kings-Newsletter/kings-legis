/**
 * Configuração central do portal. Identidade, URLs e navegação ficam aqui para
 * serem reutilizadas por páginas, SEO e componentes.
 *
 */

export const site = {
  name: "King's Legis",
  logo: "/brand/logo-kings-legis.png",
  brandMark: "/brand/icon-kings-legis.png",
  icon: "/favicon.png",
  radarName: "King's Radar",
  tagline: "O que o Congresso, o Diário Oficial e os tribunais fizeram",
  description:
    "Proposições, tramitação, votações e atos oficiais do país, com a fonte oficial em cada item.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://kingsnewsletter.com",
  newsletterUrl: process.env.NEXT_PUBLIC_NEWSLETTER_URL ?? "https://kingsnewsletter.com",
  editorialEmail: process.env.NEXT_PUBLIC_EDITORIAL_EMAIL ?? "contact@kingsnewsletter.com",
  locale: "pt_BR",
  lang: "pt-BR",
} as const;

export const nav = [
  { href: "/legis", label: "Início" },
  { href: "/legis/proposicoes", label: "Proposições" },
  { href: "/legis/partidos", label: "Partidos" },
  { href: "/legis/agenda", label: "Agenda" },
  { href: "/radar", label: "Radar" },
] as const;

/** Monta URL absoluta a partir de um caminho interno (ex.: "/legis/agenda"). */
export function absoluteUrl(path = "/"): string {
  const base = site.url.replace(/\/+$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
