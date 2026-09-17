# Telas e fluxos: Kanban MVP

> Autor: Raphael Sparda. Status: **v3 (2026-09-16)**.
> Alinhado a `docs/product/scope.md` v2, `docs/architecture/overview.md` v1.2 (§4.2 e §9) e `docs/architecture/api.md` v1.2. Tokens e componentes: `docs/design/design-system.md`.
> **Sem gamificação.** Toda cor citada é token ou chave de paleta.

## 0. Mapa do app

### 0.1 Rotas (overview §9)

| Rota | Tela | Acesso |
| ---- | ---- | ---- |
| `/setup` | Configuração inicial | Só com `needsSetup`. Senão, redireciona. |
| `/login` | Login (`?next=<rota>`) | Público |
| `/convite#token=…` | Aceitar convite | Público |
| `/redefinir-senha#token=…` | Nova senha | Público |
| `/` | Quadros ativos | Logado |
| `/quadros/arquivados` | Quadros arquivados | Logado |
| `/b/:boardId` | Quadro | Logado |
| `/b/:boardId/c/:cardId` | Detalhe do card (diálogo sobre o quadro, URL compartilhável) | Logado |
| `/meus-cards` | Meus cards | Logado |
| `/perfil` | Perfil | Logado |
| `/admin/membros`, `/admin/convites`, `/admin/workspace` | Administração (abas) | Admin |

Notificações não têm rota: são um popover no desktop e um Sheet de tela cheia no mobile.

### 0.2 Fluxos principais

```text
Instância nova ─> /setup ─> Admin criado ─> / (vazio) ─> Novo quadro ─> /b/:id (A fazer · Fazendo · Concluído)
Admin ─> /admin/convites ─> Novo convite ─> copia link ─> envia ─> /convite#token ─> conta ─> /
Membro ─> /meus-cards ─> abre card ─> define prioridade ─> Concluir ─> card vai para o fim de "Concluído"
Card concluído ─> Reabrir ─> card vai para o TOPO da primeira lista ativa que não é de conclusão
Esqueceu a senha ─> Admin ─> /admin/membros ─> Gerar link ─> /redefinir-senha#token ─> /login
```

### 0.3 Regras de conclusão refletidas na UI (overview §4.2, ADR 0010)

| Ação | Efeito | Feedback (toast + `aria-live`) |
| ---- | ---- | ---- |
| "Concluir" com lista de conclusão | Conclui e move para o **fim** dela | "Card concluído e movido para {Concluído}." |
| "Concluir" sem lista de conclusão | Conclui e fica onde está | "Card concluído." |
| "Reabrir" com o card na lista de conclusão | Reabre e move para o **topo** da primeira lista ativa não-conclusão | "Card reaberto e movido para o topo de {A fazer}." + [Ver card] |
| "Reabrir" com o card na lista de conclusão, sem outra lista ativa | Reabre e fica | "Card reaberto. Ele continua em {Concluído} porque o quadro não tem outra lista." |
| "Reabrir" fora da lista de conclusão ou sem lista de conclusão | Reabre e fica | "Card reaberto." |
| Arrastar ou "Mover para…" um card aberto **para** a lista de conclusão | Conclui | "Card concluído." |
| Arrastar ou "Mover para…" um card concluído **para fora** da lista de conclusão | Reabre, na posição escolhida | "Card reaberto." |
| Restaurar card aberto cuja lista é de conclusão | Restaura no fim e **conclui** | "Card restaurado em {Concluído} e marcado como concluído." |
| Marcar lista como de conclusão com cards abertos | **Dialog de confirmação** e depois conclui todos | Seção 7.2 |
| Desmarcar lista de conclusão ou arquivá-la | Ninguém é reaberto | "{Entregue} deixou de ser a lista de conclusão. Os cards dela continuam concluídos." |
| Criar card na lista de conclusão | Não permitido: a lista não tem "Adicionar card" | Seção 7.2 |

Os nomes entre chaves são os nomes reais das listas. A UI decide o toast pelo `completionChange` da resposta (`completed` / `reopened` / `null`) e pela lista final do card.

### 0.4 Estados e erros globais (overview §8)

| Situação | Comportamento | Microcopy |
| ---- | ---- | ---- |
| 401 | Limpa o cache e vai para `/login?next=<rota>`. | Faixa no login: "Sua sessão expirou. Entre de novo para continuar." |
| 403 | Toast. Rota de admin acessada por Member: EmptyState. | "Você não tem permissão para isso." |
| 404 de quadro ou card | EmptyState. | "Quadro não encontrado. Ele pode ter sido excluído." / "Card não encontrado. Ele pode ter sido excluído." |
| 409 `BOARD_ARCHIVED` | Toast e recarga. | "Este quadro foi arquivado. Restaure o quadro para editar." |
| 409 `LIST_ARCHIVED` | Toast e rollback. | "A lista de destino foi arquivada. Escolha outra lista." |
| 429 | Toast com o tempo de `Retry-After`. | "Muitas tentativas. Tente de novo em {2 minutos}." |
| 5xx ou rede | Toast. Em carregamento de página, EmptyState com [Tentar de novo]. | "Algo deu errado. Tente de novo." |
| Offline | Faixa abaixo do cabeçalho com barra `--status-due-soon-bg` e ícone. | "Sem conexão. As alterações não serão salvas até a conexão voltar." |
| Polling ou foco na aba | Silencioso. Não mexe em campo em edição nem em card sendo arrastado. | — |

---

## 1. Cabeçalho e navegação

### 1.1 Desktop (≥ 768px)

```text
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ [▮▮▮] Kanban     Quadros   Meus cards                  🔔(3)   ☀ (●━━) ☾   (RS)     │  56px, bg-surface, shadow-sm
└──────────────────────────────────────────────────────────────────────────────────────┘
```

| Elemento | Especificação |
| ---- | ---- |
| Logo | Marca de três barrinhas `rounded-full` nas cores `blue`, `orange` e `green` + "Kanban" em 18px 700. É link para `/`, com `aria-label="Kanban, ir para Quadros"`. |
| Quadros / Meus cards | 14px 500 `text-muted`. O atual usa `text-text` 600 + barra de 3px `bg-accent` + `aria-current="page"`. |
| Notificações | `IconButton` de sino + pílula `data-status="overdue"` com o número (`9+`). `aria-label="Notificações, 3 não lidas"`. |
| Tema | `ThemeSwitch` (`role="switch"`, `aria-label="Tema escuro"`), com sol e lua ao lado. |
| Avatar | Menu: nome (texto), "Meu perfil", "Administração" (só Admin → `/admin/membros`), "Atalhos do teclado", divisória, "Sair". |

