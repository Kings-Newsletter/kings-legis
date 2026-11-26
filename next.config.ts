import type { NextConfig } from "next";

/**
 * O portal é servido em https://kingsnewsletter.com/legis e /radar.
 * A newsletter faz rewrite dos dois prefixos para este projeto, então não há
 * basePath: as rotas já nascem em app/legis e app/radar.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    // A raiz do domínio próprio da Vercel (kings-legis.vercel.app) não tem
    // página: leva quem chega lá para o Legis.
    return [{ source: "/", destination: "/legis", permanent: false }];
  },
  async headers() {
    // Cache das páginas na CDN da Vercel, no mesmo modelo do kings-sports.
    // Nenhuma página é personalizada (sem login, cookies ou headers lidos),
    // então a mesma URL pode ser servida a todos por algum tempo e a Vercel
    // não renderiza a página a cada visita (o limite de CPU é da conta toda).
    //
    // Vercel-CDN-Cache-Control vale só para a CDN da Vercel: o navegador e a
    // Cloudflare continuam sem guardar o HTML.
    const cdn = (seconds: number) => [
      {
        key: "Vercel-CDN-Cache-Control",
        value: `s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}`,
      },
    ];
    return [
      // Início, agenda e feed do Radar mudam ao longo do dia.
      { source: "/legis", headers: cdn(300) },
      { source: "/legis/:path*", headers: cdn(300) },
      { source: "/radar", headers: cdn(300) },
      { source: "/radar/:path*", headers: cdn(300) },
      // O aquecimento (chamado pelo kings-worker) precisa rodar sempre: nunca vem do cache da CDN.
      { source: "/legis/api/aquecer", headers: [{ key: "Vercel-CDN-Cache-Control", value: "no-store" }] },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
