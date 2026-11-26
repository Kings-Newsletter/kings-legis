import { LOGOS, PARTIDOS } from "@/lib/partidos";

/**
 * Logo do partido numa caixa de tamanho fixo. Sem logo (Cidadania, sem partido),
 * mostra a sigla na cor do partido. É decorativo: a sigla aparece sempre ao lado.
 */
export function LogoPartido({ sigla, cor, tamanho = "medio" }: { sigla: string; cor: string; tamanho?: "pequeno" | "medio" }) {
  const logo = LOGOS[sigla];
  const classe = `logo-partido logo-partido-${tamanho}`;
  if (!logo) {
    return (
      <span className={`${classe} logo-partido-selo`} style={{ background: cor }} aria-hidden="true">
        {sigla === "S/Partido" ? "—" : sigla.slice(0, 4)}
      </span>
    );
  }
  return (
    <span className={logo.escuro ? `${classe} logo-partido-escuro` : classe} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo.src} alt="" loading="lazy" decoding="async" title={PARTIDOS[sigla]?.nome ?? sigla} />
    </span>
  );
}
