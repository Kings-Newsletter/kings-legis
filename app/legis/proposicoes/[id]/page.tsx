import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SeloEstagio, TrilhaEstagio } from "@/components/proposicoes/estagio";
import { ItemProposicao } from "@/components/proposicoes/item-proposicao";
import { CASA_COM_ARTIGO, CASA_LABEL, TIPOS, dataBr, dataHoraBr, identificacao, idDaUrl, urlProposicao } from "@/lib/legis/catalogo";
import { urlPolitico } from "@/lib/abrir-politico";
import { buscarProposicao, eventosDaProposicao, mesmaMateriaNaOutraCasa, origemDosDados } from "@/lib/legis/proposicoes";
import { absoluteUrl, site } from "@/lib/site";
import type { LegisEventTipo } from "@/lib/types";

/** A ficha é refeita no máximo a cada 30 minutos; cada chamada às APIs tem cache próprio. */
export const revalidate = 1800;

type Props = { params: Promise<{ id: string }> };

const cortar = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await buscarProposicao(idDaUrl(id)).catch(() => null);
  if (!p) return { title: "Proposição não encontrada", robots: { index: false } };
  const titulo = `${identificacao(p)}: ${cortar(p.ementa, 80)}`;
  return {
    title: titulo,
    description: cortar(`${p.ementa} Estágio: ${p.situacaoFonte}.`, 200),
    alternates: { canonical: absoluteUrl(urlProposicao(p._id)) },
    robots: origemDosDados() === "exemplo" ? { index: false } : undefined,
    openGraph: { title: titulo, type: "article", url: absoluteUrl(urlProposicao(p._id)) },
  };
}

const TIPO_EVENTO: Record<LegisEventTipo, string> = {
  tramitacao: "Tramitação",
  pauta: "Pauta",
  votacao: "Votação",
  sancao: "Sanção",
  veto: "Veto",
};

