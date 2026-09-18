# Design system: Ronin (marca da logo + paleta colorida estilo Monday)

> Autor: Raphael Sparda. Status: **v4 (2026-09-16)**.
> v4: pedido do cliente — tokens de tema derivados da logo (`Ronin Logo.png`): destaque **vermelho-sangue `#E0000E`** nos dois temas; tema escuro com o **preto** da logo; neutros sem tom azulado. Paleta de listas/etiquetas, prioridades e estados (1.2–1.4) inalterada.
> Alinhado a `docs/product/scope.md` v2, `docs/architecture/overview.md` v1.2 (§9) e `docs/architecture/api.md` v1.2, que são a fonte da verdade para chaves, nomes de token e rotas.
> Implementação: React + TypeScript + Vite + **Tailwind 4**. Tokens em `src/styles/globals.css`.

## 0. Princípios

1. **Colorido, mas legível.** Cores vivas aparecem em **superfícies sólidas**: cabeçalho de lista, pílulas de etiqueta, prioridade e estado, e marcas. Texto corrido fica sobre neutro.
2. **Toda cor viva tem cor de texto definida** (`-fg`), branca ou escura, escolhida por contraste (seção 1.3).
3. **Cor só via token.** Nada de hex, `rgb()` ou paleta padrão do Tailwind nos componentes. A paleta padrão fica desligada.
4. **Trocar paleta ou tema = editar só `globals.css`.** Os nomes são semânticos (`--color-accent`) ou chaves fixas (`--palette-red-bg`, `--priority-urgent-bg`).
5. **Formas suaves:** cantos arredondados moderados e sombras sutis. Sem degradê nem glass.
6. **Nenhuma informação só por cor** (RN17). Lista, prioridade, prazo e estado sempre têm texto e/ou ícone.
7. **Sem fontes ou ícones de CDN** (LGPD). Tudo vai empacotado.
8. **Sem gamificação.**

## 1. Cores

### 1.1 Semânticos (`--color-*`, geram utilitários do Tailwind)

O tema claro é o **padrão** (S5). O escuro sobrescreve os mesmos nomes em `:root[data-theme="dark"]`.

| Token | Utilitário | Uso | Claro | Escuro |
| ---- | ---- | ---- | ---- | ---- |
| `--color-bg` | `bg-bg` | Fundo do app e da área do quadro | `#F7F7F7` | `#000000` |
| `--color-surface` | `bg-surface` | Cabeçalho, cards, modal, menus, tiles | `#FFFFFF` | `#141414` |
| `--color-surface-sunken` | `bg-surface-sunken` | Corpo da coluna, trilhos, lateral do detalhe | `#EEEEEE` | `#0A0A0A` |
| `--color-hover` | `bg-hover` | Hover de menu, linha e botão ghost; notificação não lida | `#E8E8E8` | `#222222` |
| `--color-border` | `border-border` | Borda decorativa, divisórias | `#D6D6D6` | `#2B2B2B` |
| `--color-border-strong` | `border-border-strong` | Borda de controle (input, checkbox, botão secundário) | `#7A7A7A` | `#707070` |
| `--color-text` | `text-text` | Texto principal | `#111111` | `#F2F2F2` |
| `--color-muted` | `text-muted` | Texto secundário, placeholder | `#5C5C5C` | `#A8A8A8` |
| `--color-accent` | `bg-accent` | Botão primário, checkbox marcado, aba ativa, switch ligado | `#E0000E` | `#E0000E` |
| `--color-accent-hover` | `bg-accent-hover` | Hover do primário | `#B8000C` | `#B8000C` |
| `--color-on-accent` | `text-on-accent` | Texto sobre accent | `#FFFFFF` | `#FFFFFF` |
| `--color-accent-text` | `text-accent-text` | Links e texto de destaque | `#C4000C` | `#FF4D55` |
| `--color-focus` | `outline-focus` | Anel de foco | `#E0000E` | `#FF4D55` |
| `--color-danger` | `text-danger` | Texto de erro, item destrutivo em menu | `#B42840` | `#FF8FA3` |
| `--color-warning` | `text-warning` | Texto de aviso | `#8A5100` | `#FDAB3D` |
| `--color-success` | `text-success` | Texto de sucesso | `#026B40` | `#00C875` |
| `--color-danger-solid` | `bg-danger-solid` | Botão destrutivo | `#C9304A` | `#C9304A` |
| `--color-danger-solid-hover` | `bg-danger-solid-hover` | Hover destrutivo | `#B42840` | `#B42840` |
| `--color-on-danger-solid` | `text-on-danger-solid` | Texto do botão destrutivo | `#FFFFFF` | `#FFFFFF` |
| `--color-pill` | `bg-pill` | Pílula neutra (prazo normal, contadores, chips de filtro) | `#E6E6E6` | `#2A2A2A` |
| `--color-on-pill` | `text-on-pill` | Texto da pílula neutra | `#111111` | `#F2F2F2` |
| `--color-overlay` | `bg-overlay` | Fundo atrás de modal (sem blur) | `rgb(0 0 0 / 0.45)` | `rgb(0 0 0 / 0.7)` |

