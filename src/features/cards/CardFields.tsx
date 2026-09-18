import {
  dueInputSchema,
  normalizeSearchText,
  PRIORITY_LABELS,
  type BoardPayload,
  type CardDetail,
  type CardPriority,
  type Label,
} from '@raphasparda/ronin-shared';
import { CalendarPlus, Pencil, Plus, Tag, UserPlus, X } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type ReactNode, type RefObject } from 'react';

import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { DuePill } from '../../components/ui/DuePill';
import { LabelPill } from '../../components/ui/LabelPill';
import { Popover } from '../../components/ui/Popover';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { PrioritySelect } from '../../components/ui/PrioritySelect';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { isoToDueInput, timeZoneDisplayName } from '../../lib/due';
import { useNow } from '../../lib/use-now';
import { useSession, useSessionUser } from '../auth/auth-api';
import { useBoardErrorHandler } from '../boards/board-errors';
import { LabelsDialog } from '../boards/LabelsDialog';
import { displayName, useUsers } from '../users/users-api';
import { CARD_MESSAGES } from './card-messages';
import { useCardAssignees, useCardLabels } from './card-relations-api';
import { useUpdateCard } from './cards-api';

const REMOVE_BUTTON =
  'inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-7';

interface FieldProps {
  card: CardDetail;
  readOnly: boolean;
  announce: (message: string) => void;
}

