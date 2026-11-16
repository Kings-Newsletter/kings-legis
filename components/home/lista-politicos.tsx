"use client";

import type { ReactNode } from "react";

import { COR_PARTIDO } from "@/lib/bancadas";
import type { Parlamentar } from "@/lib/parlamentares";

interface Props {
  titulo: string;
  pessoas: Parlamentar[];
  mostrarUf?: boolean;
  nota?: string;
}

export function ListaPoliticos({ titulo, pessoas, mostrarUf = false, nota }: Props) {
  if (!pessoas.length) return null;
  return (
    <section className="politicos">
      <h3 className="politicos-titulo">
        {titulo} <span>{pessoas.length}</span>
      </h3>
      {nota && <p className="politicos-nota">{nota}</p>}
      <ul className="politicos-lista">
        {pessoas.map((p) => (
          <li key={p.id}>
            <Item url={p.url}>
              {/* Fotos oficiais da Câmara e do Senado. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.foto} alt="" loading="lazy" width={44} height={44} className="politico-foto" />
              <span className="politico-texto">
                <span className="politico-nome">{p.nome}</span>
                <span className="politico-cargo">
                  {p.cargo}
                  {mostrarUf ? ` · ${p.uf}` : ""}
                </span>
              </span>
              <span className="politico-partido" style={{ borderColor: COR_PARTIDO[p.partido] ?? "#9aa5b1" }}>
                {p.partido}
              </span>
            </Item>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Com página oficial, a linha vira link; sem ela, fica só o cartão. */
function Item({ url, children }: { url: string; children: ReactNode }) {
  return url ? (
    <a href={url} className="politico" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <div className="politico">{children}</div>
  );
}
