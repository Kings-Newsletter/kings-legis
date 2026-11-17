"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EVENTO_ABRIR_POLITICO, urlPolitico } from "@/lib/abrir-politico";
import { COR_PARTIDO } from "@/lib/bancadas";
import { descricaoCampo } from "@/lib/ideologia";
import type { Parlamentar } from "@/lib/parlamentares";
import { PARTIDOS } from "@/lib/partidos";

/** O que a ficha completa traz para cada fonte, para o pop-up antecipar. */
const NA_FICHA: Record<string, string[]> = {
  camara: ["Gastos da cota parlamentar, nota por nota", "Votações e presença no Plenário", "Projetos de autoria", "O que ainda não é público"],
  senado: ["Gastos da cota parlamentar (CEAPS)", "Votações e presença no Plenário", "Projetos de autoria", "O que ainda não é público"],
  tse: ["Bens declarados ao TSE", "Limites de gastos da campanha", "Outras eleições disputadas", "O que ainda não é público"],
};

/**
 * Pop-up com os dados básicos de um político e o atalho para a ficha completa.
 * Montado uma vez no layout; qualquer lista ou arco abre com abrirPolitico(p).
 */
export function PopupPolitico() {
  const [pessoa, setPessoa] = useState<Parlamentar | null>(null);
  const fechar = useRef<HTMLButtonElement>(null);
  const antes = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const abrir = (ev: Event) => {
      antes.current = document.activeElement as HTMLElement | null;
      setPessoa((ev as CustomEvent<Parlamentar>).detail);
    };
    window.addEventListener(EVENTO_ABRIR_POLITICO, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_POLITICO, abrir);
  }, []);

  useEffect(() => {
    if (!pessoa) return;
    fechar.current?.focus();
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        ev.stopPropagation();
        setPessoa(null);
      }
    };
    // Captura: o Esc fecha o pop-up antes de o mapa usá-lo para subir de nível.
    window.addEventListener("keydown", tecla, true);
    const rolagem = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", tecla, true);
      document.body.style.overflow = rolagem;
      antes.current?.focus?.();
    };
  }, [pessoa]);

  if (!pessoa) return null;

  const cor = COR_PARTIDO[pessoa.partido] ?? "#9aa5b1";
  const fonte = pessoa.id.split("-")[0] ?? "tse";
  const partido = PARTIDOS[pessoa.partido];

  return (
    <div className="popup-fundo" onMouseDown={(ev) => ev.target === ev.currentTarget && setPessoa(null)}>
      <div
        className="popup-politico"
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-politico-nome"
        style={{ ["--partido" as string]: cor }}
      >
        <button ref={fechar} type="button" className="popup-fechar" aria-label="Fechar" onClick={() => setPessoa(null)}>
          ×
        </button>
        <div className="popup-topo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pessoa.foto} alt="" width={96} height={96} />
          <div>
            <p className="popup-cargo">
              {pessoa.cargo}
              {pessoa.uf ? ` · ${pessoa.uf}` : ""}
            </p>
            <h2 id="popup-politico-nome">{pessoa.nome}</h2>
            <p className="popup-partido">
              <i aria-hidden="true" />
              <strong>{pessoa.partido}</strong>
              {partido && <span>{partido.nome}</span>}
            </p>
            <p className="popup-campo">{descricaoCampo(pessoa.partido)}</p>
          </div>
        </div>

        <div className="popup-ficha">
          <p>Na página completa:</p>
          <ul>
            {(NA_FICHA[fonte] ?? NA_FICHA.tse!).map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>

        <div className="popup-acoes">
          <Link href={urlPolitico(pessoa.id)} className="btn btn-primario" onClick={() => setPessoa(null)}>
            Ver página completa →
          </Link>
          {pessoa.url && (
            <a href={pessoa.url} target="_blank" rel="noopener noreferrer" className="popup-oficial">
              Página oficial
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
