import { LoaderCircle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Mostra spinner e troca o texto por `loadingText` (ex.: "Salvando…"). */
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'border-transparent bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border-border-strong bg-surface text-text hover:bg-hover',
  ghost: 'border-transparent bg-transparent text-text hover:bg-hover',
  danger: 'border-transparent bg-danger-solid text-on-danger-solid hover:bg-danger-solid-hover',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-10 px-4 md:h-9',
  sm: 'h-7 px-2.5',
};

const DISABLED =
  'disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted';

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingText,
  icon,
  disabled,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-md border text-sm font-medium whitespace-nowrap transition-colors duration-150 ease-standard ${VARIANTS[variant]} ${SIZES[size]} ${DISABLED} ${className}`}
      {...props}
    >
      {loading ? (
        <LoaderCircle aria-hidden size={16} className="animate-spin" />
      ) : (
        icon && (
          <span aria-hidden className="inline-flex shrink-0">
            {icon}
          </span>
        )
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
}
