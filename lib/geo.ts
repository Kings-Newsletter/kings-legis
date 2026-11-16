/**
 * Malhas municipais do IBGE (API de malhas v3) convertidas em caminhos SVG.
 * Busca direto do navegador, só quando a pessoa abre um estado.
 * Fonte: IBGE, https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
 */

type Anel = [number, number][];
type Geometria = { type: "Polygon"; coordinates: Anel[] } | { type: "MultiPolygon"; coordinates: Anel[][] };

interface Feicao {
  properties: { codarea: string };
  geometry: Geometria;
}

export interface Municipio {
  codigo: string;
  nome: string;
  path: string;
  /** Centro aproximado, para posicionar rótulos. */
  cx: number;
  cy: number;
}

export interface MalhaEstado {
  viewBox: string;
  municipios: Municipio[];
}

const LARGURA = 600;

function aneis(g: Geometria): Anel[] {
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

/** Projeção equirretangular com correção pela latitude média: simples e boa o bastante para um estado. */
export async function carregarMalhaEstado(uf: string): Promise<MalhaEstado> {
  const [malha, nomes] = await Promise.all([
    fetch(
      `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf}?intrarregiao=municipio&formato=application/vnd.geo%2Bjson&qualidade=intermediaria`,
    ).then((r) => {
      if (!r.ok) throw new Error(`IBGE respondeu ${r.status}`);
      return r.json() as Promise<{ features: Feicao[] }>;
    }),
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`).then((r) => {
      if (!r.ok) throw new Error(`IBGE respondeu ${r.status}`);
      return r.json() as Promise<{ id: number; nome: string }[]>;
    }),
  ]);

  const nomePorCodigo = new Map(nomes.map((m) => [String(m.id), m.nome]));

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of malha.features) {
    for (const anel of aneis(f.geometry)) {
      for (const [x, y] of anel) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const escala = LARGURA / ((maxX - minX) * k);
  const altura = (maxY - minY) * escala;
  const px = (x: number) => +((x - minX) * k * escala).toFixed(1);
  const py = (y: number) => +((maxY - y) * escala).toFixed(1);

  const municipios = malha.features.map((f) => {
    let sx = 0, sy = 0, n = 0;
    const d = aneis(f.geometry)
      .map((anel) =>
        anel
          .map(([x, y], i) => {
            const X = px(x), Y = py(y);
            sx += X;
            sy += Y;
            n++;
            return `${i === 0 ? "M" : "L"}${X} ${Y}`;
          })
          .join("") + "Z",
      )
      .join("");
    return {
      codigo: f.properties.codarea,
      nome: nomePorCodigo.get(f.properties.codarea) ?? f.properties.codarea,
      path: d,
      cx: n ? sx / n : 0,
      cy: n ? sy / n : 0,
    };
  });

  const margem = 6;
  return {
    viewBox: `${-margem} ${-margem} ${LARGURA + margem * 2} ${(altura + margem * 2).toFixed(1)}`,
    municipios: municipios.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
  };
}
