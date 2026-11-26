import { CarregandoLogo } from "@/components/carregando-logo";

/** Mostrado enquanto uma página busca os dados nas fontes oficiais. */
export default function Loading() {
  return (
    <div className="container pagina carregamento-pagina" aria-busy="true">
      <CarregandoLogo rotulo="Buscando nas fontes oficiais" tamanho={120} />
    </div>
  );
}
