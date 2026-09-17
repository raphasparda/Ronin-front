# Ronin Web

**Quadros de tarefas coloridos, rápidos e acessíveis para equipes pequenas.**

[![CI](https://github.com/raphasparda/Ronin-front/actions/workflows/ci.yml/badge.svg)](https://github.com/raphasparda/Ronin-front/actions/workflows/ci.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)
![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?logo=playwright&logoColor=white)

> **English summary.** Web client for Ronin, a self-hosted, board-based task manager for small teams, in the spirit of Trello and ClickUp. Built with React 19, TypeScript, Vite, TanStack Query and Tailwind CSS 4. Highlights: drag-and-drop with a keyboard-friendly "Move to…" alternative, optimistic updates with per-item rollback and mutation queues, filters stored in the URL, safe Markdown, light and dark themes, page transitions with the View Transitions API, and WCAG 2.2 AA checks with axe in the end-to-end suite. Documentation is in Brazilian Portuguese.

O Ronin é um app de tarefas em quadros, no estilo Trello e ClickUp, para uma equipe pequena rodar no próprio servidor. Este repositório tem a **SPA em React**. A API, o banco e os contratos compartilhados ficam em um repositório separado.

## Sumário

- [Telas](#telas)
- [Funcionalidades](#funcionalidades)
- [Destaques técnicos](#destaques-técnicos)
- [Stack](#stack)
- [Documentação](#documentação)
- [Autor](#autor)

## Telas

Capturas geradas com o próprio app, rodando com dados de exemplo.

**Quadro no tema escuro**

![Quadro "Sprint 12" no tema escuro, com as listas A fazer, Fazendo, Em revisão e Concluído](docs/images/quadro-dark.png)

**Quadro no tema claro**

![O mesmo quadro no tema claro](docs/images/quadro-light.png)

<table>
  <tr>
    <td width="50%"><strong>Detalhe do card</strong><br /><img src="docs/images/detalhe-do-card.png" alt="Detalhe do card com descrição em Markdown, checklist, responsáveis, prazo e etiquetas" /></td>
    <td width="50%"><strong>Meus cards</strong><br /><img src="docs/images/meus-cards.png" alt="Meus cards agrupados em Atrasados, Vencendo, Com prazo e Sem prazo" /></td>
  </tr>
  <tr>
    <td width="50%"><strong>Login</strong><br /><img src="docs/images/login.png" alt="Tela de login no tema escuro" /></td>
    <td width="50%" align="center"><strong>Celular</strong><br /><img src="docs/images/mobile-quadro.png" alt="Quadro no celular, com navegação inferior" width="260" /></td>
  </tr>
</table>

## Funcionalidades

- **Quadros e listas com cor** de uma paleta fixa, e uma lista marcada como "Concluído".
- **Arrastar e soltar** listas, cards e itens de checklist com `@dnd-kit`.
- **"Mover para…"** (quadro, lista e posição) como alternativa completa ao arraste, pelo teclado e no celular.
- **Detalhe do card** em diálogo com URL própria: título, descrição em **Markdown seguro**, histórico de atividade.
- **Responsáveis, etiquetas, prazo e prioridade** (Baixa, Média, Alta, Urgente), com estados "vencendo" e "atrasado". Nenhuma informação depende só da cor.
- **Filtros na URL** por responsável, etiqueta, prioridade, prazo e texto: o link filtrado pode ser compartilhado.
- **Checklists** com progresso na face do card e **comentários** em Markdown.
- **Notificações** no app quando alguém atribui você a um card ou comenta num card seu.
- **Meus cards**: tudo o que é seu, em todos os quadros, agrupado por prazo e ordenado por prioridade.
- **Tema claro e escuro** com as cores da logo, aplicado antes da primeira pintura (sem piscar).
- **Transições entre telas no estilo iOS** (entrar, voltar, trocar de seção) com a View Transitions API, e **animações "bubble"** em diálogos, menus e cards novos. "Reduzir movimento" desliga tudo.
- **Responsivo**, com navegação inferior no celular.
- **Acessibilidade WCAG 2.2 AA**: navegação completa por teclado, foco visível, rótulos em ícones e axe nos testes E2E, nos dois temas.
- **Administração**: convites e redefinição de senha por link, papéis, desativação e anonimização de membros.

## Destaques técnicos

- **Atualizações otimistas com rollback por item** (TanStack Query 5): mover, concluir ou editar um card aparece na hora. Se a API recusar, só os campos daquele card voltam, sem desfazer as outras ações em andamento ([`src/features/cards/cards-api.ts`](src/features/cards/cards-api.ts)).
- **Filas de mutação** por escopo (`scope` do TanStack Query): movimentos seguidos no mesmo quadro são enviados em ordem, e o quadro só é recarregado quando a fila esvazia.
- **Contratos compartilhados**: tipos e schemas Zod vêm do pacote `@raphasparda/ronin-shared`, o mesmo que a API usa. Os testes de componentes usam MSW com as mesmas fixtures.
- **Design system tokenizado no Tailwind 4**: tokens semânticos (`--color-surface`, `--color-text`, ...) e de paleta por tema em `@theme`, sem cores literais nos componentes ([`src/styles/globals.css`](src/styles/globals.css), [`docs/design/design-system.md`](docs/design/design-system.md)).
- **Segurança no cliente**: o redirecionamento pós-login (`?next=`) aceita só caminhos internos ([`src/lib/safe-next.ts`](src/lib/safe-next.ts)); o Markdown é renderizado sem HTML cru e sem links `javascript:` ([`src/components/ui/Markdown.tsx`](src/components/ui/Markdown.tsx)); toda mutação envia o header de CSRF que a API exige.
- **Transições de página** calculadas pela profundidade da rota (push, pop, fade), sobre `viewTransition` do React Router ([`src/lib/page-transitions.ts`](src/lib/page-transitions.ts)).
- **E2E contra a API real**: o Playwright sobe a API do ronin-api num banco isolado (`kanban_e2e`), em portas próprias, e roda em desktop e celular, com checagem de acessibilidade por axe.

## Stack

| Camada      | Tecnologia                                                      |
| ----------- | --------------------------------------------------------------- |
| UI          | React 19, TypeScript 5.9, React Router, lucide-react            |
| Build       | Vite 8                                                          |
| Estilo      | Tailwind CSS 4 com tokens próprios, fonte Figtree               |
| Dados       | TanStack Query 5, contratos Zod 4 (`@raphasparda/ronin-shared`) |
| Formulários | React Hook Form                                                 |
| Arraste     | `@dnd-kit/core` e `@dnd-kit/sortable`                           |
| Markdown    | `react-markdown` + `remark-gfm`, sem HTML                       |
| Testes      | Vitest + Testing Library + MSW; Playwright + axe                |
| Qualidade   | ESLint, Prettier, GitHub Actions                                |

## Documentação

| Documento                                                      | Conteúdo                                         |
| -------------------------------------------------------------- | ------------------------------------------------ |
| [`docs/design/design-system.md`](docs/design/design-system.md) | cores, tokens, temas e componentes               |
| [`docs/design/screens.md`](docs/design/screens.md)             | telas e fluxos                                   |
| [`docs/ops/setup-local.md`](docs/ops/setup-local.md)           | ambiente local, proxy, E2E                       |
| [`docs/ops/ci.md`](docs/ops/ci.md)                             | pipeline do GitHub Actions, segredos e variáveis |
| [`docs/ops/known-issues.md`](docs/ops/known-issues.md)         | problemas conhecidos                             |
| [`CHANGELOG.md`](CHANGELOG.md)                                 | histórico de entregas                            |

## Autor

**Raphael Sparda** · SPARDA.dev · [github.com/raphasparda](https://github.com/raphasparda)
