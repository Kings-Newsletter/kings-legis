import Link from "next/link";

import { CASA_LABEL, dataBr, identificacao, urlProposicao } from "@/lib/legis/catalogo";
import type { ItemLista } from "@/lib/legis/proposicoes";

import { SeloEstagio } from "./estagio";

function autoria(autores: ItemLista["autores"]): string {
  if (!autores.length) return "";
  const a = autores[0]!;
  const primeiro = a.partido ? `${a.nome} (${a.partido}${a.uf ? `-${a.uf}` : ""})` : a.nome;
  return autores.length > 1 ? `${primeiro} e mais ${autores.length - 1}` : primeiro;
}

/** Uma proposição numa lista: identificação, estágio, ementa oficial e autoria. */
export function ItemProposicao({ item, compacto = false }: { item: ItemLista; compacto?: boolean }) {
  return (
    <li className={compacto ? "proposicao proposicao-compacta" : "proposicao"}>
      <div className="proposicao-topo">
        <Link href={urlProposicao(item._id)} className="proposicao-id">
          {identificacao(item)}
        </Link>
        <span className="muted small">{CASA_LABEL[item.casa]}</span>
        <SeloEstagio estagio={item.estagio} />
      </div>
      <p className="proposicao-ementa">{item.ementa}</p>
      {!compacto && (
        <p className="muted small">
          {autoria(item.autores)}
          {item.autores.length > 0 && " · "}
          Apresentada em {dataBr(item.dataApresentacao)} · Atualizada em {dataBr(item.ultimaAtualizacao)}
        </p>
      )}
      {compacto && <p className="muted small">{item.situacaoFonte}</p>}
    </li>
  );
}
