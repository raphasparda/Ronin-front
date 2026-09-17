import type { CardPriority, PaletteColor } from '@kanban/shared';
import type { ComponentProps, ReactNode } from 'react';

export type PillStatus = 'scheduled' | 'due-soon' | 'overdue' | 'done' | 'archived';

export interface PillProps extends ComponentProps<'span'> {
  color?: PaletteColor;
  priority?: CardPriority;
  status?: PillStatus;
  icon?: ReactNode;
}

/**
 * Pílula sólida. Com `color`, `priority` ou `status`, a cor vem de `data-*` (globals.css);
 * sem nenhum deles, é a pílula neutra. O texto é sempre obrigatório (RN17).
 */
export function Pill({
  color,
  priority,
  status,
  icon,
  className = '',
  children,
  ...props
}: PillProps) {
  const colored = color !== undefined || priority !== undefined || status !== undefined;

  return (
    <span
      data-color={color}
      data-priority={priority}
      data-status={status}
      className={`inline-flex h-[22px] max-w-full items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ${
        colored ? 'bg-(--c-bg) text-(--c-fg)' : 'bg-pill text-on-pill'
      } ${className}`}
      {...props}
    >
      {icon && (
        <span aria-hidden className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
