"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { COR_PARTIDO } from "@/lib/bancadas";

const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const TODOS = "todos";

interface Props {
  /** Sigla escolhida, ou "todos". */
  valor: string;
  /** Partidos presentes na lista, com quantas pessoas cada um tem. */
  partidos: [sigla: string, n: number][];
  total: number;
  aoEscolher: (sigla: string) => void;
}

/**
 * Seletor de partido com busca, cor de cada partido e barra do tamanho da bancada.
 * Mesmo desenho do seletor de estado, abrindo para baixo; navegável por setas, Enter e Esc.
 */
export function SeletorPartido({ valor, partidos, total, aoEscolher }: Props) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const id = useId();

  // Do maior para o menor, como na legenda do arco.
  const opcoes = useMemo(() => {
    const q = normalizar(busca.trim());
    const ordenados = [...partidos].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt-BR"));
    const filtrados = ordenados.filter(([s]) => !q || normalizar(s).includes(q));
    return [...(q ? [] : [[TODOS, total] as [string, number]]), ...filtrados];
  }, [partidos, total, busca]);

  const maior = Math.max(1, ...partidos.map(([, n]) => n));
  const nAtual = valor === TODOS ? total : (partidos.find(([s]) => s === valor)?.[1] ?? 0);

  useEffect(() => {
    if (!aberto) return;
    const fora = (ev: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(ev.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    setBusca("");
    campo.current?.focus({ preventScroll: true });
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    setAtivo(Math.max(0, opcoes.findIndex(([s]) => s === valor)));
    // Só ao abrir: depois a seta do teclado manda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  useEffect(() => {
    // Rola só a lista (scrollIntoView também rolaria a página).
    const caixa = lista.current;
    const item = caixa?.querySelector<HTMLElement>(`[data-indice="${ativo}"]`);
    if (!caixa || !item) return;
    if (item.offsetTop < caixa.scrollTop) caixa.scrollTop = item.offsetTop - 6;
    else if (item.offsetTop + item.offsetHeight > caixa.scrollTop + caixa.clientHeight)
      caixa.scrollTop = item.offsetTop + item.offsetHeight - caixa.clientHeight + 6;
  }, [ativo]);

  const escolher = (sigla: string) => {
    aoEscolher(sigla);
    setAberto(false);
  };

  const teclado = (ev: KeyboardEvent) => {
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      setAtivo((i) => Math.min(i + 1, opcoes.length - 1));
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      const o = opcoes[ativo];
      if (o) escolher(o[0]);
    } else if (ev.key === "Escape") {
      setAberto(false);
    }
  };

  return (
    <div className="seletor seletor-abaixo" ref={raiz}>
      <button
        type="button"
        className="seletor-botao seletor-botao-partido"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={`${id}-lista`}
        onClick={() => setAberto((a) => !a)}
      >
        <Marca sigla={valor} />
        <span className="seletor-texto">
          <span className="seletor-rotulo">Partido</span>
          <span className="seletor-nome">
            {valor === TODOS ? "Todos os partidos" : valor}{" "}
            <span className="seletor-conta">· {nAtual}</span>
          </span>
        </span>
        {valor !== TODOS && (
          <span
            role="button"
            tabIndex={0}
            className="seletor-limpar"
            aria-label="Mostrar todos os partidos"
            onClick={(ev) => {
              ev.stopPropagation();
              escolher(TODOS);
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" || ev.key === " ") {
                ev.preventDefault();
                ev.stopPropagation();
                escolher(TODOS);
              }
            }}
          >
            ×
          </span>
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
            <span className="sr-only">Buscar partido</span>
            <input
              ref={campo}
              type="text"
              value={busca}
              placeholder="Buscar partido"
              onChange={(ev) => {
                setBusca(ev.target.value);
                setAtivo(0);
              }}
              onKeyDown={teclado}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-lista`}
              aria-activedescendant={opcoes[ativo] ? `${id}-${ativo}` : undefined}
              autoComplete="off"
            />
          </label>

          <ul className="seletor-lista" role="listbox" id={`${id}-lista`} ref={lista} aria-label="Partidos">
            {opcoes.length === 0 && <li className="seletor-vazio">Nenhum partido encontrado</li>}
            {opcoes.map(([sigla, n], i) => {
              const marcado = sigla === valor;
              const todos = sigla === TODOS;
              return (
                <li key={sigla} role="presentation">
                  {todos && <p className="seletor-grupo" aria-hidden="true">Sem filtro</p>}
                  {i === 1 && !busca && (
                    <p className="seletor-grupo" aria-hidden="true">
                      Do maior para o menor
                    </p>
                  )}
                  <div
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={marcado}
                    data-indice={i}
                    className={`seletor-opcao${i === ativo ? " seletor-opcao-ativa" : ""}${marcado ? " seletor-opcao-marcada" : ""}`}
                    onMouseEnter={() => setAtivo(i)}
                    onMouseDown={(ev) => ev.preventDefault()}
                    onClick={() => escolher(sigla)}
                  >
                    <Marca sigla={sigla} pequena />
                    <span className="seletor-opcao-nome">
                      {todos ? "Todos os partidos" : sigla}
                      {!todos && (
                        <span className="seletor-barra" aria-hidden="true">
                          <span
                            style={{ width: `${(n / maior) * 100}%`, background: COR_PARTIDO[sigla] ?? "#9aa5b1" }}
                          />
                        </span>
                      )}
                    </span>
                    <span className="seletor-opcao-dep">
                      {n} {n === 1 ? "pessoa" : "pessoas"}
                    </span>
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

/** Quadradinho com a cor do partido; para "todos", um mosaico das cores. */
function Marca({ sigla, pequena = false }: { sigla: string; pequena?: boolean }) {
  if (sigla === TODOS) {
    return (
      <span className={`seletor-uf seletor-mosaico${pequena ? " seletor-uf-pequena" : ""}`} aria-hidden="true">
        {["#1b3f8b", "#cc0000", "#2ba3d8", "#f2a900"].map((c) => (
          <span key={c} style={{ background: c }} />
        ))}
      </span>
    );
  }
  const cor = COR_PARTIDO[sigla] ?? "#9aa5b1";
  return (
    <span
      className={`seletor-uf seletor-uf-partido${pequena ? " seletor-uf-pequena" : ""}`}
      style={{ background: cor, color: textoSobre(cor) }}
      aria-hidden="true"
    >
      {sigla.slice(0, 2)}
    </span>
  );
}

/** Texto branco em cores escuras e escuro em cores claras (luminância relativa). */
function textoSobre(hex: string) {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const canal = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = 0.2126 * canal(r ?? 0) + 0.7152 * canal(g ?? 0) + 0.0722 * canal(b ?? 0);
  return lum > 0.4 ? "#142028" : "#ffffff";
}
