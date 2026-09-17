# CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`. Roda em todo `pull_request` e em `push` na `main`. Um push novo na mesma branch/PR cancela a execução anterior (`concurrency`). O `GITHUB_TOKEN` só tem `contents: read`.

## Jobs

| Job      | Passos                                                                                                         | Tempo esperado |
| -------- | -------------------------------------------------------------------------------------------------------------- | -------------- |
| `checks` | checkout → pnpm (versão do `packageManager`) → Node do `.nvmrc` com cache do store → cria `kanban_test` → `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build` | ~5 min |
| `e2e`    | só roda se `checks` passar; mesmo preparo → cria `kanban_e2e` → `playwright install --with-deps chromium` → `pnpm test:e2e`; em falha publica `apps/web/playwright-report` e `apps/web/test-results` (traces, screenshots) como artefato por 7 dias | ~10 min |

Cada job tem seu próprio serviço `postgres:18-alpine` (usuário/senha/banco `kanban`, porta 5432 do runner, healthcheck `pg_isready`). Os steps só começam depois que o serviço fica saudável.

Para bloquear merge: em *Settings → Branches → Branch protection rules* (ou *Rulesets*) da `main`, exigir os checks **Lint, typecheck, testes e build** e **E2E (Playwright)**.

## Banco no CI

O CI **nunca** sobe o PostgreSQL embutido (`embedded-postgres`, usado no dev local). Motivos: o serviço do GitHub já é um Postgres 18 real, e o binário do `postgres` se recusa a rodar como root no Linux.

Isso é garantido pela variável `DEV_DB_EXTERNAL_ONLY=true`, lida por `scripts/dev-db/postgres.mjs` (usado pelo globalSetup do Vitest da API e por `apps/web/e2e/run.mjs`):

- banco respondendo: reaproveita (tipo `external`), cria os bancos que faltarem e aplica as migrations;
- banco fora do ar: falha na hora com `PostgreSQL em 127.0.0.1:5432 não responde (DEV_DB_EXTERNAL_ONLY=true ...)`, sem procurar binários nem tentar `initdb`/`pg_ctl`.

Sem a variável (dev local), o comportamento é o de sempre (docs/ops/setup-local.md).

## Variáveis de ambiente (nível do workflow)

| Variável               | Valor no CI                                           | Quem usa                                   |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------ |
| `DEV_DB_EXTERNAL_ONLY` | `true`                                                | `scripts/dev-db/postgres.mjs`              |
| `DATABASE_URL`         | `postgres://kanban:kanban@127.0.0.1:5432/kanban`      | `e2e/run.mjs` (servidor/credenciais base)  |
| `TEST_DATABASE_URL`    | `postgres://kanban:kanban@127.0.0.1:5432/kanban_test` | Vitest da API (sem ela, testes de banco são pulados) |
| `E2E_DATABASE_URL`     | `postgres://kanban:kanban@127.0.0.1:5432/kanban_e2e`  | `e2e/run.mjs` e `webServer` da API no Playwright |
| `APP_ORIGIN`           | `http://127.0.0.1:5310`                               | validação de env da API (os E2E sobrescrevem com a origem 5320) |
| `LOG_LEVEL`            | `warn`                                                | API                                        |

O GitHub Actions define `CI=true`, o que no Playwright liga `forbidOnly`, 1 retry e o reporter HTML (`apps/web/playwright-report`). Não há segredos: as credenciais acima são de um banco descartável que só existe durante o job. Nada de `NODE_ENV` global (o `vite build` precisa do padrão `production`; os E2E definem `development` para a API).

Os bancos `kanban_test`/`kanban_e2e` são criados explicitamente por `docker exec <serviço> psql` (o `postgres.mjs` também os criaria, mas assim uma falha de permissão aparece num step próprio).

## Reproduzir localmente (Windows)

Não é preciso Docker. Para rodar os mesmos passos contra o banco local de dev:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test          # sobe/reaproveita o Postgres local (5433) e usa kanban_test
pnpm build
pnpm test:e2e      # usa kanban_e2e
```

Para simular o modo do CI contra um Postgres já rodando (Docker na 5432, por exemplo), defina as variáveis da tabela na sessão (`$env:DEV_DB_EXTERNAL_ONLY='true'`, `$env:TEST_DATABASE_URL='postgres://kanban:kanban@127.0.0.1:5432/kanban_test'` etc.).

Validar o YAML sem push: baixe o [actionlint](https://github.com/rhysd/actionlint/releases) (zip `windows_amd64`, sem instalação) e rode `actionlint .github/workflows/ci.yml`.

## Falhas comuns

- **`ERR_PNPM_OUTDATED_LOCKFILE`**: `package.json` mudou sem atualizar o `pnpm-lock.yaml`. Rode `pnpm install` localmente e commite o lockfile.
- **`não responde (DEV_DB_EXTERNAL_ONLY=true ...)`**: o serviço Postgres não subiu; veja o log do step "Initialize containers".
- **E2E falhou**: baixe o artefato `playwright-<run>-<tentativa>` e abra o trace com `pnpm --filter @kanban/web exec playwright show-trace <arquivo trace.zip>` ou o relatório com `pnpm --filter @kanban/web exec playwright show-report <pasta playwright-report>`.
- **Versão do pnpm/Node**: vêm de `packageManager` (package.json) e `.nvmrc`. Mude lá, nunca no workflow.
