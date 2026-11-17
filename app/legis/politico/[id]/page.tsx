import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { descricaoCampo } from "@/lib/ideologia";
import { buscarPerfil, type Bloco, type Despesas, type Perfil, type Votacoes } from "@/lib/perfil";
import { absoluteUrl } from "@/lib/site";

/** A ficha é refeita no máximo a cada 6 horas; cada fonte tem seu próprio cache. */
export const revalidate = 21600;

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await buscarPerfil(decodeURIComponent(id));
  if (!p) return { title: "Político não encontrado" };
  return {
    title: `${p.nome} (${p.partido}${p.uf ? `-${p.uf}` : ""})`,
    description: `${p.cargo}: gastos, votações, projetos e o que ainda não é público, com a fonte oficial de cada dado.`,
    alternates: { canonical: absoluteUrl(`/legis/politico/${p.id}`) },
  };
}

const REAL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const REAL_CURTO = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const NUM = new Intl.NumberFormat("pt-BR");
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const pct = (n: number, de: number) => (de ? `${((n / de) * 100).toFixed(1).replace(".", ",")}%` : "—");
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—");

export default async function PaginaPolitico({ params }: Props) {
  const { id } = await params;
  const p = await buscarPerfil(decodeURIComponent(id));
  if (!p) notFound();

  return (
    <div className="container pagina pagina-politico">
      <nav className="politico-volta">
        <Link href="/legis">← King&apos;s Legis</Link>
      </nav>

      <Cabecalho p={p} />

      <Indice p={p} />

      {p.despesas && <SecaoDespesas bloco={p.despesas} />}
      {p.votacoes && <SecaoVotacoes bloco={p.votacoes} />}
      {p.projetos && (
        <section className="politico-secao" id="projetos" aria-labelledby="projetos-titulo">
          <h2 id="projetos-titulo">Projetos de autoria</h2>
          {p.projetos.ok ? (
            <>
              <p className="muted">
                {p.projetos.dados.total
                  ? `${NUM.format(p.projetos.dados.total)} proposições com a autoria ou coautoria dele(a). As mais recentes:`
                  : "As proposições mais recentes:"}
              </p>
              <ul className="projetos-lista">
                {p.projetos.dados.itens.map((pr) => (
                  <li key={`${pr.titulo}-${pr.data}`}>
                    <p className="projeto-titulo">
                      {pr.url ? (
                        <a href={pr.url} target="_blank" rel="noopener noreferrer">
                          {pr.titulo}
                        </a>
                      ) : (
                        pr.titulo
                      )}
                      {pr.data && <span className="muted small"> · {pr.data}</span>}
                    </p>
                    <p className="projeto-ementa">{pr.ementa}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Ausente bloco={p.projetos} />
          )}
        </section>
      )}

      {p.bens && (
        <section className="politico-secao" id="bens" aria-labelledby="bens-titulo">
          <h2 id="bens-titulo">Bens declarados ao TSE</h2>
          {p.bens.ok ? (
            <>
              <div className="politico-numeros">
                <Numero rotulo={`Total declarado em ${p.bens.dados.eleicao}`} valor={REAL.format(p.bens.dados.total)} />
                <Numero rotulo="Bens" valor={NUM.format(p.bens.dados.itens.length)} />
              </div>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Descrição</th>
                      <th className="num">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.bens.dados.itens.map((b, i) => (
                      <tr key={i}>
                        <td>{b.tipo}</td>
                        <td>{b.descricao}</td>
                        <td className="num">{REAL.format(b.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">Valores como declarados pelo próprio candidato na eleição, sem correção.</p>
            </>
          ) : (
            <Ausente bloco={p.bens} />
          )}
        </section>
      )}

      {(p.campanha.length > 0 || p.eleicoes.length > 0) && (
        <section className="politico-secao" id="eleicoes" aria-labelledby="eleicoes-titulo">
          <h2 id="eleicoes-titulo">Campanha e outras eleições</h2>
          {p.campanha.length > 0 && (
            <div className="politico-numeros">
              {p.campanha.map((c) => (
                <Numero key={c.rotulo} rotulo={c.rotulo} valor={REAL.format(c.valor)} />
              ))}
            </div>
          )}
          {p.eleicoes.length > 0 && (
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Ano</th>
                    <th>Cargo</th>
                    <th>Partido</th>
                    <th>Local</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {p.eleicoes.map((e) => (
                    <tr key={`${e.ano}-${e.cargo}`}>
                      <td>{e.ano}</td>
                      <td>{e.cargo}</td>
                      <td>{e.partido}</td>
                      <td>{e.local}</td>
                      <td>{e.resultado}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <section className="politico-secao politico-faltando" id="faltando" aria-labelledby="faltando-titulo">
        <h2 id="faltando-titulo">O que ainda não está aqui</h2>
        <p className="muted">
          Dados que um eleitor deveria conseguir ver e que esta ficha ainda não mostra, com o motivo e onde procurar.
        </p>
        <ul className="faltando-lista">
          {p.faltando.map((f) => (
            <li key={f.item}>
              <p className="faltando-item">{f.item}</p>
              <p className="faltando-porque">{f.porque}</p>
              {f.onde && (
                <a href={f.onde.href} target="_blank" rel="noopener noreferrer">
                  {f.onde.rotulo} →
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>

      <footer className="politico-fontes">
        <p>
          Fontes, consultadas em {p.consultadoEm}:{" "}
          {p.fontes.map((f, i) => (
            <span key={f.href}>
              {i > 0 && " · "}
              <a href={f.href} target="_blank" rel="noopener noreferrer">
                {f.rotulo}
              </a>
            </span>
          ))}
        </p>
      </footer>
    </div>
  );
}

function Cabecalho({ p }: { p: Perfil }) {
  return (
    <header className="politico-topo" style={{ ["--partido" as string]: p.cor }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.foto} alt={`Foto de ${p.nome}`} width={132} height={132} className="politico-foto-grande" />
      <div className="politico-identidade">
        <p className="eyebrow">{p.cargo}</p>
        <h1>{p.nome}</h1>
        {p.nomeCompleto && p.nomeCompleto !== p.nome && <p className="muted">{p.nomeCompleto}</p>}
        <p className="politico-partido-linha">
          <span className="politico-partido-pill">
            <i aria-hidden="true" />
            {p.partido}
          </span>
          {p.uf && <span>{p.uf}</span>}
          <span className="muted small">{descricaoCampo(p.partido)}</span>
        </p>
        {p.urlOficial && (
          <a href={p.urlOficial} target="_blank" rel="noopener noreferrer" className="politico-oficial">
            Página oficial →
          </a>
        )}
      </div>
      <dl className="politico-fatos">
        {p.fatos.map((f) => (
          <div key={f.rotulo}>
            <dt>{f.rotulo}</dt>
            <dd>{f.valor}</dd>
          </div>
        ))}
        {p.contatos.map((c, i) => (
          <div key={`${c.rotulo}-${i}`}>
            <dt>{c.rotulo}</dt>
            <dd>
              {c.href ? (
                <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                  {c.valor}
                </a>
              ) : (
                c.valor
              )}
            </dd>
          </div>
        ))}
      </dl>
    </header>
  );
}

function Indice({ p }: { p: Perfil }) {
  const itens = [
    p.despesas && { href: "#gastos", rotulo: "Gastos" },
    p.votacoes && { href: "#votacoes", rotulo: "Votações e presença" },
    p.projetos && { href: "#projetos", rotulo: "Projetos" },
    p.bens && { href: "#bens", rotulo: "Bens" },
    (p.campanha.length > 0 || p.eleicoes.length > 0) && { href: "#eleicoes", rotulo: "Eleições" },
    { href: "#faltando", rotulo: "O que falta" },
  ].filter((x): x is { href: string; rotulo: string } => Boolean(x));
  return (
    <nav className="politico-indice" aria-label="Nesta página">
      {itens.map((i) => (
        <a key={i.href} href={i.href}>
          {i.rotulo}
        </a>
      ))}
    </nav>
  );
}

function Numero({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="politico-numero">
      <p>{rotulo}</p>
      <p className="politico-numero-valor">{valor}</p>
      {detalhe && <p className="muted small">{detalhe}</p>}
    </div>
  );
}

function Ausente({ bloco }: { bloco: Extract<Bloco<unknown>, { ok: false }> }) {
  return (
    <div className="politico-ausente">
      <p>
        <strong>Sem dados.</strong> {bloco.motivo}
      </p>
      {bloco.onde && (
        <a href={bloco.onde.href} target="_blank" rel="noopener noreferrer">
          {bloco.onde.rotulo} →
        </a>
      )}
    </div>
  );
}

function SecaoDespesas({ bloco }: { bloco: Bloco<Despesas> }) {
  return (
    <section className="politico-secao" id="gastos" aria-labelledby="gastos-titulo">
      <h2 id="gastos-titulo">Gastos com dinheiro público</h2>
      {!bloco.ok ? (
        <Ausente bloco={bloco} />
      ) : (
        <DespesasDetalhe d={bloco.dados} />
      )}
    </section>
  );
}

function DespesasDetalhe({ d }: { d: Despesas }) {
  const mesesComGasto = d.porMes.filter((v) => v > 0).length;
  const maiorMes = Math.max(1, ...d.porMes);
  const maiorTipo = Math.max(1, ...d.porTipo.map((t) => t.total));
  const maior = d.itens.reduce((m, i) => (i.valor > (m?.valor ?? -1) ? i : m), d.itens[0]);
  const limite = 300;
  return (
    <>
      <p className="muted">
        {d.nome} em {d.ano}: despesas reembolsadas com dinheiro público, nota por nota, como a casa publica.
      </p>
      <div className="politico-numeros">
        <Numero rotulo={`Total em ${d.ano}`} valor={REAL.format(d.total)} />
        <Numero
          rotulo="Média por mês com gasto"
          valor={REAL_CURTO.format(mesesComGasto ? d.total / mesesComGasto : 0)}
          detalhe={`${mesesComGasto} ${mesesComGasto === 1 ? "mês" : "meses"}`}
        />
        <Numero rotulo="Notas e recibos" valor={NUM.format(d.itens.length)} />
        {maior && <Numero rotulo="Maior gasto" valor={REAL.format(maior.valor)} detalhe={`${maior.tipo} · ${maior.fornecedor}`} />}
      </div>

      <div className="gastos-graficos">
        <div>
          <h3>Por mês</h3>
          <ul className="barras-mes" aria-label="Gasto por mês">
            {d.porMes.map((v, i) => (
              <li key={i} title={`${MESES[i]}: ${REAL.format(v)}`}>
                <span className="barra-mes" style={{ height: `${(v / maiorMes) * 100}%` }} />
                <span className="barra-mes-rotulo">{MESES[i]}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Com o quê</h3>
          <ul className="barras-tipo">
            {d.porTipo.map((t) => (
              <li key={t.tipo}>
                <span className="barras-tipo-nome">{t.tipo}</span>
                <span className="barras-tipo-trilho" aria-hidden="true">
                  <span style={{ width: `${(t.total / maiorTipo) * 100}%` }} />
                </span>
                <span className="barras-tipo-valor">
                  {REAL_CURTO.format(t.total)} <span className="muted">· {pct(t.total, d.total)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h3>Quem mais recebeu</h3>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>CNPJ/CPF</th>
              <th className="num">Notas</th>
              <th className="num">Total</th>
            </tr>
          </thead>
          <tbody>
            {d.fornecedores.map((f) => (
              <tr key={`${f.nome}-${f.documento}`}>
                <td>{f.nome}</td>
                <td className="muted">{f.documento ?? "—"}</td>
                <td className="num">{f.n}</td>
                <td className="num">{REAL.format(f.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Cada despesa</h3>
      <div className="tabela-rolagem tabela-alta">
        <table className="tabela">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Fornecedor</th>
              <th className="num">Valor</th>
              <th>Nota</th>
            </tr>
          </thead>
          <tbody>
            {d.itens.slice(0, limite).map((i, k) => (
              <tr key={k}>
                <td>{dataBr(i.data)}</td>
                <td>{i.tipo}</td>
                <td>
                  {i.fornecedor}
                  {i.documentoFornecedor && <span className="muted small"> · {i.documentoFornecedor}</span>}
                </td>
                <td className="num">{REAL.format(i.valor)}</td>
                <td>
                  {i.url ? (
                    <a href={i.url} target="_blank" rel="noopener noreferrer">
                      ver
                    </a>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {d.itens.length > limite && (
        <p className="muted small">
          Mostrando as {limite} despesas mais recentes de {NUM.format(d.itens.length)}. Os totais acima contam todas.
        </p>
      )}
    </>
  );
}

const CLASSE_VOTO: Record<string, string> = {
  Sim: "voto-sim",
  Não: "voto-nao",
  Abstenção: "voto-neutro",
  Obstrução: "voto-neutro",
  Votou: "voto-neutro",
  "Sem voto registrado": "voto-ausente",
  NCom: "voto-ausente",
};

function SecaoVotacoes({ bloco }: { bloco: Bloco<Votacoes> }) {
  return (
    <section className="politico-secao" id="votacoes" aria-labelledby="votacoes-titulo">
      <h2 id="votacoes-titulo">Votações e presença</h2>
      {!bloco.ok ? (
        <Ausente bloco={bloco} />
      ) : (
        <>
          <p className="muted">{bloco.dados.nota}</p>
          <div className="politico-numeros">
            <Numero
              rotulo="Registrou voto"
              valor={pct(bloco.dados.registrados, bloco.dados.total)}
              detalhe={`${bloco.dados.registrados} de ${bloco.dados.total} votações · ${bloco.dados.periodo}`}
            />
            <Numero
              rotulo="Sem voto registrado"
              valor={pct(bloco.dados.total - bloco.dados.registrados, bloco.dados.total)}
              detalhe={`${bloco.dados.total - bloco.dados.registrados} votações`}
            />
          </div>
          <ul className="votos-resumo">
            {bloco.dados.porVoto.map((v) => (
              <li key={v.voto} className={CLASSE_VOTO[v.voto] ?? "voto-neutro"}>
                <strong>{v.n}</strong> {v.voto}
                {v.legenda && v.legenda.toLowerCase() !== v.voto.toLowerCase() && <span className="muted"> · {v.legenda}</span>}
              </li>
            ))}
          </ul>
          <div className="tabela-rolagem tabela-alta">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>O que se votou</th>
                  <th>Voto</th>
                  <th>Resultado</th>
                </tr>
              </thead>
              <tbody>
                {bloco.dados.itens.map((v, i) => (
                  <tr key={i}>
                    <td>{dataBr(v.data)}</td>
                    <td>
                      {v.materia && (
                        <strong>
                          {v.url ? (
                            <a href={v.url} target="_blank" rel="noopener noreferrer">
                              {v.materia}
                            </a>
                          ) : (
                            v.materia
                          )}
                          :{" "}
                        </strong>
                      )}
                      {v.descricao}
                    </td>
                    <td>
                      <span className={`voto-pill ${CLASSE_VOTO[v.voto] ?? "voto-neutro"}`}>{v.voto}</span>
                    </td>
                    <td>{v.resultado ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
