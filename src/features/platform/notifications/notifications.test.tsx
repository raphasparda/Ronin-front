import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeAll, describe, expect, it } from 'vitest';

import { getToasts } from '../../../components/ui/toast-store';
import { apiErrorResponse } from '../../../test/auth-handlers';
import { BOARD_ID, CARD_IDS } from '../../../test/board-handlers';
import {
  makeNotification,
  notificationDb,
  notificationRequests,
  seedNotifications,
} from '../../../test/notification-handlers';
import { renderApp } from '../../../test/render';
import { server } from '../../../test/server';
import { unreadCountQueryKey } from './notifications-api';

type User = ReturnType<typeof userEvent.setup>;

const toastMessages = () => getToasts().map((item) => item.message);

beforeAll(async () => {
  await Promise.all([
    import('../../tools/kanban/boards/BoardsPage'),
    import('../../tools/kanban/boards/BoardPage'),
    import('../../tools/kanban/cards/CardDetailRoute'),
  ]);
});

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

async function openPanel(user: User, name: string | RegExp = /^Notificações/) {
  await user.click(await screen.findByRole('button', { name }));
  return screen.getByRole('dialog', { name: 'Notificações' });
}

describe('Sino de notificações', () => {
  it('mostra o contador com texto acessível e "9+" acima de 9', async () => {
    seedNotifications([
      makeNotification({ createdAt: minutesAgo(1) }),
      makeNotification({ createdAt: minutesAgo(2) }),
      makeNotification({ createdAt: minutesAgo(3) }),
      makeNotification({ createdAt: minutesAgo(4), readAt: minutesAgo(1) }),
    ]);
    const { queryClient } = renderApp('/');

    const bell = await screen.findByRole('button', { name: 'Notificações, 3 não lidas' });
    expect(within(bell).getByText('3')).toBeInTheDocument();

    seedNotifications(
      Array.from({ length: 9 }, (_, index) =>
        makeNotification({ createdAt: minutesAgo(10 + index) }),
      ),
    );
    await queryClient.invalidateQueries({ queryKey: unreadCountQueryKey });

    const updated = await screen.findByRole('button', { name: 'Notificações, 12 não lidas' });
    expect(within(updated).getByText('9+')).toBeInTheDocument();
    expect(screen.getByText('9 novas notificações')).toHaveAttribute('aria-live', 'polite');
  });

  it('sem não lidas, o nome é só "Notificações" e nada é anunciado', async () => {
    renderApp('/');

    const bell = await screen.findByRole('button', { name: 'Notificações' });
    expect(bell).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText(/nova notificação/)).not.toBeInTheDocument();
  });

  it('clicar numa não lida abre o card e marca como lida', async () => {
    const assigned = makeNotification({ createdAt: minutesAgo(5) });
    const commented = makeNotification({
      type: 'card_commented',
      commentId: crypto.randomUUID(),
      card: {
        id: CARD_IDS.campaign,
        title: 'Publicar campanha',
        boardId: BOARD_ID,
        boardName: 'Marketing',
      },
      createdAt: minutesAgo(90),
      readAt: minutesAgo(60),
    });
    seedNotifications([assigned, commented]);
    const user = userEvent.setup();
    const { router } = renderApp('/');

    const panel = await openPanel(user, 'Notificações, 1 não lida');
    expect(panel).toHaveFocus();
    const unread = await within(panel).findByRole('link', {
      name: 'Não lida. Bruno Lima atribuiu você a Revisar orçamento. Marketing, há 5 min',
    });
    expect(unread).toHaveAttribute('href', `/b/${BOARD_ID}/c/${CARD_IDS.budget}`);
    expect(within(unread).getByText('Nova')).toBeVisible();
    const read = within(panel).getByRole('link', {
      name: 'Bruno Lima comentou em Publicar campanha. Marketing, há 1 h',
    });
    expect(within(read).queryByText('Nova')).not.toBeInTheDocument();

    await user.click(unread);

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(`/b/${BOARD_ID}/c/${CARD_IDS.budget}`),
    );
    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument();
    expect(await screen.findByRole('dialog', { name: 'Revisar orçamento' })).toBeVisible();
    await waitFor(() =>
      expect(notificationRequests('notifications/read').map((item) => item.body)).toEqual([
        assigned.id,
      ]),
    );
    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument();
    expect(notificationDb.notifications.every((item) => item.readAt !== null)).toBe(true);
  });

  it('"Marcar todas como lidas" zera o contador e desabilita o botão', async () => {
    seedNotifications([
      makeNotification({ createdAt: minutesAgo(1) }),
      makeNotification({ createdAt: minutesAgo(2) }),
    ]);
    const user = userEvent.setup();
    renderApp('/');

    const panel = await openPanel(user, 'Notificações, 2 não lidas');
    await within(panel).findAllByRole('link');
    const markAll = within(panel).getByRole('button', { name: 'Marcar todas como lidas' });
    await user.click(markAll);

    expect(await screen.findByRole('button', { name: 'Notificações' })).toBeInTheDocument();
    expect(markAll).toBeDisabled();
    expect(within(panel).queryByText('Nova')).not.toBeInTheDocument();
    expect(notificationRequests('notifications/read-all')).toHaveLength(1);
  });

  it('erro ao marcar todas desfaz e avisa', async () => {
    server.use(http.post('/api/notifications/read-all', () => apiErrorResponse('INTERNAL_ERROR')));
    seedNotifications([makeNotification({ createdAt: minutesAgo(1) })]);
    const user = userEvent.setup();
    renderApp('/');

    const panel = await openPanel(user, 'Notificações, 1 não lida');
    await within(panel).findAllByRole('link');
    await user.click(within(panel).getByRole('button', { name: 'Marcar todas como lidas' }));

    await waitFor(() =>
      expect(toastMessages()).toContain(
        'Não foi possível marcar as notificações como lidas. Tente de novo.',
      ),
    );
    expect(screen.getByRole('button', { name: 'Notificações, 1 não lida' })).toBeInTheDocument();
    expect(within(panel).getByText('Nova')).toBeVisible();
  });

  it('pagina com "Carregar mais" usando o cursor before', async () => {
    const items = Array.from({ length: 35 }, (_, index) =>
      makeNotification({ createdAt: minutesAgo(index + 1), readAt: minutesAgo(0) }),
    );
    seedNotifications(items);
    const user = userEvent.setup();
    renderApp('/');

    const panel = await openPanel(user, 'Notificações');
    const list = await within(panel).findByRole('list', { name: 'Lista de notificações' });
    expect(within(list).getAllByRole('link')).toHaveLength(30);

    await user.click(within(panel).getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(35));
    expect(within(panel).queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
    const requests = notificationRequests('notifications').map((item) => item.body);
    expect(requests.at(-1)).toEqual({ limit: 30, before: items[29]?.createdAt });
  });

  it('vazio e Esc: mensagem e o foco volta ao sino', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const panel = await openPanel(user, 'Notificações');
    expect(await within(panel).findByText('Nenhuma notificação por aqui.')).toBeVisible();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notificações' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notificações' })).toHaveFocus();
  });

  it('erro ao carregar a lista oferece tentar de novo', async () => {
    server.use(http.get('/api/notifications', () => apiErrorResponse('INTERNAL_ERROR')));
    const user = userEvent.setup();
    renderApp('/');

    const panel = await openPanel(user, 'Notificações');
    expect(
      await within(panel).findByText('Não foi possível carregar as notificações.'),
    ).toBeVisible();
    expect(within(panel).getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
  });
});
