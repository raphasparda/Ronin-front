# CI (GitHub Actions) do ronin-web

Workflow: `.github/workflows/ci.yml`. Roda em todo `pull_request` e em `push` na `main`. Um push novo na mesma branch/PR cancela a execução anterior (`concurrency`). O `GITHUB_TOKEN` só tem `contents: read`.

## Layout no runner

Os dois jobs fazem checkout de **dois** repositórios lado a lado em `$GITHUB_WORKSPACE`:

```text
ronin-web/   este repositório (os comandos rodam aqui)
ronin-api/   raphasparda/Ronin-End: fonte do @raphasparda/ronin-shared (link:) e API dos E2E
```

## Jobs

| Job      | Passos                                                                                                                                                                                                                                                         | Tempo esperado |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| `checks` | checkout dos dois → pnpm (`packageManager` do web) → Node do `.nvmrc` com cache dos dois lockfiles → `pnpm install --frozen-lockfile` no ronin-api e no ronin-web → `pnpm lint` → `pnpm typecheck` → `pnpm test` → `pnpm build`                                | ~5 min         |
| `e2e`    | só roda se `checks` passar; mesmo preparo + serviço `postgres:18-alpine` → cria `kanban_e2e` → `playwright install --with-deps chromium` → `pnpm test:e2e`; em falha publica `ronin-web/playwright-report` e `ronin-web/test-results` como artefato por 7 dias | ~10 min        |

Para bloquear merge: em _Settings → Branches → Branch protection rules_ (ou _Rulesets_) da `main`, exigir os checks **Lint, typecheck, testes e build** e **E2E (Playwright)**.

## Configuração no GitHub (placeholders)

_Settings → Secrets and variables → Actions_:

| Tipo     | Nome                   | Obrigatório                         | Valor                                                                                                                                                                                           |
| -------- | ---------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Variável | `RONIN_API_REPOSITORY` | não                                 | repositório da API. Padrão: `raphasparda/Ronin-End`                                                                                                                                             |
| Variável | `RONIN_API_REF`        | não                                 | branch ou tag do ronin-api a testar. Padrão: `main`                                                                                                                                             |
| Segredo  | `RONIN_API_TOKEN`      | **sim, se o ronin-api for privado** | fine-grained PAT (dono `raphasparda`) com acesso só ao repositório `Ronin-End`, permissão _Contents: Read-only_. Sem ele, o checkout usa o `GITHUB_TOKEN`, que não lê outro repositório privado |

O PAT fine-grained expira (máximo 1 ano): anote a data e renove antes, senão o CI falha no checkout do ronin-api.

## Banco nos E2E

O CI **nunca** sobe o PostgreSQL embutido do ronin-api: `DEV_DB_EXTERNAL_ONLY=true` faz o `scripts/dev-db/postgres.mjs` de lá só reaproveitar o serviço do job (e falhar na hora se ele não responder).

| Variável               | Valor no job `e2e`                                   | Quem usa                                                        |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------------------------- |
| `RONIN_API_DIR`        | `$GITHUB_WORKSPACE/ronin-api`                        | `e2e/run.mjs`, `playwright.config.ts`, `vite.config.ts`         |
| `DEV_DB_EXTERNAL_ONLY` | `true`                                               | `postgres.mjs` do ronin-api                                     |
| `DATABASE_URL`         | `postgres://kanban:kanban@127.0.0.1:5432/kanban`     | `e2e/run.mjs` (servidor/credenciais base)                       |
| `E2E_DATABASE_URL`     | `postgres://kanban:kanban@127.0.0.1:5432/kanban_e2e` | `e2e/run.mjs` e API no Playwright                               |
| `APP_ORIGIN`           | `http://127.0.0.1:5310`                              | validação de env da API (os E2E sobrescrevem com a origem 5320) |
| `LOG_LEVEL`            | `warn`                                               | API                                                             |

O GitHub Actions define `CI=true`, o que no Playwright liga `forbidOnly`, 1 retry e o reporter HTML. As credenciais do banco são descartáveis e só existem durante o job.

## Quando o contrato muda

Um PR que depende de mudança no ronin-api (ex.: novo campo em `@raphasparda/ronin-shared`) falha aqui até a mudança chegar na `main` do ronin-api. Para testar antes do merge, defina temporariamente a variável `RONIN_API_REF` com a branch do ronin-api (e volte para `main` depois).

Se o web passar a consumir o shared pelo GitHub Packages, o job `checks` não precisa mais do checkout do ronin-api (só o `e2e`); veja `docs/ops/shared-package.md` do ronin-api.

## Reproduzir localmente (Windows)

Com o ronin-api em `../ronin-api` e instalado:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e      # usa o Postgres local do ronin-api (5433) e o banco kanban_e2e
```

Validar o YAML sem push: [actionlint](https://github.com/rhysd/actionlint/releases) (`actionlint .github/workflows/ci.yml`).

## Falhas comuns

- **Checkout do ronin-api: `Repository not found`**: repositório privado sem `RONIN_API_TOKEN`, token expirado ou `RONIN_API_REPOSITORY` errado.
- **`ERR_PNPM_OUTDATED_LOCKFILE`**: `package.json` mudou sem atualizar o `pnpm-lock.yaml`. Rode `pnpm install` e commite o lockfile.
- **`ronin-api não encontrado em ...`**: `RONIN_API_DIR` não bate com o `path` do checkout.
- **E2E falhou**: baixe o artefato `playwright-<run>-<tentativa>` e abra o trace com `pnpm exec playwright show-trace <trace.zip>` ou o relatório com `pnpm exec playwright show-report <pasta playwright-report>`.
