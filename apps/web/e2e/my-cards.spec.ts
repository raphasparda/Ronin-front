// Fatia 9 (tarefa 9.3): D1 "Meus cards" e RN14, docs/product/scope.md.
import type { Page } from '@playwright/test';

import { cardIdsInList, listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import { cardDialog, DAY_MS, HOUR_MS, localDue, toast } from './support/ui';

async function titlesIn(page: Page, group: string): Promise<string[]> {
  const list = page.getByRole('list', { name: group, exact: true });
  if ((await list.count()) === 0) return [];
  const names = await list
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => link.getAttribute('aria-label') ?? ''));
  return names.map((name) => name.split('. ')[0] ?? name);
}

test('Meus cards: quatro grupos por prazo, ordem por prioridade, sem concluídos/arquivados; concluir tira da lista e "Desfazer" devolve', async ({
  page,
  apiAs,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const api = await apiAs(team.ana);
  const ops = await api.createBoard('Operações');
  const pessoal = await api.createBoard('Pessoal');
  const todo = listByName(ops.lists, 'A fazer');
  const doing = listByName(ops.lists, 'Fazendo');

  const overdue = localDue(-2 * DAY_MS, false);
  const seed = async (
    listId: string,
    title: string,
    patch: Parameters<typeof api.updateCard>[1] | null,
  ) => {
    const card = await api.createCard(listId, title);
    if (patch) await api.updateCard(card.id, patch);
    await api.assign(card.id, team.bruno.id);
    return card;
  };
  await seed(todo.id, 'Pagar fornecedor', { due: overdue, priority: 'low' });
  await seed(doing.id, 'Enviar NF', { due: overdue, priority: 'urgent' });
  const meeting = await seed(todo.id, 'Reunião de status', { due: localDue(3 * HOUR_MS, true) });
  await seed(todo.id, 'Planejamento trimestral', { due: localDue(10 * DAY_MS, false) });
  await seed(todo.id, 'Sem prazo baixa', { priority: 'low' });
  await seed(listByName(pessoal.lists, 'A fazer').id, 'Sem prazo urgente', { priority: 'urgent' });
  await seed(todo.id, 'Sem prazo sem prioridade', null);
  const done = await seed(todo.id, 'Já concluído', { priority: 'urgent' });
  await api.complete(done.id);
  const archived = await seed(todo.id, 'Arquivado', null);
  await api.archiveCard(archived.id);
  await api.createCard(todo.id, 'Não é do Bruno');
  const orderBefore = cardIdsInList(await api.board(ops.board.id), todo.id);

  await signIn(page.context(), team.bruno);
  await page.goto('/');
  await page.getByRole('link', { name: 'Meus cards' }).last().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Meus cards' })).toBeVisible();

  await test.step('D1: grupos com contagem, na ordem Atrasados · Vencendo · Com prazo · Sem prazo', async () => {
    await expect(page.getByRole('heading', { level: 2 })).toHaveText([
      /Atrasados/,
      /Vencendo \(24h\)/,
      /Com prazo/,
      /Sem prazo/,
    ]);
    await expect(
      page.getByRole('heading', { level: 2, name: /^Atrasados ?, 2 cards$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /^Vencendo \(24h\) ?, 1 card$/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /^Sem prazo ?, 3 cards$/ }),
    ).toBeVisible();
  });

  await test.step('D1/RN14: ordem por prazo e prioridade; concluídos, arquivados e de outros ficam fora', async () => {
    expect(await titlesIn(page, 'Atrasados')).toEqual(['Enviar NF', 'Pagar fornecedor']);
    expect(await titlesIn(page, 'Vencendo (24h)')).toEqual(['Reunião de status']);
    expect(await titlesIn(page, 'Com prazo')).toEqual(['Planejamento trimestral']);
    expect(await titlesIn(page, 'Sem prazo')).toEqual([
      'Sem prazo urgente',
      'Sem prazo baixa',
      'Sem prazo sem prioridade',
    ]);
    const main = page.getByRole('main');
    await expect(main).not.toContainText('Já concluído');
    await expect(main).not.toContainText('Arquivado');
    await expect(main).not.toContainText('Não é do Bruno');
    // Cada item diz quadro, lista, prioridade e prazo em texto.
    await expect(
      page.getByRole('list', { name: 'Atrasados' }).getByRole('link').first(),
    ).toHaveAccessibleName(
      /^Enviar NF\. Prioridade urgente\. Atrasado, .*\. Quadro Operações, lista Fazendo$/,
    );
    await expect(
      page.getByRole('list', { name: 'Sem prazo' }).getByRole('link').first(),
    ).toHaveAccessibleName('Sem prazo urgente. Prioridade urgente. Quadro Pessoal, lista A fazer');
  });

  await test.step('concluir pela lista tira o card; "Desfazer" reabre e devolve ao lugar de antes', async () => {
    await page.getByRole('button', { name: 'Concluir Reunião de status' }).click();
    await expect(toast(page, 'Card concluído.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /Vencendo/ })).toHaveCount(0);
    let card = (await api.board(ops.board.id)).cards.find((item) => item.id === meeting.id);
    expect(card).toMatchObject({
      status: 'completed',
      listId: listByName(ops.lists, 'Concluído').id,
    });

    await page
      .getByRole('region', { name: 'Avisos' })
      .getByRole('button', { name: 'Desfazer' })
      .click();
    await expect(toast(page, 'Conclusão desfeita. O card voltou para A fazer.')).toBeVisible();
    await expect.poll(() => titlesIn(page, 'Vencendo (24h)')).toEqual(['Reunião de status']);
    const payload = await api.board(ops.board.id);
    card = payload.cards.find((item) => item.id === meeting.id);
    expect(card).toMatchObject({ status: 'open', listId: todo.id });
    // A posição original dentro da lista não volta (BUG em integration-bugs.spec.ts).
    expect(cardIdsInList(payload, todo.id).sort()).toEqual([...orderBefore].sort());
  });

  await test.step('item abre o detalhe do card', async () => {
    await page.getByRole('link', { name: /^Enviar NF\./ }).click();
    await expect(page).toHaveURL(new RegExp(`/b/${ops.board.id}/c/`));
    await expect(cardDialog(page, 'Enviar NF')).toBeVisible();
  });
});
