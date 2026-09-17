import { PALETTE, type PaletteColor } from '@kanban/shared';

/** Cor estável por usuário: hash do id módulo 9 (design-system §6). */
export function avatarColor(id: string): PaletteColor {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? 'gray';
}

/** "Raphael Sparda" → "RS"; "ana" → "A". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return `${first}${last}`.toLocaleUpperCase('pt-BR');
}

export interface AvatarProps {
  id: string;
  name: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs' } as const;

/** Decorativo: quem usa o avatar dá o nome acessível ao controle que o contém. */
export function Avatar({ id, name, size = 'md', className = '' }: AvatarProps) {
  return (
    <span
      aria-hidden
      data-color={avatarColor(id)}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-(--c-bg) font-semibold text-(--c-fg) ${SIZES[size]} ${className}`}
    >
      {initials(name)}
    </span>
  );
}