export default async function FichaProposicao({ params }: Props) {
  const { id } = await params;
  let p: Awaited<ReturnType<typeof buscarProposicao>>;
  try {
    p = await buscarProposicao(idDaUrl(id));
  } catch (erro) {
    console.error("[legis] ficha", erro);
    return <FonteFora />;
  }
  if (!p) notFound();

  const [eventos, outras] = await Promise.all([eventosDaProposicao(p._id), mesmaMateriaNaOutraCasa(p)]);
  const tipo = TIPOS.find((t) => t.sigla === p.sigla)?.nome;
  const casa = CASA_LABEL[p.casa];
  const artigo = CASA_COM_ARTIGO[p.casa];
  const explicacao = p.explicacao?.status === "aprovada" && p.explicacao.texto ? p.explicacao : null;
  const assuntoErro = encodeURIComponent(`Erro na ficha ${identificacao(p)}`);
  const corpoErro = encodeURIComponent(`Ficha: ${absoluteUrl(urlProposicao(p._id))}\n\nO que está errado:\n`);

  return (
    <div className="container pagina ficha">
      <nav className="politico-volta">
        <Link href="/legis/proposicoes">← Proposições</Link>
      </nav>

      <header className="ficha-cabecalho">
        <p className="eyebrow">
          {casa}
          {tipo ? ` · ${tipo}` : ""}
        </p>
        <h1>{identificacao(p)}</h1>
        <div className="ficha-estado">
          <SeloEstagio estagio={p.estagio} />
          <span className="muted small">Atualizada em {dataHoraBr(p.ultimaAtualizacao)}</span>
        </div>
      </header>

      {origemDosDados() === "exemplo" && <p className="notice">Proposição de exemplo, não é real.</p>}

      <section className="card" aria-labelledby="ementa-titulo">
        <h2 id="ementa-titulo">Ementa oficial</h2>
        <p className="ficha-ementa">{p.ementa}</p>
        <p className="muted small">
          Texto oficial {artigo.do}.{" "}
          <a href={p.urlOficial} target="_blank" rel="noopener noreferrer">
            Ver na página oficial ↗
          </a>
        </p>
      </section>

      {explicacao && (
        <section className="card ficha-explicacao" aria-labelledby="explicacao-titulo">
          <div className="card-head">
            <h2 id="explicacao-titulo">O que muda, explicado pela redação</h2>
            {explicacao.contextLabel && <span className="chip">{explicacao.contextLabel}</span>}
          </div>
          {explicacao.texto!.split(/\n{2,}/).map((par, i) => (
            <p key={i}>{par}</p>
          ))}
          <p className="muted small">
            Texto produzido com apoio de IA e revisado pela redação
            {explicacao.aprovadoEm ? ` em ${dataBr(explicacao.aprovadoEm)}` : ""}.
          </p>
        </section>
      )}

      <section className="card" aria-labelledby="estagio-titulo">
        <h2 id="estagio-titulo">Em que etapa está</h2>
        <TrilhaEstagio estagio={p.estagio} />
        <p>
          <span className="muted">Situação como {artigo.o} escreve:</span> {p.situacaoFonte}
        </p>
      </section>

      <div className="duas-colunas">
        <section className="card" aria-labelledby="autores-titulo">
          <h2 id="autores-titulo">{p.autores.length === 1 ? "Autor" : "Autores"}</h2>
          {p.autores.length ? (
            <ul className="ficha-autores">
              {p.autores.map((a) => (
                <li key={`${a.nome}-${a.partido ?? ""}`}>
                  {a.idPolitico ? (
                    <Link className="ficha-autor-nome" href={urlPolitico(a.idPolitico)}>
                      {a.nome}
                    </Link>
                  ) : (
                    <span className="ficha-autor-nome">{a.nome}</span>
                  )}
                  {(a.partido || a.uf) && (
                    <span className="muted small">
                      {" "}
                      {[a.partido, a.uf].filter(Boolean).join("-")}
                    </span>
                  )}
                  {a.tipo && <span className="muted small"> · {a.tipo}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">A fonte não informa a autoria.</p>
          )}
        </section>

        <section className="card" aria-labelledby="dados-titulo">
          <h2 id="dados-titulo">Dados</h2>
          <dl className="ficha-dados">
            <dt>Apresentada em</dt>
            <dd>{dataBr(p.dataApresentacao)}</dd>
            <dt>Casa</dt>
            <dd>{casa}</dd>
            {p.temas.length > 0 && (
              <>
                <dt>Temas</dt>
                <dd className="chips">
                  {p.temas.map((t) => (
                    <Link key={t} className="chip" href={`/legis/proposicoes?tema=${encodeURIComponent(t)}`}>
                      {t}
                    </Link>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </section>
      </div>

      {outras.length > 0 && (
        <section className="card" aria-labelledby="outras-titulo">
          <h2 id="outras-titulo">A mesma matéria na outra Casa</h2>
          <ul className="proposicoes">
            {outras.map((o) => (
              <ItemProposicao key={o._id} item={o} compacto />
            ))}
          </ul>
        </section>
      )}

      <section className="card" aria-labelledby="eventos-titulo">
        <h2 id="eventos-titulo">Tramitação</h2>
        {eventos.length ? (
          <ol className="linha-tempo">
            {eventos.map((e) => (
              <li key={e._id} className={`evento evento-${e.tipo}`}>
                <p className="evento-topo">
                  <time dateTime={new Date(e.data).toISOString()}>{dataBr(e.data)}</time>
                  <span className="evento-tipo">{TIPO_EVENTO[e.tipo] ?? e.tipo}</span>
                  {e.orgao && <span className="muted small">{e.orgao}</span>}
                </p>
                <p>
                  {e.urlOficial ? (
                    <a href={e.urlOficial} target="_blank" rel="noopener noreferrer">
                      {e.descricao}
                    </a>
                  ) : (
                    e.descricao
                  )}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Os eventos de tramitação aparecem aqui quando a coleta registrar algum.</p>
        )}
      </section>

      <p className="muted small ficha-rodape">
        Dados oficiais {artigo.do}, direto da API de dados abertos. Viu algo errado?{" "}
        <a href={`mailto:${site.editorialEmail}?subject=${assuntoErro}&body=${corpoErro}`}>Reportar erro</a> ·{" "}
        <Link href="/legis/como-atualizamos">Como atualizamos</Link>
      </p>
    </div>
  );
}

function FonteFora() {
  return (
    <div className="container pagina">
      <nav className="politico-volta">
        <Link href="/legis/proposicoes">← Proposições</Link>
      </nav>
      <h1>Fonte fora do ar</h1>
      <p className="notice">
        A API de dados abertos da Câmara ou do Senado não respondeu agora. Tente de novo em alguns
        minutos.
      </p>
    </div>
  );
}
