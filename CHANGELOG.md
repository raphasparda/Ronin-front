# Changelog

Todas as mudanças relevantes do Ronin ficam registradas aqui.

O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). O projeto ainda não tem versão publicada: tudo abaixo está em "Unreleased" (não lançado) até o deploy da Fatia 10.

## [Unreleased]

Entrega das Fatias 0 a 9 do MVP, na branch `feat/mvp-fatias-2-9`. A Fatia 10 (produção em VPS, backup e revisão final) ainda está pendente: veja [`docs/ops/known-issues.md`](docs/ops/known-issues.md).

### Foto de perfil

- Em **Meu perfil**, enviar, trocar e remover a foto: o arquivo (PNG, JPEG ou WebP) é recortado em quadrado pelo centro e comprimido no navegador antes de subir. A foto aparece em todos os avatares — cabeçalho, membros, responsáveis do card e comentários — e cai de volta nas iniciais quando não há foto.

### Alterado

- Monorepo dividido em dois repositórios, com histórico preservado: **ronin-web** (este, `raphasparda/Ronin-front`: SPA na raiz, E2E em `e2e/`, docs de design) e **ronin-api** (`raphasparda/Ronin-End`: API, `@raphasparda/ronin-shared` (antes `@kanban/shared`), banco local de dev, docs de produto, arquitetura e operação; ADR 0014 de lá). As entradas abaixo são do monorepo e incluem itens da API.
- `@raphasparda/ronin-shared` ligado por `link:../ronin-api/packages/shared` (ou pela versão publicada no GitHub Packages); fixtures de teste pelo subpath `@raphasparda/ronin-shared/test-fixtures`.
- `pnpm test:e2e` sobe a API a partir do ronin-api (`RONIN_API_DIR`, padrão `../ronin-api`), mantendo o banco isolado `kanban_e2e` e as portas 3100/5320.
- CI faz checkout de `raphasparda/Ronin-End` (variável opcional `RONIN_API_REPOSITORY`, segredo `RONIN_API_TOKEN` se privado).

### Adicionado

#### Deploy e configuração inicial

- Tela "Configurar a equipe" pede o **código de configuração** quando a API informa `requiresSetupToken` e envia `setupToken`; `403 SETUP_TOKEN_INVALID` aparece no próprio campo, com foco nele.
- Deploy do front como Static Site no Render: `scripts/render-build.sh` clona o Ronin-End com `GH_RONIN_END_TOKEN` (sem expor o token), instala só o `@raphasparda/ronin-shared` e gera `dist/`. Guia com configuração, rewrites (`/api/*` para a API e fallback da SPA), headers de segurança e cache em [`docs/ops/deploy-render.md`](docs/ops/deploy-render.md).

#### Base e ambiente de desenvolvimento

- Monorepo pnpm com `apps/api` (Fastify 5 + Drizzle + PostgreSQL 18), `apps/web` (React 19 + Vite + Tailwind 4) e `packages/shared` (contratos Zod e regras de domínio).
- `pnpm dev` sobe um PostgreSQL local do projeto (porta 5433, sem Docker e sem admin), aplica as migrations e sobe API (3000) e web (5310).
- Redirecionamento automático de `localhost:5310` para `127.0.0.1:5310` no servidor de desenvolvimento.
- Documentação OpenAPI em `/api/docs` (só fora de produção).
- Migrations versionadas em `apps/api/drizzle`.

#### Equipe e acesso

- Configuração inicial: a primeira conta cria a equipe e vira Admin.
- Login e logout com sessão em cookie `HttpOnly`, expiração ociosa e absoluta, e proteção CSRF.
- Senhas com Argon2id.
- Convites por link de uso único (7 dias), com e-mail opcional e papel.
- Redefinição de senha por link gerado pelo Admin (24 h), sem e-mail; encerra todas as sessões da pessoa.
- Administração de membros: mudar papel, desativar, reativar e gerar link de redefinição, com garantia de pelo menos um Admin ativo.
- Anonimização de conta desativada (LGPD), mantendo cards, comentários e histórico com "Usuário removido".
- Perfil (nome e senha) e ajustes da equipe (nome e fuso horário).

#### Quadros e listas

