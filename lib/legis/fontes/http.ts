import "server-only";

/**
 * GET em JSON numa API oficial, com cache no servidor (fetch do Next com
 * revalidate): a mesma URL só vai à fonte de novo depois de `revalidar` segundos,
 * então a visita quase sempre é servida do cache, sem chamar a Câmara ou o Senado.
 */
export const CACHE = {
  lista: 60 * 30,
  detalhe: 60 * 60,
  referencia: 60 * 60 * 24,
} as const;

export class FonteIndisponivel extends Error {}

/**
 * No máximo 4 chamadas simultâneas por fonte: a Câmara responde 429 (excesso de
 * requisições) quando a lista busca o detalhe de 20 proposições de uma vez.
 */
const SIMULTANEAS = 4;
const filas = new Map<string, { ativas: number; espera: (() => void)[] }>();

async function naVez<T>(host: string, tarefa: () => Promise<T>): Promise<T> {
  const fila = filas.get(host) ?? { ativas: 0, espera: [] };
  filas.set(host, fila);
  if (fila.ativas >= SIMULTANEAS) await new Promise<void>((ok) => fila.espera.push(ok));
  fila.ativas++;
  try {
    return await tarefa();
  } finally {
    fila.ativas--;
    fila.espera.shift()?.();
  }
}

const pausa = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

export async function getJson<T>(url: string, revalidar: number): Promise<{ dados: T; headers: Headers }> {
  const host = new URL(url).host;
  for (let tentativa = 1; ; tentativa++) {
    let r: Response;
    try {
      r = await naVez(host, () =>
        fetch(url, {
          headers: { Accept: "application/json" },
          next: { revalidate: revalidar },
          signal: AbortSignal.timeout(15_000),
        }),
      );
    } catch (erro) {
      // As APIs às vezes demoram por alguns segundos: uma nova tentativa antes de desistir.
      if (tentativa < 2) continue;
      throw new FonteIndisponivel(`${host} não respondeu: ${String(erro)}`);
    }
    // Excesso de requisições: espera (o que a fonte pedir, até 3 s) e tenta de novo, até 3 vezes.
    if (r.status === 429 && tentativa < 3) {
      const pedido = Number(r.headers.get("retry-after"));
      await pausa(Number.isFinite(pedido) && pedido > 0 ? Math.min(pedido * 1000, 3000) : 600 * tentativa);
      continue;
    }
    if (r.status === 404) throw new FonteIndisponivel(`404 em ${url}`);
    if (!r.ok) throw new FonteIndisponivel(`${host} respondeu ${r.status}`);
    return { dados: (await r.json()) as T, headers: r.headers };
  }
}

/** Monta a query string ignorando valores vazios. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  return p.toString();
}
