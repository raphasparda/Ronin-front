# Ronin Web

Front-end do Ronin: quadros de tarefas para uma equipe pequena de software, com backend e dados próprios. SPA em React 19 + Vite + Tailwind 4 + TanStack Query, em TypeScript, com testes de componentes (Vitest + Testing Library + MSW) e E2E (Playwright).

A API (Fastify + PostgreSQL), o pacote de contratos `@raphasparda/ronin-shared` e a documentação de produto, arquitetura e operação ficam no repositório irmão **ronin-api**. Produto e escopo: `README.md` e `docs/product/scope.md` de lá.

Público deste README: quem vai rodar, testar ou desenvolver o web do Ronin na própria máquina.

## Como rodar

Precisa só de **Node.js 24** e **pnpm 10** (`npm i -g pnpm@10`, sem admin). Não precisa de Docker nem de PostgreSQL instalado.

Clone os dois repositórios lado a lado, com os nomes de pasta `ronin-api` e `ronin-web` (este repositório usa `../ronin-api`):

```powershell
git clone https://github.com/raphasparda/Ronin-End.git ronin-api
git clone https://github.com/raphasparda/Ronin-front.git ronin-web
```

```text
<pasta>/
├─ ronin-api/   (raphasparda/Ronin-End)
└─ ronin-web/   (este: raphasparda/Ronin-front)
```

1. No **ronin-api**: `pnpm install` e `pnpm dev` (sobe o PostgreSQL local na 5433, aplica as migrations e sobe a API na 3000).
2. Neste repositório, em outro terminal: `pnpm install` e `pnpm dev`.
3. Abra <http://127.0.0.1:5310>.

Instale o ronin-api **antes** deste: o `@raphasparda/ronin-shared` vem de `link:../ronin-api/packages/shared`.

- A porta do web é **5310**, e não a 5173 padrão do Vite, porque a 5173 já é usada por outro projeto na máquina do cliente. A porta é fixa: se estiver ocupada, o Vite falha em vez de trocar de porta.
- O Vite faz proxy de `/api` para `http://127.0.0.1:3000` (ou o `PORT` do `.env` do ronin-api).
- Se abrir `http://localhost:5310`, o servidor de desenvolvimento redireciona para `http://127.0.0.1:5310` (mesmo caminho e query). A API só aceita mutações com `Origin` igual ao `APP_ORIGIN` (`http://127.0.0.1:5310`).

Com o banco vazio, a primeira tela é **Configurar a equipe** (a primeira conta vira Admin). Passo a passo de primeiro uso, convites e redefinição de senha: `README.md` do ronin-api.

Detalhes e problemas comuns: [`docs/ops/setup-local.md`](docs/ops/setup-local.md) e [`docs/ops/known-issues.md`](docs/ops/known-issues.md).

## Comandos úteis

| Comando                             | Faz                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `pnpm dev`                          | Vite em `127.0.0.1:5310` com proxy `/api` (a API precisa estar rodando no ronin-api) |
| `pnpm build`                        | build de produção em `dist/`                                                         |
| `pnpm preview`                      | serve o build na 4173, com o mesmo proxy                                             |
| `pnpm test` / `pnpm test:watch`     | testes de componentes (Vitest + jsdom + MSW)                                         |
| `pnpm test:e2e`                     | Playwright: banco `kanban_e2e` e API do ronin-api (3100) + web (5320)                |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                                                               |
| `pnpm typecheck`                    | TypeScript do app e dos E2E                                                          |
| `pnpm format` / `pnpm format:check` | Prettier                                                                             |

## Testes E2E

```powershell
pnpm exec playwright install chromium   # só na primeira vez
pnpm test:e2e                            # desktop e mobile
pnpm test:e2e --project=desktop          # só desktop
pnpm test:e2e --headed                   # argumentos extras vão para o Playwright
```

