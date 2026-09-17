import { PRIORITY_LABELS, type CardPriority } from '@kanban/shared';
import { ChevronDown, ChevronUp, ChevronsUp, Equal, type LucideIcon } from 'lucide-react';

import { Pill } from './Pill';

const PRIORITY_ICONS: Record<CardPriority, LucideIcon> = {
  urgent: ChevronsUp,
  high: ChevronUp,
  medium: Equal,
  low: ChevronDown,
};

export interface PriorityBadgeProps {
  priority: CardPriority | null;
  className?: string;
}

/** Prioridade com ícone e texto; nada quando o card não tem prioridade. */
export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (priority === null) return null;
  const Icon = PRIORITY_ICONS[priority];

  return (
    <Pill priority={priority} icon={<Icon size={12} strokeWidth={2.5} />} className={className}>
      <span className="sr-only">Prioridade </span>
      {PRIORITY_LABELS[priority]}
    </Pill>
  );
}
