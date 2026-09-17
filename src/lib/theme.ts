import { useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

/** Mesma chave lida por `public/theme-init.js`. */
export const THEME_STORAGE_KEY = 'kanban.theme';

const listeners = new Set<() => void>();

function toTheme(value: string | null): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

export function getTheme(): Theme {
  return toTheme(document.documentElement.getAttribute('data-theme'));
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Armazenamento bloqueado: o tema vale só para esta aba.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return;
    document.documentElement.setAttribute('data-theme', toTheme(event.newValue));
    listener();
  };
  window.addEventListener('storage', onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getServerTheme(): Theme {
  return 'light';
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, getServerTheme);
}
