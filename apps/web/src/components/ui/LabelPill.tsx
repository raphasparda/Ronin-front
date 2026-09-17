import type { Label } from '@kanban/shared';

import { Pill } from './Pill';

const FACE_MAX_CHARS = 18;

export interface LabelPillProps {
  label: Pick<Label, 'name' | 'color'>;
  /** Na face do card o nome é cortado com "…" (o nome completo fica no `title`). */
  truncate?: boolean;
  className?: string;
}

/** Etiqueta: cor da paleta **e** nome (o nome da cor não é anunciado). */
export function LabelPill({ label, truncate = false, className }: LabelPillProps) {
  const short =
    truncate && label.name.length > FACE_MAX_CHARS
      ? `${label.name.slice(0, FACE_MAX_CHARS).trimEnd()}…`
      : label.name;

  return (
    <Pill color={label.color} title={label.name} className={className}>
      <span className="truncate">{short}</span>
    </Pill>
  );
}
