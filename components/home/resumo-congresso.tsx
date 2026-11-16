import Link from "next/link";

import { COMPOSICAO, DATA_CONSULTA } from "@/lib/bancadas";

/**
 * Resumo da Câmara na página inicial: uma barra com as bancadas, do maior partido para
 * o menor, e um atalho para a página de partidos (com o arco de cadeiras completo).
 */
export function ResumoCongresso() {
  const camara = COMPOSICAO.camara;
  const maiores = camara.grupos.slice(0, 5);
  const resto = camara.grupos.slice(5).reduce((t, g) => t + g.n, 0);

  return (
    <article className="card resumo-congresso" aria-labelledby="resumo-congresso-titulo">
      <div className="card-head">
        <h2 id="resumo-congresso-titulo">Como está o Congresso</h2>
      </div>
      <p className="resumo-congresso-num">
        <strong>{camara.total}</strong> deputados de <strong>{camara.grupos.length}</strong> partidos
      </p>
      <div className="resumo-barra" role="img" aria-label="Bancadas da Câmara, do maior partido para o menor">
        {camara.grupos.map((g) => (
          <span
            key={g.sigla}
            style={{ flexGrow: g.n, background: g.cor }}
            title={`${g.sigla}: ${g.n}`}
          />
        ))}
      </div>
      <ul className="resumo-maiores">
        {maiores.map((g) => (
          <li key={g.sigla}>
            <i style={{ background: g.cor }} aria-hidden="true" />
            {g.sigla} <strong>{g.n}</strong>
          </li>
        ))}
        <li>
          outros <strong>{resto}</strong>
        </li>
      </ul>
      <Link href="/legis/partidos" className="btn btn-primario resumo-link">
        Ver cada partido e cada cadeira →
      </Link>
      <p className="muted small">Fonte: Câmara dos Deputados, dados abertos, consulta em {DATA_CONSULTA}.</p>
    </article>
  );
}
