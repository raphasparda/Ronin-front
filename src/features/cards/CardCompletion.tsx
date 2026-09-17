import type { CardDetail } from '@raphasparda/ronin-shared';
import { Check, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '../../components/ui/Button';
import { Pill } from '../../components/ui/Pill';
import { formatShortDateTime } from '../../lib/dates';
import { useNow } from '../../lib/use-now';
import { useSession } from '../auth/auth-api';
import { displayName, useUsers } from '../users/users-api';
import { CARD_MESSAGES } from './card-messages';
import { toCardSummary } from './cards-api';
import { useCardCompletionAction } from './use-card-actions';

interface CardCompletionProps {
  card: CardDetail;
  readOnly: boolean;
  announce: (message: string) => void;
}

/** Topo do detalhe (screens §8.3): "Concluir" no card aberto; bloco "Concluído" com "Reabrir". */
export function CardCompletion({ card, readOnly, announce }: CardCompletionProps) {
  const { run, pending } = useCardCompletionAction();
  const users = useUsers();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef(false);
  const completed = card.status === 'completed';

  useEffect(() => {
    if (!focusAfterChange.current) return;
    focusAfterChange.current = false;
    const frame = requestAnimationFrame(() => buttonRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [completed]);

  if (readOnly && !completed) return null;

  const toggle = () => {
    focusAfterChange.current = true;
    run({
      card: toCardSummary(card),
      action: completed ? 'reopen' : 'complete',
      list: { name: card.list.name, isDoneList: card.list.isDoneList },
      source: 'detail',
      announce,
    });
  };

  const busy = pending?.cardId === card.id ? pending.action : null;

  if (!completed) {
    return (
      <Button
        ref={buttonRef}
        icon={<Check size={16} />}
        className="self-start sm:min-w-40"
        loading={busy === 'complete'}
        loadingText="Concluindo…"
        onClick={toggle}
      >
        Concluir
      </Button>
    );
  }

  const author = card.completedBy
    ? displayName(users.data?.find((user) => user.id === card.completedBy))
    : null;
  const when = card.completedAt ? formatShortDateTime(card.completedAt, timeZone, now) : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-l-4 border-border border-l-(--status-done-bg) bg-surface p-3 sm:flex-row sm:items-center">
      <p className="flex flex-1 flex-wrap items-center gap-2">
        <Pill status="done" icon={<Check size={12} strokeWidth={2.5} />}>
          Concluído
        </Pill>
        {when && (
          <span className="text-muted">
            {author ? CARD_MESSAGES.completedBy(author, when) : `em ${when}`}
          </span>
        )}
      </p>
      {!readOnly && (
        <Button
          ref={buttonRef}
          variant="secondary"
          icon={<RotateCcw size={16} />}
          className="self-start sm:self-auto"
          loading={busy === 'reopen'}
          loadingText="Reabrindo…"
          onClick={toggle}
        >
          Reabrir
        </Button>
      )}
    </div>
  );
}
