import { Calendar, Check, Clock, TriangleAlert, type LucideIcon } from 'lucide-react';

import { describeDue, type DueCard, type DueDisplay } from '../../lib/due';
import { Pill, type PillStatus } from './Pill';

const STATUS: Record<DueDisplay['state'], { status: PillStatus; icon: LucideIcon }> = {
  scheduled: { status: 'scheduled', icon: Calendar },
  due_soon: { status: 'due-soon', icon: Clock },
  overdue: { status: 'overdue', icon: TriangleAlert },
  completed: { status: 'done', icon: Check },
};

export interface DuePillProps {
  card: DueCard;
  timeZone: string | undefined;
  now: Date;
  className?: string;
}

/** Prazo com estado por ícone e texto (RN17); nada quando o card está aberto e sem prazo. */
export function DuePill({ card, timeZone, now, className }: DuePillProps) {
  return <DueStatePill due={describeDue(card, timeZone, now)} className={className} />;
}

/** Mesma pílula a partir do prazo já descrito (a face do card calcula `describeDue` uma vez). */
export function DueStatePill({ due, className }: { due: DueDisplay | null; className?: string }) {
  if (!due) return null;
  const { status, icon: Icon } = STATUS[due.state];

  return (
    <Pill status={status} icon={<Icon size={12} strokeWidth={2.5} />} className={className}>
      <span aria-hidden>{due.text}</span>
      <span className="sr-only">{due.spoken}</span>
    </Pill>
  );
}
