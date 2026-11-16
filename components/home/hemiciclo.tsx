"use client";

import { useMemo, useState } from "react";

import { posicoes } from "@/lib/arco";
import { COMPOSICAO, DATA_CONSULTA, type Casa } from "@/lib/bancadas";

export function Hemiciclo() {
  const [casa, setCasa] = useState<Casa>("camara");
  const [fixo, setFixo] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const dados = COMPOSICAO[casa];

  const cadeiras = useMemo(() => {
    const pos = posicoes(dados.total, dados.fileiras);
    const out: { x: number; y: number; sigla: string; cor: string; ordem: number }[] = [];
    for (const g of dados.grupos) {
      for (let i = 0; i < g.n; i++) {
        const p = pos[out.length];
        if (p) out.push({ x: p.x, y: p.y, sigla: g.sigla, cor: g.cor, ordem: out.length });
      }
    }
    return out;
  }, [dados]);

  // O passar do mouse tem prioridade sobre o partido fixado com clique.
  const foco = hover ?? fixo;
  const raio = casa === "camara" ? 4.6 : 11;
  const grupo = dados.grupos.find((g) => g.sigla === foco);
  const pct = (n: number) => ((n / dados.total) * 100).toFixed(1).replace(".", ",");
  // Animação de entrada: as cadeiras surgem da esquerda para a direita em ~0,8 s.
  const passo = 800 / dados.total;

  const trocar = (c: Casa) => {
    setCasa(c);
    setFixo(null);
    setHover(null);
  };

  return (
    <article className="card hemiciclo" aria-labelledby="casa-titulo">
      <div className="card-head">
        <h2 id="casa-titulo">Como está o Congresso</h2>
        <div className="segmentado" role="group" aria-label="Casa">
          <button type="button" aria-pressed={casa === "camara"} onClick={() => trocar("camara")}>
            Câmara · 513
          </button>
          <button type="button" aria-pressed={casa === "senado"} onClick={() => trocar("senado")}>
            Senado · 81
          </button>
        </div>
      </div>

      <svg
        key={casa}
        viewBox="0 0 500 262"
        role="img"
        aria-label={`Composição do ${dados.nome} em arco, um ponto por cadeira, partidos do maior para o menor`}
        className="hemiciclo-svg"
        onMouseLeave={() => setHover(null)}
      >
        {cadeiras.map((c) => {
          const apagada = foco !== null && foco !== c.sigla;
          const destaque = foco === c.sigla;
          return (
            <circle
              key={c.ordem}
              cx={c.x}
              cy={c.y}
              r={raio}
              fill={c.cor}
              className={`cadeira${apagada ? " cadeira-apagada" : ""}${destaque ? " cadeira-destaque" : ""}`}
              style={{ animationDelay: `${Math.round(c.ordem * passo)}ms` }}
              onMouseEnter={() => setHover(c.sigla)}
              onClick={() => setFixo(fixo === c.sigla ? null : c.sigla)}
            />
          );
        })}
        <text key={foco ?? "total"} x={250} y={228} textAnchor="middle" className="hemiciclo-num">
          {grupo ? grupo.n : dados.total}
        </text>
        <text x={250} y={250} textAnchor="middle" className="hemiciclo-txt">
          {grupo ? `${grupo.sigla} · ${pct(grupo.n)}%` : "passe o mouse num partido"}
        </text>
      </svg>

      <ul className="chips" aria-label="Bancadas, da maior para a menor" onMouseLeave={() => setHover(null)}>
        {dados.grupos.map((g) => {
          const ativo = foco === g.sigla;
          return (
            <li key={g.sigla}>
              <button
                type="button"
                className={`chip${ativo ? " chip-ativo" : ""}`}
                aria-pressed={fixo === g.sigla}
                onMouseEnter={() => setHover(g.sigla)}
                onFocus={() => setHover(g.sigla)}
                onBlur={() => setHover(null)}
                onClick={() => setFixo(fixo === g.sigla ? null : g.sigla)}
              >
                <span className="chip-cor" style={{ background: g.cor }} aria-hidden="true" />
                {g.sigla} <strong>{g.n}</strong>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="muted small">
        {dados.maioria}. Ordem por tamanho da bancada, sem classificação ideológica. Fonte:{" "}
        {casa === "camara" ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos, consulta em {DATA_CONSULTA}.
      </p>
    </article>
  );
}
