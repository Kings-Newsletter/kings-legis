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

- **Nenhuma coleta roda aqui.** O portal só lê do banco; a coleta fica nos módulos
  `src/legis` e `src/radar` do [kings-worker](https://github.com/Kings-Newsletter/kings-worker).
  O limite de CPU da Vercel é da conta inteira, então nada de chamadas a APIs externas
  durante a visita.
- **Escrita no banco:** só o kings-worker e, no campo `explicacao`, o painel admin da newsletter.
- **Coleções `news` e `sports`:** nunca são lidas nem alteradas por este projeto.

## Estrutura

| Caminho | O que é |
| --- | --- |
| `app/legis` | Início, proposições, agenda e `sitemap.xml` do Legis |
| `app/radar` | Feed do Radar |
| `components/layout` | Cabeçalho e rodapé |
| `lib/site.ts` | Nome, URLs e navegação |
| `lib/types.ts` | Formato dos documentos (o mesmo do kings-worker) |
| `lib/db` | Conexão com o MongoDB, somente leitura |
| `app/globals.css` | Tema provisório, neutro e com cores frias, todo em variáveis CSS |

Ainda não há logo: o nome aparece só em texto.

## Rodar localmente

```bash
cp .env.example .env.local   # MONGODB_URI pode ficar vazia
npm install
npm run dev                  # http://localhost:3000/legis
```

Sem `MONGODB_URI` as páginas mostram o estado vazio.

## Publicação

1. Criar o projeto `kings-legis` na Vercel apontando para este repositório.
2. No `vercel.json` da newsletter, adicionar os rewrites de `/legis`, `/legis/:path*`,
   `/radar` e `/radar/:path*` para `https://kings-legis.vercel.app`, como já existe para
   `/sports` e `/economy`.
3. No `robots.txt` da newsletter, apontar para `/legis/sitemap.xml`.

## Pendências desta base

- Gerar e versionar o `package-lock.json` no primeiro `npm install` local; depois trocar
  `npm install` por `npm ci` na CI e no `vercel.json`.
