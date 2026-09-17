// Regressões dos bugs encontrados na integração (web + API reais), já corrigidos. Cada teste
// reproduz o cenário original e confere o comportamento esperado.
import { cardIdsInList, listByName } from './support/api';
import { expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, CARLA, seedTeam } from './support/seed';
import { cardDialog, DAY_MS, localDue, toast } from './support/ui';

test.describe('mobile', () => {
  test('mobile: quadro com 3 listas cabe na largura do celular (sem zoom-out da página)', async ({
    page,
    apiAs,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Só com viewport de celular.');
    // Os `sr-only` (position: absolute) do cabeçalho da lista escapavam do contêiner com overflow-x
    // por não terem ancestral posicionado, e o documento ficava com ~1089 px (página reduzida).
    const team = await seedTeam({ ana: ANA });
    const api = await apiAs(team.ana);
    const { board } = await api.createBoard('Largura');
    await signIn(page.context(), team.ana);
    await page.goto(`/b/${board.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Largura' })).toBeVisible();
    const size = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
    }));
    expect(size).toEqual({ scroll: 412, inner: 412 });
  });

  test('mobile: "Adicionar responsável" deixa tocar em qualquer pessoa', async ({
    page,
    apiAs,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Só com viewport de celular.');
    // O painel abria abaixo da tela (sem ajustar à viewport) e fechava em qualquer rolagem.
    const team = await seedTeam({ ana: ANA, bruno: BRUNO, carla: CARLA });
    const api = await apiAs(team.ana);
    const { board, lists } = await api.createBoard('Mobile');
    const card = await api.createCard(listByName(lists, 'A fazer').id, 'Card no celular');
    await signIn(page.context(), team.ana);
    await page.goto(`/b/${board.id}/c/${card.id}`);
    const dialog = cardDialog(page, 'Card no celular');
    await dialog.getByRole('button', { name: 'Adicionar', exact: true }).tap();
    const picker = page.getByRole('group', { name: 'Adicionar responsável' });
    const panel = await picker.boundingBox();
    const viewport = page.viewportSize();
    expect(panel && viewport).toBeTruthy();
    if (panel && viewport) {
      expect(panel.y).toBeGreaterThanOrEqual(0);
      expect(panel.y + panel.height).toBeLessThanOrEqual(viewport.height);
    }
    await picker.getByRole('checkbox', { name: 'Carla Costa' }).tap({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: 'Remover Carla Costa' })).toBeVisible();
    // Rolar o detalhe não fecha o painel: ele acompanha o botão.
    await dialog
      .locator('.overflow-y-auto')
      .first()
      .evaluate((element) => {
        element.scrollTop -= 40;
      });
    await expect(picker).toBeVisible();
    await picker.getByRole('checkbox', { name: 'Bruno Membro' }).tap({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: 'Remover Bruno Membro' })).toBeVisible();
  });
});

test('detalhe do card: depois de "Salvar prazo" o foco continua no diálogo e Esc fecha', async ({
  page,
  apiAs,
}) => {
  // O formulário do prazo desmontava com o foco dentro; o foco caía no <body> e Esc não fechava.
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Foco');
  const card = await api.createCard(listByName(lists, 'A fazer').id, 'Card com prazo');
  await signIn(page.context(), team.ana);
  await page.goto(`/b/${board.id}/c/${card.id}`);
  const dialog = cardDialog(page, 'Card com prazo');
  await dialog.getByRole('button', { name: 'Definir prazo' }).click();
  await dialog.getByLabel('Data', { exact: true }).fill(localDue(2 * DAY_MS, false).date);
  await dialog.getByRole('button', { name: 'Salvar prazo' }).click();
  await expect(dialog.getByRole('button', { name: 'Alterar prazo' })).toBeVisible();
  expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden({ timeout: 3_000 });
});

test('detalhe do card: botão de fechar tem nome acessível no desktop', async ({
  page,
  apiAs,
  isMobile,
}) => {
  test.skip(isMobile, 'No mobile o botão se chama "Voltar" e funciona.');
  // O texto "Fechar" usava `hidden sm:sr-only` e ficava com display: none também no desktop.
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Fechar');
  const card = await api.createCard(listByName(lists, 'A fazer').id, 'Card para fechar');
  await signIn(page.context(), team.ana);
  await page.goto(`/b/${board.id}/c/${card.id}`);
  const dialog = cardDialog(page, 'Card para fechar');
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeVisible({
    timeout: 3_000,
  });
});

test('comentário: excluir mostra "Comentário excluído." (e avisaria se falhasse)', async ({
  page,
  apiAs,
}) => {
  // A exclusão otimista desmontava o comentário antes dos callbacks do `mutate()`: sem toast de
  // sucesso nem de erro.
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Comentários');
  const card = await api.createCard(listByName(lists, 'A fazer').id, 'Card comentado');
  await api.comment(card.id, 'Vou sumir');
  await signIn(page.context(), team.ana);
  await page.goto(`/b/${board.id}/c/${card.id}`);
  const dialog = cardDialog(page, 'Card comentado');
  await dialog.getByRole('button', { name: 'Excluir comentário de Ana Admin' }).click();
  await dialog
    .getByRole('group', { name: 'Confirmar exclusão' })
    .getByRole('button', { name: 'Excluir', exact: true })
    .click();
  await expect(dialog.getByText('Nenhum comentário ainda.')).toBeVisible();
  await expect(toast(page, 'Comentário excluído.')).toBeVisible({ timeout: 3_000 });
});

test('Meus cards: "Desfazer" a conclusão devolve o card à posição de antes na lista', async ({
  page,
  apiAs,
}) => {
  // O reopen põe o card no topo da primeira lista; quando essa já era a lista original, o
  // "Desfazer" o deixava no topo.
  const team = await seedTeam({ ana: ANA });
  const api = await apiAs(team.ana);
  const { board, lists } = await api.createBoard('Desfazer');
  const todo = listByName(lists, 'A fazer');
  for (const title of ['Primeiro', 'Segundo', 'Terceiro']) {
    const card = await api.createCard(todo.id, title);
    await api.assign(card.id, team.ana.id);
  }
  const before = cardIdsInList(await api.board(board.id), todo.id);

  await signIn(page.context(), team.ana);
  await page.goto('/meus-cards');
  await page.getByRole('button', { name: 'Concluir Segundo' }).click();
  await page
    .getByRole('region', { name: 'Avisos' })
    .getByRole('button', { name: 'Desfazer' })
    .click();
  await expect(toast(page, 'Conclusão desfeita. O card voltou para A fazer.')).toBeVisible();
  expect(cardIdsInList(await api.board(board.id), todo.id)).toEqual(before);
});
