import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface InlineEditProps {
  value: string;
  /** Rótulo acessível do campo (ex.: "Nome do quadro"). */
  label: string;
  onSave: (value: string) => void;
  onCancel: () => void;
  /** Chamado quando o valor salvo ficaria vazio: a edição é cancelada e o nome original volta. */
  onEmpty?: () => void;
  maxLength: number;
  className?: string;
}

/**
 * Campo de renomear no lugar: abre com o texto selecionado, Enter e blur salvam, Esc cancela.
 * Só chama `onSave` quando o texto (após trim) mudou.
 */
export function InlineEdit({
  value,
  label,
  onSave,
  onCancel,
  onEmpty,
  maxLength,
  className = '',
}: InlineEditProps) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = draft.trim();
    if (!save || next === value.trim()) {
      onCancel();
      return;
    }
    if (next === '') {
      onEmpty?.();
      onCancel();
      return;
    }
    onSave(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      finish(false);
    }
  };

  return (
    <input
      ref={inputRef}
      aria-label={label}
      value={draft}
      maxLength={maxLength}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
      className={`h-9 min-w-0 rounded-md border border-border-strong bg-surface px-2 text-text ${className}`}
    />
  );
}
