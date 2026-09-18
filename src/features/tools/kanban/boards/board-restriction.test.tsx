import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../../../components/ui/toast-store';
import { MEMBER_ID } from '../../../../test/admin-handlers';
import { authHandlers } from '../../../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  memberSession,
  RESTRICTED_BOARD_ID,
  signInAsMember,
} from '../../../../test/board-handlers';
import { renderApp } from '../../../../test/render';
import { server } from '../../../../test/server';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

/** As rotas são lazy: carregar os módulos antes evita estourar o tempo do primeiro `findBy`. */
beforeAll(async () => {
  await import('./BoardPage');
  await import('./BoardsPage');
});

/** Entra como o Member Bruno Lima, que não está na lista do quadro "Diretoria". */
function signInWithoutAccess() {
  signInAsMember();
  server.use(authHandlers.me(memberSession));
}

const openBoardMenu = (user: User) =>
  user.click(screen.getByRole('button', { name: 'Opções do quadro' }));

async function openVisibilityDialog(user: User) {
  await screen.findByRole('heading', { level: 1, name: 'Marketing' });
  await openBoardMenu(user);
  await user.click(await screen.findByRole('menuitem', { name: 'Quem pode ver este quadro…' }));
  return screen.findByRole('dialog', { name: 'Quem pode ver este quadro' });
}

describe('Quadro restrito na lista de quadros', () => {
  it('mostra nome e cadeado, sem link para abrir', async () => {
    signInWithoutAccess();
    renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Quadros ativos' });
    // O quadro existe na lista, com o nome visível...
    const locked = within(grid).getByRole('button', {
      name: 'Quadro restrito: Diretoria. Você não tem acesso.',
    });
    expect(locked).toBeVisible();
    expect(within(locked).getByText('Quadro restrito')).toBeVisible();
    // ...mas não é link e não tem menu de ações.
    expect(within(grid).queryByRole('link', { name: /Diretoria/ })).not.toBeInTheDocument();
    expect(within(grid).queryByRole('button', { name: /Opções/ })).not.toBeInTheDocument();
  });

  it('acionar o quadro bloqueado explica o motivo e não navega', async () => {
    signInWithoutAccess();
    const user = userEvent.setup();
    const { router } = renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Quadros ativos' });
    await user.click(
      within(grid).getByRole('button', {
        name: 'Quadro restrito: Diretoria. Você não tem acesso.',
      }),
    );

    await waitFor(() =>
      expect(toastMessages().join(' ')).toContain('Só quem está na lista de acesso pode abrir'),
    );
    expect(router.state.location.pathname).toBe('/');
  });

  it('quem tem acesso continua abrindo o quadro pelo link', async () => {
    renderApp('/');

    const grid = await screen.findByRole('list', { name: 'Quadros ativos' });
    expect(within(grid).getByRole('link', { name: 'Diretoria' })).toHaveAttribute(
      'href',
      `/b/${RESTRICTED_BOARD_ID}`,
    );
  });
});

