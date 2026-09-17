import { PALETTE, PALETTE_LABELS, type PaletteColor } from '@kanban/shared';
import { Check } from 'lucide-react';
import { useRef, type KeyboardEvent } from 'react';

export interface ColorSwatchPickerProps {
  value: PaletteColor;
  onChange: (color: PaletteColor) => void;
  /** Nome do grupo (ex.: "Cor da lista A fazer"). */
  label: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const SIZES = { sm: 'size-6', md: 'size-7' } as const;

const NEXT_KEYS = new Set(['ArrowRight', 'ArrowDown']);
const PREVIOUS_KEYS = new Set(['ArrowLeft', 'ArrowUp']);

/**
 * Paleta fixa como `radiogroup` (RN15): uma parada de Tab, setas escolhem a cor,
 * cada amostra tem o nome da cor ("Azul") e a selecionada mostra um check.
 */
export function ColorSwatchPicker({
  value,
  onChange,
  label,
  size = 'md',
  disabled = false,
}: ColorSwatchPickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const select = (index: number) => {
    const color = PALETTE[(index + PALETTE.length) % PALETTE.length] as PaletteColor;
    onChange(color);
    groupRef.current?.querySelector<HTMLElement>(`[data-swatch="${color}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = PALETTE.indexOf(value);
    if (NEXT_KEYS.has(event.key)) {
      event.preventDefault();
      select(index + 1);
    } else if (PREVIOUS_KEYS.has(event.key)) {
      event.preventDefault();
      select(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      select(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      select(PALETTE.length - 1);
    }
  };

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={disabled ? undefined : onKeyDown}
      className="flex flex-wrap gap-2"
    >
      {PALETTE.map((color) => {
        const checked = color === value;
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={PALETTE_LABELS[color]}
            data-swatch={color}
            tabIndex={checked ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(color)}
            className="inline-flex size-10 items-center justify-center rounded-full disabled:cursor-not-allowed md:size-9"
          >
            <span
              aria-hidden
              data-color={color}
              className={`inline-flex items-center justify-center rounded-full border-2 border-(--c-border) bg-(--c-bg) text-(--c-fg) ${
                checked ? 'outline-2 outline-offset-2 outline-text' : ''
              } ${SIZES[size]}`}
            >
              {checked && <Check size={size === 'md' ? 16 : 14} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
