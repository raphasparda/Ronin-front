import { ChevronDown, CircleAlert } from 'lucide-react';
import { useId, type ComponentProps } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'children'> {
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
}

/** `<select>` nativo com o mesmo visual e ligação de rótulo/dica/erro do `Input`. */
export function Select({ label, options, hint, error, id, className = '', ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={selectId} className="font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-10 w-full appearance-none rounded-md bg-surface pr-9 text-md text-text md:h-9 md:text-sm ${
            error ? 'border-2 border-danger pl-[11px]' : 'border border-border-strong pl-3'
          }`}
          {...props}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown
          aria-hidden
          size={16}
          className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
        />
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