Contraste da marca (WCAG, calculado): claro — botão branco/`#E0000E` 5,03:1, hover 6,90:1, link `#C4000C`/bg 5,85:1, foco/bg 4,69:1; escuro — botão 5,03:1, link `#FF4D55` sobre bg 6,44:1 / surface 5,65:1 / hover 4,88:1, borda forte/surface 3,72:1. O vermelho de "Atrasado" e "Urgente" (`#C9304A`) é próximo do destaque: por isso esses estados sempre levam ícone e texto (RN17).

### 1.2 Paleta de listas e etiquetas (`--palette-<cor>-bg|fg|border`)

As chaves e a ordem do ciclo vêm do enum `palette_color` (ADR 0012): `gray`, `red`, `orange`, `yellow`, `green`, `cyan`, `blue`, `purple`, `magenta`. A lista nova recebe a próxima cor depois da última lista ativa (`nextPaletteColor`).

**Os valores são os mesmos nos dois temas** (decisão de design): cores sólidas com texto próprio funcionam sobre claro e escuro, e a cor de uma lista não "muda" quando a pessoa troca o tema. O `-border` serve para contorno de amostra, pílula em hover e contorno de alvo de drop.

| Chave | Nome na UI | `-bg` | `-fg` | Contraste | `-border` |
| ---- | ---- | ---- | ---- | ---- | ---- |
| `gray` | Cinza | `#676879` | `#FFFFFF` | 5,4:1 | `#55566A` |
| `red` | Vermelho | `#C9304A` | `#FFFFFF` | 5,2:1 | `#A82740` |
| `orange` | Laranja | `#FDAB3D` | `#1A1B22` | 9,0:1 | `#E0912A` |
| `yellow` | Amarelo | `#FFCB00` | `#1A1B22` | 11,2:1 | `#E0B000` |
| `green` | Verde | `#00C875` | `#1A1B22` | 7,7:1 | `#00A862` |
| `cyan` | Ciano | `#66CCFF` | `#1A1B22` | 9,5:1 | `#3FB5F0` |
| `blue` | Azul | `#579BFC` | `#1A1B22` | 6,1:1 | `#3A85F0` |
| `purple` | Roxo | `#784BD1` | `#FFFFFF` | 5,6:1 | `#6238B8` |
| `magenta` | Magenta | `#D1177A` | `#FFFFFF` | 5,1:1 | `#B01266` |

**Listas padrão de quadro novo:** "A fazer" = `blue`, "Fazendo" = `orange`, "Concluído" = `green`. Pelo ciclo, a próxima lista criada recebe `cyan`, depois `blue`, `purple`, `magenta`, `gray`…

**Ajustes em relação aos tons originais do Monday:** o vermelho `#E2445C` e o roxo `#A25DDC` ficam na "zona morta", onde nem branco (≈ 4,0:1) nem escuro (≈ 4,2:1) chegam a 4,5:1. Por isso viraram `#C9304A` e `#784BD1`. O rosa `#FF158A` só passaria com texto escuro a 4,6:1, então virou `#D1177A` com texto branco.

**Regra para cor nova:** calcule a luminância relativa L do fundo. Com `L ≤ 0,183`, use `-fg` branco. Com `L ≥ 0,226`, use `#1A1B22`. Entre os dois, ajuste o tom.

### 1.3 Prioridade (`--priority-<nivel>-bg|fg`)

Os valores são próprios (não referenciam a paleta). Assim, trocar a cor de lista não muda a prioridade.

| Nível (`card_priority`) | Rótulo | Ícone (lucide) | `-bg` | `-fg` | Contraste |
| ---- | ---- | ---- | ---- | ---- | ---- |
| `urgent` | Urgente | `ChevronsUp` | `#C9304A` (vermelho) | `#FFFFFF` | 5,2:1 |
| `high` | Alta | `ChevronUp` | `#784BD1` (roxo) | `#FFFFFF` | 5,6:1 |
| `medium` | Média | `Equal` | `#579BFC` (azul) | `#1A1B22` | 6,1:1 |
| `low` | Baixa | `ChevronDown` | `#66CCFF` (ciano) | `#1A1B22` | 9,5:1 |
| `null` | (nada na face) / "Sem prioridade" no seletor e no filtro | — | — | — | — |

