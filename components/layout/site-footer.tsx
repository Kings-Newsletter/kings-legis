import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container rodape">
        <div className="rodape-sobre">
          <p className="rodape-marca">{site.name}</p>
          <p>
            Parte da <a href={site.newsletterUrl}>King&apos;s Newsletter</a>. Dados de fontes
            oficiais, sem nota, ranking ou recomendação de voto.
          </p>
          <p>
            Encontrou um erro? <a href={`mailto:${site.editorialEmail}`}>{site.editorialEmail}</a>
          </p>
        </div>
        <div className="rodape-news">
          <p className="rodape-marca">Resumo da semana no Congresso</p>
          <p>Receba por e-mail, junto com a King&apos;s Newsletter.</p>
          <a href={site.newsletterUrl} className="btn btn-claro">
            Assinar
          </a>
        </div>
      </div>
    </footer>
  );
}
