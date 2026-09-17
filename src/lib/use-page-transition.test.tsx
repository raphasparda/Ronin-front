import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pageTransitionKey, usePageTransition } from './use-page-transition';

function Page({ transitionKey }: { transitionKey: string }) {
  const ref = usePageTransition<HTMLDivElement>(transitionKey);
  return <div ref={ref} data-testid="page" />;
}

function mockAnimate() {
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }) as unknown as Animation);
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    writable: true,
    value: animate,
  });
  return { animate, cancel };
}

function mockReducedMotion(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches }) as MediaQueryList),
  );
}

afterEach(() => {
  delete (HTMLElement.prototype as { animate?: unknown }).animate;
  vi.unstubAllGlobals();
});

describe('pageTransitionKey', () => {
  it('mantém a página do quadro ao abrir o detalhe do card', () => {
    expect(pageTransitionKey('/b/abc/c/xyz')).toBe('/b/abc');
    expect(pageTransitionKey('/b/abc/c/xyz/')).toBe('/b/abc');
    expect(pageTransitionKey('/b/abc')).toBe('/b/abc');
  });

  it('páginas diferentes têm chaves diferentes', () => {
    expect(pageTransitionKey('/')).toBe('/');
    expect(pageTransitionKey('/meus-cards')).toBe('/meus-cards');
    expect(pageTransitionKey('/b/outro')).not.toBe(pageTransitionKey('/b/abc'));
  });
});

describe('usePageTransition', () => {
  it('não anima na primeira renderização nem quando a chave se repete', () => {
    mockReducedMotion(false);
    const { animate } = mockAnimate();
    const { rerender } = render(<Page transitionKey="/" />);
    rerender(<Page transitionKey="/" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('faz fade só de opacidade quando a página muda', () => {
    mockReducedMotion(false);
    const { animate } = mockAnimate();
    const { rerender } = render(<Page transitionKey="/" />);
    rerender(<Page transitionKey="/meus-cards" />);
    expect(animate).toHaveBeenCalledTimes(1);
    expect(animate).toHaveBeenCalledWith(
      [{ opacity: 0 }, { opacity: 1 }],
      expect.objectContaining({ duration: 200 }),
    );
  });

  it('respeita "reduzir movimento"', () => {
    mockReducedMotion(true);
    const { animate } = mockAnimate();
    const { rerender } = render(<Page transitionKey="/" />);
    rerender(<Page transitionKey="/perfil" />);
    expect(animate).not.toHaveBeenCalled();
  });

  it('cancela a animação anterior ao trocar de página de novo', () => {
    mockReducedMotion(false);
    const { cancel } = mockAnimate();
    const { rerender } = render(<Page transitionKey="/" />);
    rerender(<Page transitionKey="/a" />);
    rerender(<Page transitionKey="/b" />);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
