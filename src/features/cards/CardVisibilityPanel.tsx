import {
  normalizeSearchText,
  type CardDetail,
  type CardVisibility,
  type UserSummary,
} from '@raphasparda/ronin-shared';
import { Lock, UserPlus, Users, X } from 'lucide-react';
import { useId, useState } from 'react';

import { Avatar } from '../../components/ui/Avatar';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pill } from '../../components/ui/Pill';
import { Popover } from '../../components/ui/Popover';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { useSessionUser } from '../auth/auth-api';
import { useBoardErrorHandler } from '../boards/board-errors';
import { displayName, useUsers } from '../users/users-api';
import { useCardViewers, useSetCardVisibility } from './card-access-api';
import { RESTRICTION_MESSAGES } from './card-messages';

const REMOVE_BUTTON =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent md:size-7';

interface CardVisibilityPanelProps {
  card: CardDetail;
  readOnly: boolean;
  announce: (message: string) => void;
  /** Quem se remove da lista perde o acesso na hora: o detalhe fecha e volta para o quadro. */
  onLostAccess: () => void;
}

/**
 * "Quem pode ver este card" (scope §11.11): alterna equipe ⇄ restrito e mantém a lista de
 * acesso. Quem pode editar o card pode mexer aqui (RN29); Admin sempre enxerga o card (RN28).
 */
