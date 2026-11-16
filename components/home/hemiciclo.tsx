"use client";

import { useMemo, useState } from "react";

import { COMPOSICAO, DATA_CONSULTA, type Casa } from "@/lib/bancadas";

const RAIO_INTERNO = 0.4;
const RAIO_PX = 232;
const CENTRO_X = 250;
const BASE_Y = 246;

/** Posição de cada cadeira em fileiras concêntricas, da esquerda para a direita. */
function posicoes(total: number, fileiras: number) {
  const raios = Array.from({ length: fileiras }, (_, i) => RAIO_INTERNO + ((1 - RAIO_INTERNO) * i) / (fileiras - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  const porFileira = raios.map((r) => Math.round((total * r) / soma));
  const ultima = fileiras - 1;
  porFileira[ultima] = (porFileira[ultima] ?? 0) + total - porFileira.reduce((a, b) => a + b, 0);

  const lista: { th: number; r: number; x: number; y: number }[] = [];
  raios.forEach((r, i) => {
    const n = porFileira[i] ?? 0;
    for (let k = 0; k < n; k++) {
      const th = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * k) / (n - 1);
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
  const [casa, setCasa] = useState<Casa>("camara");
  const [foco, setFoco] = useState<string | null>(null);
  const dados = COMPOSICAO[casa];

  const cadeiras = useMemo(() => {
    const pos = posicoes(dados.total, dados.fileiras);
    const out: { x: number; y: number; sigla: string; cor: string }[] = [];
    for (const g of dados.grupos) {
      for (let i = 0; i < g.n; i++) {
        const p = pos[out.length];
        if (p) out.push({ x: p.x, y: p.y, sigla: g.sigla, cor: g.cor });
      }
    }
    return out;
  }, [dados]);

  const raio = casa === "camara" ? 4.6 : 11;
  const grupo = dados.grupos.find((g) => g.sigla === foco);
  const pct = (n: number) => ((n / dados.total) * 100).toFixed(1).replace(".", ",");

  const trocar = (c: Casa) => {
    setCasa(c);
    setFoco(null);
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
        viewBox="0 0 500 262"
        role="img"
        aria-label={`Composição do ${dados.nome} em arco, um ponto por cadeira, partidos do maior para o menor`}
        className="hemiciclo-svg"
      >
        {cadeiras.map((c, i) => (
          <circle key={`${casa}-${i}`} cx={c.x} cy={c.y} r={raio} fill={c.cor} opacity={foco && foco !== c.sigla ? 0.15 : 1} />
        ))}
        <text x={250} y={228} textAnchor="middle" className="hemiciclo-num">
          {grupo ? grupo.n : dados.total}
        </text>
        <text x={250} y={250} textAnchor="middle" className="hemiciclo-txt">
          {grupo ? `${grupo.sigla} · ${pct(grupo.n)}%` : "toque num partido"}
        </text>
      </svg>

      <ul className="chips" aria-label="Bancadas, da maior para a menor">
        {dados.grupos.map((g) => {
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
        {dados.maioria}. Ordem por tamanho da bancada, sem classificação ideológica. Fonte:{" "}
        {casa === "camara" ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos, consulta em {DATA_CONSULTA}.
      </p>
    </article>
  );
}
