import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Servido em /legis/sitemap.xml. O robots.txt da newsletter (raiz do domínio)
 * deve apontar para ele.
 *
 * As fichas de proposição vêm direto das APIs da Câmara e do Senado e não são
 * listadas aqui: o Google chega a elas pelos links da lista e da home. Um sitemap
 * com todas as fichas precisa de um índice próprio (a coleta do kings-worker).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paginas = ["/legis", "/legis/proposicoes", "/legis/partidos", "/legis/agenda", "/legis/como-atualizamos", "/radar"];
  return paginas.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "daily",
    priority: path === "/legis" ? 1 : 0.7,
  }));
}