export function CardVisibilityPanel({
  card,
  readOnly,
  announce,
  onLostAccess,
}: CardVisibilityPanelProps) {
  const labelId = useId();
  const groupName = useId();
  const me = useSessionUser();
  const users = useUsers();
  const visibility = useSetCardVisibility(card.boardId, card.id);
  const viewers = useCardViewers(card.boardId, card.id);
  const handleError = useBoardErrorHandler(card.boardId);
  const [query, setQuery] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const byId = new Map((users.data ?? []).map((user) => [user.id, user]));
  const nameOf = (userId: string) => displayName(byId.get(userId));
  const restricted = card.visibility === 'restricted';
  const isAdmin = me?.role === 'admin';
  const pending = visibility.isPending || viewers.isPending;

  const onError = (error: unknown, fallback: string) => {
    if (isApiError(error) && error.code === 'CARD_RESTRICTED') {
      toast.error(RESTRICTION_MESSAGES.lostAccess);
      onLostAccess();
      return;
    }
    if (isApiError(error) && error.code === 'USER_NOT_ACTIVE') {
      toast.error(RESTRICTION_MESSAGES.userNotActive);
      return;
    }
    if (isApiError(error) && error.code === 'CARD_NOT_RESTRICTED') {
      toast.error(RESTRICTION_MESSAGES.notRestricted);
      return;
    }
    handleError(error, fallback);
  };

  const changeVisibility = (next: CardVisibility) => {
    if (next === card.visibility) return;
    visibility.mutate(next, {
      onSuccess: ({ card: updated }) => {
        toast.success(
          updated.visibility === 'restricted'
            ? RESTRICTION_MESSAGES.restrictedNow(updated.viewerIds.length)
            : RESTRICTION_MESSAGES.teamNow,
        );
      },
      onError: (error) => onError(error, RESTRICTION_MESSAGES.visibilityFailed),
    });
  };

  const toggleViewer = (userId: string, add: boolean) => {
    const name = nameOf(userId);
    viewers.mutate(
      { userId, add },
      {
        onSuccess: () => {
          if (add) {
            toast.success(RESTRICTION_MESSAGES.added(name));
            announce(RESTRICTION_MESSAGES.added(name));
            return;
          }
          if (userId === me?.id && !isAdmin) {
            toast.success(RESTRICTION_MESSAGES.removed(name));
            onLostAccess();
            return;
          }
          toast.success(RESTRICTION_MESSAGES.removed(name));
          announce(RESTRICTION_MESSAGES.removed(name));
        },
        onError: (error) => onError(error, RESTRICTION_MESSAGES.viewerFailed),
      },
    );
  };

  const search = normalizeSearchText(query);
  const candidates = (users.data ?? [])
    .filter((user: UserSummary) => user.status === 'active' && !card.viewerIds.includes(user.id))
    .filter((user) => search === '' || normalizeSearchText(user.name).includes(search));

  /** Motivo para não poder tirar o acesso desta pessoa (RN27 e RN32). */
  const blockedReason = (userId: string): string | null => {
    if (card.assigneeIds.includes(userId)) return RESTRICTION_MESSAGES.isAssignee(nameOf(userId));
    if (card.viewerIds.length === 1) return RESTRICTION_MESSAGES.lastPerson;
    return null;
  };

  const option = (value: CardVisibility, label: string, help: string) => (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="radio"
        name={groupName}
        value={value}
        checked={card.visibility === value}
        disabled={readOnly || pending}
        onChange={() => changeVisibility(value)}
        className="mt-1 size-4 shrink-0 accent-(--color-accent)"
      />
      <span className="flex min-w-0 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-xs text-muted">{help}</span>
      </span>
    </label>
  );

  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2 border-t border-border pt-4">
      <h3 id={labelId} className="text-xs font-semibold tracking-wide text-muted uppercase">
        {RESTRICTION_MESSAGES.panelTitle}
      </h3>

      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-col gap-2">
        {option('team', RESTRICTION_MESSAGES.team, RESTRICTION_MESSAGES.teamHelp)}
        {option('restricted', RESTRICTION_MESSAGES.restricted, RESTRICTION_MESSAGES.restrictedHelp)}
      </div>

      {readOnly && <p className="text-xs text-muted">{RESTRICTION_MESSAGES.boardArchived}</p>}

      {restricted && (
        <>
          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Lock aria-hidden size={14} className="mt-px shrink-0" />
            <span>{RESTRICTION_MESSAGES.restrictedWarning}</span>
          </p>

          {card.viewerIds.length === 0 ? (
            <p className="text-warning">{RESTRICTION_MESSAGES.emptyList}</p>
          ) : (
            <ul aria-label={RESTRICTION_MESSAGES.panelTitle} className="flex flex-col gap-1">
              {card.viewerIds.map((userId) => {
                const name = nameOf(userId);
                const reason = blockedReason(userId);
                const isMe = userId === me?.id;
                return (
                  <li key={userId} className="flex min-h-8 items-center gap-2">
                    <Avatar id={userId} name={name} size="sm" />
                    <span className="min-w-0 flex-1 truncate">
                      {name}
                      {isMe && <span className="text-muted"> (eu)</span>}
                    </span>
                    {card.assigneeIds.includes(userId) && (
                      <Pill>{RESTRICTION_MESSAGES.assigneeBadge}</Pill>
                    )}
                    {!readOnly && (
                      <button
                        type="button"
                        aria-label={RESTRICTION_MESSAGES.removeAccess(name)}
                        title={reason ?? RESTRICTION_MESSAGES.removeAccess(name)}
                        disabled={reason !== null || pending}
                        onClick={() => {
                          if (isMe) setConfirmLeave(true);
                          else toggleViewer(userId, false);
                        }}
                        className={REMOVE_BUTTON}
                      >
                        <X aria-hidden size={16} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {!readOnly && (
            <Popover
              panelLabel={RESTRICTION_MESSAGES.addPerson}
              onOpen={() => setQuery('')}
              triggerClassName="inline-flex h-10 items-center gap-1.5 self-start rounded-md px-2 font-medium text-text hover:bg-hover md:h-8"
              trigger={
                <>
                  <UserPlus aria-hidden size={16} />
                  {RESTRICTION_MESSAGES.addPerson}
                </>
              }
            >
              <div className="flex flex-col gap-2">
                <label className="flex flex-col gap-1.5">
                  <span className="font-medium">{RESTRICTION_MESSAGES.searchPerson}</span>
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    className="h-10 rounded-md border border-border-strong bg-surface px-3 text-md text-text md:h-9 md:text-sm"
                  />
                </label>
                {users.isPending ? (
                  <p className="text-muted">Carregando pessoas…</p>
                ) : candidates.length === 0 ? (
                  <p className="text-muted">{RESTRICTION_MESSAGES.noPeopleFound}</p>
                ) : (
                  <ul aria-label="Pessoas ativas" className="flex flex-col">
                    {candidates.map((user) => (
                      <li key={user.id}>
                        <button
                          type="button"
                          onClick={() => toggleViewer(user.id, true)}
                          className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover md:min-h-8"
                        >
                          <Avatar id={user.id} name={user.name} size="sm" />
                          <span className="min-w-0 truncate">
                            {user.name}
                            {user.id === me?.id && <span className="text-muted"> (eu)</span>}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Popover>
          )}

          <p className="flex items-start gap-1.5 text-xs text-muted">
            <Users aria-hidden size={14} className="mt-px shrink-0" />
            <span>
              {RESTRICTION_MESSAGES.adminsAlways}
              {isAdmin && me && !card.viewerIds.includes(me.id) && (
                <> {RESTRICTION_MESSAGES.adminOutsideList}</>
              )}
            </span>
          </p>
        </>
      )}

      <ConfirmDialog
        open={confirmLeave}
        tone="danger"
        title={RESTRICTION_MESSAGES.leaveTitle}
        description={<p>{RESTRICTION_MESSAGES.leaveDescription}</p>}
        confirmLabel={RESTRICTION_MESSAGES.leaveConfirm}
        pending={viewers.isPending}
        pendingLabel="Saindo…"
        onConfirm={() => {
          setConfirmLeave(false);
          if (me) toggleViewer(me.id, false);
        }}
        onClose={() => setConfirmLeave(false)}
      />
    </section>
  );
}
