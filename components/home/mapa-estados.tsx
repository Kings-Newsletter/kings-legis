"use client";

import Link from "next/link";
import { useState } from "react";

import { ESTADOS, MAPA_VIEWBOX, REGIOES } from "@/lib/brasil";

const opcoes = [...ESTADOS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export function MapaEstados() {
  const [sel, setSel] = useState("SP");
  const atual = ESTADOS.find((e) => e.uf === sel) ?? ESTADOS[0]!;
  // O estado selecionado é desenhado por último, para o contorno ficar por cima.
  const ordem = [...ESTADOS].sort((a, b) => Number(a.uf === sel) - Number(b.uf === sel));

  return (
    <section className="card estados" aria-labelledby="estados-titulo">
      <div className="estados-mapa">
        <h2 id="estados-titulo">Seu estado no Congresso</h2>
        <svg
          viewBox={MAPA_VIEWBOX}
          role="img"
          aria-label="Mapa do Brasil por estado; o estado selecionado aparece em destaque"
          className="mapa-svg"
        >
          {ordem.map((e) => {
            const ativo = e.uf === sel;
            return (
              <path
                key={e.uf}
                d={e.path}
                onClick={() => setSel(e.uf)}
                fill={ativo ? "#142a33" : REGIOES[e.regiao].cor}
                stroke={ativo ? "#7fd0d9" : "#ffffff"}
                strokeWidth={ativo ? 2.5 : 1}
                className="mapa-uf"
              >
                <title>{e.nome}</title>
              </path>
            );
          })}
        </svg>
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
          Mapa: <a href="https://github.com/VictorCazanave/svg-maps">svg-maps</a>, de Victor
          Cazanave, licença <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>.
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
            <p className="painel-num">—</p>
          </div>
        </div>
        <p className="painel-aviso">
          Bancada, proposições e gastos do estado entram quando a coleta da Câmara e do Senado
          estiver ligada.
        </p>
        <div className="painel-acoes">
          <Link href={`/legis/proposicoes?uf=${atual.uf}`} className="btn btn-claro">
            Ver proposições
          </Link>
        </div>
      </aside>
    </section>
  );
}
