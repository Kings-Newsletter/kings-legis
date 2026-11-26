import { site } from "@/lib/site";

/**
 * Animação de carregamento com a marca do King's Legis: o ícone "respira", um brilho
 * passa por ele e uma barra fina corre embaixo. Com movimento reduzido, fica parado.
 */
export function CarregandoLogo({ rotulo = "Carregando", tamanho = 88 }: { rotulo?: string; tamanho?: number }) {
  return (
    <div className="carregando-logo" role="status" aria-live="polite">
      <span className="carregando-logo-marca" style={{ width: tamanho, height: Math.round(tamanho * 0.42) }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.brandMark} alt="" width={tamanho} height={Math.round(tamanho * 0.42)} />
        <span
          className="carregando-logo-brilho"
          style={{ WebkitMaskImage: `url(${site.brandMark})`, maskImage: `url(${site.brandMark})` }}
        />
      </span>
      <span className="carregando-logo-barra" aria-hidden="true">
        <span />
      </span>
      <span className="carregando-logo-texto">{rotulo}…</span>
    </div>
  );
}
