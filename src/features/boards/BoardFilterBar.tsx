import {
  CARD_PRIORITIES,
  DUE_FILTER_VALUES,
  NO_PRIORITY_FILTER,
  NO_PRIORITY_LABEL,
  PRIORITY_LABELS,
  type BoardFilter,
  type BoardPayload,
  type DueFilter,
  type PriorityFilter,
} from '@raphasparda/ronin-shared';
import { Calendar, ChevronDown, Clock, Search, TriangleAlert, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import { LabelPill } from '../../components/ui/LabelPill';
import { Pill } from '../../components/ui/Pill';
import { Popover } from '../../components/ui/Popover';
import { PriorityBadge } from '../../components/ui/PriorityBadge';
import { useSessionUser } from '../auth/auth-api';
import { unlockedCards } from '../cards/cards-api';
import { displayName, useUsers } from '../users/users-api';

export const SEARCH_DEBOUNCE_MS = 200;
export const FILTER_HELP = 'Mostra cards que atendem a pelo menos uma opção.';

const DUE_OPTION_LABELS: Record<DueFilter, string> = {
  overdue: 'Atrasado',
  due_soon: 'Vencendo (24h)',
  none: 'Sem prazo',
};

const DUE_ICONS: Record<DueFilter, ReactNode> = {
  overdue: <TriangleAlert size={12} strokeWidth={2.5} />,
  due_soon: <Clock size={12} strokeWidth={2.5} />,
  none: <Calendar size={12} strokeWidth={2.5} />,
};

const PRIORITY_OPTIONS: readonly PriorityFilter[] = [
  ...[...CARD_PRIORITIES].reverse(),
  NO_PRIORITY_FILTER,
];

export interface FilterOption {
  value: string;
  /** Texto usado nos chips e no nome acessível. */
  text: string;
  display?: ReactNode;
}

function toggle<T extends string>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

interface FilterMenuProps {
  label: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  emptyText: string;
  onToggle: (value: string) => void;
}

function FilterMenu({ label, options, selected, emptyText, onToggle }: FilterMenuProps) {
  const helpId = useId();
  const count = selected.length;

  return (
    <Popover
      panelLabel={`Filtrar por ${label.toLocaleLowerCase('pt-BR')}`}
      triggerLabel={count > 0 ? `${label}, ${count} selecionado${count === 1 ? '' : 's'}` : label}
      triggerClassName={`inline-flex h-10 items-center gap-1.5 rounded-md border px-3 text-sm font-medium md:h-9 ${
        count > 0
          ? 'border-accent-text bg-surface text-text'
          : 'border-border-strong bg-surface text-text hover:bg-hover'
      }`}
      trigger={
        <>
          {label}
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-on-accent">
              {count}
            </span>
          )}
          <ChevronDown aria-hidden size={16} className="text-muted" />
        </>
      }
    >
      <fieldset aria-describedby={helpId} className="flex flex-col gap-1">
        <legend className="sr-only">{label}</legend>
        {options.length === 0 ? (
          <p className="text-muted">{emptyText}</p>
        ) : (
          options.map((option) => (
            <label
              key={option.value}
              className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 hover:bg-hover md:min-h-8"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => onToggle(option.value)}
                aria-label={option.text}
                className="size-4 shrink-0 accent-(--color-accent)"
              />
              <span aria-hidden className="flex min-w-0 items-center">
                {option.display ?? option.text}
              </span>
            </label>
          ))
        )}
      </fieldset>
      <p id={helpId} className="mt-2 border-t border-border pt-2 text-xs text-muted">
        {FILTER_HELP}
      </p>
    </Popover>
  );
}

/** Opções de cada critério, com os nomes usados nos chips. */
export function useFilterOptions(payload: BoardPayload) {
  const users = useUsers();
  const me = useSessionUser();

  const assignedIds = new Set(unlockedCards(payload.cards).flatMap((card) => card.assigneeIds));
  const people = (users.data ?? [])
    .filter((user) => user.id !== me?.id && (user.status === 'active' || assignedIds.has(user.id)))
    .map((user) => ({
      value: user.id,
      text:
        user.status === 'active' ? displayName(user) : `${displayName(user)} (conta desativada)`,
    }));
  const assignees: FilterOption[] = [...(me ? [{ value: me.id, text: 'Eu' }] : []), ...people];

  const labels: FilterOption[] = payload.labels.map((label) => ({
    value: label.id,
    text: label.name,
    display: <LabelPill label={label} />,
  }));

  const priorities: FilterOption[] = PRIORITY_OPTIONS.map((priority) => ({
    value: priority,
    text: priority === NO_PRIORITY_FILTER ? NO_PRIORITY_LABEL : PRIORITY_LABELS[priority],
    display:
      priority === NO_PRIORITY_FILTER ? (
        NO_PRIORITY_LABEL
      ) : (
        <PriorityBadge priority={priority} srPrefix={false} />
      ),
  }));

  const due: FilterOption[] = DUE_FILTER_VALUES.map((value) => ({
    value,
    text: DUE_OPTION_LABELS[value],
    display:
      value === 'none' ? (
        DUE_OPTION_LABELS[value]
      ) : (
        <Pill status={value === 'overdue' ? 'overdue' : 'due-soon'} icon={DUE_ICONS[value]}>
          {DUE_OPTION_LABELS[value]}
        </Pill>
      ),
  }));

  return { assignees, labels, priorities, due };
}

export type FilterOptions = ReturnType<typeof useFilterOptions>;

interface SearchFieldProps {
  value: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCommit: (text: string) => void;
}

