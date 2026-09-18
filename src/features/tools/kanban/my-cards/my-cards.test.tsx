import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { getToasts } from '../../../../components/ui/toast-store';
import { apiErrorResponse, sessionFixture } from '../../../../test/auth-handlers';
import {
  BOARD_ID,
  boardDb,
  boardRequests,
  CARD_IDS,
  LIST_IDS,
  type CardRecord,
} from '../../../../test/board-handlers';
import { renderApp } from '../../../../test/render';
import { server } from '../../../../test/server';
import { MY_CARDS_POLL_INTERVAL_MS } from './my-cards-api';

const NOW = new Date('2026-09-16T15:00:00.000Z');
const HOUR = 60 * 60 * 1000;
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs).toISOString();
const ME = sessionFixture.user.id;

const toastMessages = () => getToasts().map((item) => item.message);

beforeAll(async () => {
  await Promise.all([
    import('./MyCardsPage'),
    import('../boards/BoardPage'),
    import('../cards/CardDetailRoute'),
  ]);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function addCard(title: string, changes: Partial<CardRecord>): CardRecord {
  const base = boardDb.cards.find((card) => card.id === CARD_IDS.budget) as CardRecord;
  const card: CardRecord = {
    ...base,
    id: crypto.randomUUID(),
    title,
    listId: LIST_IDS.todo,
    labelIds: [],
    assigneeIds: [ME],
    ...changes,
  };
  boardDb.cards.push(card);
  return card;
}

function groupTitles(name: string): string[] {
  const list = screen.getByRole('list', { name });
  return within(list)
    .getAllByRole('link')
    .map((link) => link.getAttribute('aria-label')?.split('. ')[0] ?? '');
}

describe('Meus cards (/meus-cards)', () => {
  it('agrupa nos limites de prazo, com contagem no título do grupo', async () => {
    addCard('Venceu há 1 ms', { dueAt: at(-1), dueHasTime: true });
    addCard('Vence em 24h exatas', { dueAt: at(24 * HOUR), dueHasTime: true });
    addCard('Vence em 24h e 1 ms', { dueAt: at(24 * HOUR + 1), dueHasTime: true });
    addCard('Vence agora', { dueAt: at(0), dueHasTime: true });
    addCard('Sem prazo', { dueAt: null });
    addCard('De outra pessoa', { dueAt: null, assigneeIds: [] });
    addCard('Já concluído', { dueAt: null, status: 'completed', completedAt: at(-HOUR) });

    renderApp('/meus-cards');

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Atrasados, 1 card' }),
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Vencendo (24h), 2 cards' }),
    ).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Com prazo, 1 card' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 2, name: 'Sem prazo, 1 card' })).toBeVisible();

    expect(groupTitles('Atrasados')).toEqual(['Venceu há 1 ms']);
    expect(groupTitles('Vencendo (24h)')).toEqual(['Vence agora', 'Vence em 24h exatas']);
    expect(groupTitles('Com prazo')).toEqual(['Vence em 24h e 1 ms']);
    expect(groupTitles('Sem prazo')).toEqual(['Sem prazo']);
    expect(screen.queryByText('De outra pessoa')).not.toBeInTheDocument();
    expect(screen.queryByText('Já concluído')).not.toBeInTheDocument();
    expect(MY_CARDS_POLL_INTERVAL_MS).toBe(60_000);
  });

  it('dentro de "Sem prazo" a ordem é por prioridade; a linha leva ao card com a lista em texto', async () => {
    addCard('Baixa', { priority: 'low', dueAt: null });
    addCard('Sem prioridade', { priority: null, dueAt: null });
    const urgent = addCard('Urgente', { priority: 'urgent', dueAt: null, listId: LIST_IDS.doing });
    addCard('Média', { priority: 'medium', dueAt: null });
    const user = userEvent.setup();
    const { router } = renderApp('/meus-cards');

    await screen.findByRole('heading', { level: 2, name: 'Sem prazo, 4 cards' });
    expect(groupTitles('Sem prazo')).toEqual(['Urgente', 'Média', 'Baixa', 'Sem prioridade']);

    const link = screen.getByRole('link', { name: /^Urgente\./ });
    expect(link).toHaveAccessibleName(
      'Urgente. Prioridade urgente. Quadro Marketing, lista Fazendo',
    );
    expect(link).toHaveAttribute('href', `/b/${BOARD_ID}/c/${urgent.id}`);
    expect(link).toHaveStyle({ borderLeftColor: 'var(--palette-orange-bg)' });

    await user.click(link);
    expect(await screen.findByRole('dialog', { name: 'Urgente' })).toBeVisible();
    expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}/c/${urgent.id}`);
  });

  it('concluir pelo teclado tira a linha, move o foco e "Desfazer" devolve o card ao lugar', async () => {
    // Entre "Revisar orçamento" (a0) e "Publicar campanha" (a1) em Fazendo.
    const primeiro = addCard('Primeiro', {
      dueAt: null,
      priority: 'high',
      listId: LIST_IDS.doing,
      position: 'a0V',
    });
    addCard('Segundo', { dueAt: null, priority: 'low' });
    const user = userEvent.setup();
    renderApp('/meus-cards');

    const first = await screen.findByRole('link', { name: /^Primeiro/ });
    first.focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'Concluir Primeiro' })).toHaveFocus();
    await user.keyboard('{Enter}');

    await waitFor(() => expect(screen.queryByRole('link', { name: /^Primeiro/ })).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Concluir Segundo' })).toHaveFocus(),
    );
    await waitFor(() => expect(toastMessages()).toContain('Card concluído.'));
    expect(boardRequests('cards/complete')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() =>
      expect(toastMessages()).toContain('Conclusão desfeita. O card voltou para Fazendo.'),
    );
    expect(boardRequests('cards/reopen')).toHaveLength(1);
    expect(boardRequests('cards/move').map((request) => request.body)).toEqual([
      { toListId: LIST_IDS.doing, placement: { type: 'after', id: CARD_IDS.budget } },
    ]);
    const restored = boardDb.cards.find((card) => card.id === primeiro.id);
    expect(restored).toMatchObject({ listId: LIST_IDS.doing, status: 'open' });
    expect(await screen.findByRole('link', { name: /^Primeiro/ })).toBeVisible();
  });

  it('"Desfazer" devolve o card ao lugar de antes mesmo quando o reopen o põe no topo da mesma lista', async () => {
    const cima = addCard('Cima', { dueAt: null, position: 'a0' });
    const meio = addCard('Meio', { dueAt: null, position: 'a1' });
    addCard('Baixo', { dueAt: null, position: 'a2' });
    const user = userEvent.setup();
    renderApp('/meus-cards');

    await user.click(await screen.findByRole('button', { name: 'Concluir Meio' }));
    await waitFor(() => expect(toastMessages()).toContain('Card concluído.'));
    await user.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Conclusão desfeita. O card voltou para A fazer.'),
    );
    expect(boardRequests('cards/move').map((request) => request.body)).toEqual([
      { toListId: LIST_IDS.todo, placement: { type: 'after', id: cima.id } },
    ]);
    const todo = boardDb.cards
      .filter((card) => card.listId === LIST_IDS.todo)
      .sort((a, b) => (a.position < b.position ? -1 : 1))
      .map((card) => card.title);
    expect(todo).toEqual(['Cima', 'Meio', 'Baixo']);
    expect(boardDb.cards.find((card) => card.id === meio.id)).toMatchObject({ status: 'open' });
  });

  it('erro ao concluir devolve a linha e avisa', async () => {
    server.use(http.post('/api/cards/:cardId/complete', () => apiErrorResponse('INTERNAL_ERROR')));
    addCard('Teimoso', { dueAt: null });
    const user = userEvent.setup();
    renderApp('/meus-cards');

    await user.click(await screen.findByRole('button', { name: 'Concluir Teimoso' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Não foi possível concluir o card. Tente de novo.'),
    );
    expect(await screen.findByRole('link', { name: /^Teimoso/ })).toBeVisible();
  });

  it('vazio: mensagem e atalho para Quadros; o cabeçalho marca a página atual', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/meus-cards');

    expect(await screen.findByRole('heading', { name: 'Nada com você agora' })).toBeVisible();
    const [headerLink] = screen.getAllByRole('link', { name: 'Meus cards' });
    expect(headerLink).toHaveAttribute('aria-current', 'page');

    await user.click(screen.getByRole('link', { name: 'Ver quadros' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
  });

  it('erro de carregamento oferece tentar de novo', async () => {
    server.use(http.get('/api/me/cards', () => apiErrorResponse('INTERNAL_ERROR')));
    renderApp('/meus-cards');

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });
});
