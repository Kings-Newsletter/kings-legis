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
                {p.projetos.dados.itens.map((pr, i) => (
                  <li key={`${pr.titulo}-${pr.data}-${i}`}>
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

      {p.remuneracao && (
        <section className="politico-secao" id="salario" aria-labelledby="salario-titulo">
          <h2 id="salario-titulo">Salário e benefícios</h2>
          {p.remuneracao.ok ? (
            <>
              <div className="politico-numeros">
                <Numero
                  rotulo="Subsídio mensal (bruto)"
                  valor={REAL.format(p.remuneracao.dados.subsidio)}
                  detalhe={`Desde ${p.remuneracao.dados.vigencia}, igual para todos os deputados e senadores`}
                />
                {p.remuneracao.dados.pagoNoMes && (
                  <Numero
                    rotulo={`Recebido em ${p.remuneracao.dados.pagoNoMes.referencia} (líquido)`}
                    valor={REAL.format(p.remuneracao.dados.pagoNoMes.liquido)}
                    detalhe={`Bruto: ${REAL.format(p.remuneracao.dados.pagoNoMes.bruto)}`}
                  />
                )}
                {p.remuneracao.dados.beneficios.map((b) => (
                  <Numero key={b.rotulo} rotulo={b.rotulo} valor={b.situacao} />
                ))}
              </div>
              {p.remuneracao.dados.pagoNoMes?.previdencia != null && (
                <>
                  <h3>Contracheque de {p.remuneracao.dados.pagoNoMes.referencia}</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        <tr>
                          <td>Remuneração bruta</td>
                          <td className="num">{REAL.format(p.remuneracao.dados.pagoNoMes.bruto)}</td>
                        </tr>
                        <tr>
                          <td>Contribuição previdenciária</td>
                          <td className="num">{REAL.format(p.remuneracao.dados.pagoNoMes.previdencia)}</td>
                        </tr>
                        <tr>
                          <td>Imposto de renda</td>
                          <td className="num">{REAL.format(p.remuneracao.dados.pagoNoMes.imposto ?? 0)}</td>
                        </tr>
                        {!!p.remuneracao.dados.pagoNoMes.redutor && (
                          <tr>
                            <td>Redutor constitucional (teto)</td>
                            <td className="num">{REAL.format(p.remuneracao.dados.pagoNoMes.redutor)}</td>
                          </tr>
                        )}
                        <tr>
                          <td>
                            <strong>Líquido</strong>
                          </td>
                          <td className="num">
                            <strong>{REAL.format(p.remuneracao.dados.pagoNoMes.liquido)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  {p.remuneracao.dados.pagoNoMes.fonte && (
                    <p className="muted small">
                      Fonte:{" "}
                      <a href={p.remuneracao.dados.pagoNoMes.fonte.href} target="_blank" rel="noopener noreferrer">
                        {p.remuneracao.dados.pagoNoMes.fonte.rotulo}
                      </a>
                      .
                    </p>
                  )}
                </>
              )}
              {p.remuneracao.dados.recursos.length > 0 && (
                <>
                  <h3>Recursos usados em {p.remuneracao.dados.anoRecursos ?? "no ano"}, segundo o Senado</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.remuneracao.dados.recursos.map((r) => (
                          <tr key={r.rotulo}>
                            <td>{r.rotulo}</td>
                            <td className="num">{REAL.format(r.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              <p className="muted small">
                {p.remuneracao.dados.nota} Fonte do subsídio:{" "}
                <a href={p.remuneracao.dados.base.href} target="_blank" rel="noopener noreferrer">
                  {p.remuneracao.dados.base.rotulo}
                </a>
                .
              </p>
            </>
          ) : (
            <Ausente bloco={p.remuneracao} />
          )}
        </section>
      )}

      {p.gabinete && (
        <section className="politico-secao" id="gabinete" aria-labelledby="gabinete-titulo">
          <h2 id="gabinete-titulo">Quem trabalha no gabinete</h2>
          {p.gabinete.ok ? (
            <>
              <div className="politico-numeros">
                <Numero rotulo="Pessoas" valor={NUM.format(p.gabinete.dados.pessoas.length)} />
                {p.gabinete.dados.porLocal.length > 1 &&
                  p.gabinete.dados.porLocal.map((l) => <Numero key={l.local} rotulo={l.local} valor={NUM.format(l.n)} />)}
                {p.gabinete.dados.totalBruto != null && (
                  <Numero
                    rotulo={`Folha bruta em ${p.gabinete.dados.referencia}`}
                    valor={REAL_CURTO.format(p.gabinete.dados.totalBruto)}
                  />
                )}
              </div>
              <div className="tabela-rolagem tabela-alta">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Nome</th>
                      <th>Cargo</th>
                      {p.gabinete.dados.porLocal.length > 1 && <th>Onde</th>}
                      <th>Desde</th>
                      {p.gabinete.dados.referencia ? (
                        <>
                          <th className="num">Bruto</th>
                          <th className="num">Líquido</th>
                        </>
                      ) : (
                        <th className="num">Vencimento básico</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {p.gabinete.dados.pessoas.map((g, i) => (
                      <tr key={`${g.nome}-${i}`}>
                        <td>{g.nome}</td>
                        <td>{g.cargo}</td>
                        {p.gabinete!.ok && p.gabinete!.dados.porLocal.length > 1 && <td>{g.local}</td>}
                        <td>{g.desde ?? "—"}</td>
                        {p.gabinete!.ok && p.gabinete!.dados.referencia ? (
                          <>
                            <td className="num">{g.bruto != null ? REAL.format(g.bruto) : "—"}</td>
                            <td className="num">{g.liquido != null ? REAL.format(g.liquido) : "—"}</td>
                          </>
                        ) : (
                          <td className="num">{g.vencimentoTabela != null ? REAL.format(g.vencimentoTabela) : "—"}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                {p.gabinete.dados.nota} Fonte:{" "}
                <a href={p.gabinete.dados.fonte.href} target="_blank" rel="noopener noreferrer">
                  {p.gabinete.dados.fonte.rotulo}
                </a>
                .
              </p>
            </>
          ) : (
            <Ausente bloco={p.gabinete} />
          )}
        </section>
      )}

      {p.emendas && (
        <section className="politico-secao" id="emendas" aria-labelledby="emendas-titulo">
          <h2 id="emendas-titulo">Emendas parlamentares</h2>
          {p.emendas.ok ? (
            <>
              <div className="politico-numeros">
                <Numero rotulo={`Empenhado em ${p.emendas.dados.anos.join(" e ")}`} valor={REAL_CURTO.format(p.emendas.dados.empenhado)} />
                <Numero rotulo="Pago" valor={REAL_CURTO.format(p.emendas.dados.pago)} detalhe="inclui restos a pagar" />
              </div>
              <h3>Para onde foi o dinheiro pago</h3>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <thead>
                    <tr>
                      <th>Localidade do gasto</th>
                      <th className="num">Emendas</th>
                      <th className="num">Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.emendas.dados.porLocal.map((l) => (
                      <tr key={l.local}>
                        <td>{l.local}</td>
                        <td className="num">{NUM.format(l.n)}</td>
                        <td className="num">{REAL.format(l.pago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3>Por área</h3>
              <div className="tabela-rolagem">
                <table className="tabela">
                  <tbody>
                    {p.emendas.dados.porFuncao.map((f) => (
                      <tr key={f.funcao}>
                        <td>{f.funcao}</td>
                        <td className="num">{NUM.format(f.n)}</td>
                        <td className="num">{REAL.format(f.pago)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small">
                Fonte:{" "}
                <a href="https://portaldatransparencia.gov.br/emendas" target="_blank" rel="noopener noreferrer">
                  Portal da Transparência (CGU)
                </a>
                .
              </p>
            </>
          ) : (
            <Ausente bloco={p.emendas} />
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
                  {p.eleicoes.map((e, i) => (
                    <tr key={`${e.ano}-${e.cargo}-${i}`}>
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

      {p.contas && (
        <section className="politico-secao" id="contas" aria-labelledby="contas-titulo">
          <h2 id="contas-titulo">Contas da campanha</h2>
          {p.contas.ok ? (
            <>
              <div className="politico-numeros">
                <Numero rotulo={`Recebido na campanha de ${p.contas.dados.ano}`} valor={REAL_CURTO.format(p.contas.dados.recebido)} />
                <Numero rotulo="Gasto" valor={REAL_CURTO.format(p.contas.dados.gasto)} />
                {p.contas.dados.limite != null && (
                  <Numero
                    rotulo="Limite de gastos"
                    valor={REAL_CURTO.format(p.contas.dados.limite)}
                    detalhe={p.contas.dados.limite ? `${pct(p.contas.dados.gasto, p.contas.dados.limite)} usado` : undefined}
                  />
                )}
              </div>

              {p.contas.dados.origens.length > 0 && (
                <>
                  <h3>De onde veio o dinheiro</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.contas.dados.origens.map((o) => (
                          <tr key={o.rotulo}>
                            <td>{o.rotulo}</td>
                            <td className="num">{NUM.format(o.n)}</td>
                            <td className="num">{REAL.format(o.valor)}</td>
                            <td className="num">{pct(o.valor, p.contas!.ok ? p.contas!.dados.recebido : 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {p.contas.dados.fundos.length > 0 && (
                <>
                  <h3>Dinheiro público e outros recursos usados nas despesas</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.contas.dados.fundos.map((f) => (
                          <tr key={f.rotulo}>
                            <td>{f.rotulo}</td>
                            <td className="num">{REAL.format(f.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {p.contas.dados.doadores.length > 0 && (
                <>
                  <h3>Maiores doadores</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.contas.dados.doadores.map((d, i) => (
                          <tr key={`${d.nome}-${i}`}>
                            <td>{d.nome}</td>
                            <td className="num">{NUM.format(d.n)}</td>
                            <td className="num">{REAL.format(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {p.contas.dados.despesasPorTipo.length > 0 && (
                <>
                  <h3>Com o que gastou</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.contas.dados.despesasPorTipo.map((d) => (
                          <tr key={d.tipo}>
                            <td>{d.tipo}</td>
                            <td className="num">{NUM.format(d.n)}</td>
                            <td className="num">{REAL.format(d.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {p.contas.dados.fornecedores.length > 0 && (
                <>
                  <h3>Maiores fornecedores</h3>
                  <div className="tabela-rolagem">
                    <table className="tabela">
                      <tbody>
                        {p.contas.dados.fornecedores.map((f, i) => (
                          <tr key={`${f.nome}-${i}`}>
                            <td>{f.nome}</td>
                            <td className="num">{NUM.format(f.n)}</td>
                            <td className="num">{REAL.format(f.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <p className="muted small">
                Valores declarados à Justiça Eleitoral na prestação de contas
                {p.contas.dados.atualizadaEm ? `, atualizada em ${p.contas.dados.atualizadaEm}` : ""}. Doadores e
                fornecedores aparecem só pelo nome.
              </p>
            </>
          ) : (
            <Ausente bloco={p.contas} />
          )}
        </section>
      )}

      {p.faltando.length > 0 && (
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
      )}

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
    p.remuneracao && { href: "#salario", rotulo: "Salário e benefícios" },
    p.gabinete && { href: "#gabinete", rotulo: "Gabinete" },
    p.emendas && { href: "#emendas", rotulo: "Emendas" },
    p.bens && { href: "#bens", rotulo: "Bens" },
    (p.campanha.length > 0 || p.eleicoes.length > 0) && { href: "#eleicoes", rotulo: "Eleições" },
    p.contas && { href: "#contas", rotulo: "Contas da campanha" },
    p.faltando.length > 0 && { href: "#faltando", rotulo: "O que falta" },
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
