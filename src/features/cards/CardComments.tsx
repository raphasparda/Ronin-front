import { commentBodySchema, type CardDetail, type Comment } from '@raphasparda/ronin-shared';
import { MessageSquare } from 'lucide-react';
import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Markdown } from '../../components/ui/Markdown';
import { formatRelativeTime, formatShortDateTime } from '../../lib/dates';
import { useNow } from '../../lib/use-now';
import { useSession, useSessionUser } from '../auth/auth-api';
import { useBoardErrorHandler } from '../boards/board-errors';
import { displayName, useUsers } from '../users/users-api';
import {
  COMMENT_MESSAGES,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from './comments-api';

const HINT = 'Markdown: **negrito**, - lista, [link](https://…). Ctrl+Enter envia.';

function validate(body: string): { ok: true; body: string } | { ok: false; error: string } {
  const parsed = commentBodySchema.safeParse(body);
  if (parsed.success) return { ok: true, body: parsed.data };
  return {
    ok: false,
    error:
      parsed.error.issues[0]?.code === 'too_big'
        ? COMMENT_MESSAGES.tooLong
        : COMMENT_MESSAGES.empty,
  };
}

interface CommentEditorProps {
  label: string;
  initial: string;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  autoFocus?: boolean;
  onSubmit: (body: string) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

function CommentEditor({
  label,
  initial,
  submitLabel,
  pendingLabel,
  pending,
  autoFocus = false,
  onSubmit,
  onCancel,
}: CommentEditorProps) {
  const [body, setBody] = useState(initial);
  const [error, setError] = useState<string | undefined>();
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const result = validate(body);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (await onSubmit(result.body)) setBody('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void submit();
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    }
  };

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-2">
      <label htmlFor={fieldId} className="sr-only">
        {label}
      </label>
      <textarea
        id={fieldId}
        autoFocus={autoFocus}
        rows={3}
        value={body}
        placeholder="Escreva um comentário…"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${errorId} ${hintId}` : hintId}
        onChange={(event) => {
          setBody(event.target.value);
          setError(undefined);
        }}
        onKeyDown={onKeyDown}
        className={`field-sizing-content max-h-[50dvh] min-h-20 w-full rounded-md bg-surface p-3 text-md text-text ${
          error ? 'border-2 border-danger' : 'border border-border-strong'
        }`}
      />
      {error && (
        <p id={errorId} className="text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" loading={pending} loadingText={pendingLabel}>
          {submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <span id={hintId} className="text-xs text-muted">
          {HINT}
        </span>
      </div>
    </form>
  );
}

interface CommentItemProps {
  comment: Comment;
  cardId: string;
  boardId: string;
  readOnly: boolean;
}

function CommentItem({ comment, cardId, boardId, readOnly }: CommentItemProps) {
  const me = useSessionUser();
  const users = useUsers();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const now = useNow();
  const update = useUpdateComment(cardId);
  const remove = useDeleteComment(cardId, boardId);
  const handleError = useBoardErrorHandler(boardId);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();

  const author = users.data?.find((user) => user.id === comment.authorId);
  const name = displayName(author);
  const isAuthor = me?.id === comment.authorId;
  const canDelete = !readOnly && (isAuthor || me?.role === 'admin');
  const canEdit = !readOnly && isAuthor;

  const save = (body: string) => {
    setEditing(false);
    if (body === comment.body) return true;
    update.mutate(
      { commentId: comment.id, body },
      { onError: (error) => handleError(error, COMMENT_MESSAGES.updateFailed) },
    );
    return true;
  };

  const confirmDelete = () => {
    setConfirming(false);
    remove.mutate(comment.id);
  };

  return (
    <li>
      <article aria-labelledby={headingId} className="flex gap-3">
        <Avatar
          id={comment.authorId}
          name={author?.anonymized ? '?' : name}
          avatarUpdatedAt={author?.avatarUpdatedAt}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p id={headingId} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-semibold">{name}</span>{' '}
            <time
              dateTime={comment.createdAt}
              title={formatShortDateTime(comment.createdAt, timeZone)}
              className="text-xs text-muted"
            >
              {formatRelativeTime(comment.createdAt, timeZone, now)}
            </time>
            {comment.editedAt && <span className="text-xs text-muted"> (editado)</span>}
          </p>
          {editing ? (
            <CommentEditor
              label="Editar comentário"
              initial={comment.body}
              submitLabel="Salvar"
              pendingLabel="Salvando…"
              pending={false}
              autoFocus
              onSubmit={save}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <Markdown>{comment.body}</Markdown>
          )}
          {!editing && confirming && (
            <div
              role="group"
              aria-label="Confirmar exclusão"
              className="flex flex-wrap items-center gap-2 rounded-md bg-surface-sunken p-2"
            >
              <span>Excluir este comentário?</span>
              <Button variant="danger" size="sm" autoFocus onClick={confirmDelete}>
                Excluir
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setConfirming(false);
                  requestAnimationFrame(() => deleteButtonRef.current?.focus());
                }}
              >
                Cancelar
              </Button>
            </div>
          )}
          {!editing && !confirming && (canEdit || canDelete) && (
            <div className="flex gap-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Editar comentário de ${name}`}
                  onClick={() => setEditing(true)}
                >
                  Editar
                </Button>
              )}
              {canDelete && (
                <Button
                  ref={deleteButtonRef}
                  variant="ghost"
                  size="sm"
                  aria-label={`Excluir comentário de ${name}`}
                  onClick={() => setConfirming(true)}
                >
                  Excluir
                </Button>
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

interface CardCommentsProps {
  card: CardDetail;
  readOnly: boolean;
}

/** Comentários em ordem cronológica, com Markdown sem HTML (screens §8.9). */
export function CardComments({ card, readOnly }: CardCommentsProps) {
  const create = useCreateComment(card.id);
  const handleError = useBoardErrorHandler(card.boardId);

  const send = async (body: string) => {
    try {
      await create.mutateAsync(body);
      return true;
    } catch (error) {
      handleError(error, COMMENT_MESSAGES.createFailed);
      return false;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {readOnly ? (
        <p className="text-muted">
          {card.archivedAt ? 'Restaure o card para comentar.' : 'O quadro está arquivado.'}
        </p>
      ) : (
        <CommentEditor
          label="Novo comentário"
          initial=""
          submitLabel="Comentar"
          pendingLabel="Enviando…"
          pending={create.isPending}
          onSubmit={send}
        />
      )}
      {card.comments.length === 0 ? (
        <p className="flex items-center gap-2 text-muted">
          <MessageSquare aria-hidden size={16} />
          Nenhum comentário ainda.
        </p>
      ) : (
        <ol aria-label="Comentários" className="flex flex-col gap-4">
          {card.comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              cardId={card.id}
              boardId={card.boardId}
              readOnly={readOnly}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
