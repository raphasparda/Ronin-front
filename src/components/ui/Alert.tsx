import { CircleAlert, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

export type AlertTone = 'error' | 'info' | 'success';

const TONES: Record<AlertTone, { bar: string; icon: LucideIcon; iconClass: string }> = {
  error: { bar: 'border-l-(--status-overdue-bg)', icon: CircleAlert, iconClass: 'text-danger' },
  info: { bar: 'border-l-accent', icon: Info, iconClass: 'text-accent-text' },
  success: { bar: 'border-l-(--status-done-bg)', icon: CircleCheck, iconClass: 'text-success' },
};

export interface AlertProps extends ComponentProps<'div'> {
  tone?: AlertTone;
}

/** Faixa de aviso dentro da página (erro de formulário, sessão expirada). */
export function Alert({ tone = 'error', className = '', children, ...props }: AlertProps) {
  const { bar, icon: Icon, iconClass } = TONES[tone];

  return (
    <div
      className={`flex items-start gap-2.5 rounded-lg border border-l-4 border-border bg-surface-sunken p-3 text-text ${bar} ${className}`}
      {...props}
    >
      <Icon aria-hidden size={16} className={`mt-0.5 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
