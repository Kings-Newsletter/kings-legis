"use client";

import { createContext, useContext, type ReactNode } from "react";

import { RETRATO, type Composicao } from "@/lib/bancadas";

const Contexto = createContext<Composicao>(RETRATO);

/** Leva a composição do Congresso (buscada no servidor, no layout) aos componentes de cliente. */
export function ComposicaoProvider({ valor, children }: { valor: Composicao; children: ReactNode }) {
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useComposicao(): Composicao {
  return useContext(Contexto);
}