function Field({
  labelId,
  title,
  headingRef,
  children,
}: {
  labelId: string;
  title: string;
  /** Torna o título focável por script: destino estável do foco quando um controle some. */
  headingRef?: RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h3
        ref={headingRef}
        id={labelId}
        tabIndex={headingRef ? -1 : undefined}
        className="text-xs font-semibold tracking-wide text-muted uppercase"
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Prioridade (screens §8.4)
// ---------------------------------------------------------------------------

export function CardPriorityField({ card, readOnly, announce }: FieldProps) {
  const labelId = useId();
  const update = useUpdateCard(card.id);
  const handleError = useBoardErrorHandler(card.boardId);

  const change = (priority: CardPriority | null) => {
    announce(
      priority === null
        ? CARD_MESSAGES.priorityRemoved
        : CARD_MESSAGES.priorityChanged(PRIORITY_LABELS[priority]),
    );
    update.mutate(
      { priority },
      { onError: (error) => handleError(error, CARD_MESSAGES.priorityFailed) },
    );
  };

  return (
    <Field labelId={labelId} title="Prioridade">
      {readOnly ? (
        card.priority === null ? (
          <p className="text-muted">Sem prioridade</p>
        ) : (
          <PriorityBadge priority={card.priority} srPrefix={false} className="self-start" />
        )
      ) : (
        <>
          <PrioritySelect labelId={labelId} value={card.priority} onChange={change} />
          {card.priority === null && (
            <p className="text-xs text-muted">{CARD_MESSAGES.priorityHelp}</p>
          )}
        </>
      )}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Responsáveis (screens §8.5)
// ---------------------------------------------------------------------------

export function CardAssigneesField({ card, readOnly, announce }: FieldProps) {
  const labelId = useId();
  const users = useUsers();
  const me = useSessionUser();
  const assignees = useCardAssignees(card.boardId, card.id);
  const handleError = useBoardErrorHandler(card.boardId);
  const [query, setQuery] = useState('');

  const byId = new Map((users.data ?? []).map((user) => [user.id, user]));
  const nameOf = (id: string) => displayName(byId.get(id));

  const toggle = (userId: string, add: boolean) => {
    const name = userId === me?.id ? 'você' : nameOf(userId);
    announce(add ? `${name} agora é responsável.` : `${name} deixou de ser responsável.`);
    assignees.mutate(
      { id: userId, add },
      {
        onError: (error) => {
          if (isApiError(error) && error.code === 'USER_NOT_ACTIVE') {
            toast.error(CARD_MESSAGES.assigneeInactive);
            return;
          }
          handleError(error, CARD_MESSAGES.assigneeFailed);
        },
      },
    );
  };

  const search = normalizeSearchText(query);
  const candidates = (users.data ?? [])
    .filter((user) => user.status === 'active')
    .filter((user) => search === '' || normalizeSearchText(user.name).includes(search))
    .sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : 0));
  const meCanBeAssigned =
    me !== null && byId.get(me.id)?.status === 'active' && !card.assigneeIds.includes(me.id);

  return (
    <Field labelId={labelId} title="Responsáveis">
      {card.assigneeIds.length === 0 ? (
        <p className="text-muted">Ninguém ainda</p>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-col gap-1">
          {card.assigneeIds.map((id) => {
            const user = byId.get(id);
            const name = nameOf(id);
            return (
              <li key={id} className="flex min-h-8 items-center gap-2">
                <Avatar
                  id={id}
                  name={user?.anonymized ? '?' : name}
                  avatarUpdatedAt={user?.avatarUpdatedAt}
                  size="sm"
                />
                <span className="min-w-0 flex-1 truncate">
                  {name}
                  {user?.status === 'deactivated' && !user.anonymized && (
                    <span className="text-muted"> (conta desativada)</span>
                  )}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    aria-label={`Remover ${name}`}
                    title={`Remover ${name}`}
                    onClick={() => toggle(id, false)}
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
        <div className="flex flex-wrap items-center gap-2">
          <Popover
            panelLabel="Adicionar responsável"
            onOpen={() => setQuery('')}
            triggerClassName="inline-flex h-10 items-center gap-1.5 rounded-md px-2 font-medium text-text hover:bg-hover md:h-8"
            trigger={
              <>
                <UserPlus aria-hidden size={16} />
                Adicionar
              </>
            }
          >
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1.5">
                <span className="font-medium">Buscar pessoa</span>
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
                <p className="text-muted">Ninguém encontrado com esse nome.</p>
              ) : (
                <ul aria-label="Pessoas ativas" className="flex flex-col">
                  {candidates.map((user) => {
                    const assigned = card.assigneeIds.includes(user.id);
                    return (
                      <li key={user.id}>
                        <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-hover md:min-h-8">
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={() => toggle(user.id, !assigned)}
                            className="size-4 shrink-0 accent-(--color-accent)"
                          />
                          <Avatar
                            id={user.id}
                            name={user.name}
                            avatarUpdatedAt={user.avatarUpdatedAt}
                            size="sm"
                          />
                          <span className="min-w-0 truncate">
                            {user.name}
                            {user.id === me?.id && <span className="text-muted"> (eu)</span>}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Popover>
          {meCanBeAssigned && (
            <Button variant="ghost" size="sm" onClick={() => toggle(me.id, true)}>
              Atribuir a mim
            </Button>
          )}
        </div>
      )}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Prazo (screens §8.6)
// ---------------------------------------------------------------------------

export function CardDueField({ card, readOnly, announce }: FieldProps) {
  const labelId = useId();
  const dateId = useId();
  const timeId = useId();
  const errorId = useId();
  const zoneId = useId();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();
  const update = useUpdateCard(card.id);
  const handleError = useBoardErrorHandler(card.boardId);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [withTime, setWithTime] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const start = () => {
    const current = card.dueAt ? isoToDueInput(card.dueAt, card.dueHasTime, timeZone) : null;
    setDate(current?.date ?? '');
    setTime(current?.time ?? '');
    setWithTime(current?.time != null);
    setError(undefined);
    setEditing(true);
  };

  // O botão focado (do formulário ou "Remover prazo") vai sumir: o foco fica no título da seção.
  const keepFocusInField = () => headingRef.current?.focus({ preventScroll: true });

  const stopEditing = () => {
    keepFocusInField();
    setEditing(false);
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const parsed = dueInputSchema.safeParse({ date, time: withTime ? time : null });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.path[0] === 'time'
          ? 'Informe um horário válido, como 14:30.'
          : 'Informe a data do prazo.',
      );
      return;
    }
    stopEditing();
    announce(CARD_MESSAGES.dueSaved);
    update.mutate(
      { due: parsed.data },
      { onError: (mutationError) => handleError(mutationError, CARD_MESSAGES.dueFailed) },
    );
  };

  const remove = () => {
    keepFocusInField();
    setEditing(false);
    announce(CARD_MESSAGES.dueRemoved);
    update.mutate(
      { due: null },
      { onError: (mutationError) => handleError(mutationError, CARD_MESSAGES.dueFailed) },
    );
  };

  const zoneName = timeZoneDisplayName(timeZone);

  return (
    <Field labelId={labelId} title="Prazo" headingRef={headingRef}>
      {editing ? (
        <form
          noValidate
          onSubmit={save}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              stopEditing();
            }
          }}
          className="flex flex-col gap-2"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={dateId} className="font-medium">
              Data
            </label>
            <input
              id={dateId}
              type="date"
              value={date}
              required
              aria-invalid={error ? true : undefined}
              aria-describedby={[error ? errorId : null, zoneId].filter(Boolean).join(' ')}
              onChange={(event) => {
                setDate(event.target.value);
                setError(undefined);
              }}
              className="h-10 rounded-md border border-border-strong bg-surface px-2 text-md text-text md:h-9 md:text-sm"
            />
          </div>
          <label className="flex min-h-8 items-center gap-2">
            <input
              type="checkbox"
              checked={withTime}
              onChange={(event) => setWithTime(event.target.checked)}
              className="size-4 accent-(--color-accent)"
            />
            Incluir horário
          </label>
          {withTime && (
            <div className="flex flex-col gap-1">
              <label htmlFor={timeId} className="font-medium">
                Horário
              </label>
              <input
                id={timeId}
                type="time"
                value={time}
                aria-describedby={zoneId}
                onChange={(event) => {
                  setTime(event.target.value);
                  setError(undefined);
                }}
                className="h-10 rounded-md border border-border-strong bg-surface px-2 text-md text-text md:h-9 md:text-sm"
              />
            </div>
          )}
          <p id={zoneId} className="text-xs text-muted">
            {zoneName}
          </p>
          {error && (
            <p id={errorId} className="text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              Salvar prazo
            </Button>
            <Button variant="secondary" size="sm" onClick={stopEditing}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : card.dueAt === null ? (
        readOnly ? (
          <p className="text-muted">Sem prazo</p>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            icon={<CalendarPlus size={16} />}
            className="self-start"
            onClick={start}
          >
            Definir prazo
          </Button>
        )
      ) : (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1">
            <DuePill card={card} timeZone={timeZone} now={now} />
            {!readOnly && (
              <>
                <button
                  type="button"
                  aria-label="Alterar prazo"
                  title="Alterar prazo"
                  onClick={start}
                  className={REMOVE_BUTTON}
                >
                  <Pencil aria-hidden size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Remover prazo"
                  title="Remover prazo"
                  onClick={remove}
                  className={REMOVE_BUTTON}
                >
                  <X aria-hidden size={16} />
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-muted">{zoneName}</p>
        </div>
      )}
    </Field>
  );
}

// ---------------------------------------------------------------------------
// Etiquetas (screens §8.7)
// ---------------------------------------------------------------------------

interface CardLabelsFieldProps extends FieldProps {
  board: BoardPayload | undefined;
}

export function CardLabelsField({ card, board, readOnly, announce }: CardLabelsFieldProps) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const cardLabels = useCardLabels(card.boardId, card.id);
  const handleError = useBoardErrorHandler(card.boardId);

  const applied = card.labelIds.flatMap(
    (id) => board?.labels.find((label) => label.id === id) ?? [],
  );

  const toggle = (label: Label, add: boolean) => {
    announce(add ? `Etiqueta ${label.name} aplicada.` : `Etiqueta ${label.name} removida do card.`);
    cardLabels.mutate(
      { id: label.id, add },
      { onError: (error) => handleError(error, CARD_MESSAGES.labelToggleFailed) },
    );
  };

  return (
    <Field labelId={labelId} title="Etiquetas">
      {applied.length === 0 ? (
        <p className="text-muted">
          {board && board.labels.length === 0
            ? 'Este quadro ainda não tem etiquetas.'
            : 'Nenhuma etiqueta.'}
        </p>
      ) : (
        <ul aria-labelledby={labelId} className="flex flex-wrap gap-1">
          {applied.map((label) => (
            <li key={label.id} className="flex max-w-full">
              <LabelPill label={label} />
            </li>
          ))}
        </ul>
      )}
      {!readOnly && board && (
        <Button
          variant="ghost"
          size="sm"
          icon={applied.length === 0 ? <Plus size={16} /> : <Tag size={16} />}
          className="self-start"
          onClick={() => setOpen(true)}
        >
          {board.labels.length === 0
            ? 'Criar etiqueta'
            : applied.length === 0
              ? 'Adicionar etiqueta'
              : 'Editar etiquetas'}
        </Button>
      )}
      {board && (
        <LabelsDialog
          open={open}
          payload={board}
          readOnly={readOnly}
          card={{ labelIds: card.labelIds, onToggle: toggle }}
          onClose={() => setOpen(false)}
        />
      )}
    </Field>
  );
}
