"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";

import { COR_PARTIDO } from "@/lib/bancadas";
import type { Cargo, Parlamentar } from "@/lib/parlamentares";

import { SeletorPartido } from "./seletor-partido";

/** Os cargos agrupados como aparecem nos filtros. */
const GRUPOS: { id: string; rotulo: string; cargos: Cargo[] }[] = [
  { id: "senado", rotulo: "Senado", cargos: ["Senador(a)"] },
  { id: "camara", rotulo: "Câmara dos Deputados", cargos: ["Deputado(a) federal"] },
  { id: "governo", rotulo: "Governo do estado", cargos: ["Governador(a)", "Vice-governador(a)"] },
  { id: "assembleia", rotulo: "Assembleia", cargos: ["Deputado(a) estadual", "Deputado(a) distrital"] },
  { id: "prefeitura", rotulo: "Prefeitura", cargos: ["Prefeito(a)", "Vice-prefeito(a)"] },
  { id: "camara-municipal", rotulo: "Câmara municipal", cargos: ["Vereador(a)"] },
];

const LETRAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function inicial(nome: string) {
  const l = semAcento(nome).charAt(0).toUpperCase();
  return LETRAS.includes(l) ? l : "#";
}

interface Props {
  lugar: string;
  pessoas: Parlamentar[];
  /** Observação abaixo do título (o que a lista não cobre). */
  nota?: ReactNode;
}

/**
 * Todo mundo eleito para um lugar, de A a Z: busca por nome, filtro por cargo e por
 * partido e índice de letras que rola a lista até a letra.
 */
export function DiretorioPoliticos({ lugar, pessoas, nota }: Props) {
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("todos");
  const [partido, setPartido] = useState("todos");
  const lista = useRef<HTMLDivElement>(null);

  const grupos = GRUPOS.map((g) => ({ ...g, n: pessoas.filter((p) => g.cargos.includes(p.cargo)).length })).filter(
    (g) => g.n > 0,
  );
  const grupoAtivo = grupos.find((g) => g.id === grupo);

  const partidos = useMemo(() => {
    const conta = new Map<string, number>();
    for (const p of pessoas) conta.set(p.partido, (conta.get(p.partido) ?? 0) + 1);
    return [...conta.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [pessoas]);

  const filtradas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return pessoas
      .filter((p) => !grupoAtivo || grupoAtivo.cargos.includes(p.cargo))
      .filter((p) => partido === "todos" || p.partido === partido)
      .filter((p) => !termo || semAcento(p.nome).includes(termo))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [pessoas, grupoAtivo, partido, busca]);

  const porLetra = useMemo(() => {
    const mapa = new Map<string, Parlamentar[]>();
    for (const p of filtradas) {
      const l = inicial(p.nome);
      mapa.set(l, [...(mapa.get(l) ?? []), p]);
    }
    return mapa;
  }, [filtradas]);

  const irPara = (letra: string) => {
    const caixa = lista.current;
    const alvo = caixa?.querySelector<HTMLElement>(`[data-letra="${letra}"]`);
    if (caixa && alvo) caixa.scrollTo({ top: alvo.offsetTop - caixa.offsetTop, behavior: "smooth" });
  };

  if (!pessoas.length) return null;

  return (
    <section className="lugar-bloco" aria-label={`Todos os eleitos: ${lugar}`}>
      <div>
        <p className="lugar-sobre">Todo mundo eleito para</p>
        <h3 className="lugar-titulo">{lugar}</h3>
        {nota && <p className="muted small">{nota}</p>}
      </div>

      <label className="diretorio-busca">
        <span className="sr-only">Buscar pelo nome</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Digite o nome de um político"
          autoComplete="off"
        />
      </label>

      <div className="diretorio-filtros">
        <ul className="diretorio-cargos" aria-label="Filtrar por cargo">
          <li>
            <button type="button" aria-pressed={!grupoAtivo} onClick={() => setGrupo("todos")}>
              Todos os cargos <span>{pessoas.length}</span>
            </button>
          </li>
          {grupos.map((g) => (
            <li key={g.id}>
              <button type="button" aria-pressed={grupoAtivo?.id === g.id} onClick={() => setGrupo(g.id)}>
                {g.rotulo} <span>{g.n}</span>
              </button>
            </li>
          ))}
        </ul>

        <div className="diretorio-linha">
          <SeletorPartido valor={partido} partidos={partidos} total={pessoas.length} aoEscolher={setPartido} />
          <p className="diretorio-conta" aria-live="polite">
            <strong>{filtradas.length}</strong> {filtradas.length === 1 ? "pessoa" : "pessoas"}, de A a Z
          </p>
        </div>

        <ol className="diretorio-letras" aria-label="Ir para a letra">
          {LETRAS.map((l) => (
            <li key={l}>
              <button type="button" disabled={!porLetra.has(l)} onClick={() => irPara(l)}>
                {l}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="diretorio-lista" ref={lista}>
        {filtradas.length === 0 ? (
          <p className="muted">Ninguém com esse nome e esses filtros.</p>
        ) : (
          [...porLetra.entries()].map(([letra, gente]) => (
            <div key={letra} className="diretorio-grupo" data-letra={letra}>
              <p className="diretorio-letra" aria-hidden="true">
                {letra}
              </p>
              <ul>
                {gente.map((p) => (
                  <li key={p.id}>
                    <Pessoa p={p} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Pessoa({ p }: { p: Parlamentar }) {
  const conteudo = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.foto} alt="" loading="lazy" width={72} height={72} />
      <span className="pessoa-nome">{p.nome}</span>
      <span className="pessoa-cargo">
        {p.cargo} · {p.uf}
      </span>
      <span className="pessoa-partido">
        <i style={{ background: COR_PARTIDO[p.partido] ?? "#9aa5b1" }} aria-hidden="true" />
        {p.partido}
      </span>
    </>
  );
  return p.url ? (
    <a className="pessoa" href={p.url} target="_blank" rel="noopener noreferrer">
      {conteudo}
    </a>
  ) : (
    <div className="pessoa">{conteudo}</div>
  );
}

/** Quem governa (e, no estado, quem está no Senado), em cartões grandes com foto. */
export function QuemGoverna({ titulo, pessoas, nota }: { titulo: string; pessoas: Parlamentar[]; nota?: string }) {
  if (!pessoas.length) return null;
  return (
    <section className="lugar-bloco" aria-label={titulo}>
      <h3>{titulo}</h3>
      <ul className="governa-lista">
        {pessoas.map((p) => (
          <li key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.foto} alt="" loading="lazy" />
            <span className="pessoa-nome">{p.nome}</span>
            <span className="pessoa-cargo">
              {p.cargo} · {p.partido}
            </span>
          </li>
        ))}
      </ul>
      {nota && <p className="muted small">{nota}</p>}
    </section>
  );
}
