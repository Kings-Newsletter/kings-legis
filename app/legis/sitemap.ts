import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

/**
 * Servido em /legis/sitemap.xml. O robots.txt da newsletter (raiz do domínio)
 * deve apontar para ele. As fichas de proposição entram aqui quando houver dados.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paginas = ["/legis", "/legis/proposicoes", "/legis/agenda", "/legis/como-atualizamos", "/radar"];
  return paginas.map((path) => ({
    url: absoluteUrl(path),
    changeFrequency: "daily",
    priority: path === "/legis" ? 1 : 0.7,
  }));
}
