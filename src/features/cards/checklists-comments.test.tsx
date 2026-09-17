import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { MEMBER_ID } from '../../test/admin-handlers';
import { apiErrorResponse, authHandlers, sessionFixture } from '../../test/auth-handlers';
import { BOARD_ID, boardDb, boardRequests, CARD_IDS, mockActor } from '../../test/board-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

type User = ReturnType<typeof userEvent.setup>;

const ME = sessionFixture.user.id;
const toastMessages = () => getToasts().map((item) => item.message);

beforeAll(async () => {
  await Promise.all([import('../boards/BoardPage'), import('./CardDetailRoute')]);
});

async function openBudget() {
  const utils = renderApp(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`);
  const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
  return { ...utils, dialog };
}

function budgetFace(): HTMLElement {
  const link = screen
    .getAllByRole('link')
    .find((item) => item.getAttribute('aria-label')?.startsWith('Revisar orçamento'));
  if (!link) throw new Error('Face não encontrada.');
  return link;
}

function itemTexts(dialog: HTMLElement, title: string): string[] {
  return within(within(dialog).getByRole('list', { name: `Itens de ${title}` }))
    .getAllByRole('checkbox')
    .map((box) => box.getAttribute('aria-label') ?? '');
}

async function createChecklist(user: User, dialog: HTMLElement, title: string, items: string[]) {
  await user.click(within(dialog).getByRole('button', { name: 'Adicionar checklist' }));
  const field = within(dialog).getByRole('textbox', { name: 'Título da checklist' });
  expect(field).toHaveValue('Checklist');
  await user.clear(field);
  await user.type(field, `${title}{Enter}`);
  await within(dialog).findByRole('heading', { level: 4, name: title });

  await user.click(within(dialog).getByRole('button', { name: `Adicionar item em ${title}` }));
  const itemField = within(dialog).getByRole('textbox', { name: `Novo item em ${title}` });
  for (const item of items) {
    await user.type(itemField, `${item}{Enter}`);
    expect(itemField).toHaveValue('');
    expect(itemField).toHaveFocus();
  }
  await waitFor(() => expect(itemTexts(dialog, title)).toEqual(items));
}

describe('Checklists (C7)', () => {
  it('cria, marca (sem concluir o card) e a face mostra x/y', async () => {
    const user = userEvent.setup();
    const { dialog } = await openBudget();

    await createChecklist(user, dialog, 'QA', ['Testar Chrome', 'Testar Safari']);
    expect(boardRequests('checklists/create')[0]?.body).toEqual({ title: 'QA' });
    expect(within(dialog).getByRole('progressbar', { name: 'Progresso de QA' })).toHaveAttribute(
      'aria-valuetext',
      '0 de 2',
    );

    await user.click(within(dialog).getByRole('checkbox', { name: 'Testar Chrome' }));

    await waitFor(() =>
      expect(boardRequests('checklist-items/update')[0]?.body).toEqual({ isChecked: true }),
    );
    expect(within(dialog).getByRole('progressbar', { name: 'Progresso de QA' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    await waitFor(() => expect(budgetFace()).toHaveAccessibleName(/Checklist 1 de 2/));

    await user.click(within(dialog).getByRole('checkbox', { name: 'Testar Safari' }));
    await waitFor(() => expect(budgetFace()).toHaveAccessibleName(/Checklist 2 de 2/));
    const card = boardDb.cards.find((item) => item.id === CARD_IDS.budget);
    expect(card?.status).toBe('open');
    expect(boardDb.activities).toEqual([]);
    expect(boardDb.checklists[0]?.items.every((item) => item.checkedBy === ME)).toBe(true);
  });

  it('reordena item pelo teclado, renomeia e exclui a checklist', async () => {
    const user = userEvent.setup();
    const { dialog } = await openBudget();
    await createChecklist(user, dialog, 'QA', ['Primeiro', 'Segundo', 'Terceiro']);

    within(dialog).getByRole('button', { name: 'Opções do item Terceiro' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Editar' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() =>
      expect(itemTexts(dialog, 'QA')).toEqual(['Primeiro', 'Terceiro', 'Segundo']),
    );
    const first = boardDb.checklists[0]?.items.find((item) => item.text === 'Primeiro');
    expect(boardRequests('checklist-items/move')[0]?.body).toEqual({
      placement: { type: 'after', id: first?.id },
    });
    expect(within(dialog).getByText('Item movido para a posição 2 de 3.')).toBeInTheDocument();

    within(dialog).getByRole('button', { name: 'Opções do item Segundo' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Mover para baixo' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await user.keyboard('{Escape}');

    await user.click(within(dialog).getByRole('button', { name: 'Opções da checklist QA' }));
    await user.click(screen.getByRole('menuitem', { name: 'Renomear' }));
    const title = within(dialog).getByRole('textbox', { name: 'Título da checklist' });
    await user.clear(title);
    await user.type(title, 'Revisão{Enter}');
    expect(await within(dialog).findByRole('heading', { level: 4, name: 'Revisão' })).toBeVisible();
    await waitFor(() =>
      expect(boardRequests('checklists/update')[0]?.body).toEqual({ title: 'Revisão' }),
    );

    await user.click(within(dialog).getByRole('button', { name: 'Opções da checklist Revisão' }));
    await user.click(screen.getByRole('menuitem', { name: 'Excluir checklist' }));
    const confirm = screen.getByRole('dialog', {
      name: 'Excluir a checklist "Revisão" e os 3 itens?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Excluir checklist' }));

    await waitFor(() =>
      expect(within(dialog).queryByRole('heading', { level: 4 })).not.toBeInTheDocument(),
    );
    expect(boardDb.checklists).toEqual([]);
    await waitFor(() => expect(budgetFace()).not.toHaveAccessibleName(/Checklist/));
  });

  it('item novo que falha volta para o campo', async () => {
    server.use(
      http.post('/api/checklists/:checklistId/items', () => apiErrorResponse('INTERNAL_ERROR')),
    );
    const user = userEvent.setup();
    const { dialog } = await openBudget();

    await user.click(within(dialog).getByRole('button', { name: 'Adicionar checklist' }));
    await user.keyboard('{Enter}');
    await within(dialog).findByRole('heading', { level: 4, name: 'Checklist' });
    await user.click(within(dialog).getByRole('button', { name: 'Adicionar item em Checklist' }));
    const field = within(dialog).getByRole('textbox', { name: 'Novo item em Checklist' });
    await user.type(field, 'Vai falhar{Enter}');

    await waitFor(() => expect(field).toHaveValue('Vai falhar'));
    expect(toastMessages()).toContain(
      'Não foi possível adicionar o item. O texto continua no campo.',
    );
    expect(
      within(dialog).queryByRole('list', { name: 'Itens de Checklist' }),
    ).not.toBeInTheDocument();
  });
});

describe('Comentários (C8)', () => {
  const T = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

  function seedComments() {
    boardDb.comments.push(
      {
        id: '66666666-6666-4666-8666-666666666666',
        cardId: CARD_IDS.budget,
        authorId: MEMBER_ID,
        body: 'Comentário do **Bruno**',
        editedAt: null,
        createdAt: T(120),
      },
      {
        id: '77777777-7777-4777-8777-777777777777',
        cardId: CARD_IDS.budget,
        authorId: ME,
        body: 'Meu comentário',
        editedAt: null,
        createdAt: T(30),
      },
    );
  }

  it('lista em ordem, cria com Ctrl+Enter e atualiza a contagem da face', async () => {
    seedComments();
    const user = userEvent.setup();
    const { dialog } = await openBudget();

    expect(within(dialog).getByRole('tab', { name: 'Comentários (2)' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const list = within(dialog).getByRole('list', { name: 'Comentários' });
    await within(list).findByText('Bruno Lima');
    const articles = within(list).getAllByRole('article');
    expect(articles[0]).toHaveAccessibleName(/^Bruno Lima há 2 h$/);
    expect(articles[0]).toHaveTextContent('Comentário do Bruno');
    expect(articles[1]).toHaveAccessibleName(/^Ana Souza há 30 min$/);
    expect(within(articles[0] as HTMLElement).getByText('Bruno').tagName).toBe('STRONG');

    const field = within(dialog).getByRole('textbox', { name: 'Novo comentário' });
    await user.type(field, 'Novo **texto**');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(within(list).getAllByRole('article')).toHaveLength(3));
    expect(boardRequests('comments/create')[0]?.body).toEqual({ body: 'Novo **texto**' });
    expect(field).toHaveValue('');
    expect(within(dialog).getByRole('tab', { name: 'Comentários (3)' })).toBeVisible();
    await waitFor(() => expect(budgetFace()).toHaveAccessibleName(/3 comentários/));
  });

  it('autor edita e exclui o próprio; Admin só exclui o dos outros', async () => {
    seedComments();
    const user = userEvent.setup();
    const { dialog } = await openBudget();

    await within(dialog).findByText('Bruno Lima');
    expect(
      within(dialog).queryByRole('button', { name: 'Editar comentário de Bruno Lima' }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Excluir comentário de Bruno Lima' }),
    ).toBeVisible();

    await user.click(
      within(dialog).getByRole('button', { name: 'Editar comentário de Ana Souza' }),
    );
    const editor = within(dialog).getByRole('textbox', { name: 'Editar comentário' });
    expect(editor).toHaveFocus();
    await user.clear(editor);
    await user.type(editor, 'Comentário revisado');
    await user.click(within(dialog).getByRole('button', { name: 'Salvar' }));

    expect(await within(dialog).findByText('Comentário revisado')).toBeVisible();
    expect(within(dialog).getByText('(editado)')).toBeVisible();
    expect(boardRequests('comments/update')[0]?.body).toEqual({ body: 'Comentário revisado' });

    await user.click(
      within(dialog).getByRole('button', { name: 'Excluir comentário de Bruno Lima' }),
    );
    const confirm = within(dialog).getByRole('group', { name: 'Confirmar exclusão' });
    expect(confirm).toHaveTextContent('Excluir este comentário?');
    await user.click(within(confirm).getByRole('button', { name: 'Excluir' }));

    await waitFor(() =>
      expect(within(dialog).queryByText(/Comentário do/)).not.toBeInTheDocument(),
    );
    expect(toastMessages()).toContain('Comentário excluído.');
    expect(boardDb.comments.map((comment) => comment.authorId)).toEqual([ME]);
  });

  it('Member não edita nem exclui comentário alheio', async () => {
    seedComments();
    mockActor.role = 'member';
    server.use(
      authHandlers.me({ ...sessionFixture, user: { ...sessionFixture.user, role: 'member' } }),
    );
    const { dialog } = await openBudget();

    const list = within(dialog).getByRole('list', { name: 'Comentários' });
    await within(list).findByText('Bruno Lima');
    expect(within(list).getAllByRole('article')).toHaveLength(2);
    expect(
      within(dialog).queryByRole('button', { name: /comentário de Bruno Lima/ }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: 'Excluir comentário de Ana Souza' }),
    ).toBeVisible();
  });

  it('Markdown sem HTML: script, onerror e javascript: não executam', async () => {
    boardDb.comments.push({
      id: '88888888-8888-4888-8888-888888888888',
      cardId: CARD_IDS.budget,
      authorId: MEMBER_ID,
      body: '<script>window.__xss=1</script>\n\n<img src=x onerror="window.__xss=2">\n\n[clique](javascript:window.__xss=3)',
      editedAt: null,
      createdAt: T(5),
    });
    const { dialog } = await openBudget();

    const list = within(dialog).getByRole('list', { name: 'Comentários' });
    expect(within(list).getByText(/<script>/)).toBeVisible();
    expect(list.querySelector('script, img, [onerror], a[href^="javascript"]')).toBeNull();
  });

  it('erro ao enviar mantém o texto no campo', async () => {
    server.use(http.post('/api/cards/:cardId/comments', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    const { dialog } = await openBudget();

    expect(within(dialog).getByText('Nenhum comentário ainda.')).toBeVisible();
    const field = within(dialog).getByRole('textbox', { name: 'Novo comentário' });
    await user.click(within(dialog).getByRole('button', { name: 'Comentar' }));
    expect(within(dialog).getByText('O comentário não pode ficar vazio.')).toBeVisible();

    await user.type(field, 'Não vai');
    await user.click(within(dialog).getByRole('button', { name: 'Comentar' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Não foi possível enviar o comentário. Tente de novo.'),
    );
    expect(field).toHaveValue('Não vai');
  });
});
