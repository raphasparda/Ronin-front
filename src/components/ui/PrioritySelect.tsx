import { CARD_PRIORITIES, NO_PRIORITY_LABEL, type CardPriority } from '@raphasparda/ronin-shared';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { PriorityBadge } from './PriorityBadge';

/** Ordem do seletor: mais urgente primeiro e "Sem prioridade" no fim. */
const OPTIONS: readonly (CardPriority | null)[] = [...[...CARD_PRIORITIES].reverse(), null];

export interface PrioritySelectProps {
  /** Id do rótulo visível ("Prioridade"). */
  labelId: string;
  value: CardPriority | null;
  onChange: (priority: CardPriority | null) => void;
  disabled?: boolean;
}

/**
 * Seletor de prioridade (design-system §6): botão com a pílula atual e listbox com Urgente,
 * Alta, Média, Baixa e "Sem prioridade". Setas navegam, Enter/Espaço escolhem, Esc fecha.
 */
export function PrioritySelect({
  labelId,
  value,
  onChange,
  disabled = false,
}: PrioritySelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonId = useId();
  const listId = useId();
  const optionId = (index: number) => `${listId}-opcao-${index}`;

  useEffect(() => {
    if (!open) return;
    listRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  });

  const show = (index = Math.max(0, OPTIONS.indexOf(value))) => {
    setActive(index);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };

  const choose = (index: number) => {
    const option = OPTIONS[index];
    close();
    if (option !== undefined && option !== value) onChange(option);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      show();
    }
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = OPTIONS.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(active + 1, last),
      ArrowUp: Math.max(active - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key] ?? active);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(active);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${labelId} ${buttonId}`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onButtonKeyDown}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-border-strong bg-surface px-2.5 text-left hover:bg-hover disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken md:h-9"
      >
        {value === null ? (
          <span className="text-muted">{NO_PRIORITY_LABEL}</span>
        ) : (
          <PriorityBadge priority={value} srPrefix={false} />
        )}
        <ChevronDown aria-hidden size={16} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={labelId}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKeyDown}
          className="absolute top-full right-0 left-0 z-40 mt-1 rounded-lg border border-border bg-surface p-1 shadow-md focus-visible:outline-offset-0"
        >
          {OPTIONS.map((option, index) => {
            const selected = option === value;
            return (
              <div
                key={option ?? 'none'}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                onPointerMove={() => setActive(index)}
                onClick={() => choose(index)}
                className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 md:min-h-8 ${
                  index === active ? 'bg-hover' : ''
                } ${option === null ? 'mt-1 border-t border-border text-muted' : ''}`}
              >
                {option === null ? (
                  NO_PRIORITY_LABEL
                ) : (
                  <PriorityBadge priority={option} srPrefix={false} />
                )}
                {selected && <Check aria-hidden size={16} className="ml-auto shrink-0 text-text" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
