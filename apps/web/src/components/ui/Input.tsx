import { CircleAlert } from 'lucide-react';
import { useId, type ComponentProps, type ReactNode } from 'react';

export interface InputProps extends ComponentProps<'input'> {
  label: string;
  hint?: string;
  error?: string;
  /** Controle dentro do campo, à direita (ex.: mostrar/ocultar senha). */
  trailing?: ReactNode;
}

export function Input({ label, hint, error, trailing, id, className = '', ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={inputId} className="font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-10 w-full rounded-md bg-surface text-md text-text md:h-9 md:text-sm disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted ${
            error ? 'border-2 border-danger px-[11px]' : 'border border-border-strong px-3'
          } ${trailing ? 'pr-11' : ''}`}
          {...props}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="flex items-start gap-1.5 text-danger">
          <CircleAlert aria-hidden size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
