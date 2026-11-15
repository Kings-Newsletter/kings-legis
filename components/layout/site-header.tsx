import Link from "next/link";

import { nav, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        {/* Sem logo por enquanto: só o nome em texto. */}
        <Link href="/legis" className="wordmark">
          {site.name}
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <ul>
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
            <li>
              <a href={site.newsletterUrl}>Newsletter</a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
