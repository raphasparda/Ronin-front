// Fatia 4 (tarefa 4.8): C1, C2 (título/descrição/prazo), C3, C10 e C12, docs/product/scope.md.
import { listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, seedTeam } from './support/seed';
import {
  cardDialog,
  cardFace,
  cardTitlesOf,
  DAY_MS,
  dragWithMouse,
  listColumn,
  localDue,
  openBoard,
  openCard,
  toast,
} from './support/ui';

const XSS_DESCRIPTION = [
  '**Importante** para o lançamento.',
  '',
  '<script>window.__xss = 1</script>',
  '<img src="x" onerror="window.__xss = 2">',
  '',
  '[link perigoso](javascript:window.__xss=3) e [site](https://exemplo.com)',
].join('\n');

test('card: criação rápida → detalhe → editar → arrastar → "Mover para…" outro quadro (aviso de etiqueta) → histórico → arquivar/restaurar', async ({
  page,
  apiAs,
  isMobile,
}) => {
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const produto = await api.createBoard('Produto');
  const marketing = await api.createBoard('Marketing');
  const bug = await api.createLabel(produto.board.id, 'Bug', 'red');

  await signIn(page.context(), team.ana);
  await openBoard(page, produto.board.id, 'Produto');
  const todo = listColumn(page, 'A fazer');

  await test.step('C1: Enter cria no fim e mantém o campo; título vazio não cria', async () => {
    await todo.getByRole('button', { name: 'Adicionar card' }).click();
    const field = todo.getByRole('textbox', { name: 'Título do card' });
    await expect(field).toBeFocused();
    await field.fill('Escrever release notes');
    await field.press('Enter');
    await expect(field).toHaveValue('');
    await expect(field).toBeFocused();
    await field.fill('   ');
    await field.press('Enter');
    await field.fill('Revisar changelog');
    await field.press('Enter');
    await expect
      .poll(() => cardTitlesOf(page, 'A fazer'))
      .toEqual(['Escrever release notes', 'Revisar changelog']);
    await field.press('Escape');
    await expect(todo.getByRole('button', { name: 'Adicionar card' })).toBeFocused();
    // Lista de conclusão não oferece criação direta.
    await expect(
      listColumn(page, 'Concluído').getByRole('button', { name: 'Adicionar card' }),
    ).toHaveCount(0);
    expect((await api.board(produto.board.id)).cards).toHaveLength(2);
  });

  const cardId = (await api.board(produto.board.id)).cards.find(
    (card) => card.title === 'Escrever release notes',
  )?.id;
  if (!cardId) throw new Error('card não criado');
  await api.applyLabel(cardId, bug.id);

  await test.step('C2: detalhe edita título, descrição (Markdown sem HTML) e prazo', async () => {
    await page.reload();
    const dialog = await openCard(page, 'Escrever release notes');
    await expect(page).toHaveURL(new RegExp(`/b/${produto.board.id}/c/${cardId}$`));
    await expect(dialog.getByRole('navigation', { name: 'Local do card' })).toContainText(
      'A fazer',
    );

    await dialog.getByRole('button', { name: 'Editar título' }).click();
    const title = dialog.getByRole('textbox', { name: 'Título do card' });
    await title.fill('Publicar release notes');
    await title.press('Enter');
    const renamed = cardDialog(page, 'Publicar release notes');
    await expect(renamed).toBeVisible();

    await renamed.getByRole('button', { name: 'Adicionar descrição…' }).click();
    await renamed.getByRole('textbox', { name: 'Descrição' }).fill(XSS_DESCRIPTION);
    await renamed.getByRole('button', { name: 'Salvar', exact: true }).click();
    const description = renamed.getByRole('region', { name: 'Descrição' });
    await expect(description.getByText('Importante', { exact: true })).toBeVisible();
    await expect(description.locator('strong')).toHaveText('Importante');
    await expect(description.locator('script, img')).toHaveCount(0);
    await expect(description.getByRole('link', { name: /site/ })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(description.locator('a[href^="javascript"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: unknown }).__xss)).toBeUndefined();

    const due = localDue(3 * DAY_MS, false);
    await renamed.getByRole('button', { name: 'Definir prazo' }).click();
    await renamed.getByLabel('Data', { exact: true }).fill(due.date);
    await renamed.getByRole('button', { name: 'Salvar prazo' }).click();
    await expect(renamed.getByRole('button', { name: 'Alterar prazo' })).toBeVisible();

    // Depois de salvar o prazo o foco continua no diálogo: Esc fecha.
    await page.keyboard.press('Escape');
    await expect(renamed).toBeHidden();
    const card = (await api.board(produto.board.id)).cards.find((item) => item.id === cardId);
    expect(card).toMatchObject({ title: 'Publicar release notes', labelIds: [bug.id] });
    expect(card?.dueAt).not.toBeNull();
    await expect(cardFace(page, 'Publicar release notes')).toHaveAccessibleName(
      /Etiquetas: Bug\. Prazo .*Tem descrição$/,
    );
  });

  await test.step('C3: arrastar com o mouse para "Fazendo" (no mobile: "Mover para…")', async () => {
    if (isMobile) {
      await cardFace(page, 'Revisar changelog').focus();
      await page.keyboard.press('m');
      const move = page.getByRole('dialog', { name: 'Mover card' });
      await move.getByLabel('Lista').selectOption({ label: 'Fazendo' });
      await move.getByRole('button', { name: 'Mover' }).click();
      await expect(toast(page, 'Card movido para Fazendo, posição 1.')).toBeVisible();
    } else {
      await dragWithMouse(
        page,
        cardFace(page, 'Revisar changelog'),
        listColumn(page, 'Fazendo').getByRole('button', { name: 'Adicionar card' }),
      );
    }
    await expect.poll(() => cardTitlesOf(page, 'Fazendo')).toEqual(['Revisar changelog']);
    await expect.poll(() => cardTitlesOf(page, 'A fazer')).toEqual(['Publicar release notes']);
    const payload = await api.board(produto.board.id);
    expect(payload.cards.find((card) => card.title === 'Revisar changelog')?.listId).toBe(
      listByName(payload.lists, 'Fazendo').id,
    );
  });

  await test.step('C3: "Mover para…" pelo teclado para outro quadro avisa da etiqueta removida', async () => {
    await cardFace(page, 'Publicar release notes').focus();
    await page.keyboard.press('m');
    const move = page.getByRole('dialog', { name: 'Mover card' });
    await expect(move.getByLabel('Quadro')).toBeFocused();
    await move.getByLabel('Quadro').selectOption({ label: 'Marketing' });
    await expect(move.getByLabel('Lista')).toHaveValue(listByName(marketing.lists, 'A fazer').id);
    await expect(
      move.getByText('A etiqueta Bug não existe em Marketing e será removida do card.'),
    ).toBeVisible();
    await move.getByRole('button', { name: 'Mover' }).focus();
    await page.keyboard.press('Enter');
    await expect(toast(page, 'Card movido para Marketing. 1 etiqueta foi removida.')).toBeVisible();
    await expect(cardFace(page, 'Publicar release notes')).toHaveCount(0);

    const moved = (await api.board(marketing.board.id)).cards.find((card) => card.id === cardId);
    expect(moved).toMatchObject({
      boardId: marketing.board.id,
      listId: listByName(marketing.lists, 'A fazer').id,
      labelIds: [],
    });
  });

  await test.step('C12: histórico mostra criação, título, prazo e movimento entre quadros', async () => {
    await page
      .getByRole('region', { name: 'Avisos' })
      .getByRole('button', { name: 'Abrir' })
      .click();
    const dialog = cardDialog(page, 'Publicar release notes');
    await expect(dialog.getByRole('navigation', { name: 'Local do card' })).toContainText(
      'Marketing',
    );
    await dialog.getByRole('tab', { name: 'Histórico' }).click();
    const history = dialog.getByRole('list', { name: 'Histórico do card' });
    await expect(history.getByRole('listitem')).toHaveText([
      /^Ana Admin moveu para o quadro Marketing A fazer/,
      /^Ana Admin definiu o prazo para /,
      /^Ana Admin mudou o título de "Escrever release notes" para "Publicar release notes"/,
      /^Ana Admin criou o card em A fazer/,
    ]);
  });

  await test.step('C10: arquivar tira do quadro; restaurar pelo detalhe e por "Itens arquivados…"', async () => {
    const dialog = cardDialog(page, 'Publicar release notes');
    await dialog.getByRole('button', { name: 'Arquivar', exact: true }).click();
    await expect(toast(page, 'Card arquivado.')).toBeVisible();
    await expect(dialog.getByText('Este card está arquivado.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Restaurar', exact: true }).click();
    await expect(toast(page, 'Card restaurado no fim de A fazer.')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Concluir' })).toBeVisible();
    // O "Restaurar" some ao restaurar; o foco fica no diálogo e Esc fecha.
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    await openBoard(page, marketing.board.id, 'Marketing');
    await page.getByRole('button', { name: 'Ações do card Publicar release notes' }).click();
    await page.getByRole('menuitem', { name: 'Arquivar' }).click();
    await expect(toast(page, 'Card arquivado.')).toBeVisible();
    await expect(cardFace(page, 'Publicar release notes')).toHaveCount(0);

    await page.getByRole('button', { name: 'Opções do quadro' }).click();
    await page.getByRole('menuitem', { name: 'Itens arquivados…' }).click();
    const archived = page.getByRole('dialog', { name: 'Itens arquivados' });
    await archived.getByRole('button', { name: 'Restaurar card Publicar release notes' }).click();
    await expect(toast(page, 'Card restaurado no fim de A fazer.')).toBeVisible();
    await expect(archived.getByText('Nenhum card arquivado.')).toBeVisible();
    await archived.getByRole('button', { name: 'Fechar', exact: true }).last().click();
    await expect(cardFace(page, 'Publicar release notes')).toBeVisible();

    const types = (await api.activity(cardId)).map((item) => item.type);
    expect(types.filter((type) => type === 'card_archived')).toHaveLength(2);
    expect(types.filter((type) => type === 'card_restored')).toHaveLength(2);
  });
});
