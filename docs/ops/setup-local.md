# Setup local (desenvolvimento)

Resumo: com o **ronin-api** clonado ao lado, instalado e rodando (`pnpm dev` lá), rode aqui `pnpm install` e `pnpm dev` e abra <http://127.0.0.1:5310>.

## Pastas lado a lado

```powershell
git clone https://github.com/raphasparda/Ronin-End.git ronin-api
git clone https://github.com/raphasparda/Ronin-front.git ronin-web
```

```text
<pasta>/
├─ ronin-api/   pnpm install  →  pnpm dev   (Postgres 5433, migrations, API 3000)
└─ ronin-web/   pnpm install  →  pnpm dev   (web 5310, proxy /api → 127.0.0.1:3000)
```

- O `@raphasparda/ronin-shared` vem de `link:../ronin-api/packages/shared` (symlink para a fonte TS). Instale o ronin-api **antes**: o `zod` usado pela fonte do shared é resolvido em `ronin-api/node_modules`.
- O banco, as migrations e a configuração da API (`.env` com `DATABASE_URL`, `PORT`, `APP_ORIGIN`) ficam no ronin-api (`docs/ops/setup-local.md` de lá).

## Portas

| Serviço    | Endereço         | Observação                                                  |
| ---------- | ---------------- | ----------------------------------------------------------- |
| Web (Vite) | `127.0.0.1:5310` | fixa (`strictPort`); a 5173 é usada por outro projeto local |
| API        | `127.0.0.1:3000` | ronin-api (`PORT` do `.env` de lá)                          |
| PostgreSQL | `127.0.0.1:5433` | ronin-api                                                   |
| API (E2E)  | `127.0.0.1:3100` | só durante `pnpm test:e2e`                                  |
| Web (E2E)  | `127.0.0.1:5320` | só durante `pnpm test:e2e`                                  |

## Como o `vite.config.ts` se liga à API

- **Proxy** `/api` → `API_PROXY_TARGET` (ambiente ou `.env` daqui) ou `http://127.0.0.1:<PORT>`, com `PORT` do ambiente ou do `.env` do ronin-api (padrão 3000). O navegador usa só a origem `http://127.0.0.1:5310`, igual ao `APP_ORIGIN` da API.
- **`localhost` → `127.0.0.1`**: quem abre `http://localhost:5310` é redirecionado (307) para o mesmo caminho em `127.0.0.1:5310`; sem isso, toda mutação tomaria 403 da checagem de `Origin`.
- **`server.fs.allow`** inclui a pasta real do `@raphasparda/ronin-shared` (fora deste repositório por causa do `link:`), e `resolve.dedupe: ['zod']` garante uma cópia só do zod.
- A pasta do ronin-api vem de `scripts/ronin-api-dir.mjs`: `RONIN_API_DIR` (ambiente ou `.env`), padrão `../ronin-api`.

Variáveis opcionais deste repositório: [`.env.example`](../../.env.example). Não há `.env` obrigatório aqui.

## E2E (`pnpm test:e2e`)

`e2e/run.mjs`:

1. localiza o ronin-api (`RONIN_API_DIR`) e confere que ele tem `node_modules`;
2. usa `scripts/dev-db/postgres.mjs` **do ronin-api** para subir (ou reaproveitar) o PostgreSQL local de lá (dados em `ronin-api/.data`) e criar o banco isolado `ronin_e2e` no servidor do `DATABASE_URL` (ambiente ou `.env` do ronin-api);
3. aplica as migrations nesse banco (`pnpm run db:migrate` no ronin-api);
4. roda o Playwright, cujo `webServer` sobe a API do ronin-api (`pnpm exec tsx src/server.ts`, porta 3100) e o Vite deste repositório (porta 5320);
5. para o PostgreSQL se foi ele que o subiu.

Os bancos `kanban` (dev) e `ronin_test` (Vitest da API) nunca são tocados; dá para rodar com o `pnpm dev` aberto. Argumentos extras vão para o Playwright: `pnpm test:e2e --project=desktop`, `pnpm test:e2e --headed`.

Na primeira vez: `pnpm exec playwright install chromium`.

Portas alternativas (outro E2E rodando): `$env:E2E_API_PORT='3110'; $env:E2E_WEB_PORT='5330'; pnpm test:e2e`.

## Trocar para o `@raphasparda/ronin-shared` publicado

Por padrão o web usa a pasta irmã. Para consumir a versão do GitHub Packages (`^0.1.0`) com `.npmrc` e token, siga `docs/ops/shared-package.md` do ronin-api (seção "Consumir pelo registro no ronin-web").
