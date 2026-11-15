import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container">
        <p>
          {site.name} e {site.radarName} fazem parte da{" "}
          <a href={site.newsletterUrl}>King&apos;s Newsletter</a>.
        </p>
        <p>
          Dados de fontes oficiais, com link em cada item. Encontrou um erro?{" "}
          <a href={`mailto:${site.editorialEmail}`}>{site.editorialEmail}</a>
        </p>
      </div>
    </footer>
  );
}
