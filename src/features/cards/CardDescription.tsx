import { cardDescriptionSchema, type CardDetail } from '@raphasparda/ronin-shared';
import { Bold, Code, Link as LinkIcon, List as ListIcon, Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { Markdown } from '../../components/ui/Markdown';
import { tabPanelProps, Tabs } from '../../components/ui/Tabs';
import { toast } from '../../components/ui/toast-store';
import { CARD_MESSAGES } from './card-messages';
import { useUpdateCard } from './cards-api';

const DESCRIPTION_MAX = 20_000;
const COUNTER_FROM = 18_000;

type Mode = 'write' | 'preview';

interface DiscardDescriptionDialogProps {
  open: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
}

/** "Descartar as alterações na descrição?" (screens §8.2). */
export function DiscardDescriptionDialog({
  open,
  onKeepEditing,
  onDiscard,
}: DiscardDescriptionDialogProps) {
  return (
    <Dialog
      open={open}
      title="Descartar as alterações na descrição?"
      onClose={onKeepEditing}
      description={<p>O texto que você escreveu e ainda não salvou será perdido.</p>}
      footer={
        <>
          <Button variant="secondary" onClick={onKeepEditing}>
            Continuar editando
          </Button>
          <Button variant="danger" onClick={onDiscard}>
            Descartar
          </Button>
        </>
      }
    >
      {null}
    </Dialog>
  );
}

interface FormatButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

function FormatButton({ label, icon, onClick }: FormatButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
    >
      <span aria-hidden className="inline-flex">
        {icon}
      </span>
    </button>
  );
}

interface CardDescriptionProps {
  card: CardDetail;
  readOnly: boolean;
  onDirtyChange: (dirty: boolean) => void;
}

