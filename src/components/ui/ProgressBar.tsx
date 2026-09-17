export interface ProgressBarProps {
  done: number;
  total: number;
  /** Nome acessível (ex.: "Progresso da checklist QA"). */
  label: string;
}

/** Trilho com preenchimento e `x/y` em texto ao lado (design-system §6). */
export function ProgressBar({ done, total, label }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const complete = total > 0 && done === total;

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} de ${total}`}
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className="h-full rounded-full bg-(--status-done-bg) transition-[width] duration-150 ease-standard"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        aria-hidden
        className={`shrink-0 text-xs font-semibold tabular-nums ${complete ? 'text-success' : 'text-muted'}`}
      >
        {done}/{total}
      </span>
    </div>
  );
}
