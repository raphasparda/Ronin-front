import { cardTitleSchema } from '@kanban/shared';
import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';

interface CardTitleProps {
  id: string;
  title: string;
  readOnly: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
  onSave: (title: string) => void;
  onEmpty: () => void;
}

/**
 * Título do detalhe (screens §8.2): Enter e blur salvam, Esc cancela sem fechar o diálogo.
 * O rascunho é local: o polling não sobrescreve o que está sendo digitado.
 */
export function CardTitle({ id, title, readOnly, headingRef, onSave, onEmpty }: CardTitleProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const editing = draft !== null;

  useEffect(() => {
    if (!editing) return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, [editing]);

  const finish = (save: boolean) => {
    if (draft === null) return;
    setDraft(null);
    requestAnimationFrame(() => (editButtonRef.current ?? headingRef.current)?.focus());
    if (!save) return;
    const parsed = cardTitleSchema.safeParse(draft);
    if (!parsed.success) {
      if (draft.trim() === '') onEmpty();
      return;
    }
    if (parsed.data !== title) onSave(parsed.data);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };

  const startEditing = () => {
    if (!readOnly) setDraft(title);
  };

  return (
    <div className="flex items-start gap-1">
      <h2
        ref={headingRef}
        id={id}
        tabIndex={-1}
        onClick={startEditing}
        className={
          editing
            ? 'sr-only'
            : `min-w-0 flex-1 rounded-md text-xl font-bold break-words outline-offset-2 ${
                readOnly ? '' : 'cursor-text'
              }`
        }
      >
        {title}
      </h2>
      {editing && (
        <textarea
          ref={fieldRef}
          aria-label="Título do card"
          rows={2}
          maxLength={500}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish(true)}
          className="field-sizing-content min-h-10 w-full resize-none rounded-md border border-border-strong bg-surface px-2 py-1 text-xl font-bold text-text"
        />
      )}
      {!readOnly && !editing && (
        <button
          ref={editButtonRef}
          type="button"
          aria-label="Editar título"
          title="Editar título"
          onClick={startEditing}
          className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
        >
          <Pencil aria-hidden size={16} />
        </button>
      )}
    </div>
  );
}