O primeiro focável é "Pular para o conteúdo".

### 1.2 Mobile (< 768px)

```text
┌────────────────────────────────────┐
│ [▮▮▮] Kanban     🔔(3)  (●━━)  (RS)│
├────────────────────────────────────┤
│              conteúdo              │
├────────────────────────────────────┤
│    ▦ Quadros       ☑ Meus cards    │  navegação inferior de 56px
└────────────────────────────────────┘
```

O switch de tema fica sem os ícones de sol e lua em telas menores que 400px. O item ativo da navegação inferior usa `text-accent-text` 600 + barra superior de 3px.

---

## 2. Configuração inicial (`/setup`)

```text
            ┌──────────────────────────────────────────┐
            │ [▮▮▮] Kanban                             │
            │ Configurar a equipe                      │  28px 700
            │ Crie a conta de administrador. Você      │
            │ convida as outras pessoas depois.        │
            │ Nome da equipe       [                ]  │
            │ Seu nome             [                ]  │
            │ E-mail               [                ]  │
            │ Senha                [            ][👁]  │
            │ Use pelo menos 10 caracteres.            │
            │ [      Criar conta e começar      ]      │
            └──────────────────────────────────────────┘
```

- Cartão `bg-surface rounded-xl shadow-sm`, 420px, centralizado (sem cartão no mobile). Labels ficam **acima** dos campos (o wireframe está comprimido).
- O fuso vai com o padrão `America/Sao_Paulo`, sem campo nesta tela (é editável em `/admin/workspace`).
- Limites: nome da equipe 1–100, nome 1–80, senha 10–256. `autocomplete`: `organization`, `name`, `email`, `new-password`.

| Estado | Microcopy |
| ---- | ---- |
| Enviando | "Criando conta…" |
| Vazios | "Informe o nome da equipe." / "Informe seu nome." / "Informe seu e-mail." |
| E-mail inválido | "Digite um e-mail válido, como nome@empresa.com." |
| Senha curta | "A senha precisa ter pelo menos 10 caracteres." |
| Já configurada | Toast + `/login`: "Esta instância já foi configurada. Entre com sua conta." |
| Sucesso | Sessão criada → `/`. |

A validação acontece no blur e no envio. No envio, o foco vai para o primeiro erro, com o resumo `role="alert"` "Corrija 2 campos para continuar."

## 3. Login (`/login`)

Mesmo cartão: "Entrar", E-mail, Senha (mostrar/ocultar) e [Entrar]. Rodapé: "Esqueceu a senha? Peça um link de redefinição ao administrador da equipe." Não há cadastro nem "esqueci minha senha" clicável.

| Estado | Microcopy |
| ---- | ---- |
| Enviando | "Entrando…" |
| Credenciais erradas ou conta desativada | `role="alert"`: "E-mail ou senha incorretos." A senha é limpa e o foco vai para ela. |
| 429 | "Muitas tentativas seguidas. Tente de novo em {5 minutos}." O botão fica desabilitado até lá. |
| Veio de 401 | Faixa: "Sua sessão expirou. Entre de novo para continuar." |
| Veio de redefinição | Faixa de sucesso: "Senha alterada. Entre com a nova senha." |

Depois do login, vai para `next` (se for rota interna) ou para `/`.

## 4. Aceitar convite (`/convite#token=…`)

O front lê o token do fragmento e chama `invites/lookup`, que retorna e-mail, papel e expiração.

```text
Aceitar convite
Crie sua conta para entrar na equipe como Membro. O convite vale até 23 set.
Seu nome     [                                   ]
E-mail       [ ana@drexys.com.br                 ]   ← preenchido e somente leitura se o convite tiver e-mail
Senha        [                            ] [👁]
Use pelo menos 10 caracteres.
[          Criar conta          ]
```

| Estado | Comportamento / microcopy |
| ---- | ---- |
| Validando | Skeleton + sr "Verificando convite…". |
| 410 `TOKEN_INVALID` ou sem token | EmptyState: "Este convite não vale mais" / "Ele pode ter expirado, já ter sido usado ou ter sido cancelado. Peça um novo link a quem convidou você." + "Já tenho conta: entrar". |
| 409 `EMAIL_TAKEN` | No campo: "Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail." |
| 409 `INVITE_EMAIL_MISMATCH` | "Este convite é para outro e-mail. Use o e-mail do convite." |
| 429 | "Muitas tentativas. Tente de novo em {x minutos}." |
| Sucesso | Sessão criada → `/`, com o toast "Bem-vindo à equipe, Ana." |

## 5. Redefinir senha (`/redefinir-senha#token=…`)

```text
Criar nova senha
Olá, Ana. Escolha uma nova senha para sua conta.
Nova senha  [                            ] [👁]
Use pelo menos 10 caracteres. Ao salvar, você sai de todos os dispositivos.
[       Salvar nova senha       ]
```

| Estado | Microcopy |
| ---- | ---- |
| 410 | "Este link não vale mais. Peça um novo ao administrador da equipe." |
| Enviando | "Salvando…" |
| Sucesso | `/login` com a faixa "Senha alterada. Entre com a nova senha." |

---

## 6. Quadros (`/`) e arquivados (`/quadros/arquivados`)

```text
Quadros                                                       [+ Novo quadro]

┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│ ███████▓▓▓▓░░░░░░░░░░░░  │ │ ███████████▓▓▓▓░░░░░░░░  │ │ ░░░░░░░░░░░░░░░░░░░░░░░  │  faixa de 6px com as cores das listas
│ Site institucional       │ │ App mobile               │ │ Operação                 │  16px 600
│ (12 abertos)(▲ 3 atrasados)│ (4 abertos)              │ │ (0 abertos)              │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘

Ver quadros arquivados →
```

- Grade `repeat(auto-fill, minmax(260px, 1fr))`, gap 16px.
- Tile `<a>` `bg-surface rounded-xl shadow-sm border border-border`, hover `shadow-md`.
  - A faixa decorativa (`aria-hidden`) mostra a proporção dos cards abertos por lista, nas cores das listas.
  - Pílulas "N abertos" (neutra) e "N atrasados" (`data-status="overdue"`).
  - *Os contadores dependem de dados agregados que `GET /api/boards` não retorna hoje. Se o arquiteto não incluir, o tile mostra só o nome e a faixa some (sem bloquear o MVP).*
