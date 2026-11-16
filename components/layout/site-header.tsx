import Link from "next/link";

import { nav, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container navbar">
        {/* Sem logo por enquanto: só o nome em texto. */}
        <Link href="/legis" className="wordmark">
          {site.name}
        </Link>
        <nav className="site-nav" aria-label="Principal">
          {nav.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="navbar-acoes">
          <Link href="/legis/proposicoes" className="btn-icone" aria-label="Buscar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </Link>
          <a href={site.newsletterUrl} className="btn btn-escuro">
            Assinar a newsletter
          </a>
        </div>
      </div>
      <div className="faixa-hoje">
        <div className="container faixa-hoje-linha">
          <span className="faixa-rotulo">Hoje</span>
          <span>Câmara, Senado e Diário Oficial do dia aparecem aqui quando a coleta estiver ligada.</span>
        </div>
      </div>
    </header>
  );
}
