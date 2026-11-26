import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

import { ComposicaoProvider } from "@/components/composicao-contexto";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { PopupPolitico } from "@/components/politicos/popup-politico";
import { buscarComposicao } from "@/lib/composicao";
import { site } from "@/lib/site";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const grotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  icons: {
    icon: [{ url: site.icon, type: "image/png", sizes: "768x768" }],
  },
  openGraph: {
    type: "website",
    locale: site.locale,
    siteName: site.name,
    title: `${site.name} — ${site.tagline}`,
    description: site.description,
    images: [
      {
        url: site.logo,
        width: 762,
        height: 445,
        alt: `Logo ${site.name}`,
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#090a0b",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Composição do Congresso direto da Câmara e do Senado (cache de 6 h no servidor).
  const composicao = await buscarComposicao();

  return (
    <html lang={site.lang} className={`${inter.variable} ${grotesk.variable}`}>
      <body>
        <a href="#conteudo" className="skip-link">
          Pular para o conteúdo
        </a>
        <ComposicaoProvider valor={composicao}>
          <SiteHeader />
          <main id="conteudo">{children}</main>
          <SiteFooter />
          <PopupPolitico />
        </ComposicaoProvider>
      </body>
    </html>
  );
}