- Ordem alfabética (`localeCompare('pt-BR')`).
- **Novo quadro:** Dialog "Nome do quadro" + ajuda "Ele já vem com as listas A fazer, Fazendo e Concluído." + [Criar quadro]. Ao criar, abre `/b/:id`.
- **`/quadros/arquivados`:** lista com nome, pílula "Arquivado", [Restaurar] e [Excluir] (Admin). Vazio: "Nenhum quadro arquivado."

| Estado | Microcopy |
| ---- | ---- |
| Carregando | 6 tiles skeleton. |
| Vazio | "Nenhum quadro ainda" / "Crie o primeiro quadro para organizar as tarefas da equipe." / [Criar quadro] |
| Nome vazio | "Dê um nome ao quadro." |

---

## 7. Quadro (`/b/:boardId`)

### 7.1 Layout

```text
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Site institucional ✎                                           [⚲ Filtros (2)]   [⋯]    │  22px 700
│ [🔍 Buscar por título] [Responsável ▾] [Etiqueta ▾] [Prioridade ▾] [Prazo ▾]             │
│ Filtro ativo · 12 de 40 cards · Limpar     (Prioridade: Urgente, Alta ✕) (Responsável: Eu ✕)│
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐ ┌──────────────┐ │
│ │▓ A fazer   (5)   ⋯ ▓│ │▓ Fazendo   (2)   ⋯ ▓│ │▓ ✓ Concluído (9) ⋯ ▓│ │ + Adicionar  │ │  cabeçalho sólido (blue / orange / green)
│ ├─────────────────────┤ ├─────────────────────┤ ├─────────────────────┤ │   lista      │ │
│ │┃(Bug) (Front-end)   │ │                     │ │                     │ └──────────────┘ │  ┃ = marca de 4px na cor da lista
│ │┃Corrigir menu do    │ │                     │ │                     │                  │
│ │┃rodapé              │ │                     │ │                     │                  │
│ │┃(⇈ Urgente) (▲ Atrasado · 14 set)           │ │                     │                  │
│ │┃☑ 2/5  💬 3  (AS)(RS)│ │                     │ │                     │                  │
│ │ + Adicionar card    │ │ + Adicionar card    │ │ Cards chegam aqui   │                  │
│ └─────────────────────┘ └─────────────────────┘ │ ao serem concluídos.│                  │
│                                                 └─────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Cabeçalho do quadro:** nome editável inline (1–100 caracteres; vazio restaura com "O nome não pode ficar vazio.").
- **Menu ⋯:** "Etiquetas…", "Itens arquivados…", divisória, "Arquivar quadro", "Excluir quadro…" (Admin).
- **Quadro arquivado:** faixa "Este quadro está arquivado." + [Restaurar quadro]. Somente leitura: sem arrastar, sem "Adicionar", controles desabilitados.

### 7.2 Lista (coluna)

**Anatomia:**
- Coluna de 288px `rounded-lg bg-surface-sunken`, com rolagem interna.
- **Cabeçalho sólido** de 44px com `data-color="{list.color}"`, `bg-(--c-bg) text-(--c-fg)` e `rounded-t-lg`. Contém:
  - ✓ (só lista de conclusão, com sr "(lista de conclusão)" e tooltip "Cards movidos para cá são concluídos");
  - nome em 14px 700 (clique para renomear);
  - pílula de contagem invertida `bg-(--c-fg) text-(--c-bg)` ("5", ou "3 de 5" com filtro);
  - ⋯ em `--c-fg`.
- Foco no cabeçalho: anel em `--c-fg` (automático).

**Menu da lista (⋯):**
- "Renomear"
- "Cor da lista" → `ColorSwatchPicker` com 9 cores. A troca é imediata e otimista.
- "Marcar como lista de conclusão" / "Desmarcar lista de conclusão"
- "Mover lista para a esquerda" / "Mover lista para a direita" (alternativa ao arrastar)
- divisória, "Arquivar lista"

**Marcar como lista de conclusão.** O front conta os cards **abertos e não arquivados** da lista no payload do quadro, sem considerar o filtro.
- **0 cards abertos:** aplica direto. Toast: "{Entregue} agora é a lista de conclusão." Se havia outra, o toast continua: " {Concluído} deixou de ser."
- **1 ou mais cards abertos:** Dialog antes de salvar:

```text
┌ Marcar "Entregue" como lista de conclusão? ─────────────────── ✕ ┐
│ Os 4 cards abertos desta lista serão marcados como concluídos,  │
│ com você como autor da conclusão.                               │
│ A lista Concluído deixa de ser a lista de conclusão. Os cards   │  ← só se já existe outra lista de conclusão
│ que estão nela continuam concluídos.                            │
│ A partir de agora, cards movidos para Entregue são concluídos   │
│ e não é possível criar card direto nela.                        │
│                       [Cancelar]  [Marcar e concluir 4 cards]   │  primário
└─────────────────────────────────────────────────────────────────┘
```

  - Singular: "O card aberto desta lista será marcado como concluído, com você como autor da conclusão." / botão "Marcar e concluir 1 card".
  - Sucesso (usa `completedCardIds.length` da resposta): toast "{Entregue} agora é a lista de conclusão. 4 cards foram concluídos." Os cards ganham a pílula "Concluído", e o `aria-live` anuncia a mesma frase.
  - Se a contagem da resposta for diferente da exibida (alguém mexeu antes), o toast usa o número real.
- **Desmarcar:** sem dialog. Toast: "{Entregue} deixou de ser a lista de conclusão. Os cards dela continuam concluídos."
- **Arquivar lista:**
  - Com cards: "Arquivar a lista "Fazendo"? Os 2 cards dela também saem do quadro. Você pode restaurar tudo em Itens arquivados." [Cancelar] [Arquivar lista]
  - Se for a lista de conclusão, acrescenta: "Ela deixa de ser a lista de conclusão."

**Lista de conclusão sem "Adicionar card"** (API recusa com `LIST_IS_DONE_LIST`). No rodapé, fica o texto `text-muted` 12px: "Cards chegam aqui ao serem concluídos." A coluna vazia tem altura mínima de 96px (alvo de drop).

**Adicionar lista:** bloco `bg-surface-sunken rounded-lg` com borda tracejada `border-strong` e o botão "+ Adicionar lista".
- Ao abrir: "Nome da lista" + `ColorSwatchPicker` compacto, com a **próxima cor do ciclo** (`nextPaletteColor`) pré-selecionada + [Adicionar] + ✕.
- O campo continua aberto para a próxima lista.

### 7.3 Face do card

```text
┌┃─────────────────────────────┐   bg-surface, rounded-lg, border-border, shadow-sm, padding 12px
┃ (Bug) (Front-end) (+2)       │   LabelPills
┃ Corrigir menu do rodapé      │   14px 500, até 3 linhas
┃ (⇈ Urgente) (▲ Atrasado · 14 set)│  PriorityPill + DuePill (quebram linha se faltar espaço)
┃ ☑ 2/5    💬 3        (AS)(RS)│   12px text-muted; avatares 24px
└┃─────────────────────────────┘
 ┃ marca de 4px na cor da lista atual (aria-hidden)