- Quadros com listas padrão "A fazer", "Fazendo" e "Concluído".
- Listas com cor da paleta fixa: criar, renomear, trocar cor, reordenar, arquivar e restaurar.
- Uma lista de conclusão por quadro.
- Arquivar e restaurar quadros; exclusão definitiva só pelo Admin, com confirmação pelo nome.

#### Cards

- Criação rápida no fim da lista.
- Arrastar e soltar entre listas e quadros, com atualização otimista e rollback em erro, e alternativa "Mover para…" pelo teclado.
- Detalhe do card com descrição em Markdown seguro (sem HTML cru, links com `noopener`).
- Concluir e reabrir pelo botão ou pela lista de conclusão, registrados no histórico.
- Arquivar e restaurar cards; exclusão definitiva só pelo Admin.
- Histórico de atividade imutável (criação, título, movimentação, responsáveis, prazo, prioridade, conclusão, arquivamento).

#### Campos, checklists e comentários

- Responsáveis, prazo (data e hora opcional, com estados "vencendo" e "atrasado"), prioridade (Baixa, Média, Alta, Urgente) e etiquetas por quadro.
- Filtro do quadro por responsável, etiqueta, prioridade, prazo e título, salvo na URL.
- Checklists com itens marcáveis e reordenáveis e progresso na face do card.
- Comentários em Markdown; o autor edita e exclui, o Admin exclui qualquer um.

#### Notificações e Meus cards

- Notificações no app para atribuição e comentário em card em que a pessoa é responsável, sem autonotificação, com contador, paginação e "marcar todas como lidas".
- Página "Meus cards" com os cards abertos atribuídos à pessoa, agrupados por estado do prazo e ordenados por prazo e prioridade.
- Limpeza periódica em produção de notificações lidas antigas, sessões expiradas, contadores de tentativa e tokens velhos.

#### Interface

- Tema claro (padrão) e escuro com as cores da logo, alternado no cabeçalho e aplicado sem piscar.
- Layout responsivo com navegação inferior no celular.

#### Testes e CI

- Testes de integração da API contra PostgreSQL real, testes de componentes com MSW e testes de domínio.
- E2E com Playwright e checagem de acessibilidade com axe, em banco isolado `kanban_e2e`, cobrindo os fluxos das Fatias 1 a 9 (inclusive dois usuários).
- Workflow do GitHub Actions com lint, typecheck, testes, build e E2E ([`docs/ops/ci.md`](docs/ops/ci.md)).

### Segurança

- Bloqueio de login sem condição de corrida: a tentativa é reservada de forma atômica no banco antes de verificar a senha. Uma rajada de 30 logins paralelos com senha errada faz no máximo 5 verificações. Vale também para a senha atual na troca de senha.
- Limites por rota: login com 30 requisições por minuto por IP e troca de senha com 10 a cada 15 minutos por usuário.
- Rebaixar, desativar ou anonimizar um Admin revoga, na mesma transação, os convites e links de redefinição pendentes criados por ele.
- Configuração fail-closed: a API não sobe com `NODE_ENV=production` e `APP_ORIGIN` em `http://`, nem com `APP_ORIGIN` em `https://` fora de produção.
- Logs sem dados sensíveis: erros de banco saem sem valores de parâmetros nem mensagens com e-mail ou hash; cookies, senhas e tokens são omitidos.
- Na interface: redirecionamento pós-login (`?next=`) aceita só caminhos internos.
- CSP do site estático sem `'unsafe-inline'` nem `'unsafe-eval'` (`script-src 'self'`, `style-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`), validada no Chromium com o build de produção. O Zod roda em modo `jitless` para não tentar `new Function`.

### Corrigido

- Quadro sem estouro de largura no celular.
- Popovers ancorados à tela, sem fechar ao rolar.
- "Desfazer" em Meus cards devolve o card à posição original.
- Botão Fechar acessível e foco preso de forma robusta no detalhe do card.
- Aviso ao excluir comentário e "Mover para…" sem ids temporários.
- Rollback de movimento por card e atualização dos caches de usuários e de Meus cards.
- Textos da interface com linguagem neutra de gênero.

Detalhes técnicos das decisões: [`docs/architecture/api.md`](docs/architecture/api.md) §18.
