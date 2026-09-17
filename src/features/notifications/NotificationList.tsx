import type { Notification } from '@raphasparda/ronin-shared';
import { BellOff } from 'lucide-react';
import { Link } from 'react-router';

import { Button } from '../../components/ui/Button';
import { formatRelativeTime, formatShortDateTime } from '../../lib/dates';
import { useNow } from '../../lib/use-now';
import { useSession } from '../auth/auth-api';
import { CARD_LINK_STATE, cardPath } from '../cards/cards-api';
import { displayName, useUsers } from '../users/users-api';
import { useNotificationList } from './notifications-api';

export const NOTIFICATION_MESSAGES = {
  title: 'Notificações',
  markAll: 'Marcar todas como lidas',
  markAllFailed: 'Não foi possível marcar as notificações como lidas. Tente de novo.',
  empty: 'Nenhuma notificação por aqui.',
  emptyDescription:
    'Quando alguém atribuir um card a você ou comentar em um card seu, o aviso aparece aqui.',
  loadFailed: 'Não foi possível carregar as notificações.',
  loadMore: 'Carregar mais',
  loading: 'Carregando notificações…',
  buttonLabel: (count: number) =>
    count === 0
      ? 'Notificações'
      : `Notificações, ${count} ${count === 1 ? 'não lida' : 'não lidas'}`,
  arrived: (count: number) => (count === 1 ? '1 nova notificação' : `${count} novas notificações`),
} as const;

const ACTIONS: Record<Notification['type'], string> = {
  card_assigned: 'atribuiu você a',
  card_commented: 'comentou em',
};

interface NotificationItemProps {
  notification: Notification;
  author: string;
  timeZone: string | undefined;
  now: Date;
  onOpen: (notification: Notification) => void;
}

function NotificationItem({ notification, author, timeZone, now, onOpen }: NotificationItemProps) {
  const unread = notification.readAt === null;
  const { card } = notification;
  const when = formatRelativeTime(notification.createdAt, timeZone, now);
  const label = [
    unread ? 'Não lida' : null,
    `${author} ${ACTIONS[notification.type]} ${card.title}`,
    `${card.boardName}, ${when}`,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <li>
      <Link
        to={cardPath(card.boardId, card.id)}
        state={CARD_LINK_STATE}
        aria-label={label}
        onClick={() => onOpen(notification)}
        className={`focus-inset flex items-start gap-3 px-4 py-3 text-text no-underline hover:bg-hover ${
          unread ? 'bg-hover' : ''
        }`}
      >
        <span
          aria-hidden
          className={`mt-2 size-2 shrink-0 rounded-full ${unread ? 'bg-accent' : ''}`}
        />
        <span aria-hidden className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="break-words">
            <span className={unread ? 'font-bold' : 'font-semibold'}>{author}</span>{' '}
            {ACTIONS[notification.type]} <span className="font-medium">{card.title}</span>
          </span>
          <span className="text-xs text-muted">
            {card.boardName} ·{' '}
            <time
              dateTime={notification.createdAt}
              title={formatShortDateTime(notification.createdAt, timeZone, now)}
            >
              {when}
            </time>
          </span>
        </span>
        {unread && (
          <span
            aria-hidden
            className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent"
          >
            Nova
          </span>
        )}
      </Link>
    </li>
  );
}

/** Conteúdo do painel: carregando, erro, vazio, lista e "Carregar mais" (screens §10). */
export function NotificationList({ onOpen }: { onOpen: (notification: Notification) => void }) {
  const list = useNotificationList({ enabled: true });
  const users = useUsers();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();

  if (list.isPending) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p role="status" className="sr-only">
          {NOTIFICATION_MESSAGES.loading}
        </p>
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            aria-hidden
            className="h-14 animate-pulse rounded-lg bg-surface-sunken"
          />
        ))}
      </div>
    );
  }

  if (!list.data) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
        <p>{NOTIFICATION_MESSAGES.loadFailed}</p>
        <Button
          variant="secondary"
          loading={list.isFetching}
          loadingText="Tentando…"
          onClick={() => void list.refetch()}
        >
          Tentar de novo
        </Button>
      </div>
    );
  }

  const notifications = list.data.pages.flatMap((page) => page.notifications);
  if (notifications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-full bg-surface-sunken text-muted">
          <BellOff aria-hidden size={24} />
        </span>
        <p className="font-semibold">{NOTIFICATION_MESSAGES.empty}</p>
        <p className="text-muted">{NOTIFICATION_MESSAGES.emptyDescription}</p>
      </div>
    );
  }

  const usersById = new Map((users.data ?? []).map((user) => [user.id, user]));

  return (
    <>
      <ul aria-label="Lista de notificações" className="divide-y divide-border">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            author={displayName(usersById.get(notification.actorId))}
            timeZone={timeZone}
            now={now}
            onOpen={onOpen}
          />
        ))}
      </ul>
      {list.hasNextPage && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {list.isFetchNextPageError && (
            <p role="alert" className="text-center text-danger">
              {NOTIFICATION_MESSAGES.loadFailed}
            </p>
          )}
          <Button
            variant="ghost"
            className="w-full"
            loading={list.isFetchingNextPage}
            loadingText="Carregando…"
            onClick={() => void list.fetchNextPage()}
          >
            {NOTIFICATION_MESSAGES.loadMore}
          </Button>
        </div>
      )}
    </>
  );
}