**Por que não laranja e amarelo para Alta e Média:** laranja já significa "Vencendo" e vermelho, "Atrasado", nas pílulas de prazo que ficam **ao lado** da prioridade na face do card. A escala vermelho → roxo → azul → ciano (quente → frio) lê como "mais urgente → menos urgente" e só coincide no Urgente, que é semanticamente próximo de "Atrasado". Mesmo assim, as duas pílulas se distinguem pelo ícone (setas × alerta/relógio) e pelo texto.

### 1.4 Estados de prazo e de card (`--status-<estado>-bg|fg`)

| Token | Estado (`getDueState`) | Ícone | `-bg` | `-fg` |
| ---- | ---- | ---- | ---- | ---- |
| `--status-scheduled-*` | `scheduled` (prazo normal) | `Calendar` | `var(--color-pill)` | `var(--color-on-pill)` |
| `--status-due-soon-*` | `due_soon` (≤ 24h) | `Clock` | `#FDAB3D` | `#1A1B22` (9,0:1) |
| `--status-overdue-*` | `overdue` | `AlertTriangle` | `#C9304A` | `#FFFFFF` (5,2:1) |
| `--status-done-*` | `completed` | `Check` | `#00C875` | `#1A1B22` (7,7:1) |
| `--status-archived-*` | arquivado | `Archive` | `#676879` | `#FFFFFF` (5,4:1) |

O badge de não lidas no sino usa `--status-overdue-*`.

### 1.5 Contraste verificado (WCAG 2.2 AA)

Razões pela fórmula de luminância relativa do WCAG, **arredondadas para baixo**. Mínimos: texto 4,5:1; UI e foco 3:1. Paleta, prioridade e estado: tabelas acima (o par não depende do tema).

**Claro**

| Frente | Fundo | Razão |
| ---- | ---- | ---- |
| text #323338 | surface / bg / sunken / hover | 12,6 / 11,7 / 10,8 / 10,3 |
| muted #5E5F70 | surface / bg / sunken / hover | 6,2 / 5,8 / 5,4 / 5,1 |
| accent-text #0060D6 | surface / bg / sunken / hover | 5,7 / 5,3 / 4,9 / 4,7 |
| on-accent #FFF | accent #0060D6 / hover #0050B3 | 5,7 / 7,5 |
| danger #B42840 | surface / sunken / hover | 6,3 / 5,4 / 5,2 |
| success #026B40 | surface / sunken / hover | 6,6 / 5,6 / 5,4 |
| warning #8A5100 | surface / sunken / hover | 6,4 / 5,5 / 5,3 |
| on-pill #323338 | pill #E1E4EC | 9,9 |
| on-danger-solid #FFF | #C9304A / #B42840 | 5,2 / 6,3 |
| border-strong #7C7F93 | surface / bg / sunken | 3,9 / 3,6 / 3,4 |
| focus #0060D6 | surface / bg | 5,7 / 5,3 |

**Escuro**

| Frente | Fundo | Razão |
| ---- | ---- | ---- |
| text #EDEEF5 | bg / sunken / surface / hover | 14,5 / 13,3 / 11,3 / 9,2 |
| muted #A6A9C0 | bg / sunken / surface / hover | 7,2 / 6,6 / 5,6 / 4,6 |
| accent-text #7FB2FF | bg / sunken / surface / hover | 7,8 / 7,1 / 6,0 / 4,9 |
| on-accent #FFF | accent #0060D6 | 5,7 |
| danger #FF8FA3 | surface / hover | 6,0 / 4,9 |
| success #00C875 | surface / hover | 5,9 / 4,8 |
| warning #FDAB3D | surface / hover | 6,8 / 5,6 |
| on-pill #EDEEF5 | pill #464C72 | 7,1 |
| border-strong #7D82A6 | surface / sunken / bg | 3,4 / 4,1 / 4,5 |
| focus #7FB2FF | surface / bg | 6,0 / 7,8 |

**Combinações proibidas:**
- Cor da paleta, prioridade ou estado como **cor de texto** sobre neutro. Use a pílula sólida com o `-fg` correspondente.
- `-fg` de uma chave sobre o `-bg` de outra.
- `--color-accent` como texto no escuro (use `--color-accent-text`).
- `--color-border` como única borda de input (use `border-strong`).
- Anel `--color-focus` sobre fundo colorido: nesses casos, o anel usa o `-fg` da cor (seção 5).

