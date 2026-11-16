"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";

import { DATA_CONSULTA, DEPUTADOS_POR_UF } from "@/lib/bancadas";
import { ESTADOS, MAPA_VIEWBOX, REGIOES, type Regiao } from "@/lib/brasil";
import { carregarMalhaEstado, type MalhaEstado } from "@/lib/geo";
import { deputadosEstaduaisPorRegra, type ResumoIbge } from "@/lib/ibge";
import type { Parlamentar } from "@/lib/parlamentares";

import { ArcoPartidos, type CasaDoLugar } from "./arco-partidos";
import { DiretorioPoliticos, QuemGoverna } from "./diretorio-politicos";
import { SeletorEstado } from "./seletor-estado";

type Nivel =
  | { tipo: "brasil" }
  | { tipo: "regiao"; regiao: Regiao }
  | { tipo: "estado"; uf: string }
  | { tipo: "municipio"; uf: string; codigo: string };

type Camada = "regiao" | "bancada";

const ORDEM_REGIOES: Regiao[] = ["N", "NE", "CO", "SE", "S"];

/** Escala fria de 5 faixas para o tamanho da bancada, do mais claro ao mais escuro. */
const FAIXAS = [
  { ate: 8, cor: "#dcebf0", rotulo: "8" },
  { ate: 12, cor: "#b5d5df", rotulo: "9 a 12" },
  { ate: 20, cor: "#7fb3c4", rotulo: "13 a 20" },
  { ate: 40, cor: "#3f8fa8", rotulo: "21 a 40" },
  { ate: Infinity, cor: "#1f4e79", rotulo: "41 a 70" },
];
const corBancada = (n: number) => (FAIXAS.find((f) => n <= f.ate) ?? FAIXAS[FAIXAS.length - 1]!).cor;

const regiaoDaUf = (uf: string): Regiao => ESTADOS.find((e) => e.uf === uf)?.regiao ?? "N";
const nomeDaUf = (uf: string) => ESTADOS.find((e) => e.uf === uf)?.nome ?? uf;

