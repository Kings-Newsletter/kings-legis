"use client";

import { useId, useMemo, useRef, useState, type SyntheticEvent } from "react";

import { fileirasPara, posicoes, raioPara } from "@/lib/arco";
import { COR_PARTIDO } from "@/lib/bancadas";
import { CAMPOS, campoDe, descricaoCampo, FONTE_IDEOLOGIA, posicaoNoEixo, type Campo } from "@/lib/ideologia";
import type { Parlamentar } from "@/lib/parlamentares";

export interface CasaDoLugar {
  id: string;
  /** Rótulo do botão, como "Na Câmara" ou "Assembleia". */
  rotulo: string;
  pessoas: Parlamentar[];
  nota?: string;
}

interface Props {
  titulo: string;
  casas: CasaDoLugar[];
}

interface Assento {
  x: number;
  y: number;
  th: number;
  ordem: number;
  cor: string;
  pessoa: Parlamentar;
}

/**
 * Bancadas de um lugar em arco: cada bolinha é a cadeira de uma pessoa, com a foto
 * dela e um anel na cor do partido. Passar o mouse (ou tocar) numa bolinha mostra
 * quem está nela; num partido, destaca a bancada inteira.
 */
export function ArcoPartidos({ titulo, casas }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const disponiveis = casas.filter((c) => c.pessoas.length > 0);
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [partidoFixo, setPartidoFixo] = useState<string | null>(null);
  const [partidoHover, setPartidoHover] = useState<string | null>(null);
  const [pessoaFixa, setPessoaFixa] = useState<string | null>(null);
  const [pessoaHover, setPessoaHover] = useState<string | null>(null);
  // Posição do minicard, em px dentro da área do arco (acima da bolinha em foco).
  const [ponto, setPonto] = useState<{ x: number; y: number; base: number } | null>(null);
  const area = useRef<HTMLDivElement>(null);
  const casa = disponiveis.find((c) => c.id === escolhida) ?? disponiveis[0];

  const grupos = useMemo(() => {
    const porSigla = new Map<string, Parlamentar[]>();
    for (const p of casa?.pessoas ?? []) porSigla.set(p.partido, [...(porSigla.get(p.partido) ?? []), p]);
    return [...porSigla.entries()]
      .map(([sigla, pessoas]) => ({
        sigla,
        pessoas: pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
        cor: COR_PARTIDO[sigla] ?? "#9aa5b1",
      }))
      // Da esquerda para a direita, pela nota da pesquisa; sem nota, no fim.
      .sort(
        (a, b) =>
          posicaoNoEixo(a.sigla) - posicaoNoEixo(b.sigla) ||
          b.pessoas.length - a.pessoas.length ||
          a.sigla.localeCompare(b.sigla, "pt-BR"),
      );
  }, [casa]);

  if (!casa) return null;

  const total = casa.pessoas.length;
  const fileiras = fileirasPara(total);
  const raio = raioPara(total, fileiras);
  const pos = posicoes(total, fileiras);
  const assentos: Assento[] = [];
  for (const g of grupos) {
    for (const pessoa of g.pessoas) {
      const p = pos[assentos.length];
      if (p) assentos.push({ x: p.x, y: p.y, th: p.th, ordem: assentos.length, cor: g.cor, pessoa });
    }
  }

  // Partido clicado: só a bancada dele fica no arco, rearrumada em fileiras próprias,
  // com bolinhas maiores e a foto de cada um; as outras cadeiras somem.
  // O filtro pode ser um partido ("PT") ou um campo ("campo:esquerda").
  const pertence = (filtro: string | null, sigla: string) =>
    filtro === null ? false : filtro.startsWith("campo:") ? campoDe(sigla) === filtro.slice(6) : sigla === filtro;
  const membrosFixos = partidoFixo ? grupos.filter((g) => pertence(partidoFixo, g.sigla)).flatMap((g) => g.pessoas) : [];
  const bancadaFixa = membrosFixos.length ? { pessoas: membrosFixos } : undefined;
  const alvos = new Map<string, { x: number; y: number; s: number }>();
  if (bancadaFixa) {
    const n = bancadaFixa.pessoas.length;
    const f2 = fileirasPara(n);
    const r2 = Math.min(raioPara(n, f2), 26);
    const pos2 = posicoes(n, f2);
    bancadaFixa.pessoas.forEach((p, i) => {
      const q = pos2[i];
      if (q) alvos.set(p.id, { x: q.x, y: q.y, s: r2 / raio });
    });
  }

  const ordemBancada = new Map([...alvos.keys()].map((id, i) => [id, i]));

  const pessoaFoco = assentos.find((a) => a.pessoa.id === (pessoaHover ?? pessoaFixa));
  const partidoFoco = partidoFixo ?? partidoHover ?? null;
  const nFoco = partidoFoco
    ? grupos.filter((g) => pertence(partidoFoco, g.sigla)).reduce((t, g) => t + g.pessoas.length, 0)
    : 0;
  const rotuloFoco = partidoFoco?.startsWith("campo:")
    ? (CAMPOS.find((c) => c.id === partidoFoco.slice(6))?.rotulo ?? "")
    : partidoFoco;

  // Faixa de fora do arco: onde começa e termina cada campo (só no arco completo).
  const contaCampo = (c: Campo) => assentos.filter((a) => campoDe(a.pessoa.partido) === c).length;
  const semNota = assentos.filter((a) => campoDe(a.pessoa.partido) === null).length;
  const faixas = CAMPOS.map((c) => {
    const ths = assentos.filter((a) => campoDe(a.pessoa.partido) === c.id).map((a) => a.th);
    return ths.length ? { ...c, de: Math.max(...ths), ate: Math.min(...ths), n: ths.length } : null;
  }).filter((f) => f !== null);
  const pct = (n: number) => ((n / total) * 100).toFixed(1).replace(".", ",");
  const passo = Math.min(40, 700 / total);
  const anel = Math.max(1.5, raio * 0.16);
  const margem = raio + anel;
  const folga = 34; // espaço acima para a faixa de campos e os rótulos
  const folgaX = 96; // espaço dos lados para os rótulos das pontas
  const rFaixa = 232 + raio + anel + 8;
  const ponto2 = (r: number, th: number) => `${(250 + r * Math.cos(th)).toFixed(1)} ${(246 - r * Math.sin(th)).toFixed(1)}`;

  const trocar = (id: string) => {
    setEscolhida(id);
    setPartidoFixo(null);
    setPartidoHover(null);
    setPessoaFixa(null);
    setPessoaHover(null);
    setPonto(null);
  };

  const marcarPonto = (ev: SyntheticEvent<SVGGElement>) => {
    const caixa = area.current?.getBoundingClientRect();
    const b = ev.currentTarget.getBoundingClientRect();
    if (!caixa) return;
    // Mantém o minicard (~260 px de largura) dentro da área do arco.
    const meio = Math.min(130, caixa.width / 2);
    const x = Math.min(Math.max(b.left + b.width / 2 - caixa.left, meio), caixa.width - meio);
    setPonto({ x, y: b.top - caixa.top, base: b.bottom - caixa.top });
  };

  // Partido em foco apaga as outras bancadas; pessoa em foco só recua as demais.
  const recuo = (a: Assento) =>
    bancadaFixa
      ? pessoaFoco && pessoaFoco.pessoa.id !== a.pessoa.id
        ? " cadeira-recua"
        : ""
      : partidoFoco !== null
      ? !pertence(partidoFoco, a.pessoa.partido)
        ? " cadeira-apagada"
        : ""
      : pessoaFoco && pessoaFoco.pessoa.id !== a.pessoa.id
        ? " cadeira-recua"
        : "";

  const alternarPessoa = (id: string) => {
    setPessoaFixa((atual) => (atual === id ? null : id));
  };

  return (
    <section className="lugar-bloco" aria-label={titulo}>
      <div className="lugar-bloco-topo">
        <h3>{titulo}</h3>
        {disponiveis.length > 1 && (
          <div className="segmentado" role="group" aria-label="Casa">
            {disponiveis.map((c) => (
              <button key={c.id} type="button" aria-pressed={c.id === casa.id} onClick={() => trocar(c.id)}>
                {c.rotulo} · {c.pessoas.length}
              </button>
            ))}
          </div>
        )}
      </div>
      <p className="muted small">
        Cada bolinha é a cadeira de uma pessoa, na cor do partido, com os partidos da esquerda para a direita. Passe o
        mouse numa bolinha para ver quem está nela; toque num campo ou num partido para ver só as cadeiras dele, com o
        rosto de cada um (toque de novo para voltar).
      </p>

      <div className="arco-lugar" ref={area}>
        <svg
          key={casa.id}
          viewBox={`${-margem - folgaX} ${-margem - folga} ${500 + 2 * (margem + folgaX)} ${262 + 2 * margem + folga}`}
          role="group"
          aria-label={`${casa.rotulo}: ${total} cadeiras em arco, partidos da esquerda para a direita`}
          className="hemiciclo-svg arco-fotos"
          onMouseLeave={() => {
            setPessoaHover(null);
            setPartidoHover(null);
          }}
        >
          <defs>
            <clipPath id={`${uid}-foto`}>
              <circle cx={0} cy={0} r={raio} />
            </clipPath>
          </defs>
          <g className={`faixas${bancadaFixa ? " faixas-ocultas" : ""}`} aria-hidden="true">
            {faixas.map((f) => {
              // Um campo de uma coluna só ainda ganha um traço visível.
              const curto = f.de - f.ate < 0.04;
              const de = curto ? f.de + 0.02 : f.de;
              const ate = curto ? f.ate - 0.02 : f.ate;
              const meio = (de + ate) / 2;
              const [lx, ly] = ponto2(rFaixa + 16, meio).split(" ").map(Number);
              return (
                <g key={f.id}>
                  <path
                    d={`M ${ponto2(rFaixa, de)} A ${rFaixa} ${rFaixa} 0 0 1 ${ponto2(rFaixa, Math.min(ate, de - 0.001))}`}
                    fill="none"
                    stroke={f.cor}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <text
                    x={lx}
                    y={ly}
                    textAnchor={meio > Math.PI * 0.62 ? "end" : meio < Math.PI * 0.38 ? "start" : "middle"}
                    className="faixa-rotulo"
                    style={{ fill: f.cor }}
                  >
                    {f.rotulo} {f.n}
                  </text>
                </g>
              );
            })}
          </g>
          {assentos.map((a) => {
            const emFoco = pessoaFoco?.pessoa.id === a.pessoa.id;
            const alvo = alvos.get(a.pessoa.id);
            const oculta = bancadaFixa !== undefined && !alvo;
            const x = alvo?.x ?? a.x;
            const y = alvo?.y ?? a.y;
            const escala = alvo?.s ?? (oculta ? 0 : 1);
            return (
              <g
                key={a.pessoa.id}
                className={`assento${oculta ? " assento-oculto" : ""}${alvo ? " assento-bancada" : ""}`}
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${escala})`,
                  transitionDelay: `${alvo ? Math.min((ordemBancada.get(a.pessoa.id) ?? 0) * 6, 400) : 0}ms`,
                }}
              >
              <g
                role="button"
                tabIndex={oculta ? -1 : 0}
                aria-hidden={oculta || undefined}
                aria-label={`${a.pessoa.nome}, ${a.pessoa.partido}`}
                aria-pressed={pessoaFixa === a.pessoa.id}
                className={`cadeira cadeira-foto${recuo(a)}${emFoco ? " cadeira-destaque" : ""}`}
                style={{ animationDelay: `${Math.round(a.ordem * passo)}ms` }}
                onMouseEnter={(ev) => {
                  marcarPonto(ev);
                  setPessoaHover(a.pessoa.id);
                }}
                onMouseLeave={() => setPessoaHover(null)}
                onFocus={(ev) => {
                  marcarPonto(ev);
                  setPessoaHover(a.pessoa.id);
                }}
                onBlur={() => setPessoaHover(null)}
                onClick={(ev) => {
                  marcarPonto(ev);
                  alternarPessoa(a.pessoa.id);
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    alternarPessoa(a.pessoa.id);
                  }
                }}
              >
                <circle cx={0} cy={0} r={raio} fill={a.cor} />
                <image
                  href={a.pessoa.foto}
                  x={-raio}
                  y={-raio}
                  width={raio * 2}
                  height={raio * 2}
                  preserveAspectRatio="xMidYMin slice"
                  clipPath={`url(#${uid}-foto)`}
                />
                <circle cx={0} cy={0} r={raio} fill="none" stroke={a.cor} strokeWidth={anel} />
                <title>{`${a.pessoa.nome} · ${a.pessoa.partido}`}</title>
              </g>
              </g>
            );
          })}
          <text key={partidoFoco ?? "total"} x={250} y={228} textAnchor="middle" className="hemiciclo-num">
            {partidoFoco ? nFoco : total}
          </text>
          <text x={250} y={250} textAnchor="middle" className="hemiciclo-txt">
            {partidoFoco ? `${rotuloFoco} · ${pct(nFoco)}%` : "cadeiras"}
          </text>
        </svg>

        {pessoaFoco && ponto && (
          <div
            key={pessoaFoco.pessoa.id}
            className={`minicard${ponto.y < 120 ? " minicard-abaixo" : ""}`}
            style={{ left: ponto.x, top: ponto.y < 120 ? ponto.base : ponto.y, borderColor: pessoaFoco.cor }}
            role="status"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={pessoaFoco.pessoa.foto} alt="" width={48} height={48} style={{ borderColor: pessoaFoco.cor }} />
            <span className="minicard-texto">
              <span className="minicard-nome">{pessoaFoco.pessoa.nome}</span>
              <span className="minicard-cargo">
                {pessoaFoco.pessoa.cargo} · {pessoaFoco.pessoa.uf}
              </span>
              <span className="minicard-partido">
                <i style={{ background: pessoaFoco.cor }} aria-hidden="true" />
                {pessoaFoco.pessoa.partido}
                <span className="minicard-campo">· {descricaoCampo(pessoaFoco.pessoa.partido)}</span>
              </span>
            </span>
          </div>
        )}

        <div className="arco-lado">
          <ul className="campos" aria-label="Esquerda, centro e direita" onMouseLeave={() => setPartidoHover(null)}>
            {CAMPOS.map((c) => {
              const n = contaCampo(c.id);
              if (!n) return null;
              const chave = `campo:${c.id}`;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`campo${partidoFoco === chave ? " campo-ativo" : ""}`}
                    style={{ ["--campo" as string]: c.cor }}
                    aria-pressed={partidoFixo === chave}
                    onMouseEnter={() => setPartidoHover(chave)}
                    onFocus={() => setPartidoHover(chave)}
                    onBlur={() => setPartidoHover(null)}
                    onClick={() => {
                      setPessoaFixa(null);
                      setPartidoFixo(partidoFixo === chave ? null : chave);
                    }}
                  >
                    <span className="campo-rotulo">{c.rotulo}</span>
                    <strong>{n}</strong>
                    <span className="campo-pct">{pct(n)}%</span>
                  </button>
                </li>
              );
            })}
            {semNota > 0 && (
              <li className="campo-sem-nota">
                sem nota <strong>{semNota}</strong>
              </li>
            )}
          </ul>
          <ul className="chips" aria-label="Bancadas, da esquerda para a direita" onMouseLeave={() => setPartidoHover(null)}>
            {grupos.map((g) => (
              <li key={g.sigla}>
                <button
                  type="button"
                  className={`chip${partidoFoco === g.sigla ? " chip-ativo" : ""}`}
                  title={descricaoCampo(g.sigla)}
                  aria-pressed={partidoFixo === g.sigla}
                  onMouseEnter={() => setPartidoHover(g.sigla)}
                  onFocus={() => setPartidoHover(g.sigla)}
                  onBlur={() => setPartidoHover(null)}
                  onClick={() => {
                    setPessoaFixa(null);
                    setPartidoFixo(partidoFixo === g.sigla ? null : g.sigla);
                  }}
                >
                  <span className="chip-cor" style={{ background: g.cor }} aria-hidden="true" />
                  {g.sigla} <strong>{g.pessoas.length}</strong>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {casa.nota && <p className="muted small">{casa.nota}</p>}
      <p className="muted small">
        Esquerda, centro e direita: nota de cada partido de 0 (esquerda) a 10 (direita) na pesquisa de {FONTE_IDEOLOGIA}{" "}
        Esquerda até 4,49; centro de 4,5 a 5,5; direita acima de 5,5. Fusões posteriores à pesquisa (União, PRD) ficam
        no campo das siglas de origem; partidos mais novos ficam sem nota.
      </p>
    </section>
  );
}
