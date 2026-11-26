import type { Metadata } from "next";
import Link from "next/link";

import { CampoData } from "@/components/filtros/campo-data";
import { Escolha } from "@/components/filtros/escolha";
import { ItemProposicao } from "@/components/proposicoes/item-proposicao";
import { ESTADOS } from "@/lib/brasil";
import { CASA_LABEL, CASAS_FILTRO, TIPOS, rotuloEstagio } from "@/lib/legis/catalogo";
import { POR_PAGINA, lerFiltros, queryDosFiltros, temFiltro, type Filtros } from "@/lib/legis/filtros";
import { listarProposicoes, temasDisponiveis } from "@/lib/legis/proposicoes";
import { absoluteUrl } from "@/lib/site";
import { ESTAGIOS } from "@/lib/types";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const f = lerFiltros(await searchParams);
  return {
    title: "Proposições",
    description: "Proposições em tramitação na Câmara, no Senado e no Congresso, com o estágio e o link oficial de cada uma.",
    alternates: { canonical: absoluteUrl("/legis/proposicoes") },
    // Combinações de filtro não precisam ser indexadas; a ficha de cada proposição é.
    robots: temFiltro(f) || f.pagina > 1 || f.casa !== "camara" ? { index: false, follow: true } : undefined,
  };
}

const NUM = new Intl.NumberFormat("pt-BR");
const UFS = [...ESTADOS].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

export default async function Proposicoes({ searchParams }: Props) {
  const f = lerFiltros(await searchParams);
  const [resultado, temas] = await Promise.all([listarProposicoes(f), temasDisponiveis(f.casa)]);
  const paginas = Math.max(1, Math.ceil(resultado.total / POR_PAGINA));

  return (
    <div className="container pagina">
      <span className="eyebrow">King&apos;s Legis</span>
      <h1>Proposições</h1>
      <p className="lead">
        Direto dos dados abertos da Câmara e do Senado: cada proposição mostra o estágio em que
        está, a situação como a Casa escreve e o link para a página oficial.
      </p>

      {resultado.origem === "exemplo" && (
        <p className="notice">
          Dados de exemplo (LEGIS_EXEMPLOS=1). Nada disso é real: serve só para desenvolver as telas.
        </p>
      )}

      <nav className="segmentado abas-casa" aria-label="Casa">
        {CASAS_FILTRO.map((c) => (
          <Link
            key={c}
            href={`/legis/proposicoes${queryDosFiltros(f, { casa: c, pagina: 1, tema: c === "senado" ? undefined : f.tema })}`}
            aria-current={f.casa === c ? "page" : undefined}
          >
            {CASA_LABEL[c]}
          </Link>
        ))}
      </nav>

      <FormFiltros f={f} temas={temas} />

      <section aria-labelledby="resultado-titulo" className="card">
        <div className="card-head">
          <h2 id="resultado-titulo">
            {resultado.total
              ? `${NUM.format(resultado.total)} ${resultado.total === 1 ? "proposição" : "proposições"}`
              : "Proposições"}
          </h2>
          {temFiltro(f) && <Link href={`/legis/proposicoes${queryDosFiltros({ casa: f.casa, pagina: 1 })}`}>Limpar filtros</Link>}
        </div>
        {!resultado.erro && <p className="muted small">{janela(f)}</p>}

        {resultado.itens.length > 0 ? (
          <ul className="proposicoes">
            {resultado.itens.map((item) => (
              <ItemProposicao key={item._id} item={item} />
            ))}
          </ul>
        ) : (
          <Vazio f={f} erro={resultado.erro} />
        )}

        {paginas > 1 && <Paginacao f={f} paginas={paginas} />}
      </section>
    </div>
  );
}

