# Ronin

Quadros de tarefas para uma equipe pequena de software. Monorepo TypeScript (pnpm workspaces): `apps/api` (Fastify), `apps/web` (React + Vite) e `packages/shared` (schemas Zod e regras puras).

## Como testar

Precisa só de **Node.js 24** e **pnpm 10** (`npm i -g pnpm@10`, sem admin). Não precisa de Docker, de PostgreSQL instalado nem de senha nenhuma.

1. `pnpm install`
2. `pnpm dev`
3. Abra <http://127.0.0.1:5310>

O `pnpm dev` cria o `.env` (se não existir), sobe um PostgreSQL 18 local do próprio projeto na porta 5433 (dados em `.data/postgres`), espera ele responder e então sobe a API (porta 3000) e o web (porta 5310). **Ctrl+C** derruba tudo, inclusive o banco. A primeira execução leva alguns segundos a mais para criar o banco.

Detalhes, problemas comuns e como zerar o banco: [`docs/ops/setup-local.md`](docs/ops/setup-local.md).

---

Arquitetura: [`docs/architecture/overview.md`](docs/architecture/overview.md) · Contrato da API: [`docs/architecture/api.md`](docs/architecture/api.md) · Plano: [`docs/architecture/plan.md`](docs/architecture/plan.md).

## Banco de dados

### Padrão: PostgreSQL local do projeto (sem Docker, sem admin)

O pacote npm `embedded-postgres` traz os binários oficiais do PostgreSQL 18 para Windows, Linux e macOS. Os scripts do repositório criam e controlam um cluster só deste projeto:

- endereço `127.0.0.1:5433` (não conflita com um Postgres nativo na 5432), usuário/senha `kanban`/`kanban` (**somente desenvolvimento**);
- bancos `kanban` (app) e `kanban_test` (testes), criados se faltarem;
- dados em `.data/postgres` e log em `.data/postgres.log` (pasta ignorada pelo git).

```powershell
pnpm dev       # banco + API + web (Ctrl+C para tudo)
pnpm db:dev    # só o banco, em primeiro plano (Ctrl+C para parar)
pnpm dev:app   # só API + web, usando um banco que já esteja rodando
```

Se o banco já estiver respondendo no `DATABASE_URL` (por exemplo, `pnpm db:dev` em outro terminal, Docker ou Postgres nativo), o `pnpm dev` reaproveita e não o derruba ao sair. Antes de subir a API, o `pnpm dev` sempre aplica as migrations pendentes (`pnpm db:migrate`, idempotente), então não é preciso migrar à mão.

### Alternativa: Docker

```powershell
pnpm db:up     # sobe postgres:18-alpine na porta POSTGRES_PORT (5433 no .env.example)
pnpm db:down   # para e remove o container (os dados ficam no volume kanban_postgres-data)
```

Não rode junto com o banco local: os dois usam a 5433. Com o container de pé, o `pnpm dev` detecta e reaproveita. O banco `kanban_test` é criado por `infra/postgres/init/01-test-db.sql` apenas na primeira subida do volume.

### Alternativa: PostgreSQL nativo

Exige a senha do superusuário `postgres`. Com o PostgreSQL 18 rodando na 5432, execute uma vez, na raiz do repositório:

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h 127.0.0.1 -U postgres -d postgres -f infra/postgres/local-setup.sql
```

O script é idempotente: cria o role `kanban` (senha `kanban`) e os bancos `kanban` e `kanban_test`. Depois, troque a porta para **5432** em `DATABASE_URL` e `TEST_DATABASE_URL` no `.env`.

## Testes

`pnpm test` roda os testes de todos os pacotes, um pacote por vez (em paralelo, a carga dos testes de banco da API deixava testes de UI com timeout e, se um pacote falhasse, o pnpm matava a API antes de ela parar o banco). Os testes de integração da API usam `TEST_DATABASE_URL`: se ele não responder e apontar para `127.0.0.1`, o setup global do Vitest (`apps/api/test/global-setup.ts`) sobe o banco local sozinho e o para no final. Em seguida aplica as migrations em `kanban_test`; testes de banco usam `useTestDatabase()` (`apps/api/test/db.ts`), que roda `truncateAll()` antes de cada teste. Se o `pnpm dev` ou o `pnpm db:dev` já estiverem rodando, o banco é reaproveitado.

## Scripts

| Script                                 | Faz                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `pnpm dev`                             | banco local (5433), depois `api` (porta 3000) e `web` (porta 5310)       |
| `pnpm dev:app`                         | só `api` e `web` em paralelo (banco por sua conta)                       |
| `pnpm db:dev`                          | só o banco local, em primeiro plano                                      |
| `pnpm db:up` / `pnpm db:down`          | sobe/derruba o Postgres do `docker-compose.yml`                          |
| `pnpm db:generate` / `pnpm db:migrate` | gera migrations (drizzle-kit) / aplica em `DATABASE_URL`                 |
| `pnpm lint` / `pnpm lint:fix`          | ESLint em todo o monorepo                                                |
| `pnpm format` / `pnpm format:check`    | Prettier                                                                 |
| `pnpm typecheck` / `pnpm test`         | em todos os pacotes (os testes da API sobem o banco local se precisarem) |
| `pnpm test:e2e`                        | Playwright em `apps/web`                                                 |
| `pnpm build`                           | build de `web` e `api`                                                   |

## Convenções

- Finais de linha LF (`.gitattributes`, `.editorconfig`). Scripts do `package.json` não usam sintaxe de shell POSIX, para funcionar no PowerShell.
- `.env` nunca é commitado; toda variável nova entra no `.env.example` com comentário.
