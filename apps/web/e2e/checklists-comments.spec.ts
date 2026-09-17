// Fatia 6 (tarefa 6.6): C7 (checklist) e C8 (comentários), docs/product/scope.md.
import { listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, seedTeam } from './support/seed';
import { cardFace, closeCard, openBoard, openCard, openMenu } from './support/ui';

const XSS_COMMENT =
  'Olha isso: <script>window.__xss = 1</script> <img src="x" onerror="window.__xss = 2"> [clique](javascript:window.__xss=3)';

test('checklist completo não conclui o card; comentários com autor, edição, exclusão por autor/Admin e sem XSS', async ({
  page,
  openAs,
  apiAs,
}) => {
  const team = await seedTeam({ ana: ANA, bruno: BRUNO });
  const anaApi = await apiAs(team.ana);
  const brunoApi = await apiAs(team.bruno);
  const { board, lists } = await anaApi.createBoard('Obra');
  const card = await anaApi.createCard(listByName(lists, 'A fazer').id, 'Pintar a sala');

  await signIn(page.context(), team.bruno);
  await openBoard(page, board.id, 'Obra');
  let dialog = await openCard(page, 'Pintar a sala');

  await test.step('C7: criar checklist e itens com Enter; progresso x/y no detalhe', async () => {
    await dialog.getByRole('button', { name: 'Adicionar checklist' }).click();
    await expect(dialog.getByLabel('Título da checklist')).toHaveValue('Checklist');
    await dialog.getByLabel('Título da checklist').fill('Materiais');
    await dialog.getByRole('button', { name: 'Criar checklist' }).click();
    await dialog.getByRole('button', { name: 'Adicionar item em Materiais' }).click();
    const field = dialog.getByRole('textbox', { name: 'Novo item em Materiais' });
    await field.fill('Comprar tinta');
    await field.press('Enter');
    await expect(field).toHaveValue('');
    await field.fill('Lixar parede');
    await field.press('Enter');
    await field.press('Escape');
    const items = dialog.getByRole('list', { name: 'Itens de Materiais' });
    await expect(items.getByRole('checkbox')).toHaveCount(2);
    const progress = dialog.getByRole('progressbar', { name: 'Progresso de Materiais' });
    await expect(progress).toHaveAttribute('aria-valuetext', '0 de 2');

    await items.getByRole('checkbox', { name: 'Comprar tinta' }).click();
    await expect(items.getByRole('checkbox', { name: 'Comprar tinta' })).toBeChecked();
    await expect(progress).toHaveAttribute('aria-valuetext', '1 de 2');
  });

  await test.step('C7: reordenar item pelo menu', async () => {
    const menu = await openMenu(page, 'Opções do item Lixar parede');
    await menu.getByRole('menuitem', { name: 'Mover para cima' }).click();
    const checkboxes = dialog
      .getByRole('list', { name: 'Itens de Materiais' })
      .getByRole('checkbox');
    await expect(checkboxes.first()).toHaveAccessibleName('Lixar parede');
    await expect(checkboxes.last()).toHaveAccessibleName('Comprar tinta');
  });

  await test.step('C7: face mostra x/y; marcar tudo não conclui o card', async () => {
    await closeCard(dialog);
    await expect(cardFace(page, 'Pintar a sala')).toHaveAccessibleName(/Checklist 1 de 2/);
    dialog = await openCard(page, 'Pintar a sala');
    await dialog.getByRole('checkbox', { name: 'Lixar parede' }).click();
    await expect(dialog.getByRole('checkbox', { name: 'Lixar parede' })).toBeChecked();
    await expect(
      dialog.getByRole('progressbar', { name: 'Progresso de Materiais' }),
    ).toHaveAttribute('aria-valuetext', '2 de 2');
    await expect(dialog.getByRole('button', { name: 'Concluir' })).toBeVisible();
    const payload = await anaApi.board(board.id);
    expect(payload.cards[0]).toMatchObject({ status: 'open', checklist: { done: 2, total: 2 } });
    expect((await anaApi.activity(card.id)).map((item) => item.type)).toEqual(['card_created']);
  });

  await test.step('C8: autor comenta com Markdown, edita (marca "editado") e HTML/javascript: não executam', async () => {
    const box = dialog.getByRole('textbox', { name: 'Novo comentário' });
    await box.fill('Primeira **demão** feita');
    await dialog.getByRole('button', { name: 'Comentar' }).click();
    const comments = dialog.getByRole('list', { name: 'Comentários' });
    await expect(comments.getByRole('article')).toHaveCount(1);
    await expect(comments.getByRole('article').first()).toContainText('Bruno Membro');
    await expect(comments.locator('strong', { hasText: 'demão' })).toBeVisible();
    await expect(box).toHaveValue('');

    await dialog.getByRole('button', { name: 'Editar comentário de Bruno Membro' }).click();
    const edit = dialog.getByRole('textbox', { name: 'Editar comentário' });
    await edit.fill('Primeira demão feita, falta a segunda');
    await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(comments.getByRole('article').first()).toContainText('(editado)');
    await expect(comments).toContainText('falta a segunda');

    await box.fill(XSS_COMMENT);
    await box.press('Control+Enter');
    await expect(comments.getByRole('article')).toHaveCount(2);
    await expect(comments.getByRole('article').nth(1)).toContainText('Olha isso:');
    await expect(comments.locator('script, img')).toHaveCount(0);
    await expect(comments.locator('a[href^="javascript"]')).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: unknown }).__xss)).toBeUndefined();
    await expect(dialog.getByRole('tab', { name: 'Comentários (2)' })).toBeVisible();
  });

  const anaComment = await anaApi.comment(card.id, 'Comentário da Ana');
  const brunoComments = (
    await brunoApi.get<{ card: { comments: { id: string; authorId: string }[] } }>(
      `/api/cards/${card.id}`,
    )
  ).card.comments.filter((comment) => comment.authorId === team.bruno.id);

  await test.step('C8: Member não edita nem exclui comentário alheio (UI e API 403)', async () => {
    await page.reload();
    dialog = page.getByRole('dialog', { name: 'Pintar a sala', exact: true });
    const comments = dialog.getByRole('list', { name: 'Comentários' });
    await expect(comments.getByRole('article')).toHaveCount(3);
    await expect(
      dialog.getByRole('button', { name: 'Editar comentário de Ana Admin' }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole('button', { name: 'Excluir comentário de Ana Admin' }),
    ).toHaveCount(0);
    expect((await brunoApi.http.delete(`/api/comments/${anaComment.id}`)).status()).toBe(403);
    expect(
      (
        await brunoApi.http.patch(`/api/comments/${anaComment.id}`, { data: { body: 'mudei' } })
      ).status(),
    ).toBe(403);
  });

  await test.step('C8: Admin exclui comentário de outra pessoa, mas não edita (UI e API)', async () => {
    const ana = await openAs(team.ana);
    await ana.goto(`/b/${board.id}/c/${card.id}`);
    const anaDialog = ana.getByRole('dialog', { name: 'Pintar a sala', exact: true });
    const comments = anaDialog.getByRole('list', { name: 'Comentários' });
    await expect(comments.getByRole('article')).toHaveCount(3);
    await expect(
      anaDialog.getByRole('button', { name: 'Editar comentário de Bruno Membro' }),
    ).toHaveCount(0);
    await expect(
      anaDialog.getByRole('button', { name: 'Editar comentário de Ana Admin' }),
    ).toBeVisible();
    const firstBruno = brunoComments[0];
    if (!firstBruno) throw new Error('comentário do Bruno não encontrado');
    expect(
      (
        await anaApi.http.patch(`/api/comments/${firstBruno.id}`, {
          data: { body: 'Admin editando' },
        })
      ).status(),
    ).toBe(403);

    await anaDialog
      .getByRole('button', { name: 'Excluir comentário de Bruno Membro' })
      .first()
      .click();
    const confirm = anaDialog.getByRole('group', { name: 'Confirmar exclusão' });
    await confirm.getByRole('button', { name: 'Excluir', exact: true }).click();
    // Sem conferir o toast "Comentário excluído.": ele não aparece (BUG em integration-bugs.spec.ts).
    await expect(comments.getByRole('article')).toHaveCount(2);
    await expect(comments).not.toContainText('falta a segunda');
  });

  await test.step('C8: autor exclui o próprio comentário; contador na face acompanha', async () => {
    await page.reload();
    dialog = page.getByRole('dialog', { name: 'Pintar a sala', exact: true });
    const comments = dialog.getByRole('list', { name: 'Comentários' });
    await expect(comments.getByRole('article')).toHaveCount(2);
    await dialog.getByRole('button', { name: 'Excluir comentário de Bruno Membro' }).click();
    await dialog
      .getByRole('group', { name: 'Confirmar exclusão' })
      .getByRole('button', { name: 'Excluir', exact: true })
      .click();
    await expect(comments.getByRole('article')).toHaveCount(1);
    await closeCard(dialog);
    await expect(cardFace(page, 'Pintar a sala')).toHaveAccessibleName(
      /Checklist 2 de 2\. 1 comentário/,
    );
  });
});