## 2. Tipografia

- `--font-sans`: `"Figtree Variable", "Figtree", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`.
- Figtree empacotada via `@fontsource-variable/figtree` (subset latin), importada em `main.tsx`. Sem Google Fonts. A alternativa equivalente é `@fontsource-variable/inter`.
- `--font-mono` (`ui-monospace…`) só em `código` na descrição e nos comentários e nos links de convite e de redefinição.

| Utilitário | Tamanho / linha | Peso | Uso |
| ---- | ---- | ---- | ---- |
| `text-xs` | 12 / 16 | 500–600 | Metadados, pílulas |
| `text-sm` | 14 / 20 | 400 | **Padrão da UI** |
| `text-md` | 16 / 24 | 400 | Descrição, comentários, inputs no mobile |
| `text-lg` | 18 / 26 | 600 | Nome do quadro, títulos de seção |
| `text-xl` | 22 / 30 | 700 | h1 de página, título do card no detalhe |
| `text-2xl` | 28 / 36 | 700 | Setup e login |

## 3. Espaçamento, tamanhos e camadas

- Espaçamento: escala padrão do Tailwind (4px). Densidade moderada: padding de card 12px, gap entre cards 8px, entre listas 16px, página 24px (16px no mobile).
- Tamanhos: cabeçalho de 56px, navegação inferior de 56px (< 768px), lista de 288px, detalhe do card de até 840px, painel de notificações de 380px, controles de 36px (40px no mobile), botão pequeno de 28px (alvo mínimo ≥ 24px).
- Camadas: header 30, dropdown 40, modal 50, toast 60.
- Breakpoints: `sm` 640 (abaixo dele o detalhe do card vira tela cheia), `md` 768 (a navegação sobe para o cabeçalho), `lg` 1024 (arrastar garantido e detalhe em duas colunas), `xl` 1280. Teste a partir de **360px**.
- Movimento: 150ms, `cubic-bezier(0.2, 0, 0, 1)`. `prefers-reduced-motion` zera transições e a rotação do card arrastado.

## 4. Raios e sombras

| Utilitário | Valor | Onde |
| ---- | ---- | ---- |
| `rounded-sm` | 4px | Checkbox, tooltip |
| `rounded-md` | 6px | Botões, inputs, itens de menu |
| `rounded-lg` | 8px | Cards, colunas, popovers, toasts |
| `rounded-xl` | 12px | Modal, tiles de quadro, seções |
| `rounded-full` | — | **Pílulas**, avatares, amostras de cor, switch |

| Utilitário | Claro | Escuro | Onde |
| ---- | ---- | ---- | ---- |
| `shadow-sm` | `0 1px 2px rgb(24 27 52 / 0.08)` | `0 1px 2px rgb(0 0 0 / 0.40)` | Card, tile, cabeçalho |
| `shadow-md` | `0 4px 12px rgb(24 27 52 / 0.12)` | `0 4px 12px rgb(0 0 0 / 0.45)` | Card em hover, menus, popovers, toasts |
| `shadow-lg` | `0 12px 32px rgb(24 27 52 / 0.18)` | `0 12px 32px rgb(0 0 0 / 0.55)` | Modal, card arrastado |

A sombra nunca é o único separador. Cards e popovers têm também borda `border-border`.

## 5. Estados de interação

| Estado | Regra |
| ---- | ---- |
| **Hover** | Primário: `accent-hover`. Ghost, menu e linha: `bg-hover`. Card: `shadow-md` + `border-border-strong`. Pílula clicável: borda 1px `var(--c-border)`. |
| **Focus** | `outline: 2px solid var(--color-focus); outline-offset: 2px`. **Sobre fundo colorido** (elemento com `data-color`, `data-priority` ou `data-status`): o anel usa `var(--c-fg)`, que sempre tem ≥ 4,5:1 com o fundo. Em áreas com rolagem, use `outline-offset: -2px` (`.focus-inset`). |
| **Active** | Mesmo tom do hover, sem deslocamento. |
| **Selecionado** | Aba ou navegação: `text-text` 600 + barra de 3px `bg-accent rounded-full` + `aria-current`/`aria-selected`. Opção de seletor: ícone de check + `aria-selected`. |
| **Disabled** | `bg-surface-sunken`, `text-muted`, `border-border`, `cursor-not-allowed`, sem opacidade. Motivo em texto quando é uma regra ("É o último Admin ativo."). |
| **Loading** | Spinner de 16px + gerúndio ("Salvando…"), mantendo a largura, com `aria-busy`. Skeleton: blocos `bg-surface-sunken` arredondados com pulsação de opacidade (sem shimmer). |
| **Erro de campo** | Borda 2px `--color-danger`, ícone e mensagem abaixo, `aria-invalid` + `aria-describedby`. |
| **Arrastando** | Origem: espaço `bg-surface-sunken` com borda tracejada `border-strong`. Card flutuante: `shadow-lg` + `rotate(2deg)` (sem rotação com reduced-motion). Coluna de destino: contorno de 2px `var(--palette-<cor>-border)`. |

