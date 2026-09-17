// Fatia 7 (tarefa 7.5): D2, C4 e C8 (notificação) e RN18 (sem autonotificação), docs/product/scope.md.
import type { Page } from '@playwright/test';

import { listByName } from './support/api';
import { expect, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import { cardDialog, assignPerson, openBoard, openCard } from './support/ui';

function bell(page: Page) {
  return page.getByRole('banner').getByRole('button', { name: /^Notificações/ });
}

/** O contador faz polling a cada 60 s; recarregar a tela é o "voltar ao app" do usuário. */
async function expectUnread(page: Page, count: number): Promise<void> {
  const name =
    count === 0
      ? 'Notificações'
      : `Notificações, ${count} ${count === 1 ? 'não lida' : 'não lidas'}`;
  await expect(async () => {
    await page.reload();
    await expect(bell(page)).toHaveAccessibleName(name, { timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
}

test('A atribui e comenta → B vê o contador, abre o card pela notificação e ela fica lida; ninguém se autonotifica', async ({
  page,
  openAs,
  apiAs,
  isMobile,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const anaApi = await apiAs(team.ana);
  const brunoApi = await apiAs(team.bruno);
  const { board, lists } = await anaApi.createBoard('Comercial');
  const card = await anaApi.createCard(listByName(lists, 'A fazer').id, 'Proposta para cliente');

  const anaPage = await openAs(team.ana);
  const brunoPage = await openAs(team.bruno);
  await brunoPage.goto('/');
  await expect(bell(brunoPage)).toHaveAccessibleName('Notificações');

  await test.step('A atribui B e a si mesma pelo detalhe do card', async () => {
    await openBoard(anaPage, board.id, 'Comercial');
    const dialog = await openCard(anaPage, 'Proposta para cliente');
    await dialog.getByRole('button', { name: 'Atribuir a mim' }).click();
    await expect(dialog.getByRole('button', { name: 'Remover Ana Admin' })).toBeVisible();

    await assignPerson(anaPage, dialog, 'Bruno Membro', isMobile);
    await expect
      .poll(async () => (await anaApi.board(board.id)).cards[0]?.assigneeIds.length)
      .toBe(2);
  });

  await test.step('A não recebe notificação da própria atribuição (RN18)', async () => {
    expect(await anaApi.unreadCount()).toBe(0);
    await anaPage.reload();
    await expect(bell(anaPage)).toHaveAccessibleName('Notificações');
  });

  await test.step('B vê "1 não lida", abre o painel e clica: vai ao card e a notificação fica lida', async () => {
    await expectUnread(brunoPage, 1);
    await bell(brunoPage).click();
    const panel = brunoPage.getByRole('dialog', { name: 'Notificações' });
    const item = panel.getByRole('link', {
      name: /^Não lida\. Ana Admin atribuiu você a Proposta para cliente\. Comercial, /,
    });
    await expect(item).toBeVisible();
    await item.click();
    await expect(brunoPage).toHaveURL(new RegExp(`/b/${board.id}/c/${card.id}$`));
    await expect(cardDialog(brunoPage, 'Proposta para cliente')).toBeVisible();
    await expect(bell(brunoPage)).toHaveAccessibleName('Notificações');
    expect(await brunoApi.unreadCount()).toBe(0);
  });

  await test.step('A comenta → B é notificado (responsável); A não', async () => {
    const dialog = cardDialog(anaPage, 'Proposta para cliente');
    await dialog.getByRole('textbox', { name: 'Novo comentário' }).fill('Bruno, revisa o valor?');
    await dialog.getByRole('button', { name: 'Comentar' }).click();
    await expect(dialog.getByRole('list', { name: 'Comentários' })).toContainText(
      'Bruno, revisa o valor?',
    );
    expect(await anaApi.unreadCount()).toBe(0);

    await brunoPage.keyboard.press('Escape');
    await expectUnread(brunoPage, 1);
    await bell(brunoPage).click();
    const panel = brunoPage.getByRole('dialog', { name: 'Notificações' });
    await expect(
      panel.getByRole('link', {
        name: /^Não lida\. Ana Admin comentou em Proposta para cliente\./,
      }),
    ).toBeVisible();
    // A de atribuição, já lida, continua na lista sem o "Não lida".
    await expect(
      panel.getByRole('link', { name: /^Ana Admin atribuiu você a Proposta para cliente\./ }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await expect(bell(brunoPage)).toHaveAccessibleName('Notificações');
    await expect(panel.getByRole('button', { name: 'Marcar todas como lidas' })).toBeDisabled();
    expect(await brunoApi.unreadCount()).toBe(0);
  });

  await test.step('B comenta → A (responsável) é notificada; B não recebe a própria', async () => {
    await brunoApi.comment(card.id, 'Revisado.');
    expect(await brunoApi.unreadCount()).toBe(0);
    await expectUnread(anaPage, 1);
    await expectUnread(brunoPage, 0);
  });

  // `page` padrão não é usado: os dois usuários têm contextos próprios.
  void page;
});
