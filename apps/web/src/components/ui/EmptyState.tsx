import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Nível do título: `h1` quando o estado ocupa a página inteira. */
  headingLevel?: 'h1' | 'h2';
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 'h2',
  className = '',
}: EmptyStateProps) {
  const Heading = headingLevel;

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-4 py-10 text-center shadow-sm ${className}`}
    >
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-surface-sunken text-muted">
        <Icon aria-hidden size={32} />
      </span>
      <Heading className={headingLevel === 'h1' ? 'text-xl' : 'text-md font-semibold'}>
        {title}
      </Heading>
      {description && <p className="max-w-md text-muted">{description}</p>}
      {action}
    </div>
  );
}
