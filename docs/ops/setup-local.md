# Setup local (desenvolvimento)

Resumo: `pnpm install` e `pnpm dev`, depois abrir <http://127.0.0.1:5310>. O `pnpm dev` sobe o banco, aplica as migrations pendentes e só então sobe API e web; se a migration falhar, API e web não sobem. Este documento explica o que acontece por baixo e como resolver problemas.

## Portas

| Serviço    | Endereço          | Observação                                                   |
| ---------- | ----------------- | ------------------------------------------------------------ |
| PostgreSQL | `127.0.0.1:5433`  | 5432 fica livre para um Postgres nativo                      |
| API        | `127.0.0.1:3000`  | `PORT` no `.env`                                             |
| Web (Vite) | `127.0.0.1:5310`  | fixa (`strictPort`); a 5173 é usada por outro projeto local  |

O Vite faz proxy de `/api` para a API, então o navegador usa só a origem `http://127.0.0.1:5310` (igual ao `APP_ORIGIN`).

## Como o banco local funciona

- Binários: pacote npm `embedded-postgres` (`@embedded-postgres/<plataforma>`), PostgreSQL 18 oficial. Nada é instalado no sistema e não precisa de admin.
- Ciclo de vida: `scripts/dev-db/postgres.mjs` usa `initdb` (primeira vez) e `pg_ctl start/stop` direto nos binários. `pg_ctl stop -m fast` garante desligamento limpo (checkpoint). A API de alto nível da lib não é usada porque no Windows ela para o servidor com `taskkill /f`.
- Configuração vem do `DATABASE_URL` (porta, usuário, senha, nome do banco) e do `TEST_DATABASE_URL` (banco de testes, se no mesmo servidor). Cluster: UTF-8, locale `C` com provider `builtin` `C.UTF-8`, autenticação `scram-sha-256`, escuta só em `127.0.0.1`.
- Arquivos em `.data/` (ignorada pelo git): `postgres/` (dados), `postgres.log` (log do servidor), `pg_ctl.out` (saída do último comando `pg_ctl`), `postgres.owner.json` (PID do processo que subiu o banco).

Quem sobe o banco é dono dele e o para ao sair:

| Situação ao rodar `pnpm dev`, `pnpm db:dev` ou `pnpm test`      | Comportamento                                     |
| --------------------------------------------------------------- | ------------------------------------------------- |
| Nada rodando                                                    | sobe o cluster e para ao sair                     |
| Cluster local rodando com dono vivo (ex.: `pnpm db:dev`)        | reaproveita, não para                             |
| Cluster local rodando sem dono (processo anterior morto à força) | assume e para ao sair                             |
| `DATABASE_URL` responde e não é o cluster local (Docker/nativo) | reaproveita, não para                             |
| Porta ocupada por outro Postgres que recusa `kanban`            | erro explicando para ajustar a porta no `.env`    |
| `DEV_DB_EXTERNAL_ONLY=true` (CI) e banco fora do ar             | erro; nunca sobe o cluster local (docs/ops/ci.md) |

## Migrations

- `pnpm dev`: aplica automaticamente em `DATABASE_URL` antes de subir a API.
- `pnpm test`: o globalSetup aplica em `TEST_DATABASE_URL` (`kanban_test`) antes dos testes.
- Manual: `pnpm db:migrate` (idempotente; registro em `drizzle.__drizzle_migrations`; execuções concorrentes são serializadas por advisory lock).
- Mudou o schema em `apps/api/src/db/schema`: `pnpm db:generate --name <descricao>`, revise o SQL em `apps/api/drizzle/` e commite. Nunca edite migration já aplicada.

## Problemas comuns

**"Porta 5310 is already in use"**: outra instância do `pnpm dev` está aberta. Feche-a (Ctrl+C) ou encontre o processo: `Get-NetTCPConnection -LocalPort 5310 | Select-Object OwningProcess`.

**"pg_ctl start falhou ... Porta 5433 ocupada"**: algum programa usa a 5433 (ex.: container do `pnpm db:up`). Pare-o ou troque a porta em `DATABASE_URL`/`TEST_DATABASE_URL`.

**Fechei o terminal e o banco continuou rodando**: na próxima execução de `pnpm dev`/`pnpm db:dev` ele é assumido e parado ao sair. Para parar na hora:

```powershell
& (Get-ChildItem node_modules\.pnpm\@embedded-postgres*\node_modules\@embedded-postgres\*\native\bin\pg_ctl.exe).FullName stop -D .data\postgres -m fast
```

**Zerar o banco local** (apaga todos os dados de desenvolvimento): com tudo parado, apague a pasta `.data\postgres` (`Remove-Item -Recurse -Force .data\postgres`). A próxima execução recria o cluster e os bancos.

**Ver o log do Postgres**: `Get-Content .data\postgres.log -Tail 50`.

## Alternativas

Docker (`pnpm db:up`) e Postgres nativo (`infra/postgres/local-setup.sql`) continuam suportados; veja o README. Nos dois casos o `pnpm dev` detecta o banco respondendo e só sobe API e web. Para não gerenciar banco nenhum, use `pnpm dev:app`.