O `e2e/run.mjs` usa o ronin-api de `RONIN_API_DIR` (padrão `../ronin-api`): sobe ou reaproveita o PostgreSQL local de lá, cria o banco isolado `kanban_e2e`, aplica as migrations e roda o Playwright, que sobe a API (`tsx src/server.ts` no ronin-api, porta 3100) e este web (porta 5320). Os bancos `kanban` e `kanban_test` não são tocados, então dá para rodar com o `pnpm dev` aberto. Os testes truncam o banco E2E e rodam em série.

CI (lint, typecheck, testes, build e E2E, com checkout do ronin-api): [`docs/ops/ci.md`](docs/ops/ci.md).

## Contratos (`@raphasparda/ronin-shared`)

- **Local (padrão):** `"@raphasparda/ronin-shared": "link:../ronin-api/packages/shared"`. Vite, Vitest e `tsc` leem a fonte TS do ronin-api; uma mudança lá aparece aqui na hora.
- **Registro (GitHub Packages):** troque para `"@raphasparda/ronin-shared": "^0.1.0"`. O `.npmrc` deste repositório já aponta o escopo (`@raphasparda:registry=https://npm.pkg.github.com`); falta só o token com `read:packages` no `~/.npmrc` de usuário (`//npm.pkg.github.com/:_authToken=<PAT>`, nunca commitado). Depois, `pnpm install` e commit do lockfile.
- Fixtures de teste: `import { ... } from '@raphasparda/ronin-shared/test-fixtures'` (subpath export; nunca importe caminhos de `packages/shared/src`).
- O escopo `@raphasparda` é o dono dos repositórios no GitHub, exigência do GitHub Packages.

Passo a passo completo (publicar, trocar para o registro e voltar, renomear se o dono mudar): `docs/ops/shared-package.md` do ronin-api.

## Variáveis

Nenhuma é obrigatória. Opcionais em [`.env.example`](.env.example) (copie para `.env`):

- `RONIN_API_DIR`: pasta do ronin-api (padrão `../ronin-api`). Se mudar, ajuste também o `link:` do `package.json`.
- `API_PROXY_TARGET`: alvo do proxy `/api`.
- Só nos E2E (ambiente): `E2E_API_PORT` (3100), `E2E_WEB_PORT` (5320), `E2E_DATABASE_URL`.

## Estrutura de pastas

```text
src/            SPA React: features por área, componentes, lib e setup de testes (src/test)
public/         arquivos estáticos (ícones, marca, theme-init.js)
e2e/            Playwright: specs, support/ (API, seed, banco, a11y), run.mjs e config
scripts/        localização do ronin-api (RONIN_API_DIR)
docs/design/    design system e telas
docs/ops/       setup local, CI e problemas conhecidos
```

## Documentação

| Documento                                                      | Conteúdo                                         |
| -------------------------------------------------------------- | ------------------------------------------------ |
| [`PRODUCT.md`](PRODUCT.md)                                     | contexto de produto e marca para design          |
| [`docs/design/design-system.md`](docs/design/design-system.md) | cores, tokens, temas e componentes               |
| [`docs/design/screens.md`](docs/design/screens.md)             | telas e fluxos                                   |
| [`docs/ops/setup-local.md`](docs/ops/setup-local.md)           | ambiente local, proxy, E2E                       |
| [`docs/ops/ci.md`](docs/ops/ci.md)                             | pipeline do GitHub Actions, segredos e variáveis |
| [`docs/ops/known-issues.md`](docs/ops/known-issues.md)         | problemas conhecidos                             |
| ronin-api: `docs/architecture/`, `docs/product/`, `docs/ops/`  | arquitetura, contrato da API, escopo, operação   |

Histórico de entregas: [`CHANGELOG.md`](CHANGELOG.md).

## Convenções

- Finais de linha LF (`.gitattributes`, `.editorconfig`). Scripts do `package.json` não usam sintaxe de shell POSIX, para funcionar no PowerShell.
- `.env` nunca é commitado.
- Mudança de contrato começa no ronin-api (`packages/shared` + `docs/architecture/api.md`); o web se ajusta no PR seguinte.
