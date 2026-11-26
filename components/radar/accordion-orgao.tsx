"use client";

import { useId, useState, type ReactNode } from "react";

type Props = {
  name: string;
  count: number;
  defaultOpen?: boolean;
  children: ReactNode;
};

const NUM = new Intl.NumberFormat("pt-BR");

export function AccordionOrgao({ name, count, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <section className={`radar-orgao${open ? " radar-orgao-aberto" : ""}`}>
      <button
        type="button"
        className="radar-orgao-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="radar-orgao-nome">{name}</span>
        <span className="radar-orgao-meta">
          <span className="radar-contagem">
            {NUM.format(count)}
            <span className="sr-only"> {count === 1 ? "ato" : "atos"}</span>
          </span>
          <span className="radar-orgao-chevron" aria-hidden="true" />
        </span>
      </button>
      <div id={contentId} className="radar-orgao-conteudo" aria-hidden={!open} inert={!open}>
        {children}
      </div>
    </section>
  );
}
