import {
  groupMyCards,
  PRIORITY_LABELS,
  type MyCard,
  type MyCardGroup,
} from '@raphasparda/ronin-shared';
import {
  Calendar,
  CalendarOff,
  Check,
  CircleCheck,
  ChevronRight,
  Clock,
  ListChecks,
  MessageSquare,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router';

import { DuePill } from '../../../../components/ui/DuePill';
import { EmptyState } from '../../../../components/ui/EmptyState';
import { Pill, type PillStatus } from '../../../../components/ui/Pill';
import { PriorityBadge } from '../../../../components/ui/PriorityBadge';
import { LoadError } from '../../../../components/ui/QueryState';
import { describeDue } from '../../../../lib/due';
import { useNow } from '../../../../lib/use-now';
import { useSession } from '../../../platform/auth/auth-api';
import { CARD_LINK_STATE, cardPath } from '../cards/cards-api';
import { useCardCompletionAction } from '../cards/use-card-actions';
import { useMyCards } from './my-cards-api';

const GROUP_STYLE: Record<MyCardGroup, { status?: PillStatus; icon: LucideIcon }> = {
  overdue: { status: 'overdue', icon: TriangleAlert },
  due_soon: { status: 'due-soon', icon: Clock },
  scheduled: { icon: Calendar },
  none: { icon: CalendarOff },
};

const cardCount = (count: number) => (count === 1 ? '1 card' : `${count} cards`);

/** Nome do link: título, prioridade, prazo, quadro e lista, checklist e comentários em texto. */
function myCardLabel(card: MyCard, timeZone: string | undefined, now: Date): string {
  const { done, total } = card.checklist;
  return [
    card.title,
    card.priority
      ? `Prioridade ${PRIORITY_LABELS[card.priority].toLocaleLowerCase('pt-BR')}`
      : null,
    describeDue(card, timeZone, now)?.spoken,
    `Quadro ${card.boardName}, lista ${card.listName}`,
    total > 0 ? `Checklist ${done} de ${total}` : null,
    card.commentCount > 0
      ? `${card.commentCount} ${card.commentCount === 1 ? 'comentário' : 'comentários'}`
      : null,
  ]
    .filter(Boolean)
    .join('. ');
}

function MyCardsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        Carregando seus cards…
      </p>
      {[3, 2].map((rows, group) => (
        <div key={group} aria-hidden className="flex flex-col gap-2">
          <div className="h-[22px] w-28 animate-pulse rounded-full bg-surface-sunken" />
          {Array.from({ length: rows }, (_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-lg bg-surface-sunken" />
          ))}
        </div>
      ))}
    </div>
  );
}

interface MyCardRowProps {
  card: MyCard;
  timeZone: string | undefined;
  now: Date;
  onComplete: (card: MyCard) => void;
}

function MyCardRow({ card, timeZone, now, onComplete }: MyCardRowProps) {
  const { done, total } = card.checklist;

  return (
    <li className="relative">
      <Link
        to={cardPath(card.boardId, card.id)}
        state={CARD_LINK_STATE}
        aria-label={myCardLabel(card, timeZone, now)}
        style={{ borderLeftColor: `var(--palette-${card.listColor}-bg)` }}
        className="focus-inset flex flex-col gap-1.5 border-l-4 py-3 pr-14 pl-3 text-text no-underline hover:bg-hover md:pr-12"
      >
        <span aria-hidden className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="w-full font-semibold break-words sm:w-auto">{card.title}</span>
          <PriorityBadge priority={card.priority} srPrefix={false} />
          <DuePill card={card} timeZone={timeZone} now={now} />
        </span>
        <span
          aria-hidden
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">{card.boardName}</span>
            <ChevronRight size={12} className="shrink-0" />
            <Pill color={card.listColor} className="max-w-48">
              <span className="truncate">{card.listName}</span>
            </Pill>
          </span>
          {total > 0 && (
            <span
              className={`inline-flex items-center gap-1 font-semibold tabular-nums ${
                done === total ? 'text-success' : ''
              }`}
            >
              <ListChecks size={14} />
              {done}/{total}
            </span>
          )}
          {card.commentCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MessageSquare size={14} />
              {card.commentCount}
            </span>
          )}
        </span>
      </Link>
      <button
        type="button"
        data-complete-id={card.id}
        aria-label={`Concluir ${card.title}`}
        title="Concluir"
        onClick={() => onComplete(card)}
        className="absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md border border-border-strong bg-surface text-muted hover:bg-hover hover:text-text md:size-8"
      >
        <Check aria-hidden size={18} />
      </button>
    </li>
  );
}

/**
 * `/meus-cards` (screens §9): cards abertos atribuídos a mim, agrupados por prazo mantendo a
 * ordem do servidor. Concluir tira a linha na hora, com "Desfazer" no toast.
 */
export function MyCardsPage() {
  const myCards = useMyCards();
  const completion = useCardCompletionAction();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<{ removed: string; next: string | null } | null>(null);

  const groups = useMemo(
    () => groupMyCards(myCards.data ?? [], now).filter((group) => group.cards.length > 0),
    [myCards.data, now],
  );

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target || myCards.data?.some((card) => card.id === target.removed)) return;
    pendingFocus.current = null;
    const next = target.next
      ? document.querySelector<HTMLElement>(`[data-complete-id="${target.next}"]`)
      : null;
    (next ?? headingRef.current)?.focus();
  }, [myCards.data]);

  const complete = (card: MyCard) => {
    const order = groups.flatMap((group) => group.cards.map((item) => item.id));
    const index = order.indexOf(card.id);
    pendingFocus.current = { removed: card.id, next: order[index + 1] ?? order[index - 1] ?? null };
    completion.run({
      card,
      action: 'complete',
      list: { name: card.listName, isDoneList: false },
      source: 'my-cards',
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <title>Meus cards · Ronin</title>
      <div className="flex flex-col gap-1">
        <h1 ref={headingRef} tabIndex={-1} className="text-xl outline-none">
          Meus cards
        </h1>
        <p className="text-muted">
          Cards abertos atribuídos a você, em todos os quadros, por prazo e prioridade.
        </p>
      </div>

      {myCards.isPending ? (
        <MyCardsSkeleton />
      ) : myCards.isError ? (
        <LoadError onRetry={() => void myCards.refetch()} retrying={myCards.isFetching} />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={CircleCheck}
          iconColor="green"
          title="Nada com você agora"
          description="Quando alguém atribuir um card a você, ele aparece aqui."
          action={
            <Link
              to="/"
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text no-underline hover:bg-hover md:h-9"
            >
              Ver quadros
            </Link>
          }
        />
      ) : (
        groups.map((group) => {
          const { status, icon: Icon } = GROUP_STYLE[group.group];
          return (
            <section
              key={group.group}
              aria-labelledby={`grupo-${group.group}`}
              className="flex flex-col gap-2"
            >
              <h2 id={`grupo-${group.group}`} className="text-sm">
                <span className="sr-only">{`${group.label}, ${cardCount(group.cards.length)}`}</span>
                <Pill aria-hidden status={status} icon={<Icon size={12} strokeWidth={2.5} />}>
                  {group.label}
                  <span className="tabular-nums">{group.cards.length}</span>
                </Pill>
              </h2>
              <ul
                aria-label={group.label}
                className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
              >
                {group.cards.map((card) => (
                  <MyCardRow
                    key={card.id}
                    card={card}
                    timeZone={timeZone}
                    now={now}
                    onComplete={complete}
                  />
                ))}
              </ul>
            </section>
          );
        })
      )}
    </div>
  );
}
