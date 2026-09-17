# Ronin

Quadros de tarefas para uma equipe pequena de software, com backend e dados próprios. Monorepo TypeScript (pnpm workspaces): `apps/api` (Fastify + PostgreSQL + Drizzle), `apps/web` (React + Vite + Tailwind) e `packages/shared` (schemas Zod e regras puras).

Público deste README: quem vai rodar, testar ou desenvolver o Ronin na própria máquina.

## Como testar

Precisa só de **Node.js 24** e **pnpm 10** (`npm i -g pnpm@10`, sem admin). Não precisa de Docker, de PostgreSQL instalado nem de senha nenhuma.

1. `pnpm install`
2. `pnpm dev`
3. Abra <http://127.0.0.1:5310>

Se abrir `http://localhost:5310`, o servidor de desenvolvimento redireciona sozinho para `http://127.0.0.1:5310` (mesmo caminho e query). O motivo: a API só aceita mutações com `Origin` igual ao `APP_ORIGIN` (`http://127.0.0.1:5310`).

A porta do web é **5310**, e não a 5173 padrão do Vite, porque a 5173 já é usada por outro projeto na máquina do cliente. A porta é fixa: se estiver ocupada, o Vite falha em vez de trocar de porta.

O `pnpm dev` cria o `.env` (se não existir), sobe um PostgreSQL 18 local do próprio projeto na porta 5433 (dados em `.data/postgres`), aplica as migrations pendentes e então sobe a API (porta 3000) e o web (porta 5310). **Ctrl+C** derruba tudo, inclusive o banco. A primeira execução leva alguns segundos a mais para criar o banco.

Detalhes, problemas comuns e como zerar o banco: [`docs/ops/setup-local.md`](docs/ops/setup-local.md). Problemas conhecidos (travamentos do Node no Windows, bloqueios de login em testes): [`docs/ops/known-issues.md`](docs/ops/known-issues.md).

## Status

