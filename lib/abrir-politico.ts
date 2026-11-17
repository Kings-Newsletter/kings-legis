import type { Parlamentar } from "./parlamentares";

/** Evento que abre o pop-up de um político; o componente PopupPolitico, no layout, escuta. */
export const EVENTO_ABRIR_POLITICO = "kings:abrir-politico";

export function abrirPolitico(p: Parlamentar) {
  window.dispatchEvent(new CustomEvent<Parlamentar>(EVENTO_ABRIR_POLITICO, { detail: p }));
}

export function urlPolitico(id: string) {
  return `/legis/politico/${encodeURIComponent(id)}`;
}