/** Descrição em Markdown com abas Escrever/Visualizar; o rascunho não é tocado pelo polling. */
export function CardDescription({ card, readOnly, onDirtyChange }: CardDescriptionProps) {
  const update = useUpdateCard(card.id);
  const [draft, setDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('write');
  const [error, setError] = useState<string | undefined>();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const headingId = useId();
  const hintId = useId();
  const errorId = useId();
  const tabsId = useId();

  const editing = draft !== null;
  const dirty = editing && draft !== card.description;

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  useEffect(() => {
    if (editing && mode === 'write') fieldRef.current?.focus();
  }, [editing, mode]);

  const start = () => {
    setDraft(card.description);
    setMode('write');
    setError(undefined);
  };

  const stop = () => {
    setDraft(null);
    setConfirmDiscard(false);
    setError(undefined);
    requestAnimationFrame(() => startButtonRef.current?.focus());
  };

  const cancel = () => (dirty ? setConfirmDiscard(true) : stop());

  const save = () => {
    if (draft === null) return;
    const parsed = cardDescriptionSchema.safeParse(draft);
    if (!parsed.success) {
      setError('A descrição pode ter no máximo 20.000 caracteres.');
      setMode('write');
      return;
    }
    if (parsed.data === card.description) {
      stop();
      return;
    }
    update.mutate(
      { description: parsed.data },
      { onSuccess: stop, onError: () => toast.error(CARD_MESSAGES.descriptionFailed) },
    );
  };

  const insert = (transform: (selected: string) => { text: string; select: [number, number] }) => {
    const field = fieldRef.current;
    if (!field || draft === null) return;
    const { selectionStart: start, selectionEnd: end } = field;
    const { text, select } = transform(draft.slice(start, end));
    setDraft(`${draft.slice(0, start)}${text}${draft.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + select[0], start + select[1]);
    });
  };

  const wrap = (marker: string, placeholder: string) =>
    insert((selected) => {
      const inner = selected || placeholder;
      return {
        text: `${marker}${inner}${marker}`,
        select: [marker.length, marker.length + inner.length],
      };
    });

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancel();
    }
  };

  const heading = (
    <div className="flex items-center justify-between gap-2">
      <h3 id={headingId} className="text-md font-semibold">
        Descrição
      </h3>
      {!readOnly && !editing && card.description !== '' && (
        <Button
          ref={startButtonRef}
          variant="ghost"
          size="sm"
          icon={<Pencil size={14} />}
          aria-label="Editar descrição"
          onClick={start}
        >
          Editar
        </Button>
      )}
    </div>
  );

  if (!editing) {
    return (
      <section aria-labelledby={headingId} className="flex flex-col gap-2">
        {heading}
        {card.description !== '' ? (
          <Markdown>{card.description}</Markdown>
        ) : readOnly ? (
          <p className="text-muted">Sem descrição.</p>
        ) : (
          <button
            ref={startButtonRef}
            type="button"
            onClick={start}
            className="rounded-lg border border-dashed border-border-strong bg-surface-sunken px-3 py-4 text-left text-muted hover:bg-hover hover:text-text"
          >
            Adicionar descrição…
          </button>
        )}
      </section>
    );
  }

  const length = draft.length;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      {heading}
      <Tabs
        label="Modo da descrição"
        idPrefix={tabsId}
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'write', label: 'Escrever' },
          { id: 'preview', label: 'Visualizar' },
        ]}
      />
      <div {...tabPanelProps(tabsId, mode)} className="flex flex-col gap-2">
        {mode === 'write' ? (
          <>
            <div role="group" aria-label="Formatação" className="flex flex-wrap gap-1">
              <FormatButton
                label="Negrito"
                icon={<Bold size={16} />}
                onClick={() => wrap('**', 'texto')}
              />
              <FormatButton
                label="Lista"
                icon={<ListIcon size={16} />}
                onClick={() =>
                  insert((selected) => {
                    const text = (selected || 'item')
                      .split('\n')
                      .map((line) => `- ${line}`)
                      .join('\n');
                    return { text, select: [0, text.length] };
                  })
                }
              />
              <FormatButton
                label="Link"
                icon={<LinkIcon size={16} />}
                onClick={() =>
                  insert((selected) => {
                    const label = selected || 'texto';
                    return {
                      text: `[${label}](https://)`,
                      select: [label.length + 3, label.length + 11],
                    };
                  })
                }
              />
              <FormatButton
                label="Código"
                icon={<Code size={16} />}
                onClick={() => wrap('`', 'código')}
              />
            </div>
            <textarea
              ref={fieldRef}
              aria-labelledby={headingId}
              aria-describedby={error ? `${errorId} ${hintId}` : hintId}
              aria-invalid={error ? true : undefined}
              rows={8}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(undefined);
              }}
              onKeyDown={onKeyDown}
              className={`field-sizing-content max-h-[60dvh] min-h-40 w-full rounded-md bg-surface p-3 text-md text-text ${
                error ? 'border-2 border-danger' : 'border border-border-strong'
              }`}
            />
          </>
        ) : draft.trim() === '' ? (
          <p className="text-muted">Nada para visualizar.</p>
        ) : (
          <div className="rounded-md border border-border p-3">
            <Markdown>{draft}</Markdown>
          </div>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-danger">
          {error}
        </p>
      )}
      <p id={hintId} className="text-xs text-muted">
        Markdown: **negrito**, - lista, [link](https://…) e `código`. Ctrl+Enter salva.
        {length >= COUNTER_FROM && ` ${length.toLocaleString('pt-BR')} de 20.000 caracteres.`}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          loading={update.isPending}
          loadingText="Salvando…"
          disabled={length > DESCRIPTION_MAX}
          onClick={save}
        >
          Salvar
        </Button>
        <Button variant="secondary" onClick={cancel}>
          Cancelar
        </Button>
      </div>

      <DiscardDescriptionDialog
        open={confirmDiscard}
        onKeepEditing={() => setConfirmDiscard(false)}
        onDiscard={stop}
      />
    </section>
  );
}