/** Anima o viewBox do SVG até o alvo: dá o efeito de zoom ao entrar numa região ou estado. */
function useViewBoxAnimado(alvo: string) {
  const [atual, setAtual] = useState(alvo);
  const anterior = useRef(alvo);

  useEffect(() => {
    const de = anterior.current.split(" ").map(Number);
    const para = alvo.split(" ").map(Number);
    const reduzir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduzir || de.length !== 4 || para.length !== 4) {
      anterior.current = alvo;
      setAtual(alvo);
      return;
    }
    const inicio = performance.now();
    const duracao = 650;
    let quadro = 0;
    const passo = (agora: number) => {
      const t = Math.min(1, (agora - inicio) / duracao);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const texto = de.map((a, i) => (a + ((para[i] ?? a) - a) * e).toFixed(2)).join(" ");
      anterior.current = texto;
      setAtual(texto);
      if (t < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    // Garantia: se a aba estiver em segundo plano e o navegador pausar os quadros,
    // o mapa chega ao enquadramento final mesmo assim.
    const garantia = window.setTimeout(() => {
      anterior.current = alvo;
      setAtual(alvo);
    }, duracao + 80);
    return () => {
      cancelAnimationFrame(quadro);
      window.clearTimeout(garantia);
    };
  }, [alvo]);

  return atual;
}

export function MapaEstados() {
  const [nivel, setNivel] = useState<Nivel>({ tipo: "brasil" });
  const [camada, setCamada] = useState<Camada>("regiao");
  const [hover, setHover] = useState<{ nome: string; detalhe: string; x: number; y: number } | null>(null);
  const [parlamentares, setParlamentares] = useState<Parlamentar[] | null>(null);
  const [erroDados, setErroDados] = useState(false);
  const [malha, setMalha] = useState<{ uf: string; dados: MalhaEstado } | null>(null);
  const [erroMalha, setErroMalha] = useState(false);
  const [alvoBrasil, setAlvoBrasil] = useState(MAPA_VIEWBOX);
  const [estaduais, setEstaduais] = useState<Record<string, Parlamentar[] | "erro">>({});
  const [ibge, setIbge] = useState<ResumoIbge | "erro" | null>(null);
  const [popMunicipios, setPopMunicipios] = useState<Record<string, Record<string, number> | "erro">>({});
  const [governos, setGovernos] = useState<Record<string, Parlamentar[] | "erro">>({});
  const [prefeituras, setPrefeituras] = useState<
    Record<string, { prefeitura: Parlamentar[]; vereadores: Parlamentar[]; aviso?: string } | "erro">
  >({});

  const caixa = useRef<HTMLDivElement>(null);
  const caminhos = useRef(new Map<string, SVGPathElement>());

  const ufAtual = nivel.tipo === "estado" || nivel.tipo === "municipio" ? nivel.uf : null;
  const regiaoAtual: Regiao | null = nivel.tipo === "regiao" ? nivel.regiao : ufAtual ? regiaoDaUf(ufAtual) : null;

  // Deputados e senadores: uma requisição, servida do cache do próprio site.
  useEffect(() => {
    fetch("/legis/api/parlamentares")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { parlamentares: Parlamentar[] }) => setParlamentares(j.parlamentares))
      .catch(() => setErroDados(true));
  }, []);

  // Malha de municípios do IBGE, carregada ao entrar num estado.
  useEffect(() => {
    if (!ufAtual || malha?.uf === ufAtual) return;
    let vivo = true;
    setErroMalha(false);
    carregarMalhaEstado(ufAtual)
      .then((dados) => {
        if (vivo) setMalha({ uf: ufAtual, dados });
      })
      .catch(() => {
        if (vivo) setErroMalha(true);
      });
    return () => {
      vivo = false;
    };
  }, [ufAtual, malha?.uf]);

  // Deputados estaduais (eleitos em 2022): carregados por estado, ao abrir o estado.
  useEffect(() => {
    if (!ufAtual || estaduais[ufAtual]) return;
    let vivo = true;
    fetch(`/legis/api/deputados-estaduais/${ufAtual}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { deputados: Parlamentar[] }) => {
        if (vivo) setEstaduais((m) => ({ ...m, [ufAtual]: j.deputados }));
      })
      .catch(() => {
        if (vivo) setEstaduais((m) => ({ ...m, [ufAtual]: "erro" }));
      });
    return () => {
      vivo = false;
    };
  }, [ufAtual, estaduais]);

  // População (IBGE) e número de municípios: um resumo do país inteiro, servido do cache do site.
  useEffect(() => {
    fetch("/legis/api/ibge/resumo")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: ResumoIbge) => setIbge(j))
      .catch(() => setIbge("erro"));
  }, []);

  // População de cada município do estado aberto.
  useEffect(() => {
    if (!ufAtual || popMunicipios[ufAtual]) return;
    let vivo = true;
    fetch(`/legis/api/ibge/municipios/${ufAtual}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { populacao: Record<string, number> }) => {
        if (vivo) setPopMunicipios((m) => ({ ...m, [ufAtual]: j.populacao }));
      })
      .catch(() => {
        if (vivo) setPopMunicipios((m) => ({ ...m, [ufAtual]: "erro" }));
      });
    return () => {
      vivo = false;
    };
  }, [ufAtual, popMunicipios]);

  // Governador(a) e vice (eleitos em 2022): carregados por estado.
  useEffect(() => {
    if (!ufAtual || governos[ufAtual]) return;
    let vivo = true;
    fetch(`/legis/api/governo/${ufAtual}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { pessoas: Parlamentar[] }) => {
        if (vivo) setGovernos((m) => ({ ...m, [ufAtual]: j.pessoas }));
      })
      .catch(() => {
        if (vivo) setGovernos((m) => ({ ...m, [ufAtual]: "erro" }));
      });
    return () => {
      vivo = false;
    };
  }, [ufAtual, governos]);

  // Prefeito(a), vice e vereadores (eleitos em 2024): carregados por município.
  const nomeMunicipio =
    nivel.tipo === "municipio" && malha?.uf === nivel.uf
      ? malha.dados.municipios.find((m) => m.codigo === nivel.codigo)?.nome
      : undefined;
  const chaveMunicipio = ufAtual && nomeMunicipio ? `${ufAtual}:${nomeMunicipio}` : null;
  useEffect(() => {
    if (!ufAtual || !nomeMunicipio || !chaveMunicipio || ufAtual === "DF" || prefeituras[chaveMunicipio]) return;
    let vivo = true;
    fetch(`/legis/api/municipio/${ufAtual}?nome=${encodeURIComponent(nomeMunicipio)}`)
      .then(async (r) => {
        const j = (await r.json()) as { prefeitura?: Parlamentar[]; vereadores?: Parlamentar[]; erro?: string };
        if (r.status === 404 && j.erro) return { prefeitura: [], vereadores: [], aviso: j.erro };
        if (!r.ok) throw new Error(String(r.status));
        return { prefeitura: j.prefeitura ?? [], vereadores: j.vereadores ?? [] };
      })
      .then((dados) => {
        if (vivo) setPrefeituras((m) => ({ ...m, [chaveMunicipio]: dados }));
      })
      .catch(() => {
        if (vivo) setPrefeituras((m) => ({ ...m, [chaveMunicipio]: "erro" }));
      });
    return () => {
      vivo = false;
    };
  }, [ufAtual, nomeMunicipio, chaveMunicipio, prefeituras]);

  // Enquadramento do mapa do Brasil: país inteiro, a região ou o estado.
  useEffect(() => {
    const ufs =
      nivel.tipo === "brasil"
        ? []
        : nivel.tipo === "regiao"
          ? ESTADOS.filter((e) => e.regiao === nivel.regiao).map((e) => e.uf)
          : [nivel.uf];
    if (!ufs.length) {
      setAlvoBrasil(MAPA_VIEWBOX);
      return;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const uf of ufs) {
      const el = caminhos.current.get(uf);
      if (!el) continue;
      const b = el.getBBox();
      x0 = Math.min(x0, b.x);
      y0 = Math.min(y0, b.y);
      x1 = Math.max(x1, b.x + b.width);
      y1 = Math.max(y1, b.y + b.height);
    }
    if (!Number.isFinite(x0)) return;
    const m = Math.max(x1 - x0, y1 - y0) * 0.08;
    setAlvoBrasil(`${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`);
  }, [nivel]);

  const viewBox = useViewBoxAnimado(alvoBrasil);

  const subir = useCallback(() => {
    setHover(null);
    setNivel((n) =>
      n.tipo === "municipio"
        ? { tipo: "estado", uf: n.uf }
        : n.tipo === "estado"
          ? { tipo: "regiao", regiao: regiaoDaUf(n.uf) }
          : { tipo: "brasil" },
    );
  }, []);

  // Esc volta um nível (fora de campos de texto).
  useEffect(() => {
    const tecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !(ev.target instanceof HTMLInputElement)) subir();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [subir]);

  const mover = (nome: string, detalhe: string, ev: MouseEvent<SVGElement>) => {
    const r = caixa.current?.getBoundingClientRect();
    if (r) setHover({ nome, detalhe, x: ev.clientX - r.left, y: ev.clientY - r.top });
  };

  const ir = (n: Nivel) => {
    setHover(null);
    setNivel(n);
  };

  const clicarEstado = (uf: string) => {
    if (nivel.tipo === "brasil") ir({ tipo: "regiao", regiao: regiaoDaUf(uf) });
    else ir({ tipo: "estado", uf });
  };

  const daUf = useMemo(() => {
    const porUf = new Map<string, { senadores: Parlamentar[]; deputados: Parlamentar[] }>();
    for (const p of parlamentares ?? []) {
      const g = porUf.get(p.uf) ?? { senadores: [], deputados: [] };
      (p.cargo === "Senador(a)" ? g.senadores : g.deputados).push(p);
      porUf.set(p.uf, g);
    }
    return porUf;
  }, [parlamentares]);

  const malhaPronta = ufAtual && malha?.uf === ufAtual ? malha.dados : null;
  const municipio =
    nivel.tipo === "municipio" ? malhaPronta?.municipios.find((m) => m.codigo === nivel.codigo) : undefined;

  // ------------------------------------------------------------ mapas
  const mapaBrasil = (
    <svg viewBox={viewBox} role="img" aria-label="Mapa do Brasil por estado" className="mapa-svg">
      {[...ESTADOS]
        .sort((a, b) => Number(a.uf === ufAtual) - Number(b.uf === ufAtual))
        .map((e) => {
          const foraDaRegiao = regiaoAtual !== null && e.regiao !== regiaoAtual;
          const base = camada === "bancada" ? corBancada(DEPUTADOS_POR_UF[e.uf] ?? 0) : REGIOES[e.regiao].cor;
          const sobre = hover?.nome === e.nome;
          return (
            <path
              key={e.uf}
              ref={(el) => {
                if (el) caminhos.current.set(e.uf, el);
              }}
              d={e.path}
              fill={e.uf === ufAtual ? "#142a33" : base}
              stroke={sobre ? "#142a33" : "#ffffff"}
              strokeWidth={sobre ? 2 : 1}
              className={`mapa-uf${sobre ? " mapa-uf-hover" : ""}${foraDaRegiao ? " mapa-uf-fora" : ""}`}
              onClick={() => clicarEstado(e.uf)}
              onMouseMove={(ev) =>
                mover(
                  e.nome,
                  camada === "bancada" ? `${DEPUTADOS_POR_UF[e.uf] ?? "—"} deputados federais` : REGIOES[e.regiao].nome,
                  ev,
                )
              }
            >
              <title>{e.nome}</title>
            </path>
          );
        })}
    </svg>
  );

  const corEstado = ufAtual ? REGIOES[regiaoDaUf(ufAtual)].cor : "#c9d2dc";
  const mapaMunicipios = ufAtual && malhaPronta && (
    <svg
      key={ufAtual}
      viewBox={malhaPronta.viewBox}
      role="img"
      aria-label={`Mapa dos municípios de ${nomeDaUf(ufAtual)}`}
      className="mapa-svg mapa-municipios"
    >
      {malhaPronta.municipios.map((m) => {
        const ativo = nivel.tipo === "municipio" && nivel.codigo === m.codigo;
        const sobre = hover?.nome === m.nome;
        return (
          <path
            key={m.codigo}
            d={m.path}
            fill={ativo ? "#142a33" : sobre ? "#3f8fa8" : corEstado}
            stroke="#ffffff"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
            className="mapa-mun"
            onClick={() => ir({ tipo: "municipio", uf: ufAtual, codigo: m.codigo })}
            onMouseMove={(ev) => mover(m.nome, nomeDaUf(ufAtual), ev)}
          >
            <title>{m.nome}</title>
          </path>
        );
      })}
    </svg>
  );

  // ------------------------------------------------------- migalhas
  const migalhas: { rotulo: string; ir: Nivel }[] = [{ rotulo: "Brasil", ir: { tipo: "brasil" } }];
  if (regiaoAtual) migalhas.push({ rotulo: REGIOES[regiaoAtual].nome, ir: { tipo: "regiao", regiao: regiaoAtual } });
  if (ufAtual) migalhas.push({ rotulo: nomeDaUf(ufAtual), ir: { tipo: "estado", uf: ufAtual } });
  if (municipio) migalhas.push({ rotulo: municipio.nome, ir: nivel });

  // ---------------------------------------------------------- painel
  const avisoDados = erroDados ? (
    <p className="painel-aviso">Não foi possível carregar a lista de parlamentares agora. Tente de novo em instantes.</p>
  ) : !parlamentares ? (
    <p className="painel-aviso">Carregando parlamentares…</p>
  ) : null;

  const resumo = ibge && ibge !== "erro" ? ibge : null;
  const rotuloPop = resumo ? `População (est. ${resumo.ano})` : "População";
  const semIbge = ibge === "erro" ? "—" : "…";
  const somaMunicipios = (ufs: string[]) =>
    resumo ? ufs.reduce((t, uf) => t + (resumo.municipios[uf] ?? 0), 0) : null;
  const somaEstaduais = (ufs: string[]) =>
    ufs.reduce((t, uf) => t + deputadosEstaduaisPorRegra(DEPUTADOS_POR_UF[uf] ?? 0), 0);
  const fonteIbge = resumo ? (
    <p className="painel-fonte-cards">População: estimativa do IBGE para {resumo.ano}.</p>
  ) : null;

  let painel: ReactNode;
  if (nivel.tipo === "brasil") {
    painel = (
      <>
        <div>
          <p className="painel-regiao">País</p>
          <p className="painel-nome">Brasil</p>
        </div>
        <Cards
          itens={[
            { rotulo: rotuloPop, valor: resumo ? formatarPopulacao(resumo.brasil) : semIbge },
            { rotulo: "Estados", valor: "26 + DF" },
            {
              rotulo: "Municípios",
              valor: formatarNumero(somaMunicipios(ESTADOS.map((e) => e.uf))) ?? semIbge,
              detalhe: "contando Brasília e Noronha",
            },
            { rotulo: "Senadores", valor: "81" },
            { rotulo: "Deputados federais", valor: "513" },
            {
              rotulo: "Deputados estaduais",
              valor: formatarNumero(somaEstaduais(ESTADOS.map((e) => e.uf))) ?? "—",
              detalhe: "com os 24 distritais",
            },
          ]}
        />
        {fonteIbge}
        <p className="painel-aviso">Toque numa região do mapa para aproximar; depois num estado e num município.</p>
        <ul className="regioes-lista" aria-label="Regiões">
          {ORDEM_REGIOES.map((r) => {
            const ufs = ESTADOS.filter((e) => e.regiao === r).map((e) => e.uf).sort();
            return (
              <li key={r}>
                <button type="button" className="regiao-botao" onClick={() => ir({ tipo: "regiao", regiao: r })}>
                  <span className="regioes-num">{ufs.length}</span>
                  <span className="regiao-texto">
                    <strong>{REGIOES[r].nome}</strong>
                    <span className="regioes-ufs">{ufs.join(" · ")}</span>
                  </span>
                  <span className="regiao-seta" aria-hidden="true">
                    →
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </>
    );
  } else if (nivel.tipo === "regiao") {
    const ufs = ESTADOS.filter((e) => e.regiao === nivel.regiao).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const deputados = ufs.reduce((s, e) => s + (DEPUTADOS_POR_UF[e.uf] ?? 0), 0);
    painel = (
      <>
        <div>
          <p className="painel-regiao">Região</p>
          <p className="painel-nome">{REGIOES[nivel.regiao].nome}</p>
        </div>
        <Cards
          itens={[
            {
              rotulo: rotuloPop,
              valor: resumo?.regioes[nivel.regiao] ? formatarPopulacao(resumo.regioes[nivel.regiao]!) : semIbge,
              detalhe:
                resumo?.regioes[nivel.regiao] && resumo.brasil
                  ? `${formatarPercentual(resumo.regioes[nivel.regiao]! / resumo.brasil)} do país`
                  : undefined,
            },
            { rotulo: "Estados", valor: String(ufs.length) },
            { rotulo: "Municípios", valor: formatarNumero(somaMunicipios(ufs.map((e) => e.uf))) ?? semIbge },
            { rotulo: "Senadores", valor: String(ufs.length * 3) },
            {
              rotulo: "Deputados federais",
              valor: String(deputados),
              detalhe: `${formatarPercentual(deputados / 513)} da Câmara`,
            },
            { rotulo: "Deputados estaduais", valor: formatarNumero(somaEstaduais(ufs.map((e) => e.uf))) ?? "—" },
          ]}
        />
        {fonteIbge}
        <ul className="estados-botoes" aria-label="Estados da região">
          {ufs.map((e) => (
            <li key={e.uf}>
              <button type="button" onClick={() => ir({ tipo: "estado", uf: e.uf })}>
                <strong>{e.uf}</strong>
                <span className="estados-botoes-nome">{e.nome}</span>
                <span className="estados-botoes-dep">{DEPUTADOS_POR_UF[e.uf] ?? "—"} dep.</span>
              </button>
            </li>
          ))}
        </ul>
        {avisoDados}
      </>
    );
  } else {
    const uf = nivel.uf;
    const grupo = daUf.get(uf);
    const federais = grupo?.deputados.length || DEPUTADOS_POR_UF[uf] || 8;
    const pops = popMunicipios[uf];
    const popMunicipio = municipio && pops && pops !== "erro" ? pops[municipio.codigo] : undefined;
    const dadosPrefeitura = chaveMunicipio ? prefeituras[chaveMunicipio] : undefined;
    const prefeitura = dadosPrefeitura && dadosPrefeitura !== "erro" ? dadosPrefeitura : null;
    const prefeito = prefeitura?.prefeitura.find((p) => p.cargo === "Prefeito(a)");
    const nVereadores = prefeitura?.vereadores.length ?? 0;
    const carregando = (falhou: boolean) => (falhou ? "—" : "…");
    const cardsMunicipio: Card[] = [
      {
        rotulo: rotuloPop,
        valor: popMunicipio ? formatarPopulacao(popMunicipio) : carregando(pops === "erro"),
        detalhe:
          popMunicipio && resumo?.ufs[uf] ? `${formatarPercentual(popMunicipio / resumo.ufs[uf]!)} do estado` : undefined,
      },
      ...(uf === "DF" || prefeitura?.aviso
        ? []
        : [
            {
              rotulo: "Prefeito(a)",
              valor: prefeito?.nome ?? (prefeitura ? "—" : carregando(dadosPrefeitura === "erro")),
              detalhe: prefeito ? `${prefeito.partido} · eleito(a) em 2024` : undefined,
              texto: true,
            },
            {
              rotulo: "Vereadores",
              valor: prefeitura ? String(nVereadores) : carregando(dadosPrefeitura === "erro"),
              detalhe:
                popMunicipio && nVereadores
                  ? `1 para cada ${formatarNumero(Math.round(popMunicipio / nVereadores))} habitantes`
                  : undefined,
            },
          ]),
    ];
    painel = (
      <>
        <div>
          <p className="painel-regiao">{municipio ? `Município · ${uf}` : `Estado · ${REGIOES[regiaoDaUf(uf)].nome}`}</p>
          <p className="painel-nome">{municipio ? municipio.nome : nomeDaUf(uf)}</p>
        </div>
        {municipio ? (
          <Cards itens={cardsMunicipio} />
        ) : (
          <Cards
            itens={[
              {
                rotulo: rotuloPop,
                valor: resumo?.ufs[uf] ? formatarPopulacao(resumo.ufs[uf]!) : semIbge,
                detalhe:
                  resumo?.ufs[uf] && resumo.brasil
                    ? `${formatarPercentual(resumo.ufs[uf]! / resumo.brasil)} do país`
                    : undefined,
              },
              {
                rotulo: "Municípios",
                valor: uf === "DF" ? "1" : (formatarNumero(resumo?.municipios[uf] ?? null) ?? semIbge),
                detalhe: uf === "DF" ? "Brasília, sem prefeitura" : undefined,
              },
              { rotulo: "Senadores", valor: String(grupo?.senadores.length || 3) },
              { rotulo: "Deputados federais", valor: String(federais) },
              {
                rotulo: uf === "DF" ? "Deputados distritais" : "Deputados estaduais",
                valor: String(
                  Array.isArray(estaduais[uf]) ? estaduais[uf].length : deputadosEstaduaisPorRegra(federais),
                ),
              },
              {
                rotulo: "Habitantes por deputado federal",
                valor: resumo?.ufs[uf] ? formatarPopulacao(resumo.ufs[uf]! / federais) : semIbge,
                detalhe: resumo ? `média nacional: ${formatarPopulacao(resumo.brasil / 513)}` : undefined,
              },
            ]}
          />
        )}
        {fonteIbge}
        {!municipio && malhaPronta && (
          <p className="painel-aviso">
            Toque num município do mapa para ver a prefeitura, a câmara de vereadores e quem o representa.
          </p>
        )}
        {municipio && uf === "DF" && (
          <p className="painel-aviso">
            O Distrito Federal não tem prefeitura nem vereadores: quem governa é o governador, e quem legisla é a
            Câmara Legislativa.
          </p>
        )}
        {municipio && uf !== "DF" && dadosPrefeitura === "erro" && (
          <p className="painel-aviso">Não foi possível carregar a prefeitura e a câmara municipal do TSE agora.</p>
        )}
        {municipio && uf !== "DF" && !dadosPrefeitura && (
          <p className="painel-aviso">Carregando prefeitura e vereadores…</p>
        )}
        {prefeitura?.aviso && <p className="painel-aviso">{prefeitura.aviso}</p>}
        {governos[uf] === "erro" && <p className="painel-aviso">Não foi possível carregar o governo do estado do TSE agora.</p>}
        {estaduais[uf] === "erro" && (
          <p className="painel-aviso">
            Não foi possível carregar os deputados {uf === "DF" ? "distritais" : "estaduais"} do TSE agora.
          </p>
        )}
        {(!governos[uf] || !estaduais[uf]) && <p className="painel-aviso">Carregando dados do TSE…</p>}
        {avisoDados}
        <p className="painel-aviso">Abaixo do mapa: quem governa, as bancadas e todos os eleitos, de A a Z.</p>
      </>
    );
  }

  // ------------------------------------------------- abaixo do mapa
  const lista = (v: Parlamentar[] | "erro" | undefined) => (Array.isArray(v) ? v : []);
  const federaisDe = (ufs: string[]) => ufs.flatMap((u) => daUf.get(u)?.deputados ?? []);
  const senadoresDe = (ufs: string[]) => ufs.flatMap((u) => daUf.get(u)?.senadores ?? []);
  const fonteTse =
    "Governadores, deputados estaduais, prefeitos e vereadores: eleitos segundo o TSE (2022 e 2024), com o partido da eleição; quem renunciou, foi cassado ou assumiu depois não aparece.";

  let lugar = "Brasil";
  let destaques: Parlamentar[] = [];
  let tituloDestaques = "";
  let casas: CasaDoLugar[] = [];
  let todos: Parlamentar[] = [];
  let notaTodos: ReactNode = "Senadores e deputados federais no exercício do mandato, segundo a Câmara e o Senado.";

  if (nivel.tipo === "brasil") {
    const ufs = ESTADOS.map((e) => e.uf);
    casas = [
      { id: "camara", rotulo: "Na Câmara", pessoas: federaisDe(ufs) },
      { id: "senado", rotulo: "No Senado", pessoas: senadoresDe(ufs) },
    ];
    todos = parlamentares ?? [];
  } else if (nivel.tipo === "regiao") {
    const ufs = ESTADOS.filter((e) => e.regiao === nivel.regiao).map((e) => e.uf);
    lugar = REGIOES[nivel.regiao].nome;
    casas = [
      { id: "camara", rotulo: "Na Câmara", pessoas: federaisDe(ufs) },
      { id: "senado", rotulo: "No Senado", pessoas: senadoresDe(ufs) },
    ];
    todos = [...senadoresDe(ufs), ...federaisDe(ufs)];
  } else {
    const uf = nivel.uf;
    const governo = lista(governos[uf]);
    const assembleia = lista(estaduais[uf]);
    const doEstado = [...governo, ...senadoresDe([uf]), ...federaisDe([uf]), ...assembleia];
    casas = [
      {
        id: "assembleia",
        rotulo: uf === "DF" ? "Câmara Legislativa" : "Assembleia",
        pessoas: assembleia,
        nota: "Deputados eleitos em 2022, com o partido da eleição (TSE).",
      },
      { id: "camara", rotulo: "Na Câmara", pessoas: federaisDe([uf]) },
      { id: "senado", rotulo: "No Senado", pessoas: senadoresDe([uf]) },
    ];
    notaTodos = fonteTse;
    if (municipio) {
      const pref = prefeituras[chaveMunicipio ?? ""];
      const dados = pref && pref !== "erro" ? pref : null;
      lugar = `${municipio.nome} (${uf})`;
      destaques = [...(dados?.prefeitura ?? []), ...governo.filter((p) => p.cargo === "Governador(a)")];
      tituloDestaques = "Quem governa a cidade e o estado";
      casas = [
        {
          id: "vereadores",
          rotulo: "Câmara municipal",
          pessoas: dados?.vereadores ?? [],
          nota: "Vereadores eleitos em 2024, com o partido da eleição (TSE).",
        },
        ...casas,
      ];
      todos = [...(dados?.prefeitura ?? []), ...(dados?.vereadores ?? []), ...doEstado];
    } else {
      lugar = nomeDaUf(uf);
      destaques = [...governo, ...senadoresDe([uf])];
      tituloDestaques = "Quem governa e quem está no Senado";
      todos = doEstado;
      notaTodos = (
        <>
          {fonteTse} Prefeitos e vereadores aparecem ao abrir cada município no mapa.
        </>
      );
    }
  }

  // "do Acre", "da Bahia", "de São Paulo", "do Nordeste", "de Rio Branco (AC)".
  const comPreposicao =
    nivel.tipo === "brasil"
      ? "do Brasil"
      : nivel.tipo === "regiao"
        ? `do ${lugar}`
        : municipio
          ? `de ${lugar}`
          : `${PREPOSICAO_UF[nivel.uf] ?? "de"} ${lugar}`;

  const abaixoDoMapa = (
    <div key={`abaixo-${lugar}`} className="lugar-detalhe">
      <QuemGoverna
        titulo={tituloDestaques}
        pessoas={destaques}
        nota={
          municipio
            ? "Prefeitura eleita em 2024 e governo eleito em 2022, segundo o TSE, com o partido da eleição."
            : "Governo eleito em 2022, segundo o TSE, com o partido da eleição; quem renunciou ou assumiu depois não aparece. Senadores: Senado Federal."
        }
      />
      {nivel.tipo !== "brasil" && (
        <ArcoPartidos key={`arco-${lugar}`} titulo={`As bancadas ${comPreposicao}`} casas={casas} />
      )}
      <DiretorioPoliticos key={`dir-${lugar}`} lugar={lugar} pessoas={todos} nota={notaTodos} />
    </div>
  );

  return (
    <section className={`card estados${nivel.tipo === "brasil" ? "" : " estados-zoom"}`} aria-labelledby="estados-titulo">
      <div className="estados-mapa">
        <div className="card-head">
          <h2 id="estados-titulo">Quem representa cada lugar</h2>
          {(nivel.tipo === "brasil" || nivel.tipo === "regiao") && (
            <div className="segmentado" role="group" aria-label="O que o mapa mostra">
              <button type="button" aria-pressed={camada === "regiao"} onClick={() => setCamada("regiao")}>
                Regiões
              </button>
              <button type="button" aria-pressed={camada === "bancada"} onClick={() => setCamada("bancada")}>
                Deputados por estado
              </button>
            </div>
          )}
        </div>

        <nav className="migalhas" aria-label="Nível do mapa">
          {nivel.tipo !== "brasil" && (
            <button type="button" className="migalhas-voltar" onClick={subir} aria-label="Voltar um nível">
              ←
            </button>
          )}
          <ol>
            {migalhas.map((m, i) => (
              <li key={m.rotulo}>
                {i < migalhas.length - 1 ? (
                  <button type="button" onClick={() => ir(m.ir)}>
                    {m.rotulo}
                  </button>
                ) : (
                  <span aria-current="location">{m.rotulo}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mapa-caixa" ref={caixa} onMouseLeave={() => setHover(null)}>
          {mapaMunicipios || mapaBrasil}
          {ufAtual && !malhaPronta && !erroMalha && <p className="mapa-carregando">Carregando municípios…</p>}
          {ufAtual && erroMalha && <p className="mapa-carregando">Não foi possível carregar os municípios do IBGE.</p>}
          {hover && (
            <div className="mapa-tooltip" style={{ left: hover.x, top: hover.y }} aria-hidden="true">
              <strong>{hover.nome}</strong>
              <span>{hover.detalhe}</span>
            </div>
          )}
        </div>

        {camada === "bancada" && (nivel.tipo === "brasil" || nivel.tipo === "regiao") ? (
          <ul className="legenda-faixas" aria-label="Deputados federais por estado">
            {FAIXAS.map((f) => (
              <li key={f.rotulo}>
                <span style={{ background: f.cor }} aria-hidden="true" />
                {f.rotulo}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small center">
            As cores indicam apenas a região do IBGE; não representam partido nem avaliação. Esc volta um nível.
          </p>
        )}

        <div className="mapa-lista">
          <span>Ir direto para</span>
          <SeletorEstado valor={ufAtual ?? ""} aoEscolher={(uf) => ir({ tipo: "estado", uf })} />
        </div>
        <p className="muted small center">
          Mapas: <a href="https://github.com/VictorCazanave/svg-maps">svg-maps</a> (Victor Cazanave,{" "}
          <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>) e malha municipal do{" "}
          <a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3">IBGE</a>.
        </p>
      </div>

      <aside key={JSON.stringify(nivel)} className="painel-uf" aria-live="polite">
        {painel}
        <p className="painel-fonte">
          Fontes: Câmara dos Deputados e Senado Federal (dados abertos). Bancadas por estado: consulta em {DATA_CONSULTA}.
        </p>
      </aside>

      {abaixoDoMapa}
    </section>
  );
}

const PREPOSICAO_UF: Record<string, string> = {
  AC: "do", AM: "do", AP: "do", CE: "do", DF: "do", ES: "do", MA: "do", PA: "do", PI: "do",
  PR: "do", RJ: "do", RN: "do", RS: "do", TO: "do", BA: "da", PB: "da",
};

// ------------------------------------------------------------- cards

interface Card {
  rotulo: string;
  valor: string;
  detalhe?: string;
  /** Valor em texto (um nome), mostrado menor que os números. */
  texto?: boolean;
}

function Cards({ itens }: { itens: Card[] }) {
  return (
    <div className="painel-numeros">
      {itens.map((c) => (
        <div key={c.rotulo} className="painel-card">
          <p>{c.rotulo}</p>
          <p className={c.texto ? "painel-num painel-num-texto" : "painel-num"}>{c.valor}</p>
          {c.detalhe && <p className="painel-card-detalhe">{c.detalhe}</p>}
        </div>
      ))}
    </div>
  );
}

const NUMERO = new Intl.NumberFormat("pt-BR");
const DECIMAL = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatarNumero(n: number | null) {
  return n === null ? null : NUMERO.format(n);
}

/** 214211951 → "214,2 mi"; 887794 → "887,8 mil"; 14762 → "14.762". */
function formatarPopulacao(n: number) {
  if (n >= 1_000_000) return `${DECIMAL.format(n / 1_000_000)} mi`;
  if (n >= 100_000) return `${DECIMAL.format(n / 1_000)} mil`;
  return NUMERO.format(Math.round(n));
}

function formatarPercentual(fracao: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: fracao < 0.01 ? 2 : 1 }).format(fracao * 100)}%`;
}
