import { useLayoutEffect, useState } from 'react';

type Handler = (...args: never[]) => unknown;

function createStableHandlers<T>(initial: T) {
  let current = initial as Record<string, Handler>;
  const stable = Object.fromEntries(
    Object.keys(current).map((key) => [key, (...args: never[]) => current[key]?.(...args)]),
  ) as T;
  return {
    stable,
    update: (next: T) => {
      current = next as Record<string, Handler>;
    },
  };
}

/**
 * Objeto de callbacks com identidade estável que sempre chama a versão mais recente de cada um.
 * Permite `memo` nos filhos sem listar dependências (as chaves são fixadas no primeiro render).
 */
export function useStableHandlers<T extends { [K in keyof T]: Handler }>(handlers: T): T {
  const [{ stable, update }] = useState(() => createStableHandlers(handlers));
  useLayoutEffect(() => update(handlers));
  return stable;
}
