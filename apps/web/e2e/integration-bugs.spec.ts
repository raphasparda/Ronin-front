// Regressões dos bugs encontrados na integração (web + API reais). Cada teste descreve o
// comportamento esperado e está marcado com `test.fail()` enquanto o bug existir (rode com
// `E2E_SHOW_BUGS=1` para ver a falha real). Quando a correção entrar, o Playwright acusa "passou inesperadamente" e o `test.fail()` deve sair.
import { cardIdsInList, listByName } from './support/api';
import { applyMobileOverflowWorkaround, expect, signIn, test } from './support/fixtures';
import { ANA, BRUNO, CARLA, seedTeam } from './support/seed';
import { cardDialog, DAY_MS, localDue, toast } from './support/ui';

/** `E2E_SHOW_BUGS=1` roda sem `test.fail()` para ver o erro real de cada bug. */
const KNOWN_BUG = process.env.E2E_SHOW_BUGS !== '1';

test.describe('sem contorno', () => {
  test.use({ mobileOverflowWorkaround: false });

  test('mobile: quadro com 3 listas cabe na largura do celular (sem zoom-out da página)', async ({
    page,
    apiAs,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Só com viewport de celular.');
    // BUG: os `sr-only` (position: absolute) do cabeçalho da lista, "(lista de conclusão)" e
    // " cards" (src/features/boards/ListColumn.tsx:142 e :147), não têm ancestral posicionado dentro
    // do contêiner com overflow-x (BoardLists.tsx:733). Eles escapam do recorte e alargam o
    // documento para ~1089 px; o Chrome mobile reduz a página inteira (o detalhe do card, que é
    // `fixed inset-0`, também fica com 1089 px e o conteúdo sai da tela). Com
    // `section { position: relative }` a largura volta a 412 px.
    test.fail(KNOWN_BUG);
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
    // BUG: o painel do Popover (src/components/ui/Popover.tsx:81) é `fixed` em `rect.bottom + 8`,
    // sem ajustar para caber na tela, e fecha em qualquer `scroll` fora dele (Popover.tsx:56-62).
    // No detalhe em tela cheia o botão fica no fim do conteúdo: as pessoas ficam abaixo da tela e
    // rolar fecha o painel. Só dá para atribuir outra pessoa pelo teclado. Independe do bug de
    // largura acima (com a largura corrigida por CSS, o toque continua falhando).
    await applyMobileOverflowWorkaround(page);
    test.fail(KNOWN_BUG);
    const team = await seedTeam({ ana: ANA, bruno: BRUNO, carla: CARLA });
    const api = await apiAs(team.ana);
    const { board, lists } = await api.createBoard('Mobile');
    const card = await api.createCard(listByName(lists, 'A fazer').id, 'Card no celular');
    await signIn(page.context(), team.ana);
    await page.goto(`/b/${board.id}/c/${card.id}`);
    const dialog = cardDialog(page, 'Card no celular');
    await dialog.getByRole('button', { name: 'Adicionar', exact: true }).tap();
    const picker = page.getByRole('group', { name: 'Adicionar responsável' });
    await picker.getByRole('checkbox', { name: 'Carla Costa' }).tap({ timeout: 5_000 });
    await expect(dialog.getByRole('button', { name: 'Remover Carla Costa' })).toBeVisible();
  });
});

test('detalhe do card: depois de "Salvar prazo" o foco continua no diálogo e Esc fecha', async ({
  page,
  apiAs,
}) => {
  // BUG: ao salvar (ou cancelar) o prazo, o formulário é desmontado sem devolver o foco
  // (src/features/cards/CardFields.tsx:279, setEditing(false)); o foco cai no <body>, fora do
  // diálogo, então Esc não fecha o detalhe e o Tab sai do foco preso (Dialog.tsx:942-965).
  test.fail(KNOWN_BUG);
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
  // BUG: o texto "Fechar" usa `hidden sm:sr-only` (src/features/cards/CardDetailRoute.tsx:68):
  // `hidden` (display: none) continua valendo a partir de `sm`, e "Voltar" é `sm:hidden`. No
  // desktop o botão só tem o ícone `aria-hidden`: fica sem nome para leitor de tela (WCAG 4.1.2).
  test.fail(KNOWN_BUG);
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
  // BUG: a exclusão é otimista (src/features/cards/comments-api.ts:76-81) e tira o comentário da
  // lista antes da resposta; o CommentItem desmonta e os callbacks passados ao `mutate()`
  // (CardComments.tsx:771-774, toast de sucesso e `handleError`) não rodam. Não há confirmação
  // e, se a API falhar, o comentário volta sem nenhuma mensagem de erro.
  test.fail(KNOWN_BUG);
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
  // BUG: `moveBack` (src/features/cards/use-card-actions.ts:718) considera o card "de volta" só
  // porque a lista é a mesma. O reopen do servidor põe o card no TOPO da primeira lista; quando essa
  // já era a lista original, o card fica no topo em vez de voltar ao lugar de antes, apesar do
  // toast "Conclusão desfeita. O card voltou para A fazer.".
  test.fail(KNOWN_BUG);
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
