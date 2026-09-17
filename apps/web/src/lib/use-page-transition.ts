import { useLayoutEffect, useRef, type RefObject } from 'react';

const DURATION_MS = 200;
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'; // --ease-standard

/**
 * Chave da "página" para a transição: abrir/fechar o detalhe do card (`/b/:id/c/:cardId`)
 * continua na mesma página do quadro, e mudar só a query (filtros) não conta.
 */
export function pageTransitionKey(pathname: string): string {
  return pathname.replace(/^(\/b\/[^/]+)\/c\/[^/]+\/?$/, '$1');
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Fade de entrada quando `key` muda. Usa a Web Animations API no próprio elemento, sem
 * remontar a página (estado, rascunhos e foco continuam). Só opacidade: `transform` criaria
 * um bloco de contenção e deslocaria menus `position: fixed` durante a animação.
 */
export function usePageTransition<T extends HTMLElement>(
  key: string,
  { animateOnMount = false }: { animateOnMount?: boolean } = {},
): RefObject<T | null> {
  const ref = useRef<T>(null);
  const previousKey = useRef<string | null>(null);

  useLayoutEffect(() => {
    const isFirst = previousKey.current === null;
    const changed = previousKey.current !== key;
    previousKey.current = key;
    const el = ref.current;
    if ((isFirst && !animateOnMount) || !changed || !el || typeof el.animate !== 'function') return;
    if (prefersReducedMotion()) return;

    const animation = el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: DURATION_MS,
      easing: EASING,
    });
    return () => animation.cancel();
  }, [key, animateOnMount]);

  return ref;
}
