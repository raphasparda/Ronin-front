import type { Activity, CardPriority, List, UserSummary } from '@raphasparda/ronin-shared';
import { History } from 'lucide-react';
import type { ReactNode } from 'react';

import { Pill } from '../../../../components/ui/Pill';
import { PriorityBadge } from '../../../../components/ui/PriorityBadge';
import { ListSkeleton, LoadError } from '../../../../components/ui/QueryState';
import { formatShortDate, formatShortDateTime } from '../../../../lib/dates';
import { useSession } from '../../../platform/auth/auth-api';
import { useBoard } from '../boards/boards-api';
import { displayName, useUsers } from '../../../platform/users/users-api';
import { useCardActivity } from './cards-api';

export interface ActivityContext {
  userName: (userId: string) => string;
  /** Cor atual da lista, se ela ainda está ativa no quadro do card. */
  listColor: (listId: string) => List['color'] | undefined;
  timeZone: string | undefined;
}

/** Prazo sem horário é gravado às 23:59:59.999 do dia (overview §4.3). */
function hasTime(iso: string): boolean {
  const date = new Date(iso);
  return !(date.getUTCSeconds() === 59 && date.getUTCMilliseconds() === 999);
}

function formatDue(iso: string, timeZone: string | undefined, withTime = hasTime(iso)): string {
  return withTime ? formatShortDateTime(iso, timeZone) : formatShortDate(iso, timeZone);
}

function ListName({ id, name, ctx }: { id: string; name: string; ctx: ActivityContext }) {
  return <Pill color={ctx.listColor(id)}>{name}</Pill>;
}

function Priority({ value }: { value: CardPriority }) {
  return <PriorityBadge priority={value} srPrefix={false} />;
}

/** Frase de cada tipo de atividade, sem o nome de quem fez (screens §8.9). */
export function activityPhrase(activity: Activity, ctx: ActivityContext): ReactNode {
  switch (activity.type) {
    case 'card_created':
      return (
        <>
          criou o card em{' '}
          <ListName id={activity.data.listId} name={activity.data.listName} ctx={ctx} />
        </>
      );
    case 'card_title_changed':
      return `mudou o título de "${activity.data.from}" para "${activity.data.to}"`;
    case 'card_moved': {
      const { data } = activity;
      const to = <ListName id={data.toListId} name={data.toListName} ctx={ctx} />;
      if (data.fromBoardId !== data.toBoardId) {
        return (
          <>
            moveu para o quadro {data.toBoardName} {to}
          </>
        );
      }
      return (
        <>
          moveu de <ListName id={data.fromListId} name={data.fromListName} ctx={ctx} /> para {to}
        </>
      );
    }
    case 'card_assignee_added':
      return activity.data.userId === activity.actorId
        ? 'se atribuiu ao card'
        : `atribuiu ${ctx.userName(activity.data.userId)}`;
    case 'card_assignee_removed':
      return activity.data.userId === activity.actorId
        ? 'deixou de ser responsável pelo card'
        : `removeu ${ctx.userName(activity.data.userId)}`;
    case 'card_due_changed': {
      const { from, to, hasTime: toHasTime } = activity.data;
      if (to === null) return 'removeu o prazo';
      const next = formatDue(to, ctx.timeZone, toHasTime);
      if (from === null) return `definiu o prazo para ${next}`;
      return `alterou o prazo de ${formatDue(from, ctx.timeZone)} para ${next}`;
    }
    case 'card_priority_changed': {
      const { from, to } = activity.data;
      if (to === null) {
        return from === null ? (
          'removeu a prioridade'
        ) : (
          <>
            removeu a prioridade <Priority value={from} />
          </>
        );
      }
      if (from === null) {
        return (
          <>
            definiu a prioridade como <Priority value={to} />
          </>
        );
      }
      return (
        <>
          alterou a prioridade de <Priority value={from} /> para <Priority value={to} />
        </>
      );
    }
    case 'card_completed':
      return 'concluiu o card';
    case 'card_reopened':
      return 'reabriu o card';
    case 'card_archived':
      return 'arquivou o card';
    case 'card_restored':
      return 'restaurou o card';
  }
}

export function ActivityItem({ activity, ctx }: { activity: Activity; ctx: ActivityContext }) {
  return (
    <li className="flex flex-col gap-0.5 py-2">
      <p className="leading-7">
        <strong className="font-semibold">{ctx.userName(activity.actorId)}</strong>{' '}
        {activityPhrase(activity, ctx)}
      </p>
      <time
        dateTime={activity.createdAt}
        title={formatShortDateTime(activity.createdAt, ctx.timeZone)}
        className="text-xs text-muted"
      >
        {formatShortDateTime(activity.createdAt, ctx.timeZone)}
      </time>
    </li>
  );
}

function userNameResolver(users: readonly UserSummary[] | undefined) {
  const byId = new Map((users ?? []).map((user) => [user.id, user]));
  return (userId: string) => displayName(byId.get(userId));
}

interface CardActivityProps {
  cardId: string;
  boardId: string;
}

/** Histórico do card, mais recente primeiro (só leitura). */
export function CardActivity({ cardId, boardId }: CardActivityProps) {
  const activity = useCardActivity(cardId);
  const users = useUsers();
  const board = useBoard(boardId, { paused: true });
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;

  if (activity.isPending || users.isPending) {
    return <ListSkeleton label="Carregando histórico…" rows={3} />;
  }
  if (activity.isError) {
    return <LoadError onRetry={() => void activity.refetch()} retrying={activity.isFetching} />;
  }
  if (activity.data.length === 0) {
    return (
      <p className="flex items-center gap-2 text-muted">
        <History aria-hidden size={16} />
        Nenhuma atividade ainda.
      </p>
    );
  }

  const ctx: ActivityContext = {
    userName: userNameResolver(users.data),
    listColor: (listId) => board.data?.lists.find((list) => list.id === listId)?.color,
    timeZone,
  };

  return (
    <ol aria-label="Histórico do card" className="flex flex-col divide-y divide-border">
      {activity.data.map((item) => (
        <ActivityItem key={item.id} activity={item} ctx={ctx} />
      ))}
    </ol>
  );
}
