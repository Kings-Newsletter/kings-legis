import Image from "next/image";
import Link from "next/link";

import { SiteNavigation } from "@/components/layout/site-navigation";
import { formatarConsulta } from "@/lib/bancadas";
import { buscarComposicao } from "@/lib/composicao";
import { site } from "@/lib/site";

export async function SiteHeader() {
  const composicao = await buscarComposicao();
  return (
    <header className="site-header">
      <div className="container navbar">
        <Link href="/legis" className="wordmark">
          <Image
            src={site.brandMark}
            alt=""
            width={624}
            height={261}
            sizes="48px"
            className="wordmark-logo"
            loading="eager"
          />
          <span>{site.name}</span>
        </Link>
        <SiteNavigation />
      </div>
      <div className="faixa-atualizacao">
        <div className="container faixa-linha">
          <span>
            {composicao.origem === "api" ? (
              <>
                Dados oficiais direto da Câmara e do Senado, consulta em{" "}
                <strong>{formatarConsulta(composicao.consultadoEm)}</strong>
              </>
            ) : (
              <>
                Câmara e Senado fora do ar agora: mostrando a consulta de{" "}
                <strong>{formatarConsulta(composicao.consultadoEm)}</strong>
              </>
            )}
          </span>
          <Link href="/legis/como-atualizamos">Como atualizamos</Link>
        </div>
      </div>
    </header>
  );
}