function SearchField({ value, inputRef, onCommit }: SearchFieldProps) {
  const [text, setText] = useState(value);
  const committed = useRef(value);
  const inputId = useId();

  useEffect(() => {
    if (value !== committed.current.trim()) {
      committed.current = value;
      setText(value);
    }
  }, [value]);

  useEffect(() => {
    if (text === committed.current) return;
    const timer = window.setTimeout(() => {
      committed.current = text;
      onCommit(text);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text, onCommit]);

  return (
    <div className="relative w-full sm:w-64">
      <label htmlFor={inputId} className="sr-only">
        Buscar por título
      </label>
      <Search
        aria-hidden
        size={16}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={text}
        placeholder="Buscar por título"
        aria-keyshortcuts="/"
        onChange={(event) => setText(event.target.value)}
        className="h-10 w-full rounded-md border border-border-strong bg-surface pr-3 pl-9 text-md text-text md:h-9 md:text-sm"
      />
    </div>
  );
}

interface BoardFilterBarProps {
  id: string;
  filter: BoardFilter;
  options: FilterOptions;
  searchRef: RefObject<HTMLInputElement | null>;
  onChange: (filter: BoardFilter) => void;
}

/** Busca + Responsável, Etiqueta, Prioridade e Prazo (multiseleção; OU dentro, E entre critérios). */
export function BoardFilterBar({ id, filter, options, searchRef, onChange }: BoardFilterBarProps) {
  const latest = useRef({ filter, onChange });
  useEffect(() => {
    latest.current = { filter, onChange };
  });
  const commitText = useCallback(
    (text: string) => latest.current.onChange({ ...latest.current.filter, text }),
    [],
  );

  return (
    <div
      id={id}
      role="search"
      aria-label="Filtros do quadro"
      className="flex flex-wrap items-center gap-2"
    >
      <SearchField value={filter.text} inputRef={searchRef} onCommit={commitText} />
      <FilterMenu
        label="Responsável"
        options={options.assignees}
        selected={filter.assigneeIds}
        emptyText="Ninguém para filtrar."
        onToggle={(value) =>
          onChange({ ...filter, assigneeIds: toggle(filter.assigneeIds, value) })
        }
      />
      <FilterMenu
        label="Etiqueta"
        options={options.labels}
        selected={filter.labelIds}
        emptyText="Este quadro ainda não tem etiquetas."
        onToggle={(value) => onChange({ ...filter, labelIds: toggle(filter.labelIds, value) })}
      />
      <FilterMenu
        label="Prioridade"
        options={options.priorities}
        selected={filter.priorities}
        emptyText=""
        onToggle={(value) =>
          onChange({ ...filter, priorities: toggle(filter.priorities, value as PriorityFilter) })
        }
      />
      <FilterMenu
        label="Prazo"
        options={options.due}
        selected={filter.due}
        emptyText=""
        onToggle={(value) => onChange({ ...filter, due: toggle(filter.due, value as DueFilter) })}
      />
    </div>
  );
}

interface FilterChip {
  key: keyof BoardFilter;
  text: string;
}

function chipsFor(filter: BoardFilter, options: FilterOptions): FilterChip[] {
  const names = (values: readonly string[], list: readonly FilterOption[]) =>
    values.map((value) => list.find((option) => option.value === value)?.text ?? 'Removido');
  const chips: FilterChip[] = [];
  if (filter.assigneeIds.length > 0) {
    chips.push({
      key: 'assigneeIds',
      text: `Responsável: ${names(filter.assigneeIds, options.assignees).join(', ')}`,
    });
  }
  if (filter.labelIds.length > 0) {
    chips.push({
      key: 'labelIds',
      text: `Etiqueta: ${names(filter.labelIds, options.labels).join(', ')}`,
    });
  }
  if (filter.priorities.length > 0) {
    chips.push({
      key: 'priorities',
      text: `Prioridade: ${names(filter.priorities, options.priorities).join(', ')}`,
    });
  }
  if (filter.due.length > 0) {
    chips.push({ key: 'due', text: `Prazo: ${names(filter.due, options.due).join(', ')}` });
  }
  if (filter.text.trim() !== '')
    chips.push({ key: 'text', text: `Busca: "${filter.text.trim()}"` });
  return chips;
}

interface FilterStatusProps {
  filter: BoardFilter;
  options: FilterOptions;
  visible: number;
  total: number;
  onChange: (filter: BoardFilter) => void;
  onClear: () => void;
}

/** "Filtro ativo · 12 de 40 cards · Limpar" (anunciado) + chips removíveis. */
export function FilterStatus({
  filter,
  options,
  visible,
  total,
  onChange,
  onClear,
}: FilterStatusProps) {
  const chips = chipsFor(filter, options);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p role="status" className="text-sm">
        <strong className="font-semibold">Filtro ativo</strong> · {visible} de {total}{' '}
        {total === 1 ? 'card' : 'cards'}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md px-1 text-sm font-semibold text-accent-text underline underline-offset-2 hover:bg-hover"
      >
        Limpar
      </button>
      <ul aria-label="Filtros aplicados" className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <li key={chip.key}>
            <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-full bg-pill pr-1 pl-3 text-xs font-semibold text-on-pill">
              <span className="truncate">{chip.text}</span>
              <button
                type="button"
                aria-label={`Remover filtro ${chip.text}`}
                onClick={() => onChange({ ...filter, [chip.key]: chip.key === 'text' ? '' : [] })}
                className="inline-flex size-6 items-center justify-center rounded-full hover:bg-hover"
              >
                <X aria-hidden size={14} />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