- **Fatias 0 a 9 do MVP: implementadas**, com testes de API, de componentes e E2E (Playwright), e CI no GitHub Actions.
- **Fatia 10 (produção): pendente.** Ainda não existem Dockerfile, Caddyfile, compose de produção, backup nem documentação de instalação na VPS. Não exponha esta versão na internet. Os bloqueios de segurança apontados para o deploy estão em [`docs/ops/known-issues.md`](docs/ops/known-issues.md#4-bloqueios-do-deploy-fatia-10).
- Há uma decisão de produto pendente sobre o bloqueio de login por e-mail (mesmo documento).

Histórico de entregas: [`CHANGELOG.md`](CHANGELOG.md).

## O que o Ronin faz hoje

### Equipe e acesso

- Configuração inicial da instância: a primeira pessoa cria a equipe e vira Admin.
- Login e logout com e-mail e senha. Bloqueio temporário após tentativas erradas.
- Convite por link (vale 7 dias, uso único), com e-mail opcional e papel (Admin ou Membro). Não há cadastro público.
- Redefinição de senha por link gerado pelo Admin (vale 24 h, uso único), sem e-mail.
- Administração de membros: mudar papel, desativar, reativar e anonimizar conta desativada (LGPD). Sempre existe pelo menos um Admin ativo.
- Perfil: trocar o próprio nome e a senha.
- Nome da equipe e fuso horário ajustáveis pelo Admin.

### Quadros e listas

- Todos os membros veem e editam todos os quadros.
- Quadro novo já vem com "A fazer", "Fazendo" e "Concluído" (esta marcada como lista de conclusão).
- Listas com cor de uma paleta fixa: criar, renomear, trocar cor, reordenar (arrastando ou pelo menu), arquivar e restaurar.
- Arquivar e restaurar quadros. Só o Admin exclui um quadro de vez, digitando o nome para confirmar.

### Cards

- Criação rápida: digite o título no fim da lista e aperte Enter.
- Arrastar e soltar entre listas e dentro delas, ou "Mover para…" (quadro, lista e posição), que funciona pelo teclado e no celular.
- Detalhe do card com título, descrição em Markdown (sem HTML cru) e histórico de atividade.
- Concluir e reabrir: pelo botão ou movendo para a lista de conclusão. Reabrir um card que está na lista de conclusão leva ele ao topo da primeira lista ativa.
- Arquivar e restaurar cards. Só o Admin exclui um card de vez.

### Campos do card

- Responsáveis (um ou mais membros ativos).
- Prazo com data e hora opcional, com estado "vencendo" (até 24 h), "atrasado" ou "concluído".
- Prioridade opcional: Baixa, Média, Alta ou Urgente, sempre com cor e texto.
- Etiquetas por quadro, com nome e cor da paleta.
- Filtro do quadro por responsável, etiqueta, prioridade, prazo e texto do título. O filtro fica na URL e vale só para quem filtrou.

### Checklists e comentários

- Vários checklists por card, com itens marcáveis e reordenáveis. O progresso (x/y) aparece na face do card. Marcar todos os itens não conclui o card.
- Comentários em Markdown. O autor edita (marca "editado") e exclui os próprios. O Admin exclui qualquer um.

### Notificações

- Sino no cabeçalho com contador de não lidas.
- Avisos quando alguém atribui você a um card e quando comentam em um card em que você é responsável. Ninguém é notificado da própria ação.
- Clicar abre o card e marca como lida. Há "marcar todas como lidas".
- Só dentro do app: sem e-mail e sem push.

### Meus cards

- Todos os cards abertos atribuídos a você, em todos os quadros, agrupados em Atrasados, Vencendo (24 h), Com prazo e Sem prazo.
- Ordem por prazo e depois por prioridade. Cada item mostra quadro e lista de origem.

### Temas e uso no celular

- Tema claro (padrão) e escuro, alternados pelo botão no cabeçalho. A escolha fica salva no navegador.
- Layout responsivo com navegação inferior no celular. Arrastar e soltar é garantido só no desktop.

Não há tempo real: o quadro recarrega a cada 30 s, ao voltar para a aba e depois de cada ação. Escopo completo e o que ficou para depois: [`docs/product/scope.md`](docs/product/scope.md).

## Primeiro uso

### 1. Criar o primeiro Admin

Com o banco vazio, <http://127.0.0.1:5310> abre a tela **Configurar a equipe**. Preencha nome da equipe, seu nome, e-mail, senha (mínimo 10 caracteres, diferente do e-mail) e fuso horário, e clique em **Criar conta e começar**. Essa conta é Admin, e a tela de configuração não aparece mais para ninguém.

O envio desse formulário tem limite de 5 tentativas a cada 15 minutos por IP (veja [`docs/ops/known-issues.md`](docs/ops/known-issues.md#3-limites-de-requisição-que-aparecem-em-testes)).

### 2. Convidar pessoas

1. No cabeçalho, abra **Administração** → aba **Convites** → **Novo convite**.
2. Informe o e-mail (opcional; se preencher, só esse e-mail usa o convite) e o papel.
3. Clique em **Criar convite** e copie o **Link do convite**. O link aparece uma única vez.
4. Envie o link por um canal privado. A pessoa abre o link, informa nome, e-mail e senha e já entra logada.

Para testar sozinho na mesma máquina, abra o link em uma **janela anônima** ou em outro navegador. Aceitar o convite na janela em que o Admin está logado troca a sessão para a conta nova.

Em desenvolvimento, os links usam `http://127.0.0.1:5310`, então só funcionam na própria máquina.

### 3. Redefinir a senha de alguém (sem e-mail)

1. **Administração** → aba **Membros**.
2. No menu de ações (três pontos) da pessoa, clique em **Gerar link de redefinição de senha**.
3. Copie o link e envie por um canal privado. Ele vale 24 h e só pode ser usado uma vez.
4. A pessoa abre o link e define a nova senha. Todas as sessões antigas dela são encerradas.

Gerar um novo link cancela o anterior. Quem sabe a própria senha troca em **Meu perfil** (menu do usuário, no canto do cabeçalho).

## Comandos úteis

Rode na raiz do repositório (PowerShell ou qualquer terminal).

| Comando                             | Faz                                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| `pnpm dev`                          | banco local (5433), migrations, `api` (3000) e `web` (5310)                             |
| `pnpm dev:app`                      | só `api` e `web` em paralelo (banco por sua conta)                                      |
| `pnpm db:dev`                       | só o banco local, em primeiro plano (Ctrl+C para parar)                                 |
| `pnpm db:migrate`                   | aplica as migrations pendentes em `DATABASE_URL` (idempotente)                          |
| `pnpm db:generate`                  | gera migration a partir do schema (drizzle-kit)                                         |
| `pnpm db:up` / `pnpm db:down`       | sobe/derruba o Postgres do `docker-compose.yml` (alternativa com Docker)                |
| `pnpm test`                         | testes de todos os pacotes, um por vez (sobe o banco local se precisar)                 |
| `pnpm test:e2e`                     | Playwright em `apps/web`, com banco `kanban_e2e` e portas próprias (API 3100, web 5320) |
| `pnpm lint` / `pnpm lint:fix`       | ESLint em todo o monorepo                                                               |
| `pnpm typecheck`                    | TypeScript em todos os pacotes                                                          |
| `pnpm format` / `pnpm format:check` | Prettier                                                                                |
| `pnpm build`                        | build de `web` e `api`                                                                  |

Na primeira vez que rodar `pnpm test:e2e`, instale o Chromium do Playwright:

```powershell
pnpm --filter @kanban/web exec playwright install chromium
```

## Banco de dados

### Padrão: PostgreSQL local do projeto (sem Docker, sem admin)

O pacote npm `embedded-postgres` traz os binários oficiais do PostgreSQL 18 para Windows, Linux e macOS. Os scripts do repositório criam e controlam um cluster só deste projeto:

- endereço `127.0.0.1:5433` (não conflita com um Postgres nativo na 5432), usuário/senha `kanban`/`kanban` (**somente desenvolvimento**);
- bancos `kanban` (app) e `kanban_test` (testes), criados se faltarem; `kanban_e2e` é criado pelo `pnpm test:e2e`;
- dados em `.data/postgres` e log em `.data/postgres.log` (pasta ignorada pelo git).

Se o banco já estiver respondendo no `DATABASE_URL` (por exemplo, `pnpm db:dev` em outro terminal, Docker ou Postgres nativo), o `pnpm dev` reaproveita e não o derruba ao sair. Antes de subir a API, o `pnpm dev` sempre aplica as migrations pendentes, então não é preciso migrar à mão.

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

`pnpm test` roda os testes de todos os pacotes, um pacote por vez (em paralelo, a carga dos testes de banco da API deixava testes de UI com timeout). Os testes de integração da API usam `TEST_DATABASE_URL`: se ele não responder e apontar para `127.0.0.1`, o setup global do Vitest (`apps/api/test/global-setup.ts`) sobe o banco local sozinho e o para no final. Em seguida aplica as migrations em `kanban_test`; testes de banco usam `useTestDatabase()` (`apps/api/test/db.ts`), que trunca as tabelas antes de cada teste. Se o `pnpm dev` ou o `pnpm db:dev` já estiverem rodando, o banco é reaproveitado.

`pnpm test:e2e` (`apps/web/e2e/run.mjs`) prepara o banco isolado `kanban_e2e`, aplica as migrations e roda o Playwright, que sobe API e web nas portas 3100 e 5320. Dá para rodar com o `pnpm dev` aberto. Argumentos extras vão para o Playwright, por exemplo `pnpm test:e2e --headed`.

CI (GitHub Actions: lint, typecheck, testes, build e E2E): [`docs/ops/ci.md`](docs/ops/ci.md).

## Estrutura de pastas

```text
apps/api/          API Fastify: módulos, plugins, schema do banco e migrations (apps/api/drizzle)
apps/web/          SPA React: features por área, componentes e E2E (apps/web/e2e)
packages/shared/   contratos Zod e regras de domínio usados por API e web
scripts/           pnpm dev, pnpm db:dev e controle do PostgreSQL local
infra/postgres/    scripts SQL das alternativas Docker e Postgres nativo
docs/              produto, arquitetura, design e operação
```

## Documentação

| Documento                                                        | Conteúdo                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| [`docs/product/scope.md`](docs/product/scope.md)                 | escopo do MVP, histórias, regras de negócio, fora de escopo |
| [`docs/architecture/overview.md`](docs/architecture/overview.md) | arquitetura, modelo de dados, segurança, deploy planejado   |
| [`docs/architecture/api.md`](docs/architecture/api.md)           | contrato da API REST e decisões de implementação (§18)      |
| [`docs/architecture/plan.md`](docs/architecture/plan.md)         | plano de implementação por fatias                           |
| [`docs/architecture/adr/`](docs/architecture/adr/)               | decisões de arquitetura (ADRs)                              |
| [`docs/design/design-system.md`](docs/design/design-system.md)   | cores, tokens, temas e componentes                          |
| [`docs/design/screens.md`](docs/design/screens.md)               | telas e fluxos                                              |
| [`docs/ops/setup-local.md`](docs/ops/setup-local.md)             | ambiente local em detalhe e problemas comuns                |
| [`docs/ops/ci.md`](docs/ops/ci.md)                               | pipeline do GitHub Actions                                  |
| [`docs/ops/known-issues.md`](docs/ops/known-issues.md)           | problemas conhecidos, limites e pendências do deploy        |

Com a API rodando em desenvolvimento, a documentação OpenAPI interativa fica em <http://127.0.0.1:5310/api/docs>.

## Convenções

- Finais de linha LF (`.gitattributes`, `.editorconfig`). Scripts do `package.json` não usam sintaxe de shell POSIX, para funcionar no PowerShell.
- `.env` nunca é commitado; toda variável nova entra no `.env.example` com comentário.
