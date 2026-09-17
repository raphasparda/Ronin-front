import { expect, type Locator, type Page } from '@playwright/test';

import { WORKSPACE } from './seed';

export const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Coluna (section com o h2 da lista). A lista de conclusão tem o sufixo lido pelo leitor de tela. */
export function listColumn(page: Page, name: string): Locator {
  return page.getByRole('region', {
    name: new RegExp(`^${escapeRegExp(name)}( \\(lista de conclusão\\))?$`),
  });
}

/** Face do card no quadro: o nome acessível começa pelo título ("Título. Etiquetas: …"). */
export function cardFace(scope: Page | Locator, title: string): Locator {
  return scope.getByRole('link', { name: new RegExp(`^${escapeRegExp(title)}(\\.|$)`) });
}

/** `<ol aria-label="Cards de X">` com os cards da lista, na ordem exibida. */
export function cardsOf(page: Page, listName: string): Locator {
  return page.getByRole('list', { name: `Cards de ${listName}`, exact: true });
}

/** Títulos dos cards de uma lista, na ordem exibida (primeiro trecho do nome acessível). */
export async function cardTitlesOf(page: Page, listName: string): Promise<string[]> {
  const list = cardsOf(page, listName);
  if ((await list.count()) === 0) return [];
  const names = await list
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label') ?? ''));
  return names.map((name) => name.split('. ')[0] ?? name);
}

/** Aviso (toast) na região "Avisos". */
export function toast(page: Page, text: string | RegExp): Locator {
  return page.getByRole('region', { name: 'Avisos' }).getByText(text);
}

/** Diálogo do detalhe do card, identificado pelo título. */
export function cardDialog(page: Page, title: string): Locator {
  return page.getByRole('dialog', { name: title, exact: true });
}

/**
 * Clica na face e espera o detalhe. Repete o clique se ele cair na janela de 250 ms após um
 * arraste (o quadro ignora esse clique de propósito) ou durante o re-render do refetch.
 */
export async function openCard(page: Page, title: string): Promise<Locator> {
  const dialog = cardDialog(page, title);
  await expect(async () => {
    if (!(await dialog.isVisible())) await cardFace(page, title).click({ timeout: 2_000 });
    await expect(dialog).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  return dialog;
}

/**
 * Marca uma pessoa como responsável pelo seletor "Adicionar responsável" do detalhe: abre o painel
 * (a busca começa vazia a cada abertura), toca/clica na pessoa e fecha com Esc.
 */
export async function assignPerson(
  page: Page,
  dialog: Locator,
  name: string,
  isMobile: boolean,
): Promise<void> {
  const picker = page.getByRole('group', { name: 'Adicionar responsável' });
  await dialog.getByRole('button', { name: 'Adicionar', exact: true }).click();
  await expect(picker.getByRole('searchbox', { name: 'Buscar pessoa' })).toHaveValue('');
  const person = picker.getByRole('checkbox', { name });
  if (isMobile) await person.tap();
  else await person.check();
  await expect(dialog.getByRole('button', { name: `Remover ${name}` })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(picker).toBeHidden();
}

export async function openBoard(page: Page, boardId: string, boardName: string): Promise<void> {
  await page.goto(`/b/${boardId}`);
  await expect(page.getByRole('heading', { level: 1, name: boardName })).toBeVisible();
}

/**
 * Arrasta com o mouse de verdade (dnd-kit PointerSensor com distância mínima de 5 px): pressiona
 * no centro de `source`, anda em passos até `target` e solta.
 */
export async function dragWithMouse(
  page: Page,
  source: Locator,
  target: Locator,
  { targetOffsetY = 0.5 }: { targetOffsetY?: number } = {},
): Promise<void> {
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  if (!from) throw new Error('origem do arraste sem caixa');
  const startX = from.x + from.width / 2;
  const startY = from.y + from.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 12, startY + 12, { steps: 4 });
  const to = await target.boundingBox();
  if (!to) throw new Error('destino do arraste sem caixa');
  const endX = to.x + to.width / 2;
  const endY = to.y + to.height * targetOffsetY;
  await page.mouse.move(endX, endY, { steps: 20 });
  // Um segundo movimento curto no destino dispara o onDragOver final antes de soltar.
  await page.mouse.move(endX + 2, endY + 2, { steps: 3 });
  await page.mouse.up();
}

const zoned = new Intl.DateTimeFormat('en-CA', {
  timeZone: WORKSPACE.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Data/hora local do workspace (São Paulo) deslocada de agora, no formato do `DueInput`. */
export function localDue(
  offsetMs: number,
  withTime: boolean,
): { date: string; time: string | null } {
  const parts = Object.fromEntries(
    zoned.formatToParts(new Date(Date.now() + offsetMs)).map((part) => [part.type, part.value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: withTime ? `${parts.hour}:${parts.minute}` : null,
  };
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

/** Fecha o detalhe pelo botão do cabeçalho ("Voltar" no mobile, "Fechar" no desktop). */
export async function closeCard(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: /^(Voltar|Fechar)$/ }).click();
  await expect(dialog).toBeHidden();
}

/**
 * Abre um menu pelo botão e espera o primeiro item focado. Repete se o menu fechar sozinho: no
 * carrossel de listas do celular, rolar até o botão dispara o `scroll-snap`, e o menu fecha em
 * qualquer rolagem (com o dedo, a pessoa só toca depois que a rolagem para).
 */
export async function openMenu(page: Page, buttonName: string): Promise<Locator> {
  const button = page.getByRole('button', { name: buttonName, exact: true });
  const menu = page.getByRole('menu', { name: buttonName, exact: true });
  await expect(async () => {
    if (!(await menu.isVisible())) await button.click({ timeout: 2_000 });
    await expect(menu).toBeVisible({ timeout: 1_000 });
    await page.waitForTimeout(150);
    await expect(menu).toBeVisible({ timeout: 100 });
  }).toPass({ timeout: 10_000 });
  return menu;
}
