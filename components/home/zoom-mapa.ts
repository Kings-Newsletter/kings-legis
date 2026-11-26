"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from "react";

const MIN = 1;
const MAX = 16;
const PASSO = 1.6;

type Caixa = [number, number, number, number];

const ler = (vb: string): Caixa => {
  const n = vb.split(/[\s,]+/).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 1, n[3] ?? 1];
};

/**
 * Zoom e arrasto sobre um SVG, por cima do enquadramento base (o país, a região ou o
 * estado). Devolve o viewBox final, quantas unidades do SVG cabem em 1 px de tela
 * (para rótulos com tamanho fixo na tela) e os controles.
 *
 * - Botões: aproximar, afastar, enquadrar.
 * - Ctrl/Cmd + roda do mouse: zoom no ponto do cursor (a roda sozinha continua rolando a página).
 * - Arrastar (com zoom): move o mapa. Um arrasto não conta como clique no estado ou município.
 */
export function useZoomMapa(base: string, chave: string, svg: RefObject<SVGSVGElement | null>) {
  const [escala, setEscala] = useState(1);
  // Centro do enquadramento, em fração da caixa base (0,5 = meio).
  const [centro, setCentro] = useState<[number, number]>([0.5, 0.5]);
  const [tela, setTela] = useState<[number, number]>([0, 0]);
  const arrasto = useRef<{ x: number; y: number; centro: [number, number]; moveu: boolean } | null>(null);

  // Novo nível (outro estado, outra região): volta ao enquadramento base.
  useEffect(() => {
    setEscala(1);
    setCentro([0.5, 0.5]);
  }, [chave]);

  // Tamanho do SVG na tela, para converter pixels em unidades do mapa.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTela([r.width, r.height]);
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [svg, chave]);

  const [bx, by, bw, bh] = ler(base);
  const w = bw / escala;
  const h = bh / escala;
  const limitar = (c: [number, number], e: number): [number, number] => {
    const mx = 0.5 / e;
    return [Math.min(1 - mx, Math.max(mx, c[0])), Math.min(1 - mx, Math.max(mx, c[1]))];
  };
  const [cx, cy] = limitar(centro, escala);
  const viewBox = `${(bx + cx * bw - w / 2).toFixed(2)} ${(by + cy * bh - h / 2).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
  // preserveAspectRatio "meet": a escala é a do lado que limita.
  const unidadesPorPx = tela[0] && tela[1] ? Math.max(w / tela[0], h / tela[1]) : w / 800;

  /** Fração da caixa base sob um ponto da tela. */
  const fracaoNoPonto = useCallback(
    (clientX: number, clientY: number): [number, number] | null => {
      const el = svg.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const u = Math.max(w / r.width, h / r.height);
      const x = bx + cx * bw - w / 2 + (clientX - r.left - (r.width - w / u) / 2) * u;
      const y = by + cy * bh - h / 2 + (clientY - r.top - (r.height - h / u) / 2) * u;
      return [(x - bx) / bw, (y - by) / bh];
    },
    [svg, w, h, bx, by, bw, bh, cx, cy],
  );

  // Último estado conhecido: vários giros da roda podem chegar antes de um novo render.
  const atual = useRef({ escala, cx, cy });
  atual.current = { escala, cx, cy };

  const zoomPara = useCallback((fator: number, ponto?: [number, number]) => {
    const a = atual.current;
    const e = Math.min(MAX, Math.max(MIN, a.escala * fator));
    const f = a.escala / e;
    // Mantém o ponto sob o cursor parado enquanto a escala muda.
    const c = limitar(ponto ? [ponto[0] + (a.cx - ponto[0]) * f, ponto[1] + (a.cy - ponto[1]) * f] : [a.cx, a.cy], e);
    atual.current = { escala: e, cx: c[0], cy: c[1] };
    setCentro(c);
    setEscala(e);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aproximar = () => zoomPara(PASSO);
  const afastar = () => zoomPara(1 / PASSO);
  const enquadrar = () => {
    setEscala(1);
    setCentro([0.5, 0.5]);
  };

  // Roda do mouse com Ctrl/Cmd: listener nativo, porque o onWheel do React é passivo e
  // não deixa impedir a rolagem (ou o zoom da página) do navegador.
  const roda = useRef<(ev: globalThis.WheelEvent) => void>(() => {});
  roda.current = (ev) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    zoomPara(ev.deltaY < 0 ? 1.25 : 1 / 1.25, fracaoNoPonto(ev.clientX, ev.clientY) ?? undefined);
  };
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const ouvir = (ev: globalThis.WheelEvent) => roda.current(ev);
    el.addEventListener("wheel", ouvir, { passive: false });
    return () => el.removeEventListener("wheel", ouvir);
  }, [svg, chave]);

  const handlers = {
    onPointerDown: (ev: PointerEvent<SVGSVGElement>) => {
      if (escala <= 1 || ev.button !== 0) return;
      arrasto.current = { x: ev.clientX, y: ev.clientY, centro: [cx, cy], moveu: false };
    },
    onPointerMove: (ev: PointerEvent<SVGSVGElement>) => {
      const a = arrasto.current;
      if (!a) return;
      const dx = ev.clientX - a.x;
      const dy = ev.clientY - a.y;
      if (!a.moveu && Math.hypot(dx, dy) < 4) return;
      if (!a.moveu) {
        a.moveu = true;
        ev.currentTarget.setPointerCapture(ev.pointerId);
      }
      setCentro(limitar([a.centro[0] - (dx * unidadesPorPx) / bw, a.centro[1] - (dy * unidadesPorPx) / bh], escala));
    },
    onPointerUp: () => {
      // O clique que encerra um arrasto é descartado em onClickCapture.
      window.setTimeout(() => {
        arrasto.current = null;
      }, 0);
    },
    onClickCapture: (ev: MouseEvent<SVGSVGElement>) => {
      if (arrasto.current?.moveu) {
        ev.stopPropagation();
        ev.preventDefault();
      }
    },
  };

  return { viewBox, escala, unidadesPorPx, aproximar, afastar, enquadrar, handlers, podeArrastar: escala > 1 };
}
