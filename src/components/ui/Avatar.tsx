import { PALETTE, type PaletteColor } from '@raphasparda/ronin-shared';
import { useState } from 'react';

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

/**
 * URL da foto do usuário. `updatedAt` (de `UserSummary.avatarUpdatedAt`) versiona a URL: o
 * navegador guarda a imagem e troca na hora quando a foto muda (api.md §7).
 */
export function avatarUrl(id: string, updatedAt: string): string {
  return `/api/users/${id}/avatar?v=${encodeURIComponent(updatedAt)}`;
}

export interface AvatarProps {
  id: string;
  name: string;
  /** Versão da foto; `null`/ausente (ou imagem que não carrega) cai nas iniciais. */
  avatarUpdatedAt?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = { sm: 'size-6 text-[10px]', md: 'size-8 text-xs' } as const;

/** Decorativo: quem usa o avatar dá o nome acessível ao controle que o contém. */
export function Avatar({ id, name, avatarUpdatedAt, size = 'md', className = '' }: AvatarProps) {
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const src = avatarUpdatedAt == null ? null : avatarUrl(id, avatarUpdatedAt);

  if (src !== null && src !== brokenSrc) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        decoding="async"
        // A foto pode ter sumido (removida por outra aba, conta anonimizada): volta às iniciais.
        onError={() => setBrokenSrc(src)}
        className={`inline-block shrink-0 rounded-full bg-pill object-cover ${SIZES[size]} ${className}`}
      />
    );
  }

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
