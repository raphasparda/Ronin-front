// Fatia 8 (tarefa 8.5): C9, RN11–RN14 e anonimização (A5/LGPD), docs/product/scope.md.
import { cardIdsInList, listByName, type Api } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import {
  cardDialog,
  cardFace,
  cardTitlesOf,
  dragWithMouse,
  listColumn,
  openBoard,
  openCard,
  toast,
} from './support/ui';
import type { Page } from '@playwright/test';

async function historyItems(page: Page, title: string) {
  const dialog = cardDialog(page, title);
  await dialog.getByRole('tab', { name: 'Histórico' }).click();
  const history = dialog.getByRole('list', { name: 'Histórico do card' });
  await expect(history).toBeVisible();
  return history.getByRole('listitem');
}

async function activityTypes(api: Api, cardId: string): Promise<string[]> {
  return (await api.activity(cardId)).map((item) => item.type).reverse();
}

test('concluir arrastando para Concluído, reabrir pelo botão (vai ao topo), arrastar para dentro e fora', async ({
  page,
  openAs,
  apiAs,
  isMobile,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Entregas');
  const todo = listByName(lists, 'A fazer');
  const doing = listByName(lists, 'Fazendo');
  const done = listByName(lists, 'Concluído');
  const card = await api.createCard(todo.id, 'Relatório mensal');
  await api.createCard(todo.id, 'Outro card');

  await signIn(page.context(), team.ana);
  const anaPage = page;
  await openBoard(anaPage, board.id, 'Entregas');

  await test.step('Ana conclui o card levando-o para Concluído (arraste no desktop, menu no mobile)', async () => {
    if (isMobile) {
      await cardFace(anaPage, 'Relatório mensal').focus();
      await anaPage.getByRole('button', { name: 'Ações do card Relatório mensal' }).click();
      await anaPage.getByRole('menuitem', { name: 'Concluir' }).click();
      await expect(toast(anaPage, 'Card concluído e movido para Concluído.')).toBeVisible();
    } else {
      await dragWithMouse(
        anaPage,
        cardFace(anaPage, 'Relatório mensal'),
        listColumn(anaPage, 'Concluído').getByText('Cards chegam aqui'),
      );
      await expect(toast(anaPage, /^Card concluído\.$/)).toBeVisible();
    }
    expect(await cardTitlesOf(anaPage, 'Concluído')).toEqual(['Relatório mensal']);
    // Face do card concluído mostra o estado em texto (RN17).
    await expect(cardFace(anaPage, 'Relatório mensal')).toHaveAccessibleName(/Concluído/);

    const payload = await api.board(board.id);
    const saved = payload.cards.find((item) => item.id === card.id);
    expect(saved).toMatchObject({ listId: done.id, status: 'completed' });
  });

  await test.step('detalhe mostra "Concluído" com autor e a atividade registra quem concluiu', async () => {
    const dialog = await openCard(anaPage, 'Relatório mensal');
    await expect(dialog.getByText(/^por Ana Admin em /)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reabrir' })).toBeVisible();
    const items = await historyItems(anaPage, 'Relatório mensal');
    await expect(items.filter({ hasText: 'concluiu o card' })).toContainText('Ana Admin');
    await expect(items.filter({ hasText: 'moveu de' }).first()).toContainText('Ana Admin');
    await anaPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  const brunoPage = await openAs(team.bruno);
  await openBoard(brunoPage, board.id, 'Entregas');

  await test.step('Bruno clica "Reabrir": card volta aberto para o topo de "A fazer"', async () => {
    const dialog = await openCard(brunoPage, 'Relatório mensal');
    await dialog.getByRole('button', { name: 'Reabrir' }).click();
    await expect(toast(brunoPage, 'Card reaberto e movido para o topo de A fazer.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Concluir' })).toBeVisible();
    await expect(dialog.getByRole('navigation', { name: 'Local do card' })).toContainText(
      'A fazer',
    );
    await brunoPage.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await expect
      .poll(() => cardTitlesOf(brunoPage, 'A fazer'))
      .toEqual(['Relatório mensal', 'Outro card']);
    const payload = await api.board(board.id);
    expect(cardIdsInList(payload, todo.id)[0]).toBe(card.id);
    expect(payload.cards.find((item) => item.id === card.id)?.status).toBe('open');
  });

  await test.step('Bruno leva o card para Concluído e depois para Fazendo: conclui e reabre', async () => {
    if (isMobile) {
      await moveWithDialog(brunoPage, 'Relatório mensal', 'Concluído (lista de conclusão)');
      await expect(
        toast(brunoPage, 'Card movido para Concluído, posição 1. Card concluído.'),
      ).toBeVisible();
      await moveWithDialog(brunoPage, 'Relatório mensal', 'Fazendo');
      await expect(
        toast(brunoPage, 'Card movido para Fazendo, posição 1. Card reaberto.'),
      ).toBeVisible();
    } else {
      await dragWithMouse(
        brunoPage,
        cardFace(brunoPage, 'Relatório mensal'),
        listColumn(brunoPage, 'Concluído').getByText('Cards chegam aqui'),
      );
      await expect(toast(brunoPage, /^Card concluído\.$/)).toBeVisible();
      await expect.poll(() => cardTitlesOf(brunoPage, 'Concluído')).toEqual(['Relatório mensal']);
      await dragWithMouse(
        brunoPage,
        cardFace(brunoPage, 'Relatório mensal'),
        listColumn(brunoPage, 'Fazendo').getByRole('button', { name: 'Adicionar card' }),
      );
      await expect(toast(brunoPage, /^Card reaberto\.$/)).toBeVisible();
    }
    await expect.poll(() => cardTitlesOf(brunoPage, 'Fazendo')).toEqual(['Relatório mensal']);
    const payload = await api.board(board.id);
    expect(payload.cards.find((item) => item.id === card.id)).toMatchObject({
      listId: doing.id,
      status: 'open',
    });
  });

  await test.step('atividade guarda todas as conclusões e reaberturas, com autor (RN13)', async () => {
    expect(await activityTypes(api, card.id)).toEqual([
      'card_created',
      'card_moved',
      'card_completed',
      'card_moved',
      'card_reopened',
      'card_moved',
      'card_completed',
      'card_moved',
      'card_reopened',
    ]);
    const activities = await api.activity(card.id);
    const actors = activities.filter((a) => a.type === 'card_completed').map((a) => a.actorId);
    expect(actors.sort()).toEqual([team.ana.id, team.bruno.id].sort());

    await openCard(brunoPage, 'Relatório mensal');
    const items = await historyItems(brunoPage, 'Relatório mensal');
    await expect(items.filter({ hasText: 'reabriu o card' })).toHaveCount(2);
    await expect(items.filter({ hasText: 'concluiu o card' })).toHaveCount(2);
    await expect(items.filter({ hasText: 'Bruno Membro reabriu o card' })).toHaveCount(2);
  });
});

async function moveWithDialog(page: Page, title: string, listLabel: string): Promise<void> {
  await cardFace(page, title).focus();
  await page.keyboard.press('m');
  const dialog = page.getByRole('dialog', { name: 'Mover card' });
  await dialog.getByLabel('Lista').selectOption({ label: listLabel });
  await dialog.getByRole('button', { name: 'Mover' }).click();
  await expect(dialog).toBeHidden();
}

test('quadro sem lista de conclusão: Concluir e Reabrir pelo botão não movem o card', async ({
  page,
  apiAs,
}) => {
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Sem conclusão');
  await api.updateList(listByName(lists, 'Concluído').id, { isDoneList: false });
  const todo = listByName(lists, 'A fazer');
  const card = await api.createCard(todo.id, 'Tarefa solta');

  await signIn(page.context(), team.ana);
  await page.goto(`/b/${board.id}/c/${card.id}`);
  const dialog = cardDialog(page, 'Tarefa solta');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await expect(toast(page, /^Card concluído\.$/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Reabrir' })).toBeVisible();
  await expect(dialog.getByRole('navigation', { name: 'Local do card' })).toContainText('A fazer');
  let payload = await api.board(board.id);
  expect(payload.cards.find((item) => item.id === card.id)).toMatchObject({
    listId: todo.id,
    status: 'completed',
  });

  await dialog.getByRole('button', { name: 'Reabrir' }).click();
  await expect(toast(page, /^Card reaberto\.$/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Concluir' })).toBeVisible();
  payload = await api.board(board.id);
  expect(payload.cards.find((item) => item.id === card.id)).toMatchObject({
    listId: todo.id,
    status: 'open',
  });
  expect((await api.activity(card.id)).map((a) => a.type)).toEqual([
    'card_reopened',
    'card_completed',
    'card_created',
  ]);
});

test('Admin desativa e anonimiza um membro: histórico passa a mostrar "Usuário removido"', async ({
  page,
  apiAs,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const anaApi = await apiAs(team.ana);
  const brunoApi = await apiAs(team.bruno);
  const { board, lists } = await anaApi.createBoard('Histórico');
  const card = await brunoApi.createCard(listByName(lists, 'A fazer').id, 'Card do Bruno');
  await brunoApi.complete(card.id);
  await brunoApi.comment(card.id, 'Comentário do Bruno');

  await signIn(page.context(), team.ana);
  await page.goto('/admin/membros');
  const members = page.getByRole('list', { name: 'Membros da equipe' });
  await expect(members).toContainText('Bruno Membro');

  await test.step('desativar com confirmação', async () => {
    await page.getByRole('button', { name: 'Ações para Bruno Membro' }).click();
    await page.getByRole('menuitem', { name: 'Desativar' }).click();
    const confirm = page.getByRole('dialog', { name: 'Desativar Bruno Membro?' });
    await confirm.getByRole('button', { name: 'Desativar' }).click();
    await expect(toast(page, 'A conta de Bruno Membro foi desativada.')).toBeVisible();
    await expect(members.getByRole('listitem').filter({ hasText: 'Bruno Membro' })).toContainText(
      'Conta desativada',
    );
    // A sessão do Bruno cai na hora.
    expect((await brunoApi.http.get('/api/auth/me')).status()).toBe(401);
  });

  await test.step('anonimizar exige digitar o nome', async () => {
    await page.getByRole('button', { name: 'Ações para Bruno Membro' }).click();
    await page.getByRole('menuitem', { name: 'Anonimizar…' }).click();
    const confirm = page.getByRole('dialog', { name: 'Anonimizar Bruno Membro?' });
    const submit = confirm.getByRole('button', { name: 'Anonimizar conta' });
    await expect(submit).toBeDisabled();
    await confirm.getByLabel('Nome da pessoa').fill('Bruno');
    await expect(submit).toBeDisabled();
    await confirm.getByLabel('Nome da pessoa').fill('Bruno Membro');
    await submit.click();
    await expect(
      toast(page, 'A conta foi anonimizada. O nome agora aparece como "Usuário removido".'),
    ).toBeVisible();
    await expect(members).toContainText('Usuário removido');
    await expect(members).toContainText('Conta anonimizada');
    await expect(members).not.toContainText('bruno@exemplo.com');
  });

  await test.step('card, comentário e histórico continuam, com "Usuário removido"', async () => {
    await page.goto(`/b/${board.id}/c/${card.id}`);
    const dialog = cardDialog(page, 'Card do Bruno');
    await expect(dialog.getByText('por Usuário removido em', { exact: false })).toBeVisible();
    const comments = dialog.getByRole('list', { name: 'Comentários' });
    await expect(comments).toContainText('Usuário removido');
    await expect(comments).toContainText('Comentário do Bruno');
    await expect(comments).not.toContainText('Bruno Membro');
    const items = await historyItems(page, 'Card do Bruno');
    await expect(items.filter({ hasText: 'concluiu o card' })).toContainText('Usuário removido');
    await expect(items.filter({ hasText: 'criou o card' })).toContainText('Usuário removido');
  });
});