describe('Abrir um quadro restrito pela URL', () => {
  it('sem acesso, mostra o estado de bloqueio com caminho de volta', async () => {
    signInWithoutAccess();
    renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Você não tem acesso a este quadro' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Voltar para Quadros' })).toHaveAttribute('href', '/');
    // Nada do conteúdo do quadro aparece.
    expect(screen.queryByRole('list', { name: 'Listas do quadro' })).not.toBeInTheDocument();
  });

  it('o caminho de volta leva à lista de quadros', async () => {
    signInWithoutAccess();
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    await user.click(await screen.findByRole('link', { name: 'Voltar para Quadros' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });
});

describe('Quem pode ver este quadro', () => {
  it('restringe o quadro e já inclui quem restringiu', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openVisibilityDialog(user);
    expect(within(dialog).getByRole('radio', { name: /Visível para a equipe/ })).toBeChecked();

    await user.click(within(dialog).getByRole('radio', { name: /Restrito a pessoas específicas/ }));

    await waitFor(() => expect(toastMessages()).toContain('Quadro restrito. 1 pessoa tem acesso.'));
    expect(boardRequests('boards/visibility').at(-1)?.body).toEqual({ visibility: 'restricted' });
    expect(within(dialog).getByText(/continua aparecendo na lista de quadros/)).toBeVisible();
    // A pessoa que restringiu entra na lista de acesso (RN30).
    const people = within(dialog).getByRole('list', { name: 'Quem pode ver este quadro' });
    expect(within(people).getByText(/Ana Souza/)).toBeVisible();
    expect(within(dialog).getByText('Administradores sempre têm acesso.')).toBeVisible();
  });

  it('adiciona e remove pessoas da lista de acesso', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    const dialog = await openVisibilityDialog(user);
    await user.click(within(dialog).getByRole('radio', { name: /Restrito a pessoas específicas/ }));
    await waitFor(() => expect(boardRequests('boards/visibility')).toHaveLength(1));

    await user.click(within(dialog).getByRole('button', { name: 'Adicionar pessoa' }));
    await user.click(await screen.findByRole('button', { name: /Bruno Lima/ }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Bruno Lima agora tem acesso a este quadro.'),
    );
    expect(boardDb.boards.find((item) => item.id === BOARD_ID)?.viewerIds).toContain(MEMBER_ID);

    await user.click(within(dialog).getByRole('button', { name: 'Remover acesso de Bruno Lima' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Bruno Lima não tem mais acesso a este quadro.'),
    );
    expect(boardDb.boards.find((item) => item.id === BOARD_ID)?.viewerIds).not.toContain(MEMBER_ID);
  });

  /**
   * A lista pode ficar vazia (RN38): o quadro segue restrito, só Admins abrem, e o aviso diz o
   * que fazer. Quem se remove perde o acesso na hora e volta para a lista de quadros.
   */
  it('sair do quadro pede confirmação e leva de volta para Quadros', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    await screen.findByRole('heading', { level: 1, name: 'Diretoria' });
    await openBoardMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Quem pode ver este quadro…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quem pode ver este quadro' });

    await user.click(within(dialog).getByRole('button', { name: 'Remover acesso de Ana Souza' }));
    const confirm = await screen.findByRole('dialog', {
      name: 'Tirar o seu acesso a este quadro?',
    });
    await user.click(within(confirm).getByRole('button', { name: 'Sair do quadro' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Ana Souza não tem mais acesso a este quadro.'),
    );
    expect(boardDb.boards.find((item) => item.id === RESTRICTED_BOARD_ID)?.viewerIds).toEqual([]);
    // Ana é Admin, então continua enxergando o quadro; o retorno é só para quem perde o acesso.
    expect(router.state.location.pathname).toBe(`/b/${RESTRICTED_BOARD_ID}`);
  });

  it('lista de acesso vazia avisa o que fazer', async () => {
    boardDb.boards = boardDb.boards.map((board) =>
      board.id === RESTRICTED_BOARD_ID ? { ...board, viewerIds: [] } : board,
    );
    const user = userEvent.setup();
    renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    await screen.findByRole('heading', { level: 1, name: 'Diretoria' });
    await openBoardMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Quem pode ver este quadro…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quem pode ver este quadro' });

    expect(within(dialog).getByText(/está sem pessoas/)).toBeVisible();
    expect(dialog).toHaveTextContent('Você vê este quadro porque tem perfil de administração.');
  });

  it('volta para a equipe e limpa a lista de acesso', async () => {
    const user = userEvent.setup();
    renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    await screen.findByRole('heading', { level: 1, name: 'Diretoria' });
    await openBoardMenu(user);
    await user.click(await screen.findByRole('menuitem', { name: 'Quem pode ver este quadro…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Quem pode ver este quadro' });

    await user.click(within(dialog).getByRole('radio', { name: /Visível para a equipe/ }));

    await waitFor(() => expect(toastMessages()).toContain('Quadro visível para a equipe.'));
    const board = boardDb.boards.find((item) => item.id === RESTRICTED_BOARD_ID);
    expect(board?.visibility).toBe('team');
    expect(board?.viewerIds).toEqual([]);
  });

  it('o cabeçalho do quadro restrito traz a pílula com texto, não só o cadeado', async () => {
    renderApp(`/b/${RESTRICTED_BOARD_ID}`);

    await screen.findByRole('heading', { level: 1, name: 'Diretoria' });
    expect(screen.getByText('Quadro restrito')).toBeVisible();
  });
});
