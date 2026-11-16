"use client";

import { useMemo, useState } from "react";

import { BANCADAS_CONSULTA, DEMAIS, GRUPOS, TOTAL_CADEIRAS } from "@/lib/bancadas";

const FILEIRAS = 12;
const RAIO_INTERNO = 0.4;
const RAIO_PX = 232;
const CENTRO_X = 250;
const BASE_Y = 246;

/** Posição de cada cadeira: fileiras concêntricas, da esquerda para a direita. */
function posicoes(total: number) {
  const raios = Array.from({ length: FILEIRAS }, (_, i) => RAIO_INTERNO + ((1 - RAIO_INTERNO) * i) / (FILEIRAS - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  const porFileira = raios.map((r) => Math.round((total * r) / soma));
  const ultima = FILEIRAS - 1;
  porFileira[ultima] = (porFileira[ultima] ?? 0) + total - porFileira.reduce((a, b) => a + b, 0);

  const lista: { th: number; r: number; x: number; y: number }[] = [];
  raios.forEach((r, i) => {
    const n = porFileira[i]!;
    for (let k = 0; k < n; k++) {
      const th = Math.PI - (Math.PI * k) / (n - 1);
      lista.push({
        th,
        r,
        x: +(CENTRO_X + r * RAIO_PX * Math.cos(th)).toFixed(1),
        y: +(BASE_Y - r * RAIO_PX * Math.sin(th)).toFixed(1),
      });
    }
  });
  return lista.sort((a, b) => b.th - a.th || a.r - b.r);
}

export function Hemiciclo() {
  const [foco, setFoco] = useState<string | null>(null);

  const cadeiras = useMemo(() => {
    const pos = posicoes(TOTAL_CADEIRAS);
    const out: { x: number; y: number; sigla: string; cor: string }[] = [];
    for (const g of GRUPOS) {
      for (let i = 0; i < g.n; i++) {
        const p = pos[out.length];
        if (p) out.push({ x: p.x, y: p.y, sigla: g.sigla, cor: g.cor });
      }
    }
    return out;
  }, []);

  const grupo = GRUPOS.find((g) => g.sigla === foco);
  const pct = (n: number) => ((n / TOTAL_CADEIRAS) * 100).toFixed(1).replace(".", ",");

  return (
    <article className="card hemiciclo" aria-labelledby="camara-titulo">
      <div className="card-head">
        <h2 id="camara-titulo">Câmara dos Deputados</h2>
        <span className="muted small">{TOTAL_CADEIRAS} cadeiras</span>
      </div>

      <svg
        viewBox="0 0 500 262"
        role="img"
        aria-label="Composição da Câmara em arco, um ponto por deputado, partidos do maior para o menor"
        className="hemiciclo-svg"
      >
        {cadeiras.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={4.6}
            fill={c.cor}
            stroke={c.sigla === "Sem dado" ? "#c9d2dc" : "none"}
            opacity={foco && foco !== c.sigla ? 0.15 : 1}
          />
        ))}
        <text x={250} y={228} textAnchor="middle" className="hemiciclo-num">
          {grupo ? grupo.n : TOTAL_CADEIRAS}
        </text>
        <text x={250} y={250} textAnchor="middle" className="hemiciclo-txt">
          {grupo
            ? `${grupo.sigla === "Demais" ? "demais partidos" : grupo.sigla} · ${pct(grupo.n)}%`
            : "toque num partido"}
        </text>
      </svg>

      <ul className="chips" aria-label="Bancadas, da maior para a menor">
        {GRUPOS.map((g) => {
          const ativo = foco === g.sigla;
          return (
            <li key={g.sigla}>
              <button
                type="button"
                className={`chip${ativo ? " chip-ativo" : ""}`}
                aria-pressed={ativo}
                onClick={() => setFoco(ativo ? null : g.sigla)}
              >
                <span className="chip-cor" style={{ background: g.cor }} aria-hidden="true" />
                {g.sigla} <strong>{g.n}</strong>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="muted small">
        Maioria simples: 257 votos · PEC: 308. Ordem por tamanho da bancada, sem classificação
        ideológica. Demais: {DEMAIS.map(([s, n]) => `${s} ${n}`).join(", ")}. Fonte: Câmara dos
        Deputados, dados abertos, consulta em {BANCADAS_CONSULTA}.
      </p>
    </article>
  );
}