## 6. Componentes base (`src/components/ui/`)

| Componente | Especificação | Acessibilidade |
| ---- | ---- | ---- |
| `Button` | `primary` (`bg-accent text-on-accent`), `secondary` (`bg-surface border border-border-strong text-text`), `ghost`, `danger` (`bg-danger-solid text-on-danger-solid`). `rounded-md`, 36/28px, 14px 500. | `<button>`. Um primário por área. |
| `IconButton` | 32px (40px no mobile), ghost, `rounded-md`. | `aria-label` + tooltip. |
| `Input` / `Textarea` / `Select` | `bg-surface border border-border-strong rounded-md`, label acima em 14px 500. | O placeholder não é label. |
| `Checkbox` | 16px `rounded-sm`, marcado em `accent`. | Nativo estilizado, alvo de 24px com o label. |
| `ThemeSwitch` | Trilho de 40×22 `rounded-full`, borda `border-strong`. Thumb de 16px `rounded-full`. Ligado (escuro): trilho `bg-accent`, thumb branco. Ícones de sol e lua de 14px ao lado (a lua fica escondida em < 400px). | `role="switch"`, `aria-checked`, `aria-label="Tema escuro"`. |
| `Pill` | `rounded-full`, altura 22px, padding 0 10px, 12px 600, ícone opcional de 12px. Recebe `data-color` / `data-priority` / `data-status` e usa `bg-(--c-bg) text-(--c-fg)`. Variante `neutral` (`bg-pill text-on-pill`). | O texto sempre existe. |
| `ListPill` | `Pill` com `data-color` da lista + nome. Usada no breadcrumb, em Meus cards, no histórico e em "Mover para…". | — |
| `LabelPill` | `Pill` com `data-color` da etiqueta. Na face, corta com "…" depois de 18 caracteres. | O nome completo vai no `title`. |
| `PriorityPill` | `Pill` com `data-priority`: ícone + rótulo ("Urgente"). Não renderiza nada com `null`. | Na face, o sr lê "Prioridade urgente". |
| `DuePill` | `Pill` com `data-status` (scheduled, due-soon, overdue, done): ícone + texto (seção 7.3 de `screens.md`). | O texto contém o estado. |
| `PrioritySelect` | Botão que mostra a `PriorityPill` atual ou "Sem prioridade" (`text-muted`) + chevron. Abre um listbox com Urgente, Alta, Média, Baixa (pílulas), divisória e "Sem prioridade". | `aria-haspopup="listbox"`. Setas, Enter, Esc. Rótulo "Prioridade". |
| `ColorSwatchPicker` | Grade de 9 círculos de 28px `rounded-full` com `var(--palette-<cor>-bg)` e borda `-border`. Selecionado: anel de 2px `text` com offset de 2px + check em `-fg`. | `role="radiogroup"`, `aria-label` por cor ("Azul"), setas. |
| `Avatar` | `rounded-full`, 24/32px. Com foto: `<img>` de `/api/users/:id/avatar?v=<avatarUpdatedAt>` com `object-cover` (imagem que não carrega cai nas iniciais). Sem foto: iniciais 600 com `data-color` derivado do id do usuário (hash módulo 9). Desativado: `gray` + borda tracejada. Anonimizado: "?". | Decorativo (`alt=""`/`aria-hidden`): o nome acessível vem de quem contém o avatar. |
| `Menu` / `Popover` | `bg-surface border border-border rounded-lg shadow-md`, itens de 32px `rounded-md`. Destrutivo em `text-danger`. | Padrão ARIA menu button. |
| `Dialog` / `Sheet` | `bg-surface rounded-xl shadow-lg` sobre `bg-overlay`. Tela cheia sem raio abaixo de 640px. | Foco preso, Esc, retorno do foco. |
| `Tabs` | Inativa `text-muted`. Ativa `text-text` 600 com barra de 3px `bg-accent`. | Padrão ARIA tabs. |
| `Toast` | `bg-surface rounded-lg shadow-md`, barra esquerda de 4px (`--status-done-bg`, `--status-overdue-bg` ou `--color-accent`) + ícone, ação opcional ("Desfazer"). Some em 5s (erro fica até fechar). Máximo de 3. | `role="status"` ou `role="alert"`. Pausa com hover e foco. |
| `ProgressBar` | Trilho de 6px `bg-surface-sunken rounded-full`, preenchimento `--status-done-bg`, com `x/y` em texto ao lado. | `role="progressbar"`. |
| `EmptyState` | Ícone de 32px em círculo `bg-surface-sunken`, título 16px 600, frase `text-muted`, uma ação. | — |

