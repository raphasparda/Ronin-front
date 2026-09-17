import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

export interface TabsProps<T extends string> {
  /** Nome acessível do grupo de abas. */
  label: string;
  /** Prefixo único (ex.: `useId()`) que liga cada aba ao seu painel. */
  idPrefix: string;
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export const tabId = (idPrefix: string, id: string) => `${idPrefix}-tab-${id}`;
export const tabPanelId = (idPrefix: string, id: string) => `${idPrefix}-panel-${id}`;

/** Props do painel de uma aba (padrão ARIA tabs). */
export function tabPanelProps(idPrefix: string, id: string) {
  return {
    role: 'tabpanel',
    id: tabPanelId(idPrefix, id),
    'aria-labelledby': tabId(idPrefix, id),
  } as const;
}

/** Abas com ativação automática: setas, Home e End trocam a aba e movem o foco. */
export function Tabs<T extends string>({
  label,
  idPrefix,
  tabs,
  value,
  onChange,
  className = '',
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const wrapped = (index + tabs.length) % tabs.length;
    const tab = tabs[wrapped];
    if (!tab) return;
    onChange(tab.id);
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[wrapped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: tabs.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`flex gap-1 border-b border-border ${className}`}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={tabPanelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={`focus-inset relative -mb-px inline-flex h-10 items-center px-3 md:h-9 ${
              selected ? 'font-semibold text-text' : 'text-muted hover:text-text'
            }`}
          >
            {tab.label}
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-accent"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
