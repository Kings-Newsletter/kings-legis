"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { DEPUTADOS_POR_UF } from "@/lib/bancadas";
import { ESTADOS, REGIOES, type Regiao } from "@/lib/brasil";

/** Remove acentos para a busca: "sao" encontra "São Paulo". */
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const ORDEM_REGIOES: Regiao[] = ["N", "NE", "CO", "SE", "S"];

/** Estados agrupados por região (Norte → Sul) e em ordem alfabética dentro de cada uma. */
const TODOS = [...ESTADOS].sort(
  (a, b) => ORDEM_REGIOES.indexOf(a.regiao) - ORDEM_REGIOES.indexOf(b.regiao) || a.nome.localeCompare(b.nome, "pt-BR"),
);

interface Props {
  valor: string;
  aoEscolher: (uf: string) => void;
}

/**
 * Seletor de estado com busca, agrupado por região e navegável pelo teclado
 * (setas, Enter e Esc). Substitui o <select> nativo, que não aceita estilo nas opções.
 */
export function SeletorEstado({ valor, aoEscolher }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();

  const atual = ESTADOS.find((e) => e.uf === valor);

  const filtrados = useMemo(() => {
    const q = normalizar(busca.trim());
    return TODOS.filter((e) => !q || normalizar(e.nome).includes(q) || e.uf.toLowerCase() === q);
  }, [busca]);

  // Fecha ao clicar fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(ev.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // Ao abrir, foca a busca e marca o estado atual.
  useEffect(() => {
    if (!aberto) return;
    setBusca("");
    setAtivo(Math.max(0, TODOS.findIndex((e) => e.uf === valor)));
    campo.current?.focus();
  }, [aberto, valor]);

  // Mantém a opção ativa visível ao navegar pelo teclado.
  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  const escolher = (uf: string) => {
    aoEscolher(uf);
    setAberto(false);
  };

  const teclado = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setAtivo((i) => Math.min(i + 1, filtrados.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const e = filtrados[ativo];
      if (e) escolher(e.uf);
    } else if (ev.key === "Escape") {
      setAberto(false);
    }
  };

  let regiaoAnterior: Regiao | null = null;

  return (
    <div className="seletor" ref={raiz}>
      <button
        type="button"
        className="seletor-botao"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        onClick={() => setAberto((a) => !a)}
      >
        {!atual && (
          <span className="seletor-texto">
            <span className="seletor-rotulo">Estado</span>
            <span className="seletor-nome">Escolha um estado</span>
          </span>
        )}
        {atual && (
          <>
            <span className="seletor-uf" style={{ background: REGIOES[atual.regiao].cor }}>
              {atual.uf}
            </span>
            <span className="seletor-texto">
              <span className="seletor-rotulo">Estado</span>
              <span className="seletor-nome">{atual.nome}</span>
            </span>
          </>
        )}
        <svg className="seletor-seta" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {aberto && (
        <div className="seletor-painel">
          <label className="seletor-busca">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <span className="sr-only">Buscar estado</span>
            <input
              ref={campo}
              type="text"
              value={busca}
              placeholder="Buscar estado ou sigla"
              onChange={(ev) => {
                setBusca(ev.target.value);
                setAtivo(0);
              }}
              onKeyDown={teclado}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-lista`}
              aria-activedescendant={filtrados[ativo] ? `${id}-${filtrados[ativo]!.uf}` : undefined}
              autoComplete="off"
            />
          </label>

          <ul className="seletor-lista" role="listbox" id={`${id}-lista`} ref={lista} aria-label="Estados">
            {filtrados.length === 0 && <li className="seletor-vazio">Nenhum estado encontrado</li>}
            {filtrados.map((e, i) => {
              const cabecalho = e.regiao !== regiaoAnterior;
              regiaoAnterior = e.regiao;
              const marcado = e.uf === valor;
              return (
                <li key={e.uf} role="presentation">
                  {cabecalho && (
                    <p className="seletor-grupo" aria-hidden="true">
                      {REGIOES[e.regiao].nome}
                    </p>
                  )}
                  <div
                    id={`${id}-${e.uf}`}
                    role="option"
                    aria-selected={marcado}
                    data-indice={i}
                    className={`seletor-opcao${i === ativo ? " seletor-opcao-ativa" : ""}${marcado ? " seletor-opcao-marcada" : ""}`}
                    onMouseEnter={() => setAtivo(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => escolher(e.uf)}
                  >
                    <span className="seletor-uf" style={{ background: REGIOES[e.regiao].cor }}>
                      {e.uf}
                    </span>
                    <span className="seletor-opcao-nome">{e.nome}</span>
                    <span className="seletor-opcao-dep">{DEPUTADOS_POR_UF[e.uf] ?? "—"} dep.</span>
                    {marcado && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
