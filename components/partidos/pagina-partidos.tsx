"use client";

import { useEffect, useMemo, useState } from "react";

import { ArcoPartidos } from "@/components/home/arco-partidos";
import { SeletorEstado } from "@/components/home/seletor-estado";
import { COR_PARTIDO, DATA_CONSULTA } from "@/lib/bancadas";
import { descricaoCampo } from "@/lib/ideologia";
import { ESTADOS } from "@/lib/brasil";
import type { Parlamentar } from "@/lib/parlamentares";
import { PARTIDOS } from "@/lib/partidos";

const PREPOSICAO_UF: Record<string, string> = {
  AC: "no", AM: "no", AP: "no", CE: "no", DF: "no", ES: "no", MA: "no", PA: "no", PI: "no",
  PR: "no", RJ: "no", RN: "no", RS: "no", TO: "no", BA: "na", PB: "na",
};

interface Bancada {
  sigla: string;
  cor: string;
  deputados: Parlamentar[];
  senadores: Parlamentar[];
}

/**
 * Página de partidos: o arco do Congresso (uma bolinha por pessoa, na cor do partido,
 * com a foto ao passar o mouse), filtro por estado e um cartão por partido.
 */
export function PaginaPartidos() {
  const [pessoas, setPessoas] = useState<Parlamentar[] | null>(null);
  const [erro, setErro] = useState(false);
  const [uf, setUf] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    fetch("/legis/api/parlamentares")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { parlamentares: Parlamentar[] }) => setPessoas(j.parlamentares))
      .catch(() => setErro(true));
  }, []);

  const doLugar = useMemo(() => (pessoas ?? []).filter((p) => !uf || p.uf === uf), [pessoas, uf]);
  const deputados = doLugar.filter((p) => p.cargo === "Deputado(a) federal");
  const senadores = doLugar.filter((p) => p.cargo === "Senador(a)");

  const bancadas = useMemo(() => {
    const mapa = new Map<string, Bancada>();
    for (const p of doLugar) {
      const b = mapa.get(p.partido) ?? {
        sigla: p.partido,
        cor: COR_PARTIDO[p.partido] ?? "#9aa5b1",
        deputados: [],
        senadores: [],
      };
      (p.cargo === "Senador(a)" ? b.senadores : b.deputados).push(p);
      mapa.set(p.partido, b);
    }
    return [...mapa.values()].sort(
      (a, b) =>
        b.deputados.length + b.senadores.length - (a.deputados.length + a.senadores.length) ||
        a.sigla.localeCompare(b.sigla, "pt-BR"),
    );
  }, [doLugar]);

  const nomeUf = ESTADOS.find((e) => e.uf === uf)?.nome;
  const onde = uf && nomeUf ? `${PREPOSICAO_UF[uf] ?? "em"} ${nomeUf}` : "no Brasil";
  const maior = Math.max(1, ...bancadas.map((b) => b.deputados.length + b.senadores.length));

  if (erro) {
    return <p className="notice">Não foi possível carregar os parlamentares agora. Tente de novo em instantes.</p>;
  }
  if (!pessoas) return <p className="notice">Carregando deputados e senadores…</p>;

  return (
    <>
      <div className="partidos-filtro">
        <span>Estado</span>
        <SeletorEstado valor={uf} aoEscolher={setUf} />
        {uf && (
          <button type="button" className="partidos-limpar" onClick={() => setUf("")}>
            Ver o Brasil todo
          </button>
        )}
        <p className="partidos-resumo">
          <strong>{bancadas.filter((b) => b.sigla !== "S/Partido").length}</strong> partidos com cadeira {onde} · {deputados.length} deputados ·{" "}
          {senadores.length} senadores
        </p>
      </div>

      <ArcoPartidos
        key={uf || "brasil"}
        titulo={`Como está o Congresso ${onde}`}
        casas={[
          {
            id: "camara",
            rotulo: "Câmara",
            pessoas: deputados,
            nota: `Parlamentares em exercício. Fonte: Câmara dos Deputados, dados abertos, consulta em ${DATA_CONSULTA}.`,
          },
          {
            id: "senado",
            rotulo: "Senado",
            pessoas: senadores,
            nota: `Parlamentares em exercício. Fonte: Senado Federal, dados abertos, consulta em ${DATA_CONSULTA}.`,
          },
        ]}
      />

      <section className="lugar-bloco" aria-labelledby="partidos-lista-titulo">
        <div className="lugar-bloco-topo">
          <h3 id="partidos-lista-titulo">Cada partido {onde}</h3>
          <p className="muted small">Toque num partido para ver os rostos da bancada.</p>
        </div>
        <ul className="partidos-lista">
          {bancadas.map((b) => {
            const info = PARTIDOS[b.sigla];
            const total = b.deputados.length + b.senadores.length;
            const expandido = aberto === b.sigla;
            return (
              <li key={b.sigla} className={`partido-card${expandido ? " partido-card-aberto" : ""}`}>
                <button
                  type="button"
                  className="partido-topo"
                  aria-expanded={expandido}
                  onClick={() => setAberto(expandido ? null : b.sigla)}
                  style={{ borderLeftColor: b.cor }}
                >
                  <span className="partido-sigla">
                    <i style={{ background: b.cor }} aria-hidden="true" />
                    {b.sigla}
                    {info?.numero && <span className="partido-numero">nº {info.numero}</span>}
                  </span>
                  <span className="partido-nome">
                    {info?.nome ?? b.sigla} · <span className="partido-campo">{descricaoCampo(b.sigla)}</span>
                  </span>
                  <span className="partido-barra" aria-hidden="true">
                    <span style={{ width: `${(total / maior) * 100}%`, background: b.cor }} />
                  </span>
                  <span className="partido-conta">
                    <span>
                      <strong>{b.deputados.length}</strong> {b.deputados.length === 1 ? "deputado" : "deputados"}
                    </span>
                    <span>
                      <strong>{b.senadores.length}</strong> {b.senadores.length === 1 ? "senador" : "senadores"}
                    </span>
                  </span>
                  <span className="partido-mais" aria-hidden="true">
                    {expandido ? "−" : "+"}
                  </span>
                </button>
                {expandido && (
                  <ul className="partido-rostos">
                    {[...b.senadores, ...b.deputados].map((p) => (
                      <li key={p.id}>
                        <a href={p.url || undefined} target="_blank" rel="noopener noreferrer" title={`${p.nome} · ${p.cargo} · ${p.uf}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.foto} alt="" loading="lazy" width={52} height={52} style={{ borderColor: b.cor }} />
                          <span className="partido-rosto-nome">{p.nome}</span>
                          <span className="partido-rosto-cargo">
                            {p.cargo === "Senador(a)" ? "Senado" : "Câmara"} · {p.uf}
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
        <p className="muted small">
          Partido de cada parlamentar segundo a Câmara e o Senado hoje (quem trocou de partido aparece no atual). Nome e
          número: TSE.
        </p>
      </section>
    </>
  );
}
