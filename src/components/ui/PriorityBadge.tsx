import { PRIORITY_LABELS, type CardPriority } from '@raphasparda/ronin-shared';
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
  /** Prefixo "Prioridade" para leitor de tela (desligue quando o texto ao redor já diz). */
  srPrefix?: boolean;
}

/** Prioridade com ícone e texto; nada quando o card não tem prioridade. */
export function PriorityBadge({ priority, className, srPrefix = true }: PriorityBadgeProps) {
  if (priority === null) return null;
  const Icon = PRIORITY_ICONS[priority];

  return (
    <Pill priority={priority} icon={<Icon size={12} strokeWidth={2.5} />} className={className}>
      {srPrefix && <span className="sr-only">Prioridade </span>}
      {PRIORITY_LABELS[priority]}
    </Pill>
  );
}
