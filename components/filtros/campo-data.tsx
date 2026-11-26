"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

interface Props {
  nome: string;
  rotulo: string;
  /** AAAA-MM-DD */
  valorInicial?: string;
}

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];
const DIAS_SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];
const DIAS_SEMANA_NOME = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Datas como AAAA-MM-DD, sem fuso: o calendário é só de dias. */
const iso = (a: number, m: number, d: number) =>
  `${a}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const partes = (s: string) => {
  const [a, m, d] = s.split("-").map(Number);
  return { a: a!, m: m! - 1, d: d! };
};
const hoje = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
const somarDias = (s: string, n: number) => {
  const { a, m, d } = partes(s);
  const x = new Date(Date.UTC(a, m, d + n));
  return iso(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};
const somarMeses = (s: string, n: number) => {
  const { a, m, d } = partes(s);
  const ultimo = new Date(Date.UTC(a, m + n + 1, 0)).getUTCDate();
  const x = new Date(Date.UTC(a, m + n, Math.min(d, ultimo)));
  return iso(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
};
const dataBr = (s: string) => s.split("-").reverse().join("/");
const porExtenso = (s: string) => {
  const { a, m, d } = partes(s);
  const dia = new Date(Date.UTC(a, m, d)).getUTCDay();
  return `${DIAS_SEMANA_NOME[dia]}, ${d} de ${MESES[m]} de ${a}`;
};

/**
 * Campo de data com calendário desenhado pelo site (o calendário do
 * <input type="date"> é do navegador e não aceita estilo). O valor vai num input
 * escondido em AAAA-MM-DD. Teclado no calendário: setas (dia/semana), PageUp/PageDown
 * (mês), Home/End (semana), Enter escolhe, Esc fecha.
 */
export function CampoData({ nome, rotulo, valorInicial = "" }: Props) {
  const id = useId();
  const [valor, setValor] = useState(valorInicial);
  const [aberto, setAberto] = useState(false);
  // Perto da borda direita da tela, o painel abre alinhado à direita do campo.
  const [aDireita, setADireita] = useState(false);
  const [foco, setFoco] = useState(valorInicial || hoje());
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const grade = useRef<HTMLDivElement>(null);

  const { a: ano, m: mes } = partes(foco);

  const semanas = useMemo(() => {
    const primeiro = new Date(Date.UTC(ano, mes, 1)).getUTCDay();
    const total = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
    const celulas: (string | null)[] = [
      ...Array.from({ length: primeiro }, () => null),
      ...Array.from({ length: total }, (_, i) => iso(ano, mes, i + 1)),
    ];
    while (celulas.length % 7) celulas.push(null);
    return Array.from({ length: celulas.length / 7 }, (_, i) => celulas.slice(i * 7, i * 7 + 7));
  }, [ano, mes]);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  // O dia em foco recebe o foco do teclado sempre que muda.
  useEffect(() => {
    if (aberto) grade.current?.querySelector<HTMLButtonElement>(`[data-dia="${foco}"]`)?.focus();
  }, [aberto, foco]);

  function abrir() {
    // Abre para a esquerda quando o painel (até 320 px) passaria da borda do formulário ou da tela.
    const r = caixa.current?.getBoundingClientRect();
    const borda = Math.min(caixa.current?.closest("form")?.getBoundingClientRect().right ?? Infinity, window.innerWidth - 16);
    setADireita(Boolean(r && r.left + 320 > borda));
    setFoco(valor || hoje());
    setAberto(true);
  }

  function fechar() {
    setAberto(false);
    botao.current?.focus();
  }

  function escolher(d: string) {
    setValor(d);
    fechar();
  }

  function teclado(e: KeyboardEvent) {
    const mover: Record<string, () => string> = {
      ArrowLeft: () => somarDias(foco, -1),
      ArrowRight: () => somarDias(foco, 1),
      ArrowUp: () => somarDias(foco, -7),
      ArrowDown: () => somarDias(foco, 7),
      PageUp: () => somarMeses(foco, e.shiftKey ? -12 : -1),
      PageDown: () => somarMeses(foco, e.shiftKey ? 12 : 1),
      Home: () => somarDias(foco, -new Date(Date.UTC(ano, mes, partes(foco).d)).getUTCDay()),
      End: () => somarDias(foco, 6 - new Date(Date.UTC(ano, mes, partes(foco).d)).getUTCDay()),
    };
    if (mover[e.key]) {
      e.preventDefault();
      setFoco(mover[e.key]!());
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    }
  }

  const diaDeHoje = hoje();

  return (
    <div className="filtro" ref={caixa}>
      <span id={`${id}-rotulo`}>{rotulo}</span>
      <input type="hidden" name={nome} value={valor} />
      <div className="campo campo-data-caixa">
        <button
          ref={botao}
          type="button"
          className="campo-data"
          aria-haspopup="dialog"
          aria-expanded={aberto}
          aria-labelledby={`${id}-rotulo ${id}-valor`}
          onClick={() => (aberto ? setAberto(false) : abrir())}
        >
          <svg className="campo-icone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="3" y="5" width="18" height="16" rx="3" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <span id={`${id}-valor`} className={valor ? "campo-valor" : "campo-valor campo-vazio"}>
            {valor ? dataBr(valor) : "Qualquer data"}
          </span>
        </button>
        {valor && (
          <button type="button" className="campo-limpar" aria-label={`Limpar ${rotulo.toLowerCase()}`} onClick={() => setValor("")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      {aberto && (
        <div className={aDireita ? "popover popover-direita calendario" : "popover calendario"} role="dialog" aria-modal="false" aria-label={`${rotulo}: escolher data`} onKeyDown={teclado}>
          <div className="calendario-topo">
            <button type="button" className="calendario-nav" aria-label="Mês anterior" onClick={() => setFoco(somarMeses(foco, -1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="calendario-mes" aria-live="polite">
              {MESES[mes]} <span>{ano}</span>
            </p>
            <button type="button" className="calendario-nav" aria-label="Próximo mês" onClick={() => setFoco(somarMeses(foco, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="calendario-grade" role="grid" ref={grade} aria-label={`${MESES[mes]} de ${ano}`}>
            <div className="calendario-semana calendario-cabecalho" role="row">
              {DIAS_SEMANA.map((d, i) => (
                <span key={i} role="columnheader" aria-label={DIAS_SEMANA_NOME[i]}>
                  {d}
                </span>
              ))}
            </div>
            {semanas.map((semana, i) => (
              <div key={i} className="calendario-semana" role="row">
                {semana.map((d, j) =>
                  d ? (
                    <button
                      key={d}
                      type="button"
                      role="gridcell"
                      data-dia={d}
                      tabIndex={d === foco ? 0 : -1}
                      aria-selected={d === valor}
                      aria-current={d === diaDeHoje ? "date" : undefined}
                      aria-label={porExtenso(d)}
                      className={[
                        "calendario-dia",
                        d === valor ? "calendario-dia-marcado" : "",
                        d === diaDeHoje ? "calendario-dia-hoje" : "",
                      ].join(" ")}
                      onClick={() => escolher(d)}
                      onFocus={() => setFoco(d)}
                    >
                      {partes(d).d}
                    </button>
                  ) : (
                    <span key={`v${j}`} role="gridcell" aria-hidden="true" />
                  ),
                )}
              </div>
            ))}
          </div>

          <div className="calendario-rodape">
            <button type="button" className="calendario-acao" onClick={() => escolher(diaDeHoje)}>
              Hoje
            </button>
            {valor && (
              <button
                type="button"
                className="calendario-acao"
                onClick={() => {
                  setValor("");
                  fechar();
                }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
