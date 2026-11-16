"use client";

import Link from "next/link";
import { useState } from "react";

import { DATA_CONSULTA, DEPUTADOS_POR_UF } from "@/lib/bancadas";
import { ESTADOS, MAPA_VIEWBOX, REGIOES, type Regiao } from "@/lib/brasil";

type Camada = "regiao" | "bancada";

const opcoes = [...ESTADOS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

/** Escala fria de 5 faixas para o tamanho da bancada, do mais claro ao mais escuro. */
const FAIXAS = [
  { ate: 8, cor: "#dcebf0", rotulo: "8" },
  { ate: 12, cor: "#b5d5df", rotulo: "9 a 12" },
  { ate: 20, cor: "#7fb3c4", rotulo: "13 a 20" },
  { ate: 40, cor: "#3f8fa8", rotulo: "21 a 40" },
  { ate: Infinity, cor: "#1f4e79", rotulo: "41 a 70" },
];

function corBancada(n: number) {
  return (FAIXAS.find((f) => n <= f.ate) ?? FAIXAS[FAIXAS.length - 1]!).cor;
}

export function MapaEstados() {
  const [sel, setSel] = useState("SP");
  const [camada, setCamada] = useState<Camada>("regiao");
  const atual = ESTADOS.find((e) => e.uf === sel) ?? ESTADOS[0]!;
  const ordem = [...ESTADOS].sort((a, b) => Number(a.uf === sel) - Number(b.uf === sel));
  const deputados = DEPUTADOS_POR_UF[atual.uf];

  const porRegiao = (Object.keys(REGIOES) as Regiao[]).map((r) => ({
    r,
    ufs: ESTADOS.filter((e) => e.regiao === r).map((e) => e.uf).sort(),
  }));

  return (
    <section className="card estados" aria-labelledby="estados-titulo">
      <div className="estados-mapa">
        <div className="card-head">
          <h2 id="estados-titulo">Seu estado no Congresso</h2>
          <div className="segmentado" role="group" aria-label="O que o mapa mostra">
            <button type="button" aria-pressed={camada === "regiao"} onClick={() => setCamada("regiao")}>
              Regiões
            </button>
            <button type="button" aria-pressed={camada === "bancada"} onClick={() => setCamada("bancada")}>
              Deputados por estado
            </button>
          </div>
        </div>

        <svg viewBox={MAPA_VIEWBOX} role="img" aria-label="Mapa do Brasil por estado; o estado selecionado aparece em destaque" className="mapa-svg">
          {ordem.map((e) => {
            const ativo = e.uf === sel;
            const base = camada === "regiao" ? REGIOES[e.regiao].cor : corBancada(DEPUTADOS_POR_UF[e.uf] ?? 0);
            return (
              <path
                key={e.uf}
                d={e.path}
                onClick={() => setSel(e.uf)}
                fill={ativo ? "#142a33" : base}
                stroke={ativo ? "#7fd0d9" : "#ffffff"}
                strokeWidth={ativo ? 2.5 : 1}
                className="mapa-uf"
              >
                <title>{e.nome}</title>
              </path>
            );
          })}
        </svg>

        {camada === "regiao" ? (
          <p className="muted small center">As cores indicam apenas a região do IBGE; não representam partido nem avaliação.</p>
        ) : (
          <ul className="legenda-faixas" aria-label="Deputados federais por estado">
            {FAIXAS.map((f) => (
              <li key={f.rotulo}>
                <span style={{ background: f.cor }} aria-hidden="true" />
                {f.rotulo}
              </li>
            ))}
          </ul>
        )}

        <label className="mapa-lista">
          Ou escolha na lista
          <select value={sel} onChange={(ev) => setSel(ev.target.value)}>
            {opcoes.map((e) => (
              <option key={e.uf} value={e.uf}>
                {e.nome}
              </option>
            ))}
          </select>
        </label>
        <p className="muted small center">
          Mapa: <a href="https://github.com/VictorCazanave/svg-maps">svg-maps</a>, de Victor Cazanave, licença{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
        </p>
      </div>

      <aside className="painel-uf" aria-live="polite">
        <div>
          <p className="painel-regiao">{REGIOES[atual.regiao].nome}</p>
          <p className="painel-nome">{atual.nome}</p>
        </div>
        <div className="painel-numeros">
          <div>
            <p>Senadores</p>
            <p className="painel-num">3</p>
          </div>
          <div>
            <p>Deputados federais</p>
            <p className="painel-num">{deputados ?? "—"}</p>
          </div>
        </div>
        <p className="painel-aviso">
          Proposições e gastos da bancada entram quando a coleta estiver ligada. Deputados em
          exercício segundo a Câmara, consulta em {DATA_CONSULTA}.
        </p>
        <div className="painel-acoes">
          <Link href={`/legis/proposicoes?uf=${atual.uf}`} className="btn btn-claro">
            Ver proposições
          </Link>
        </div>
        <ul className="regioes-lista" aria-label="Estados por região">
          {porRegiao.map(({ r, ufs }) => (
            <li key={r}>
              <span className="regioes-num">{ufs.length}</span>
              <span>
                <strong>{REGIOES[r].nome}</strong>
                <br />
                <span className="regioes-ufs">{ufs.join(" · ")}</span>
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}
