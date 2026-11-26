"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export interface Opcao {
  valor: string;
  rotulo: string;
  /** Texto menor à direita (ex.: nome completo do tipo). */
  detalhe?: string;
}

interface Props {
  nome: string;
  rotulo: string;
  opcoes: Opcao[];
  valorInicial?: string;
  /** Mostra uma busca no topo da lista quando há muitas opções. */
  busca?: boolean;
}

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Seletor com a lista desenhada pelo site (o <select> nativo não deixa estilizar as
 * opções). O valor vai num input escondido, então o formulário GET continua igual.
 * Teclado: setas, Home/End, Enter, Esc e digitar para buscar.
 */
export function Escolha({ nome, rotulo, opcoes, valorInicial = "", busca }: Props) {
  const id = useId();
  const [valor, setValor] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  // Perto da borda direita da tela, o painel abre alinhado à direita do campo.
  const [aDireita, setADireita] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [ativo, setAtivo] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const campoBusca = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const comBusca = busca ?? opcoes.length > 12;

  const visiveis = useMemo(() => {
    const q = normalizar(filtro.trim());
    return q ? opcoes.filter((o) => normalizar(`${o.rotulo} ${o.detalhe ?? ""}`).includes(q)) : opcoes;
  }, [opcoes, filtro]);

  const atual = opcoes.find((o) => o.valor === valor) ?? opcoes[0];

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    (comBusca ? campoBusca.current : lista.current)?.focus();
  }, [aberto, comBusca]);

  useEffect(() => {
    lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" });
  }, [ativo, aberto]);

  function abrir() {
    // Abre para a esquerda quando o painel (até 320 px) passaria da borda do formulário ou da tela.
    const r = caixa.current?.getBoundingClientRect();
    const borda = Math.min(caixa.current?.closest("form")?.getBoundingClientRect().right ?? Infinity, window.innerWidth - 16);
    setADireita(Boolean(r && r.left + 320 > borda));
    setFiltro("");
    setAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    setAberto(true);
  }

  function escolher(o: Opcao) {
    setValor(o.valor);
    setAberto(false);
    botao.current?.focus();
  }

  function teclado(e: KeyboardEvent) {
    if (!aberto) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setAberto(false);
      botao.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAtivo((a) => Math.min(a + 1, visiveis.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAtivo((a) => Math.max(a - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setAtivo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAtivo(visiveis.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = visiveis[ativo];
      if (o) escolher(o);
    } else if (e.key === "Tab") {
      setAberto(false);
    } else if (!comBusca && e.key.length === 1) {
      // Sem campo de busca: a primeira letra pula para a opção.
      const i = visiveis.findIndex((o) => normalizar(o.rotulo).startsWith(normalizar(e.key)));
      if (i >= 0) setAtivo(i);
    }
  }

  return (
    <div className="filtro" ref={caixa} onKeyDown={teclado}>
      <span id={`${id}-rotulo`}>{rotulo}</span>
      <input type="hidden" name={nome} value={valor} />
      <button
        ref={botao}
        type="button"
        className="campo campo-escolha"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-labelledby={`${id}-rotulo ${id}-valor`}
        onClick={() => (aberto ? setAberto(false) : abrir())}
      >
        <span id={`${id}-valor`} className={valor ? "campo-valor" : "campo-valor campo-vazio"}>
          {atual?.rotulo}
        </span>
        <svg className="campo-seta" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {aberto && (
        <div className={aDireita ? "popover popover-direita" : "popover"}>
          {comBusca && (
            <div className="seletor-busca">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                ref={campoBusca}
                type="text"
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  setAtivo(0);
                }}
                placeholder={`Buscar ${rotulo.toLowerCase()}`}
                aria-label={`Buscar ${rotulo.toLowerCase()}`}
                aria-controls={`${id}-lista`}
                aria-activedescendant={visiveis[ativo] ? `${id}-op-${ativo}` : undefined}
              />
            </div>
          )}
          <ul
            ref={lista}
            id={`${id}-lista`}
            className="seletor-lista"
            role="listbox"
            tabIndex={-1}
            aria-labelledby={`${id}-rotulo`}
            aria-activedescendant={visiveis[ativo] ? `${id}-op-${ativo}` : undefined}
          >
            {visiveis.map((o, i) => {
              const marcada = o.valor === valor;
              return (
                <li
                  key={o.valor || "todos"}
                  id={`${id}-op-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={marcada}
                  className={[
                    "seletor-opcao",
                    i === ativo ? "seletor-opcao-ativa" : "",
                    marcada ? "seletor-opcao-marcada" : "",
                  ].join(" ")}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(o)}
                >
                  <span className="seletor-opcao-nome">
                    {o.rotulo}
                    {o.detalhe && <span className="opcao-detalhe"> {o.detalhe}</span>}
                  </span>
                  {marcada && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M5 12l5 5 9-10" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </li>
              );
            })}
            {!visiveis.length && <li className="seletor-vazio">Nada encontrado</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