function FormFiltros({ f, temas }: { f: Filtros; temas: string[] }) {
  const todos = { valor: "", rotulo: "Todos" };
  return (
    <form className="filtros card" action="/legis/proposicoes" role="search" aria-label="Filtrar proposições">
      <label className="filtro filtro-busca">
        <span>Busca</span>
        <span className="campo campo-busca">
          <svg className="campo-icone" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input type="search" name="q" defaultValue={f.q} placeholder="Número (PL 1234/2026) ou palavras da ementa" />
        </span>
      </label>
      <input type="hidden" name="casa" value={f.casa} />

      <Escolha
        nome="tipo"
        rotulo="Tipo"
        valorInicial={f.sigla ?? ""}
        opcoes={[todos, ...TIPOS.map((t) => ({ valor: t.sigla, rotulo: t.sigla, detalhe: t.nome }))]}
      />
      {f.casa === "senado" && (
        <Escolha
          nome="estagio"
          rotulo="Estágio"
          valorInicial={f.estagio ?? ""}
          opcoes={[todos, ...ESTAGIOS.map((e) => ({ valor: e, rotulo: rotuloEstagio(e) }))]}
        />
      )}
      {temas.length > 0 && (
        <Escolha
          nome="tema"
          rotulo="Tema"
          valorInicial={f.tema ?? ""}
          opcoes={[todos, ...temas.map((t) => ({ valor: t, rotulo: t }))]}
        />
      )}
      <Escolha
        nome="uf"
        rotulo="UF do autor"
        valorInicial={f.uf ?? ""}
        opcoes={[{ valor: "", rotulo: "Todas" }, ...UFS.map((e) => ({ valor: e.uf, rotulo: e.nome, detalhe: e.uf }))]}
      />
      <CampoData nome="de" rotulo="Apresentada de" valorInicial={f.de} />
      <CampoData nome="ate" rotulo="Até" valorInicial={f.ate} />

      <div className="filtro-acoes">
        <button type="submit" className="btn btn-primario">
          Filtrar
        </button>
      </div>
    </form>
  );
}

function janela(f: Filtros): string {
  if (f.q || f.de || f.ate) return `Fonte: ${f.casa === "camara" ? "Câmara dos Deputados" : "Senado Federal"}, dados abertos.`;
  return f.casa === "camara"
    ? "Sem período escolhido, a Câmara lista as proposições que tramitaram nos últimos 30 dias, das mais novas para as mais antigas."
    : "Sem busca nem período, o Senado lista as proposições apresentadas nos últimos 30 dias, da atualização mais recente para a mais antiga.";
}

function Vazio({ f, erro }: { f: Filtros; erro?: boolean }) {
  const casa = f.casa === "camara" ? "da Câmara" : "do Senado";
  if (erro) {
    return (
      <div className="vazio">
        <p className="vazio-titulo">A API {casa} não respondeu agora.</p>
        <p className="muted">Tente de novo em alguns minutos.</p>
      </div>
    );
  }
  return (
    <div className="vazio">
      <p className="vazio-titulo">Nenhuma proposição com esses filtros.</p>
      <p className="muted">
        {f.q ? "Confira o número ou tente outras palavras. " : ""}
        <Link href={`/legis/proposicoes${queryDosFiltros({ casa: f.casa, pagina: 1 })}`}>Ver todas</Link>
      </p>
    </div>
  );
}

function Paginacao({ f, paginas }: { f: Filtros; paginas: number }) {
  const atual = Math.min(f.pagina, paginas);
  return (
    <nav className="paginacao" aria-label="Páginas">
      {atual > 1 ? (
        <Link href={`/legis/proposicoes${queryDosFiltros(f, { pagina: atual - 1 })}`} rel="prev">
          ← Anteriores
        </Link>
      ) : (
        <span />
      )}
      <span className="muted small">
        Página {atual} de {paginas}
      </span>
      {atual < paginas ? (
        <Link href={`/legis/proposicoes${queryDosFiltros(f, { pagina: atual + 1 })}`} rel="next">
          Próximas →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
