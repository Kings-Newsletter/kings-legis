# King's Legis e King's Radar

Portal da King's Newsletter que mostra o que o Legislativo, o Diário Oficial da União e os
tribunais fizeram, com a fonte oficial em cada item. Servido em
`kingsnewsletter.com/legis` e `kingsnewsletter.com/radar`.

Desenho completo do projeto (escopo, fontes, modelo de dados, jobs, fases e decisões em
aberto): [King's Legis e King's Radar — Desenho do projeto](https://claude.ai/artifact/FCJUx6Q2dH8PK1gAUyqPYz).

## Arquitetura

```
Câmara · Senado · DOU · tribunais
            │  coleta agendada (kings-worker, servidor 24/7)
            ▼
MongoDB kings_newsletter: legis_items · legis_events · radar_items
            │  só leitura
            ▼
este portal (Next.js na Vercel, cache na CDN)
            │  rewrite de /legis e /radar no vercel.json da newsletter
            ▼
kingsnewsletter.com/legis e /radar
```

- **Dados oficiais direto da fonte.** A composição do Congresso, as proposições e a
  tramitação vêm das APIs de dados abertos da Câmara (`dadosabertos.camara.leg.br/api/v2`)
  e do Senado (`legis.senado.leg.br/dadosabertos/processo`), sem chave. Cada chamada fica
  no cache do servidor (30 min para listas, 1 h para detalhes, 6 h para a composição) e as
  páginas no cache da CDN: o limite de CPU da Vercel é da conta inteira, então a visita
  quase nunca chega às fontes. No máximo 4 chamadas simultâneas por fonte, com nova
  tentativa quando a Câmara responde 429.
- **O que ainda depende do kings-worker:** relevância, explicação por IA, Radar e um
  sitemap com todas as fichas; esses módulos (`src/legis`, `src/radar`) gravam no banco.
- **Escrita no banco:** só o kings-worker e, no campo `explicacao`, o painel admin da newsletter.
- **Coleções `news` e `sports`:** nunca são lidas nem alteradas por este projeto.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `app/legis` | Início, proposições (lista e ficha), agenda e `sitemap.xml` do Legis |
| `app/radar` | Feed do Radar |
| `components/layout` | Cabeçalho e rodapé |
| `lib/site.ts` | Nome, URLs e navegação |
| `lib/types.ts` | Formato dos documentos (o mesmo do kings-worker) |
| `lib/db` | Conexão com o MongoDB, somente leitura |
| `lib/legis` | Proposições e tramitação (`fontes/camara.ts`, `fontes/senado.ts`), tradução de situação para estágio, filtros e dados de exemplo |
| `lib/composicao.ts` | Bancadas da Câmara e do Senado direto das APIs |
| `components/proposicoes` | Item da lista, selo e trilha de estágio |
| `app/globals.css` | Tema provisório, neutro e com cores frias, todo em variáveis CSS |

Ainda não há logo: o nome aparece só em texto.

## Rodar localmente

```bash
cp .env.example .env.local   # MONGODB_URI pode ficar vazia
npm install
npm run dev                  # http://localhost:3000/legis
```

As páginas leem direto da Câmara e do Senado. Para testar sem rede, com dados de
exemplo (fictícios, nunca em produção), ponha `LEGIS_EXEMPLOS=1` no `.env.local`.

## Publicação

1. Criar o projeto `kings-legis` na Vercel apontando para este repositório.
2. No `vercel.json` da newsletter, adicionar os rewrites de `/legis`, `/legis/:path*`,
   `/radar` e `/radar/:path*` para `https://kings-legis.vercel.app`, como já existe para
   `/sports` e `/economy`.
3. No `robots.txt` da newsletter, apontar para `/legis/sitemap.xml`.
4. Configurar `CRON_SECRET` (valor aleatório longo) no projeto da Vercel e no kings-worker.
5. No agendador do kings-worker, chamar o aquecimento dos caches com
   `Authorization: Bearer <CRON_SECRET>` (nada é agendado na Vercel):
   - `GET https://kings-legis.vercel.app/legis/api/aquecer?parte=radar` a cada 30 minutos,
     das 6h às 22h (edição do DOU e notícias dos tribunais);
   - `GET https://kings-legis.vercel.app/legis/api/aquecer?parte=perfis` uma vez por dia,
     às 6h (cota e folha do Senado, funcionários da Câmara, candidatos do TSE; leva de
     1 a 3 minutos).
   A resposta é um JSON com `ok` e as etapas; `ok: false` lista as fontes que falharam.

## Pendências desta base

- Gerar e versionar o `package-lock.json` no primeiro `npm install` local; depois trocar
  `npm install` por `npm ci` na CI e no `vercel.json`.