Ícones: `lucide-react`, 16px (20px no cabeçalho), traço 2, `currentColor`, com `aria-hidden` quando são decorativos.

## 7. Bloco CSS para `src/styles/globals.css`

```css
@import "tailwindcss";

/* =====================================================================
   1. TEMA CLARO (padrão) — semânticos, raios, sombras, tipografia
   @theme publica tudo em :root e gera os utilitários (bg-surface etc.).
   ===================================================================== */
@theme {
  --color-*: initial;          /* desliga a paleta padrão do Tailwind */
  --radius-*: initial;
  --shadow-*: initial;
  --inset-shadow-*: initial;
  --drop-shadow-*: initial;

  --color-transparent: transparent;
  --color-current: currentColor;

  --color-bg: #F6F7FB;
  --color-surface: #FFFFFF;
  --color-surface-sunken: #ECEEF4;
  --color-hover: #E7E9F0;
  --color-border: #D0D4E4;
  --color-border-strong: #7C7F93;
  --color-text: #323338;
  --color-muted: #5E5F70;
  --color-accent: #0060D6;
  --color-accent-hover: #0050B3;
  --color-on-accent: #FFFFFF;
  --color-accent-text: #0060D6;
  --color-focus: #0060D6;
  --color-danger: #B42840;
  --color-warning: #8A5100;
  --color-success: #026B40;
  --color-danger-solid: #C9304A;
  --color-danger-solid-hover: #B42840;
  --color-on-danger-solid: #FFFFFF;
  --color-pill: #E1E4EC;
  --color-on-pill: #323338;
  --color-overlay: rgb(24 27 52 / 0.45);

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 12px;

  --shadow-sm: 0 1px 2px rgb(24 27 52 / 0.08);
  --shadow-md: 0 4px 12px rgb(24 27 52 / 0.12);
  --shadow-lg: 0 12px 32px rgb(24 27 52 / 0.18);

  --font-sans: "Figtree Variable", "Figtree", system-ui, -apple-system,
    "Segoe UI", Roboto, Arial, sans-serif;
  --font-mono: ui-monospace, "Cascadia Code", Consolas, "Liberation Mono", monospace;

  --text-xs: 0.75rem;    --text-xs--line-height: 1rem;
  --text-sm: 0.875rem;   --text-sm--line-height: 1.25rem;
  --text-md: 1rem;       --text-md--line-height: 1.5rem;
  --text-lg: 1.125rem;   --text-lg--line-height: 1.625rem;
  --text-xl: 1.375rem;   --text-xl--line-height: 1.875rem;
  --text-2xl: 1.75rem;   --text-2xl--line-height: 2.25rem;

  --breakpoint-sm: 40rem;
  --breakpoint-md: 48rem;
  --breakpoint-lg: 64rem;
  --breakpoint-xl: 80rem;
}

:root { color-scheme: light; }

/* =====================================================================
   2. TEMA ESCURO — sobrescreve os mesmos nomes
   ===================================================================== */
:root[data-theme="dark"] {
  color-scheme: dark;

  --color-bg: #181B34;
  --color-surface: #292F4C;
  --color-surface-sunken: #1F2240;
  --color-hover: #363C5E;
  --color-border: #3A3F63;
  --color-border-strong: #7D82A6;
  --color-text: #EDEEF5;
  --color-muted: #A6A9C0;
  --color-accent: #0060D6;
  --color-accent-hover: #0050B3;
  --color-on-accent: #FFFFFF;
  --color-accent-text: #7FB2FF;
  --color-focus: #7FB2FF;
  --color-danger: #FF8FA3;
  --color-warning: #FDAB3D;
  --color-success: #00C875;
  --color-danger-solid: #C9304A;
  --color-danger-solid-hover: #B42840;
  --color-on-danger-solid: #FFFFFF;
  --color-pill: #464C72;
  --color-on-pill: #EDEEF5;
  --color-overlay: rgb(8 9 20 / 0.65);

  --shadow-sm: 0 1px 2px rgb(0 0 0 / 0.40);
  --shadow-md: 0 4px 12px rgb(0 0 0 / 0.45);
  --shadow-lg: 0 12px 32px rgb(0 0 0 / 0.55);
}

/* =====================================================================
   3. PALETA (listas e etiquetas), PRIORIDADE e ESTADOS
   Iguais nos dois temas por decisão de design (pares fundo/texto fixos).
   Para diferenciar por tema no futuro, repita as variáveis em
   :root[data-theme="dark"].
   ===================================================================== */
:root {
  --palette-gray-bg: #676879;    --palette-gray-fg: #FFFFFF;    --palette-gray-border: #55566A;
  --palette-red-bg: #C9304A;     --palette-red-fg: #FFFFFF;     --palette-red-border: #A82740;
  --palette-orange-bg: #FDAB3D;  --palette-orange-fg: #1A1B22;  --palette-orange-border: #E0912A;
  --palette-yellow-bg: #FFCB00;  --palette-yellow-fg: #1A1B22;  --palette-yellow-border: #E0B000;
  --palette-green-bg: #00C875;   --palette-green-fg: #1A1B22;   --palette-green-border: #00A862;
  --palette-cyan-bg: #66CCFF;    --palette-cyan-fg: #1A1B22;    --palette-cyan-border: #3FB5F0;
  --palette-blue-bg: #579BFC;    --palette-blue-fg: #1A1B22;    --palette-blue-border: #3A85F0;
  --palette-purple-bg: #784BD1;  --palette-purple-fg: #FFFFFF;  --palette-purple-border: #6238B8;
  --palette-magenta-bg: #D1177A; --palette-magenta-fg: #FFFFFF; --palette-magenta-border: #B01266;

  --priority-urgent-bg: #C9304A; --priority-urgent-fg: #FFFFFF;
  --priority-high-bg: #784BD1;   --priority-high-fg: #FFFFFF;
  --priority-medium-bg: #579BFC; --priority-medium-fg: #1A1B22;
  --priority-low-bg: #66CCFF;    --priority-low-fg: #1A1B22;

  --status-scheduled-bg: var(--color-pill);  --status-scheduled-fg: var(--color-on-pill);
  --status-due-soon-bg: #FDAB3D;             --status-due-soon-fg: #1A1B22;
  --status-overdue-bg: #C9304A;              --status-overdue-fg: #FFFFFF;
  --status-done-bg: #00C875;                 --status-done-fg: #1A1B22;
  --status-archived-bg: #676879;             --status-archived-fg: #FFFFFF;
}

/* Cor dinâmica vinda do banco: o componente seta o atributo e usa
   bg-(--c-bg) text-(--c-fg) border-(--c-border). Nunca montar classe com a chave. */
[data-color="gray"]    { --c-bg: var(--palette-gray-bg);    --c-fg: var(--palette-gray-fg);    --c-border: var(--palette-gray-border); }
[data-color="red"]     { --c-bg: var(--palette-red-bg);     --c-fg: var(--palette-red-fg);     --c-border: var(--palette-red-border); }
[data-color="orange"]  { --c-bg: var(--palette-orange-bg);  --c-fg: var(--palette-orange-fg);  --c-border: var(--palette-orange-border); }
[data-color="yellow"]  { --c-bg: var(--palette-yellow-bg);  --c-fg: var(--palette-yellow-fg);  --c-border: var(--palette-yellow-border); }
[data-color="green"]   { --c-bg: var(--palette-green-bg);   --c-fg: var(--palette-green-fg);   --c-border: var(--palette-green-border); }
[data-color="cyan"]    { --c-bg: var(--palette-cyan-bg);    --c-fg: var(--palette-cyan-fg);    --c-border: var(--palette-cyan-border); }
[data-color="blue"]    { --c-bg: var(--palette-blue-bg);    --c-fg: var(--palette-blue-fg);    --c-border: var(--palette-blue-border); }
[data-color="purple"]  { --c-bg: var(--palette-purple-bg);  --c-fg: var(--palette-purple-fg);  --c-border: var(--palette-purple-border); }
[data-color="magenta"] { --c-bg: var(--palette-magenta-bg); --c-fg: var(--palette-magenta-fg); --c-border: var(--palette-magenta-border); }

[data-priority="urgent"] { --c-bg: var(--priority-urgent-bg); --c-fg: var(--priority-urgent-fg); --c-border: var(--priority-urgent-bg); }
[data-priority="high"]   { --c-bg: var(--priority-high-bg);   --c-fg: var(--priority-high-fg);   --c-border: var(--priority-high-bg); }
[data-priority="medium"] { --c-bg: var(--priority-medium-bg); --c-fg: var(--priority-medium-fg); --c-border: var(--priority-medium-bg); }
[data-priority="low"]    { --c-bg: var(--priority-low-bg);    --c-fg: var(--priority-low-fg);    --c-border: var(--priority-low-bg); }

[data-status="scheduled"] { --c-bg: var(--status-scheduled-bg); --c-fg: var(--status-scheduled-fg); --c-border: var(--color-border); }
[data-status="due-soon"]  { --c-bg: var(--status-due-soon-bg);  --c-fg: var(--status-due-soon-fg);  --c-border: var(--status-due-soon-bg); }
[data-status="overdue"]   { --c-bg: var(--status-overdue-bg);   --c-fg: var(--status-overdue-fg);   --c-border: var(--status-overdue-bg); }
[data-status="done"]      { --c-bg: var(--status-done-bg);      --c-fg: var(--status-done-fg);      --c-border: var(--status-done-bg); }
[data-status="archived"]  { --c-bg: var(--status-archived-bg);  --c-fg: var(--status-archived-fg);  --c-border: var(--status-archived-bg); }

/* =====================================================================
   4. BASE
   ===================================================================== */
@layer base {
  html {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-sans);
    -webkit-text-size-adjust: 100%;
  }
  body {
    min-height: 100dvh;
    font-size: var(--text-sm);
    line-height: var(--text-sm--line-height);
    -webkit-font-smoothing: antialiased;
  }
  h1, h2, h3 { font-weight: 700; }
  a { color: var(--color-accent-text); text-underline-offset: 2px; }
  ::placeholder { color: var(--color-muted); opacity: 1; }
  ::selection { background: var(--color-accent); color: var(--color-on-accent); }

  :focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
  /* sobre fundo colorido, o anel usa o texto da própria cor */
  :is([data-color], [data-priority], [data-status]):focus-visible,
  :is([data-color], [data-priority], [data-status]) :focus-visible { outline-color: var(--c-fg); }
  .focus-inset:focus-visible { outline-offset: -2px; }

  * { scrollbar-color: var(--color-border-strong) transparent; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
  .drag-overlay { transform: none !important; }
}
```

