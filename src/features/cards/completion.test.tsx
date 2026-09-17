import type { BoardPayload } from '@raphasparda/ronin-shared';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { apiErrorResponse } from '../../test/auth-handlers';
import { BOARD_ID, boardDb, boardRequests, CARD_IDS, LIST_IDS } from '../../test/board-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';
import { boardQueryKey } from '../boards/boards-api';
import { cardsInList } from './cards-api';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

beforeAll(async () => {
  await Promise.all([import('../boards/BoardPage'), import('./CardDetailRoute')]);
});

async function cardTitles(listName: string): Promise<string[]> {
  const list = await screen.findByRole('list', { name: `Cards de ${listName}` });
  return within(list)
    .queryAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

function queryCardTitles(listName: string): string[] {
  const list = screen.queryByRole('list', { name: `Cards de ${listName}` });
  if (!list) return [];
  return within(list)
    .queryAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

async function faceAction(user: User, title: string, action: 'Concluir' | 'Reabrir') {
  await user.click(await screen.findByRole('button', { name: `Ações do card ${title}` }));
  await user.click(screen.getByRole('menuitem', { name: action }));
}

function putCard(cardId: string, changes: Partial<(typeof boardDb.cards)[number]>) {
  boardDb.cards = boardDb.cards.map((card) =>
    card.id === cardId ? { ...card, ...changes } : card,
  );
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('Concluir e reabrir no detalhe (screens §8.3)', () => {
  it('concluir move para o fim de Concluído, mostra quem concluiu e foca "Reabrir"', async () => {
    const user = userEvent.setup();
    const { queryClient } = renderApp(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`);

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Concluir' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Card concluído e movido para Concluído.'),
    );
    expect(dialog).toHaveTextContent('Card concluído e movido para Concluído.');
    const location = within(dialog).getByRole('navigation', { name: 'Local do card' });
    expect(location).toHaveTextContent('Concluído (lista de conclusão)');
    expect(dialog).toHaveTextContent(/por Ana Souza em \d+ \w+, \d{2}:\d{2}/);
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Reabrir' })).toHaveFocus(),
    );
    expect(boardRequests('cards/complete')).toHaveLength(1);

    const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(BOARD_ID));
    const done = cardsInList(payload?.cards ?? [], LIST_IDS.done);
    expect(done.at(-1)).toMatchObject({ id: CARD_IDS.budget, status: 'completed' });
  });

  it('reabrir a partir de Concluído leva ao topo da primeira lista e o diálogo continua aberto', async () => {
    putCard(CARD_IDS.budget, {
      listId: LIST_IDS.done,
      status: 'completed',
      completedAt: '2026-09-16T17:30:00.000Z',
    });
    putCard(CARD_IDS.campaign, { listId: LIST_IDS.todo });
    const user = userEvent.setup();
    const { queryClient, router } = renderApp(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`);

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Card reaberto e movido para o topo de A fazer.'),
    );
    expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`);
    expect(within(dialog).getByRole('navigation', { name: 'Local do card' })).toHaveTextContent(
      'A fazer',
    );
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Concluir' })).toHaveFocus(),
    );

    const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(BOARD_ID));
    expect(cardsInList(payload?.cards ?? [], LIST_IDS.todo).map((card) => card.id)).toEqual([
      CARD_IDS.budget,
      CARD_IDS.campaign,
    ]);
    expect(await cardTitles('A fazer')).toEqual(['Revisar orçamento', 'Publicar campanha']);
  });

  it('enquanto reabre, o botão mostra "Reabrindo…"', async () => {
    const gate = deferred();
    server.use(
      http.post('/api/cards/:cardId/reopen', async () => {
        await gate.promise;
        return apiErrorResponse('INTERNAL_ERROR');
      }),
    );
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}/c/${CARD_IDS.report}`);

    const dialog = await screen.findByRole('dialog', { name: 'Fechar relatório' });
    await user.click(within(dialog).getByRole('button', { name: 'Reabrir' }));
    expect(await within(dialog).findByRole('button', { name: 'Reabrindo…' })).toBeDisabled();

    gate.resolve();
    await waitFor(() =>
      expect(toastMessages()).toContain('Não foi possível reabrir o card. Tente de novo.'),
    );
    expect(within(dialog).getByRole('button', { name: 'Reabrir' })).toBeEnabled();
  });

  it('card arquivado não mostra Concluir', async () => {
    putCard(CARD_IDS.budget, { archivedAt: '2026-09-16T17:30:00.000Z' });
    renderApp(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`);

    const dialog = await screen.findByRole('dialog', { name: 'Revisar orçamento' });
    expect(dialog).toHaveTextContent('Este card está arquivado.');
    expect(within(dialog).queryByRole('button', { name: 'Concluir' })).not.toBeInTheDocument();
  });
});

describe('Concluir e reabrir pelo menu da face (screens §0.3)', () => {
  it('é otimista: vai para Concluído na hora e volta se o servidor falha', async () => {
    const gate = deferred();
    server.use(
      http.post('/api/cards/:cardId/complete', async () => {
        await gate.promise;
        return apiErrorResponse('INTERNAL_ERROR');
      }),
    );
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await faceAction(user, 'Publicar campanha', 'Concluir');

    await waitFor(async () => expect(await cardTitles('Concluído')).toEqual(['Publicar campanha']));
    expect(
      screen.getByRole('link', { name: 'Publicar campanha. Concluído. Tem descrição' }),
    ).toBeVisible();

    gate.resolve();
    await waitFor(() =>
      expect(toastMessages()).toContain('Não foi possível concluir o card. Tente de novo.'),
    );
    await waitFor(async () =>
      expect(await cardTitles('Fazendo')).toEqual([
        'Revisar orçamento',
        'Publicar campanha',
        'Fechar relatório',
      ]),
    );
    expect(queryCardTitles('Concluído')).toEqual([]);
  });

  it('quadro sem lista de conclusão: conclui e reabre sem mover', async () => {
    boardDb.lists = boardDb.lists.map((list) =>
      list.id === LIST_IDS.done ? { ...list, isDoneList: false } : list,
    );
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await faceAction(user, 'Revisar orçamento', 'Concluir');
    await waitFor(() => expect(toastMessages()).toContain('Card concluído.'));
    expect(
      await screen.findByRole('link', {
        name: 'Revisar orçamento. Etiquetas: Financeiro. Concluído',
      }),
    ).toBeVisible();
    expect(await cardTitles('Fazendo')).toEqual([
      'Revisar orçamento',
      'Publicar campanha',
      'Fechar relatório',
    ]);
    expect(
      screen.getByText('Card concluído.', { selector: '[aria-live] *, [aria-live]' }),
    ).toBeInTheDocument();

    await faceAction(user, 'Revisar orçamento', 'Reabrir');
    await waitFor(() => expect(toastMessages()).toContain('Card reaberto.'));
    expect(await cardTitles('Fazendo')).toEqual([
      'Revisar orçamento',
      'Publicar campanha',
      'Fechar relatório',
    ]);
  });

  it('reabrir em Concluído sem outra lista avisa que o card continua lá', async () => {
    boardDb.lists = boardDb.lists.map((list) =>
      list.id === LIST_IDS.todo || list.id === LIST_IDS.doing
        ? { ...list, archivedAt: '2026-09-16T17:30:00.000Z' }
        : list,
    );
    putCard(CARD_IDS.report, { listId: LIST_IDS.done });
    const user = userEvent.setup();
    renderApp(`/b/${BOARD_ID}`);

    await faceAction(user, 'Fechar relatório', 'Reabrir');

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Card reaberto. Ele continua em Concluído porque o quadro não tem outra lista.',
      ),
    );
    expect(await cardTitles('Concluído')).toEqual(['Fechar relatório']);
  });

  it('reabrir movido oferece "Ver card"', async () => {
    putCard(CARD_IDS.report, { listId: LIST_IDS.done });
    const user = userEvent.setup();
    const { router } = renderApp(`/b/${BOARD_ID}`);

    await faceAction(user, 'Fechar relatório', 'Reabrir');

    await waitFor(() =>
      expect(toastMessages()).toContain('Card reaberto e movido para o topo de A fazer.'),
    );
    expect(await cardTitles('A fazer')).toEqual(['Fechar relatório']);
    await user.click(screen.getByRole('button', { name: 'Ver card' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}/c/${CARD_IDS.report}`),
    );
  });
});
