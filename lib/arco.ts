/**
 * Geometria do arco de cadeiras (hemiciclo), usada pelo arco do Congresso e pelos
 * arcos de cada lugar no mapa.
 */

export const ARCO = { raioInterno: 0.4, raioPx: 232, centroX: 250, baseY: 246 };

export interface Cadeira {
  th: number;
  r: number;
  x: number;
  y: number;
}

/** Posição de cada cadeira em fileiras concêntricas, da esquerda para a direita. */
export function posicoes(total: number, fileiras: number): Cadeira[] {
  const { raioInterno, raioPx, centroX, baseY } = ARCO;
  const raios =
    fileiras <= 1
      ? [0.72]
      : Array.from({ length: fileiras }, (_, i) => raioInterno + ((1 - raioInterno) * i) / (fileiras - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  const porFileira = raios.map((r) => Math.round((total * r) / soma));
  const ultima = raios.length - 1;
  porFileira[ultima] = (porFileira[ultima] ?? 0) + total - porFileira.reduce((a, b) => a + b, 0);

  const lista: Cadeira[] = [];
  raios.forEach((r, i) => {
    const n = porFileira[i] ?? 0;
    for (let k = 0; k < n; k++) {
      const th = n === 1 ? Math.PI / 2 : Math.PI - (Math.PI * k) / (n - 1);
      lista.push({
        th,
        r,
        x: +(centroX + r * raioPx * Math.cos(th)).toFixed(1),
        y: +(baseY - r * raioPx * Math.sin(th)).toFixed(1),
      });
    }
  });
  return lista.sort((a, b) => b.th - a.th || a.r - b.r);
}

/** Número de fileiras que deixa as cadeiras legíveis para um total qualquer. */
export function fileirasPara(total: number) {
  if (total <= 5) return 1;
  if (total <= 14) return 2;
  if (total <= 30) return 3;
  if (total <= 60) return 4;
  if (total <= 100) return 5;
  if (total <= 200) return 7;
  if (total <= 400) return 10;
  return 12;
}

/** Raio da bolinha que cabe entre fileiras e entre vizinhas da fileira mais curta. */
export function raioPara(total: number, fileiras: number) {
  const { raioInterno, raioPx } = ARCO;
  if (fileiras <= 1) {
    const vao = (Math.PI * 0.72 * raioPx) / Math.max(total - 1, 1);
    return Math.min(26, vao * 0.42);
  }
  const entreFileiras = (raioPx * (1 - raioInterno)) / (fileiras - 1);
  const raios = Array.from({ length: fileiras }, (_, i) => raioInterno + ((1 - raioInterno) * i) / (fileiras - 1));
  const soma = raios.reduce((a, b) => a + b, 0);
  const naInterna = Math.max(Math.round((total * raioInterno) / soma), 2);
  const vizinhas = (Math.PI * raioInterno * raioPx) / (naInterna - 1);
  return Math.min(22, entreFileiras * 0.42, vizinhas * 0.45);
}