```

- O card é um `<a href="/b/:boardId/c/:cardId">`. O `aria-label` composto segue esta ordem: título, etiquetas, **prioridade**, prazo, checklist, comentários, responsáveis. Exemplo: "Corrigir menu do rodapé. Etiquetas: Bug, Front-end. Prioridade urgente. Atrasado, 14 de setembro. Checklist 2 de 5. 3 comentários. Responsáveis: Ana Souza, Raphael Sparda."
- Marca da lista: borda esquerda de 4px com `var(--palette-<cor>-bg)` (scope C2). É decorativa, porque a lista já é identificada pela coluna ou pela pílula.
- Hover: `shadow-md` + `border-strong`. Foco: anel inset.
- Linhas vazias não aparecem. **Sem prioridade não aparece nada.**
- Checklist completo: `5/5` em `text-success`.
- Ações rápidas (⋯, visível em hover e foco e sempre no mobile): "Abrir", "Mover para…", "Concluir"/"Reabrir", "Prioridade ›" (submenu com as 4 opções + "Sem prioridade"), "Arquivar".

**PriorityPill**

| Valor | Pílula |
| ---- | ---- |
| `urgent` | `data-priority="urgent"` · ícone `ChevronsUp` · "Urgente" |
| `high` | `data-priority="high"` · `ChevronUp` · "Alta" |
| `medium` | `data-priority="medium"` · `Equal` · "Média" |
| `low` | `data-priority="low"` · `ChevronDown` · "Baixa" |
| `null` | nada na face |

A prioridade **não reordena** cards no quadro (RN16).

**DuePill** (`getDueState`)

| Estado | Pílula | Texto |
| ---- | ---- | ---- |
| `scheduled` | `data-status="scheduled"` + `Calendar` | `20 set` · `20 set, 14:00` |
| `due_soon` | `data-status="due-soon"` + `Clock` | `Vencendo · hoje 18:00` / `Vencendo · amanhã 09:00` |
| `overdue` | `data-status="overdue"` + `AlertTriangle` | `Atrasado · 14 set` |
| `completed` | `data-status="done"` + `Check` | `Concluído · 14 set` / `Concluído` (sem prazo) |
| `none` e aberto | nada | — |

As datas ficam no fuso do workspace, com o ano só quando é diferente do atual. Card concluído sem prazo também mostra "Concluído". O título não é riscado.

### 7.4 Adicionar card rápido

- É o botão ghost "+ Adicionar card" no rodapé (menos na lista de conclusão). Abre uma textarea "Título do card" + [Adicionar card] + ✕ + a dica "Enter adiciona · Esc fecha".
- **Enter** cria no fim, limpa, mantém o foco e rola até o card. Quebras de linha viram espaço (limite de 500). **Esc** fecha. O clique fora mantém o rascunho se houver texto.
- Vazio: botão desabilitado.
- Otimista. Se falhar: "Não foi possível criar o card. O texto continua no campo para você tentar de novo."
- Anúncio: "Card criado em A fazer."

### 7.5 Arrastar e "Mover para…"

**Arrastar** (`@dnd-kit`, `PointerSensor` com 5px e `KeyboardSensor`; garantido ≥ 1024px):
- Cards dentro e entre listas. Listas pelo cabeçalho. Visual na seção 5 do design system.
- Entrar na lista de conclusão **conclui** ("Card concluído."). Sair dela com card concluído **reabre** ("Card reaberto."). O status muda na hora (otimista) e é confirmado pelo `completionChange`.
- Erro: o card volta, com o toast "Não foi possível mover o card. Ele voltou para onde estava." (e o status volta junto).
- Com filtro ativo, arrastar é permitido, e a posição é calculada entre os vizinhos visíveis.
- Anúncios: "Card {título} pego. Posição 1 de 5 em A fazer." / "Movido para Fazendo, posição 2 de 3." / "Card solto em Concluído. Card concluído." / "Card solto em Fazendo. Card reaberto." / "Movimento cancelado."
- Touch (< 1024px): não garantido. O caminho é "Mover para…".

**Dialog "Mover para…"** (menu do card, detalhe ou atalho `M` com o card focado)

```text
┌ Mover card ────────────────────────────── ✕ ┐
│ Quadro    [ Site institucional           ▾] │
│ Lista     [ (● Fazendo)                  ▾] │  opções com ListPill
│ Posição   [ 3 (final)                    ▾] │  1..n+1
│                                             │
│ ⚠ As etiquetas Bug e Front-end não existem  │  trocar de quadro com etiquetas (text-warning + ícone)
│   em App mobile e serão removidas do card.  │
│ ✓ Mover para Concluído conclui o card.      │  destino é lista de conclusão e card aberto
│ ↺ Tirar o card de Concluído reabre o card.  │  origem é lista de conclusão, card concluído, destino comum
│                       [Cancelar]  [Mover]   │
└─────────────────────────────────────────────┘
```

- Os padrões são os valores atuais. "Mover" fica desabilitado sem mudança. Listas de quadro arquivado não aparecem.
- Sucesso: "Card movido para Fazendo, posição 3." Se o status mudou, o anúncio acrescenta "Card concluído." ou "Card reaberto." Se saiu do quadro: toast "Card movido para App mobile." + [Abrir]. Se houve `removedLabelIds`, acrescenta "2 etiquetas foram removidas."

### 7.6 Filtros (C11)

- O botão "Filtros" mostra/esconde a barra (`aria-expanded`). Com filtro ativo: "Filtros (N)" em estilo primário e barra sempre visível.
- **Campos:**
  - busca por título (debounce de 200 ms; `/` foca);
  - **Responsável ▾**: "Eu", "Sem responsável", membros;
  - **Etiqueta ▾**: pílulas + "Sem etiqueta";
  - **Prioridade ▾**: pílulas Urgente, Alta, Média e Baixa + "Sem prioridade";
  - **Prazo ▾**: "Atrasado", "Vencendo (24h)", "Sem prazo".
  - Todos são multiseleção com checkbox.
- Lógica: OR dentro do filtro, AND entre filtros. O rodapé do dropdown explica: "Mostra cards que atendem a pelo menos uma opção."
- **URL** (overview §9): `?responsavel=…&etiqueta=…&prioridade=urgent,high,none&prazo=overdue&q=…`.
- **Indicador:** linha "**Filtro ativo** · 12 de 40 cards · Limpar" (`role="status"`, anunciada ao mudar) + chips removíveis `bg-pill rounded-full` ("Prioridade: Urgente, Alta ✕") + contagem "3 de 5" nos cabeçalhos das listas.
- Sem resultados na lista: "Nenhum card com estes filtros". No quadro todo: EmptyState "Nenhum card encontrado" + [Limpar filtros].
- Mobile: Sheet de tela cheia com [Limpar] [Ver 12 cards].

### 7.7 Etiquetas e itens arquivados

- **Etiquetas… (Sheet):**
  - Cada linha tem `LabelPill`, "7 cards", ✎ e 🗑. O formulário tem nome (1–50), cor (9 amostras) e prévia da pílula.
  - Duplicada: "Já existe uma etiqueta com este nome neste quadro."
  - Excluir: "Excluir a etiqueta "Bug"? Ela será removida de 7 cards deste quadro." [Cancelar] [Excluir etiqueta]
- **Itens arquivados… (Sheet)** com abas "Cards" e "Listas":
  - Linha de card: título, `ListPill` da lista de origem, pílula "Arquivado", [Restaurar] e, para Admin, [Excluir].
  - **Card aberto cuja lista de origem é a lista de conclusão:** a linha mostra a ajuda `text-muted` "Ao restaurar, o card volta para Concluído e é marcado como concluído." Depois de restaurar, o toast diz "Card restaurado em Concluído e marcado como concluído."
  - Demais cards: "Card restaurado no fim de {Fazendo}."
  - Lista de origem arquivada (`listArchived`): [Restaurar] fica desabilitado, com "Restaure a lista Fazendo primeiro." + [Restaurar lista].
  - Listas: "Lista restaurada no fim do quadro."
  - Vazio: "Nenhum card arquivado." / "Nenhuma lista arquivada."

### 7.8 Arquivar e excluir quadro

- **Arquivar:** "Arquivar "Site institucional"? Ele sai da lista de quadros de todos. Você pode restaurar depois." → `/`, com o toast "Quadro arquivado." + [Desfazer].
- **Excluir (Admin):** Dialog danger "Excluir quadro definitivamente" / "Isto apaga o quadro, as listas, os cards, os comentários e o histórico. Não dá para desfazer." / "Para confirmar, digite: **Site institucional**" + campo. [Excluir quadro] fica desabilitado até o nome bater (trim). Erro `CONFIRMATION_MISMATCH`: "O nome digitado não confere."
- **Excluir card (Admin):** "Excluir o card definitivamente? Não dá para desfazer."

### 7.9 Mobile (< 1024px, desenhado em 360px)

```text
┌────────────────────────────────────┐
│ Site institucional   [Filtros] [⋯] │
│ (● A fazer 5) (● Fazendo 2) (● Co… │  abas-pílula roláveis
├────────────────────────────────────┤
│ ▓▓ A fazer        (5)          ⋯ ▓▓│
│ ┃(Bug)                           ⋯ │
│ ┃Corrigir menu do rodapé           │
│ ┃(⇈ Urgente) (▲ Atrasado · 14 set) │
│ ┃☑ 2/5  💬 3              (AS)(RS) │
│ + Adicionar card                   │
├────────────────────────────────────┤
│    ▦ Quadros       ☑ Meus cards    │
└────────────────────────────────────┘
```

- Uma lista por vez (`100vw − 32px`), com `scroll-snap`. As abas (`role="tablist"`) acompanham: a ativa é uma pílula sólida `data-color`, e as outras são neutras com um ponto na cor.
- De 768 a 1023px: colunas lado a lado, com arrastar best effort.

| Estado | Microcopy |
| ---- | ---- |
| Carregando | Skeleton do cabeçalho + 3 colunas × 3 cards. |
| Sem listas | "Este quadro não tem listas" / "Adicione uma lista para começar." / [Adicionar lista] |
| Lista vazia (comum) | Só "+ Adicionar card". |

---

## 8. Detalhe do card (`/b/:boardId/c/:cardId`)

### 8.1 Layout

- **≥ 1024px:** Dialog `rounded-xl shadow-lg`, até 840px, com duas colunas (principal + lateral de 260px `bg-surface-sunken`).
- **640–1023px:** Dialog de uma coluna.
- **< 640px:** tela cheia, com a barra "← Voltar" e ⋯.
- **Fechar** (✕, Esc, Voltar): volta para a tela de origem (`history.back()` quando veio de dentro do app, como Meus cards ou notificação). Em acesso direto, vai para `/b/:boardId`.

```text
┌────────────────────────────────────────────────────────────────────────────────── ✕ ┐
│ Site institucional › (● A fazer)                                                [⋯] │
│ Corrigir menu do rodapé                                                             │  22px 700
│ (⇈ Urgente) (▲ Atrasado · 14 set)                                                   │
├──────────────────────────────────────────────────────┬──────────────────────────────┤
│ Descrição                                  [Editar]  │ [      ✓ Concluir      ]     │
│ O link "Contato" aponta para a página antiga...      │                              │
│                                                      │ Prioridade                   │
│ Checklist: QA                         2/5    [⋯]     │ [(⇈ Urgente)            ▾]   │  PrioritySelect
│ ████████░░░░░░░░░░░░                                 │                              │
│ ☑ Testar no Chrome                                   │ Responsáveis                 │
│ ☐ Testar no Safari                                   │ (AS) Ana Souza            ✕  │
│ + Adicionar item                                     │ + Adicionar                  │
│                                                      │                              │
│ + Adicionar checklist                                │ Prazo                        │
│                                                      │ [14/09/2026] [18:00]     ✕   │
│ [Comentários (3)]  [Histórico]                       │ Horário de Brasília          │
│ ┌──────────────────────────────────────────────────┐ │                              │
│ │ Escreva um comentário…                           │ │ Etiquetas                    │
│ └──────────────────────────────────────────────────┘ │ (Bug) (Front-end)  ✎         │
│ (AS) Ana Souza · há 2 h                              │ ──────────────────────────── │
│ Não achei o link no mobile.                          │ [⇄ Mover para…]              │
│ Editar · Excluir                                     │ [▣ Arquivar]                 │
└──────────────────────────────────────────────────────┴──────────────────────────────┘
```

- Pilha em uma coluna: título → pílulas → **Concluir/Reabrir** → **Prioridade** → Responsáveis → Prazo → Etiquetas → Descrição → Checklists → Comentários/Histórico → Mover para… / Arquivar.
- Foco: vai para o título (h2) ao abrir e fica preso no diálogo. Esc cancela uma edição aberta antes de fechar.
- Menu ⋯: "Copiar link do card", "Mover para…", "Arquivar", "Excluir definitivamente" (Admin).

### 8.2 Título e descrição

- **Título:** textarea inline (1–500, sem quebra de linha). Enter e blur salvam, Esc cancela. Vazio: "O título não pode ficar vazio."
- **Descrição:** "Adicionar descrição…" abre a edição.
  - Textarea Markdown de 16px com barra mínima (negrito, lista, link, código) e abas "Escrever"/"Visualizar".
  - [Salvar] [Cancelar] e Ctrl/Cmd+Enter. Limite de 20.000.
  - Rascunho ao fechar: "Descartar as alterações na descrição?" [Continuar editando] [Descartar]
  - O conteúdo é sanitizado, e os links abrem com `rel="noopener noreferrer"` + sr "(abre em nova aba)".

### 8.3 Concluir / Reabrir

| Estado | Topo |
| ---- | ---- |
| Aberto | Botão **primário** "✓ Concluir". |
| Concluído | Bloco `rounded-lg bg-surface` com barra esquerda de 4px `--status-done-bg`: pílula "✓ Concluído" + "por Ana Souza em 16 set, 14:30" + botão **secundário** "Reabrir". |

- **Concluir:** otimista. Com lista de conclusão, o card vai para o fim dela: o breadcrumb troca a `ListPill`, e o toast diz "Card concluído e movido para Concluído." Sem lista de conclusão: "Card concluído."
- **Reabrir:**
  - Card na lista de conclusão: ele vai para o **topo da primeira lista ativa que não é de conclusão**. O breadcrumb atualiza, o diálogo **continua aberto** e o toast diz "Card reaberto e movido para o topo de A fazer."
  - Sem outra lista ativa: "Card reaberto. Ele continua em Concluído porque o quadro não tem outra lista."
  - Fora da lista de conclusão, ou em quadro sem ela: "Card reaberto." O card fica onde está.
  - Enquanto a resposta não chega, o botão mostra "Reabrindo…". A posição final vem da resposta (sem adivinhar a lista no otimista: só o status muda na hora).
- Erro: rollback e o toast "Não foi possível concluir o card. Tente de novo." / "Não foi possível reabrir o card. Tente de novo."
- Card arquivado (409): os botões ficam ocultos (seção 8.9).

### 8.4 Prioridade

- Campo "Prioridade" com o `PrioritySelect`:
  - sem valor, mostra "Sem prioridade" em `text-muted` + chevron;
  - com valor, mostra a `PriorityPill`.
- O listbox tem "Urgente", "Alta", "Média" e "Baixa" (pílulas, com check na atual), divisória e "Sem prioridade" (limpa, envia `priority: null`).
- Setas navegam, Enter seleciona e Esc fecha. A gravação é imediata e otimista, e a pílula do topo do diálogo e da face atualizam.
- Anúncio: "Prioridade alterada para Alta." / "Prioridade removida."
- Ajuda `text-muted` 12px abaixo do campo (só na primeira vez que o campo abre vazio, sem persistir): "A prioridade não muda a ordem dos cards no quadro."
- Erro: "Não foi possível alterar a prioridade. Tente de novo."
- Também fica acessível no menu ⋯ da face do card (submenu "Prioridade").

### 8.5 Responsáveis

- "+ Adicionar" abre um popover com a busca "Buscar pessoa" e os **membros ativos**. "Eu" vem primeiro. A gravação é imediata.
- ✕ por pessoa (`aria-label="Remover Ana Souza"`). Desativado: "(desativado)", fora do popover.
- Vazio: "Ninguém ainda" + "Atribuir a mim". Busca sem resultado: "Ninguém encontrado com esse nome."
- 409 `USER_NOT_ACTIVE`: "Essa pessoa foi desativada e não pode ser atribuída."

### 8.6 Prazo

- "+ Definir prazo" → `type="date"` + "Incluir horário" (`type="time"`) + ✕ "Remover prazo". Abaixo: "Horário de Brasília" (nome amigável do fuso do workspace).
- A pílula de prazo atualiza na hora. Prazo no passado é permitido.

### 8.7 Etiquetas

- Pílulas em linha. O ✎ abre um popover com as etiquetas do quadro (checkbox + pílula), a busca e "+ Criar etiqueta".
- Sem etiquetas: "Este quadro ainda não tem etiquetas." + [Criar etiqueta].

### 8.8 Checklists

- "+ Adicionar checklist" (padrão "Checklist"). O cabeçalho tem título editável, `x/y`, `ProgressBar` e ⋯ ("Renomear", "Ocultar itens marcados", "Excluir checklist").
- Item: checkbox + texto (clique edita). O ⋯ do item tem "Mover para cima", "Mover para baixo" e "Excluir". Marcado: `text-muted`, sem riscado.
- "+ Adicionar item" continua aberto depois do Enter.
- Excluir: "Excluir a checklist "QA" e os 5 itens?"
- Marcar itens não conclui o card nem gera histórico.

### 8.9 Comentários, histórico e card arquivado

**Comentários (aba padrão):**
- Caixa no topo ("Escreva um comentário…", Ctrl/Cmd+Enter). Lista em ordem cronológica crescente.
- Item: avatar, nome 600, data relativa (`<time>` com `title`), "(editado)" e corpo em 16px.
- O autor edita e exclui. O Admin só exclui (403 ao editar de outro).
- Excluir: inline "Excluir este comentário? [Excluir] [Cancelar]".
- Anonimizado: "Usuário removido". Vazio: "Nenhum comentário ainda."
- Erro: o texto fica no campo, com "Não foi possível enviar o comentário. Tente de novo."

**Histórico** (`GET /cards/:id/activity`, o mais recente primeiro, só leitura; nomes de lista e prioridades aparecem como pílulas pequenas):

| `type` | Frase |
| ---- | ---- |
| `card_created` | "**Ana Souza** criou o card em (A fazer)" |
| `card_title_changed` | "**Ana Souza** mudou o título de "Menu" para "Corrigir menu do rodapé"" |
| `card_moved` | "**Ana Souza** moveu de (A fazer) para (Fazendo)" / "moveu para o quadro App mobile (A fazer)" |
| `card_assignee_added` / `_removed` | "**Raphael Sparda** atribuiu Ana Souza" / "removeu Ana Souza" / "atribuiu a si mesmo" |
| `card_due_changed` | "**Ana Souza** definiu o prazo para 14 set, 18:00" / "alterou o prazo de 14 set para 20 set" / "removeu o prazo" |
| `card_priority_changed` | "**Ana Souza** definiu a prioridade como (⇈ Urgente)" (from `null`) / "alterou a prioridade de (= Média) para (⇈ Urgente)" / "removeu a prioridade (⌄ Baixa)" (to `null`) |
| `card_completed` | "**Ana Souza** concluiu o card" |
| `card_reopened` | "**Ana Souza** reabriu o card" |
| `card_archived` / `card_restored` | "**Ana Souza** arquivou o card" / "restaurou o card" |

A reabertura pelo botão gera `card_reopened` + `card_moved`, que aparecem como duas linhas consecutivas. A conclusão em massa ao marcar lista gera um `card_completed` por card, com o ator de quem marcou.

**Card arquivado:** faixa com pílula "Arquivado" + "Este card está arquivado." + [Restaurar] (+ [Excluir definitivamente] para Admin). Tudo fica em somente leitura, sem Concluir/Reabrir, com "Restaure o card para comentar." Se a lista de origem é a de conclusão e o card está aberto, a faixa acrescenta: "Ao restaurar, ele volta para Concluído e é marcado como concluído."

---

## 9. Meus cards (`/meus-cards`)

```text
Meus cards
Cards abertos atribuídos a você, em todos os quadros, por prazo e prioridade.

(▲ Atrasados  2)
┌───────────────────────────────────────────────────────────────────────────────────┐
│▌ Corrigir menu do rodapé               (⇈ Urgente) (▲ Atrasado · 14 set)   [✓]    │  ▌ = barra de 4px na cor da lista
│▌ Site institucional › (● A fazer)   (Bug)   ☑ 2/5   💬 3                          │
├───────────────────────────────────────────────────────────────────────────────────┤
│▌ Revisar textos da home                (= Média) (▲ Atrasado · 14 set)     [✓]    │  mesmo prazo: Urgente antes de Média
└───────────────────────────────────────────────────────────────────────────────────┘
(⏱ Vencendo  1)
(📅 Com prazo  4)
(Sem prazo  6)                                            ← aqui a ordem é só por prioridade
```

- Os grupos (Atrasados, Vencendo, Com prazo, Sem prazo) são montados no front com `getDueState`, **preservando a ordem do servidor**: prazo ascendente, depois prioridade (Urgente → Alta → Média → Baixa → sem prioridade), depois criação. Grupos vazios não aparecem.
- Cabeçalho de grupo: `<h2>` em forma de pílula (Atrasados = `data-status="overdue"`, Vencendo = `due-soon`, os demais neutros), com ícone, texto e contagem.
- Bloco do grupo: `bg-surface rounded-lg shadow-sm border border-border`, com divisórias.
- **Linha** `<a href="/b/:boardId/c/:cardId">` (abre o diálogo sobre o quadro; fechar volta para Meus cards):
  - barra de 4px na cor da lista (`listColor`);
  - 1ª linha: título 14px 600 + `PriorityPill` + `DuePill`;
  - 2ª linha: quadro › `ListPill`, etiquetas, checklist, comentários.
  - O sr lê "Prioridade urgente" dentro do rótulo do link.
- **Concluir rápido:** `IconButton` ✓ (`aria-label="Concluir {título}"`). A linha sai com o toast "Card concluído." + [Desfazer] (chama `reopen`; com lista de conclusão, o card vai para o topo da primeira lista, e o toast de desfazer explica "Card reaberto e movido para o topo de A fazer.").
- Polling de 60 s e ao focar a aba.
- Mobile: as pílulas descem para a 2ª linha, e o ✓ fica com 40px.

| Estado | Microcopy |
| ---- | ---- |
| Carregando | 2 pílulas de grupo + 5 linhas skeleton. |
| Vazio | Ícone ✓ em círculo `data-color="green"`: "Nada com você agora" / "Quando alguém atribuir um card a você, ele aparece aqui." / [Ver quadros] |
| Erro | Padrão global. |

---

## 10. Notificações

- **Desktop:** popover no sino (380px, até 70vh, `rounded-xl shadow-md`). **Mobile:** Sheet de tela cheia.
- Item `<a>` para `/b/:boardId/c/:cardId`. O clique marca como lida (`POST …/read`) e abre o card.
  - `card_assigned`: "**{Autor}** atribuiu você a {título}" + "{quadro} · há 5 min".
  - `card_commented`: "**{Autor}** comentou em {título}" + "{quadro} · ontem".
- **Não lida:** fundo `bg-hover`, ponto de 8px `bg-accent`, nome em 700 e pílula "Nova" (`bg-accent text-on-accent`), mais sr "não lida".
- Cabeçalho do painel: "Notificações" + "Marcar todas como lidas" (ghost, desabilitado sem não lidas).
- Paginação: "Carregar mais" (`before`/`nextBefore`).
- Contador: polling. `aria-live` anuncia só quando aumenta ("1 nova notificação").
- Card excluído: o clique leva ao 404 do card.

| Estado | Microcopy |
| ---- | ---- |
| Carregando | 4 itens skeleton. |
| Vazio | "Nenhuma notificação por aqui." / "Você será avisado quando alguém atribuir um card a você ou comentar em um card seu." |
| Erro | "Não foi possível carregar as notificações." + [Tentar de novo] |

---

## 11. Administração (`/admin/*`, só Admin)

Título "Administração" e abas-link **Membros** (`/admin/membros`), **Convites** (`/admin/convites`) e **Equipe** (`/admin/workspace`).

### 11.1 Membros

```text
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Nome                         E-mail               Papel         Status          ⋯ │
│ (RS) Raphael Sparda (você)   raphael@…            Admin         (● Ativo)         │
│ (AS) Ana Souza               ana@…                [Membro ▾]    (● Ativo)       ⋯ │
│ (JP) João Pedro              joao@…               Membro        (Desativado)    ⋯ │
│ (?)  Usuário removido        —                    Membro        (Anonimizado)     │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- Tabela em `bg-surface rounded-lg shadow-sm`. **Mobile:** um cartão por membro.
- **Status:** "Ativo" (pílula verde), "Desativado" (`gray`), "Anonimizado" (neutra).
- **Papel:**
  - `select` inline. Rebaixar confirma: "Tornar Ana Souza Membro? Ela deixa de acessar a administração." Toast: "Papel de Ana Souza alterado para Membro."
  - A **própria linha** não tem select nem menu (`CANNOT_TARGET_SELF`). Mostra o texto "Você".
  - `LAST_ADMIN`: o select e o "Desativar" ficam desabilitados, com "É o último Admin ativo."
- **Menu ⋯:**
  - "Gerar link de redefinição de senha" (só ativos; em desativados: desabilitado, com "Reative a conta antes de gerar o link.")
  - "Desativar" / "Reativar"
  - "Anonimizar…" (só desativados, `text-danger`)
  - Anonimizados não têm menu.
- **Link de redefinição** → Dialog:
  - Título "Link de redefinição para Ana Souza". Texto: "Copie e envie por um canal privado. O link vale por 24 horas e funciona uma vez só."
  - Input readonly mono 13px + [⧉ Copiar link] ("✓ Copiado" por 2 s).
  - Aviso `text-warning`: "Este link não aparece de novo. Gerar outro cancela este."
  - Falha ao copiar: "Não foi possível copiar. Selecione o link e copie manualmente."
- **Desativar** (danger): "Desativar Ana Souza? Ela sai de todos os dispositivos e não consegue mais entrar. Links de redefinição pendentes são cancelados. Os cards e comentários dela continuam." Toast: "Ana Souza foi desativada."
- **Reativar:** sem Dialog. Toast: "Ana Souza foi reativada. Gere um link de redefinição se ela não lembrar a senha."
- **Anonimizar** (danger, digitar `ANONIMIZAR`): "O nome vira "Usuário removido" e o e-mail é apagado. Os cards e comentários continuam. Não dá para desfazer."

### 11.2 Convites

- [+ Novo convite] + tabela de **Pendentes** (e-mail ou "Sem e-mail", pílula de papel, criado por, expira em, [Revogar]). A expiração em até 24h aparece em pílula `due-soon`.
- **Histórico (30 dias):** "Usado" (verde) + "por Carla Lima", "Expirado" (gray), "Revogado" (gray).
- **Novo convite (Dialog):**
  - "E-mail (opcional)", com a ajuda "Se preencher, só este e-mail poderá usar o convite."
  - Papel: radiogroup "Membro" (padrão) / "Admin", com a ajuda "Admins acessam a administração: convites, papéis e contas."
  - Em seguida vem o Dialog de link: "Envie este link para a pessoa. Ele vale por 7 dias e funciona uma vez só." + "Este link não aparece de novo."
- `EMAIL_TAKEN`: "Já existe uma conta com este e-mail."
- **Revogar:** inline "Revogar este convite? O link deixa de funcionar." Toast: "Convite revogado."
- Vazio: "Nenhum convite pendente." Só você na equipe: "Você está sozinho por aqui. Convide alguém para começar."

### 11.3 Equipe (`/admin/workspace`)

```text
Nome da equipe
[ Drexys                              ]
Fuso horário
[ America/Sao_Paulo (Horário de Brasília)  ▾]   ← combobox com busca
Prazos e o agrupamento de Meus cards usam este fuso.
                                        [Salvar]
```

- "Salvar" fica desabilitado sem mudança. Toast: "Dados da equipe atualizados."
- Fuso inválido: "Escolha um fuso horário da lista."

---

## 12. Perfil (`/perfil`)

- Seção **Dados:** avatar de 64px, "Nome" (1–80) + [Salvar nome], e-mail e papel em texto. Toast: "Nome atualizado." Vazio: "Informe seu nome."
- Seção **Senha:** "Senha atual", "Nova senha" (10–256) + [Alterar senha].
  - `PASSWORD_INCORRECT`: "A senha atual está incorreta."
  - Sucesso (a sessão atual continua): "Senha alterada. Você saiu dos outros dispositivos."
- [Sair] (secundário). O tema não é duplicado aqui.

---

## 13. Acessibilidade: checklist

**Teclado e foco**
- [ ] A ordem de Tab segue a visual (cabeçalho → filtros → listas → cards → adicionar).
- [ ] O anel de foco é visível em tudo. Sobre fundo colorido (cabeçalho de lista, pílula clicável, aba de lista), usa `--c-fg`.
- [ ] Dialog, Sheet, popover e listbox: foco preso, Esc e retorno do foco.
- [ ] Alternativas a arrastar: "Mover para…", "Mover lista para a esquerda/direita", "Mover para cima/baixo" (checklist). (2.5.7)
- [ ] Atalhos de uma tecla (`/`, `M`) só funcionam com o foco no quadro ou no card e fora de campos. A lista fica em "Atalhos do teclado" no menu do avatar. (2.1.4)

**Leitores de tela**
- [ ] `aria-label` composto na face do card, com prioridade e prazo em texto.
- [ ] `aria-live="polite"` para: card criado, movido, concluído, reaberto (com a lista de destino), prioridade alterada, lista marcada como de conclusão (com contagem), filtro ativo, "Copiado" e nova notificação.
- [ ] O nome da cor não é anunciado em lista nem etiqueta (é decorativo). Nos seletores de cor, é anunciado ("Azul").

**Cor e contraste**
- [ ] Só os pares das tabelas do design system. Texto sobre cor viva sempre usa `-fg`.
- [ ] Prioridade, prazo, conclusão, lista de conclusão, status de membro, não lida e filtro ativo têm texto e/ou ícone além da cor (RN17).
- [ ] axe sem violações sérias nos dois temas, incluindo `/dev/paleta`, com zoom de 200% e 360px.

**Alvos e formulários**
- [ ] Alvos ≥ 24px (40px no mobile). Amostras de 28px.
- [ ] Labels visíveis, `autocomplete`, `aria-invalid` e `aria-describedby`, e foco no primeiro erro.
- [ ] Toasts pausam no hover e no foco. `prefers-reduced-motion` é respeitado.

## 14. Tom da microcopy

- Direta, em "você", sem exclamação e sem jargão.
- Erro = o que aconteceu + o que fazer.
- Botões com verbo + objeto. Confirmações dizem a consequência, **quantos itens** são afetados e se dá para desfazer.
- Mudança de status automática (concluir ao mover, reabrir ao tirar, concluir ao marcar lista ou ao restaurar) é **sempre anunciada**. Ninguém deve ser surpreendido por um card que mudou de estado sozinho.
