// Fatia 5 (tarefa 5.6): C2, C4, C5, C6, C11 e C13, docs/product/scope.md.
import type { Page } from '@playwright/test';

import { cardIdsInList, listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, CARLA, seedTeam } from './support/seed';
import {
  assignPerson,
  cardFace,
  cardTitlesOf,
  closeCard,
  DAY_MS,
  HOUR_MS,
  localDue,
  openBoard,
  openCard,
  openMenu,
} from './support/ui';

async function toggleFilter(page: Page, menu: string, option: string): Promise<void> {
  const bar = page.getByRole('search', { name: 'Filtros do quadro' });
  // "Limpar" esconde a barra quando ela estava aberta só por causa do filtro da URL.
  if (!(await bar.isVisible())) await page.getByRole('button', { name: /^Filtros/ }).click();
  await bar.getByRole('button', { name: new RegExp(`^${menu}`) }).click();
  const panel = page.getByRole('group', { name: `Filtrar por ${menu.toLowerCase()}` });
  await panel.getByRole('checkbox', { name: option, exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
}

async function clearFilters(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Limpar', exact: true }).click();
  await expect(page.getByText('Filtro ativo')).toBeHidden();
}

const ALL = ['Atrasado urgente', 'Vencendo baixa', 'Sem prazo nenhum'];

test('responsáveis, etiqueta, prioridade e prazo no card; filtros por cada critério na URL; prioridade não reordena', async ({
  page,
  apiAs,
  isMobile,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO, carla: CARLA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Filtros');
  const todo = listByName(lists, 'A fazer');
  const c1 = await api.createCard(todo.id, 'Atrasado urgente');
  const c2 = await api.createCard(todo.id, 'Vencendo baixa');
  await api.createCard(todo.id, 'Sem prazo nenhum');
  await api.updateCard(c2.id, { due: localDue(3 * HOUR_MS, true) });
  const orderBefore = cardIdsInList(await api.board(board.id), todo.id);

  await signIn(page.context(), team.ana);
  await openBoard(page, board.id, 'Filtros');

  await test.step('C4: atribuir dois membros ativos', async () => {
    const dialog = await openCard(page, 'Atrasado urgente');
    await expect(dialog.getByText('Ninguém ainda')).toBeVisible();
    await assignPerson(page, dialog, 'Bruno Membro', isMobile);
    await assignPerson(page, dialog, 'Carla Costa', isMobile);
    await expect(
      dialog.getByRole('list', { name: 'Responsáveis' }).getByRole('listitem'),
    ).toHaveCount(2);
  });

  await test.step('C6: criar etiqueta pelo card (cor da paleta) já aplica ao card', async () => {
    const dialog = page.getByRole('dialog', { name: 'Atrasado urgente', exact: true });
    await dialog.getByRole('button', { name: 'Criar etiqueta' }).click();
    const labels = page.getByRole('dialog', { name: 'Etiquetas do card' });
    await expect(labels.getByText('Este quadro ainda não tem etiquetas.')).toBeVisible();
    await labels.getByRole('button', { name: 'Criar etiqueta' }).click();
    await labels.getByLabel('Nome da etiqueta').fill('Bug');
    await labels
      .getByRole('radiogroup', { name: 'Cor da etiqueta' })
      .getByRole('radio', { name: 'Vermelho' })
      .click();
    await labels.getByRole('button', { name: 'Criar etiqueta' }).click();
    await expect(labels.getByRole('checkbox', { name: 'Bug' })).toBeChecked();
    await labels.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialog.getByRole('list', { name: 'Etiquetas' })).toContainText('Bug');
  });

  await test.step('C13: prioridade pelo teclado; C5: prazo vencido', async () => {
    const dialog = page.getByRole('dialog', { name: 'Atrasado urgente', exact: true });
    const priority = dialog.getByRole('button', { name: 'Prioridade Sem prioridade' });
    await priority.focus();
    await page.keyboard.press('ArrowDown');
    const listbox = dialog.getByRole('listbox', { name: 'Prioridade' });
    await expect(listbox).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('button', { name: 'Prioridade Urgente' })).toBeFocused();

    await dialog.getByRole('button', { name: 'Definir prazo' }).click();
    await dialog.getByLabel('Data', { exact: true }).fill(localDue(-DAY_MS, false).date);
    await dialog.getByRole('button', { name: 'Salvar prazo' }).click();
    await expect(dialog.getByText('Atrasado', { exact: false }).first()).toBeVisible();
    await closeCard(dialog);

    await expect(cardFace(page, 'Atrasado urgente')).toHaveAccessibleName(
      'Atrasado urgente. Etiquetas: Bug. Prioridade urgente. Atrasado, ontem. Responsáveis: Bruno Membro, Carla Costa',
    );
  });

  await test.step('C13: prioridade pelo menu da face; prioridade não muda a ordem', async () => {
    const menu = await openMenu(page, 'Ações do card Vencendo baixa');
    await menu.getByRole('menuitemradio', { name: 'Baixa' }).click();
    await expect(cardFace(page, 'Vencendo baixa')).toHaveAccessibleName(
      /^Vencendo baixa\. Prioridade baixa\. Vencendo, (hoje|amanhã) \d\d:\d\d$/,
    );
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(ALL);
    const payload = await api.board(board.id);
    expect(cardIdsInList(payload, todo.id)).toEqual(orderBefore);
    expect(payload.cards.find((card) => card.id === c1.id)).toMatchObject({
      priority: 'urgent',
      assigneeIds: [team.bruno.id, team.carla.id],
    });
    expect((await api.activity(c1.id)).map((item) => item.type)).toContain('card_priority_changed');
  });

  await test.step('C11: filtros por responsável, etiqueta, prioridade, prazo e texto (estado na URL)', async () => {
    await page.getByRole('button', { name: 'Filtros', exact: true }).click();

    await toggleFilter(page, 'Responsável', 'Bruno Membro');
    await expect(page).toHaveURL(new RegExp(`responsavel=${team.bruno.id}`));
    await expect(page.getByRole('status').filter({ hasText: 'Filtro ativo' })).toHaveText(
      'Filtro ativo · 1 de 3 cards',
    );
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Atrasado urgente']);
    // A URL reproduz o filtro (recarregar ou compartilhar o link).
    await page.reload();
    await expect(page.getByRole('button', { name: 'Filtros (1)' })).toBeVisible();
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Atrasado urgente']);
    await clearFilters(page);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(ALL);

    await toggleFilter(page, 'Etiqueta', 'Bug');
    await expect(page).toHaveURL(/etiqueta=/);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Atrasado urgente']);
    await clearFilters(page);

    await toggleFilter(page, 'Prioridade', 'Sem prioridade');
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Sem prazo nenhum']);
    await toggleFilter(page, 'Prioridade', 'Urgente');
    await expect(page).toHaveURL(/prioridade=/);
    await expect
      .poll(() => cardTitlesOf(page, 'A fazer'))
      .toEqual(['Atrasado urgente', 'Sem prazo nenhum']);
    await clearFilters(page);

    await toggleFilter(page, 'Prazo', 'Atrasado');
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Atrasado urgente']);
    await toggleFilter(page, 'Prazo', 'Atrasado');
    await toggleFilter(page, 'Prazo', 'Vencendo (24h)');
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Vencendo baixa']);
    await toggleFilter(page, 'Prazo', 'Vencendo (24h)');
    await toggleFilter(page, 'Prazo', 'Sem prazo');
    await expect(page).toHaveURL(/prazo=/);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Sem prazo nenhum']);
    // Critérios diferentes combinam com E: sem prazo E responsável Bruno → nada.
    await toggleFilter(page, 'Responsável', 'Bruno Membro');
    await expect(page.getByText('Nenhum card encontrado')).toBeVisible();
    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await expect(page.getByText('Filtro ativo')).toBeHidden();

    await page.getByRole('searchbox', { name: 'Buscar por título' }).fill('VENCENDO');
    await expect(page).toHaveURL(/q=VENCENDO/);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Vencendo baixa']);
    await clearFilters(page);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(ALL);
  });
});
