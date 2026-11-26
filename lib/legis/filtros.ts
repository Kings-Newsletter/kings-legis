import { ESTAGIOS, type Estagio } from "@/lib/types";

import { TIPOS } from "./catalogo";

/** Filtros da lista de proposições, lidos da URL. Sem acesso à rede. */

export const POR_PAGINA = 20;

export type CasaFiltro = "camara" | "senado";

export interface Filtros {
  /** Cada Casa tem a sua API e a sua paginação, então a lista é de uma Casa por vez. */
  casa: CasaFiltro;
  q?: string;
  sigla?: string;
  estagio?: Estagio;
  /** Nome do tema (Câmara). */
  tema?: string;
  uf?: string;
  /** AAAA-MM-DD, data de apresentação. */
  de?: string;
  ate?: string;
  pagina: number;
}

type Params = Record<string, string | string[] | undefined>;

const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const dataValida = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/** Lê e valida os filtros da URL; o que não for válido é ignorado. */
export function lerFiltros(sp: Params): Filtros {
  const sigla = um(sp.tipo)?.toUpperCase();
  const estagio = um(sp.estagio) as Estagio | undefined;
  const uf = um(sp.uf)?.toUpperCase();
  const pagina = Number.parseInt(um(sp.pagina) ?? "1", 10);
  return {
    casa: um(sp.casa) === "senado" ? "senado" : "camara",
    q: um(sp.q)?.slice(0, 120),
    sigla: sigla && TIPOS.some((t) => t.sigla === sigla) ? sigla : undefined,
    estagio: estagio && (ESTAGIOS as readonly string[]).includes(estagio) ? estagio : undefined,
    tema: um(sp.tema)?.slice(0, 80),
    uf: uf && /^[A-Z]{2}$/.test(uf) ? uf : undefined,
    de: dataValida(um(sp.de)),
    ate: dataValida(um(sp.ate)),
    pagina: Number.isFinite(pagina) && pagina > 0 ? Math.min(pagina, 500) : 1,
  };
}

/** Monta a query string dos filtros, com trocas pontuais (ex.: outra página, outra Casa). */
export function queryDosFiltros(
  f: Filtros,
  troca: Partial<Record<keyof Filtros, string | number | undefined>> = {},
): string {
  const v = { ...f, ...troca } as Record<string, string | number | undefined>;
  const qs = new URLSearchParams();
  const pares: [string, string | number | undefined][] = [
    ["casa", v.casa === "camara" ? undefined : v.casa],
    ["q", v.q],
    ["tipo", v.sigla],
    ["estagio", v.estagio],
    ["tema", v.tema],
    ["uf", v.uf],
    ["de", v.de],
    ["ate", v.ate],
    ["pagina", Number(v.pagina) > 1 ? v.pagina : undefined],
  ];
  for (const [k, val] of pares) if (val !== undefined && val !== "") qs.set(k, String(val));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function temFiltro(f: Filtros): boolean {
  return Boolean(f.q || f.sigla || f.estagio || f.tema || f.uf || f.de || f.ate);
}

/** "PL 1234/2026", "pl 1234", "PEC 45/2019" → sigla, número e (se houver) ano. */
export function lerNumero(q: string): { sigla: string; numero: number; ano?: number } | null {
  const m = q.match(/^([a-z]{2,4})\s*\.?\s*(\d{1,6})(?:\s*\/\s*(\d{4}))?$/i);
  if (!m) return null;
  return { sigla: m[1]!.toUpperCase(), numero: Number(m[2]), ano: m[3] ? Number(m[3]) : undefined };
}

/** Datas das APIs vêm no horário de Brasília e sem fuso ("2026-11-25T19:20"). */
export function dataBrasilia(s: string | null | undefined): Date {
  if (!s) return new Date(0);
  const t = s.trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return new Date(`${t}T12:00:00-03:00`);
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(t)) return new Date(t);
  const comSegundos = /T\d{2}:\d{2}$/.test(t) ? `${t}:00` : t;
  return new Date(`${comSegundos}-03:00`);
}