> **Cuidado com o `data-*` e o foco:** a regra de foco também atinge filhos. Coloque `data-color`, `data-priority` e `data-status` **só no elemento que tem o fundo colorido** (cabeçalho da lista, pílula, avatar), nunca na coluna ou no card inteiro. A marca de cor da lista na face do card usa `style={{ background: 'var(--palette-blue-bg)' }}`, montado a partir da chave, sem hex.

**Exemplos válidos:** `bg-surface text-text border border-border rounded-lg shadow-sm`, `bg-accent text-on-accent hover:bg-accent-hover rounded-md`, `<span data-priority={p} className="bg-(--c-bg) text-(--c-fg) rounded-full">`.
**Inválidos:** `bg-blue-500`, `text-[#fff]`, `` bg-palette-${color} ``, `bg-linear-to-r`, `backdrop-blur`, variante `dark:`.

### 7.1 Tema

- Atributo `data-theme="light" | "dark"` no `<html>`. **Padrão: claro** (S5).
- `public/theme-init.js`, carregado **síncrono** no `<head>` (script externo, por causa da CSP):

```js
(function () {
  var t = null;
  try { t = localStorage.getItem("ronin.theme"); } catch (e) {}
  document.documentElement.setAttribute("data-theme", t === "dark" ? "dark" : "light");
})();
```

- O `ThemeSwitch` do cabeçalho grava `localStorage["ronin.theme"]` e troca o atributo na hora, sem recarregar.

### 7.2 Proteção contra regressão (CI)

Um grep em `src/**/*.tsx` que falha ao encontrar:
- `(bg|text|border|fill|stroke|outline|ring|shadow)-\[#`;
- hex em `style=`;
- paleta padrão `-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b`;
- `bg-(linear|radial|conic|gradient)`, `backdrop-blur`, `dark:`.

A página `/dev/paleta` (smoke do plano, 0.8) deve mostrar: todas as 9 cores como cabeçalho de lista e etiqueta, as 4 prioridades e os 5 estados, nos dois temas, para o axe validar.

## 8. Checklist para trocar paleta ou tema

1. Edite só `globals.css` (blocos 1–3).
2. Recalcule cada par `-bg`/`-fg` (regra da seção 1.2) e a tabela 1.5.
3. **Não renomeie nem remova chaves** (`palette_color` e `card_priority` são enums do banco). Para "aposentar" uma cor, mude só o valor.
4. Revise nos dois temas: quadro com filtros, face do card com prioridade + prazo atrasado, detalhe do card, Meus cards, notificações e administração.
