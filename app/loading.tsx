export default function Loading() {
  return (
    <div className="container pagina carregamento" aria-busy="true">
      <p className="sr-only" role="status">
        Carregando conteúdo
      </p>
      <div className="skeleton skeleton-titulo" aria-hidden="true" />
      <div className="skeleton skeleton-descricao" aria-hidden="true" />
      <div className="skeleton-filtros" aria-hidden="true">
        <span className="skeleton" />
        <span className="skeleton" />
        <span className="skeleton" />
      </div>
      <div className="skeleton-grid" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <div className="card skeleton-card" key={item}>
            <span className="skeleton skeleton-card-titulo" />
            <span className="skeleton skeleton-linha" />
            <span className="skeleton skeleton-linha skeleton-linha-curta" />
            <span className="skeleton skeleton-linha" />
          </div>
        ))}
      </div>
    </div>
  );
}
