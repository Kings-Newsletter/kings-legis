import { TRILHA, rotuloEstagio } from "@/lib/legis/catalogo";
import type { Estagio } from "@/lib/types";

/** Selo do estágio normalizado. */
export function SeloEstagio({ estagio }: { estagio: Estagio }) {
  return <span className={`estagio estagio-${estagio}`}>{rotuloEstagio(estagio)}</span>;
}

/**
 * Trilha do protocolo até a sanção. Vetada e arquivada são saídas do caminho:
 * a trilha mostra até onde a proposição chegou e um aviso ao lado.
 */
export function TrilhaEstagio({ estagio }: { estagio: Estagio }) {
  const fora = estagio === "vetada" || estagio === "arquivada";
  // Vetada: passou pelo Congresso (aprovada) e parou na sanção. Arquivada: sem posição na trilha.
  const posicao = estagio === "vetada" ? TRILHA.indexOf("aprovada") : TRILHA.indexOf(estagio);

  return (
    <div className="trilha">
      <ol className="trilha-passos">
        {TRILHA.map((e, i) => {
          const classe = i < posicao ? "feita" : i === posicao && !fora ? "atual" : i === posicao ? "feita" : "";
          return (
            <li key={e} className={`trilha-passo ${classe}`} aria-current={classe === "atual" ? "step" : undefined}>
              <span className="trilha-barra" aria-hidden="true" />
              <span className="trilha-nome">{rotuloEstagio(e)}</span>
            </li>
          );
        })}
      </ol>
      {fora && (
        <p className={`trilha-saida estagio-${estagio}`}>
          {estagio === "vetada"
            ? "Vetada pela Presidência da República. O Congresso ainda pode derrubar o veto."
            : "Arquivada. A proposição saiu de tramitação."}
        </p>
      )}
    </div>
  );
}
