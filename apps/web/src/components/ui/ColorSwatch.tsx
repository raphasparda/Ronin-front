import { PALETTE_LABELS, type PaletteColor } from '@kanban/shared';
import { Check } from 'lucide-react';

export interface ColorSwatchProps {
  color: PaletteColor;
  selected?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = { sm: 'size-5', md: 'size-7' } as const;

/** Amostra circular de uma cor da paleta, com nome acessível ("Azul"). */
export function ColorSwatch({
  color,
  selected = false,
  size = 'md',
  className = '',
}: ColorSwatchProps) {
  const label = PALETTE_LABELS[color];

  return (
    <span
      role="img"
      aria-label={selected ? `${label}, selecionada` : label}
      data-color={color}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-(--c-border) bg-(--c-bg) text-(--c-fg) ${
        selected ? 'outline-2 outline-offset-2 outline-text' : ''
      } ${SIZES[size]} ${className}`}
    >
      {selected && <Check aria-hidden size={size === 'md' ? 16 : 12} strokeWidth={3} />}
    </span>
  );
}
