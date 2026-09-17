import { afterEach, describe, expect, it, vi } from 'vitest';

import { installPageTransitions, navDepth, navTransitionType } from './page-transitions';

describe('navTransitionType', () => {
  it('entrar num quadro é push; voltar para Quadros é pop', () => {
    expect(navTransitionType('/', '/b/abc')).toBe('push');
    expect(navTransitionType('/meus-cards', '/b/abc/c/1')).toBe('push');
    expect(navTransitionType('/b/abc', '/')).toBe('pop');
    expect(navTransitionType('/quadros/arquivados', '/')).toBe('pop');
  });

  it('seções do mesmo nível trocam com fade', () => {
    expect(navTransitionType('/', '/meus-cards')).toBe('fade');
    expect(navTransitionType('/b/abc', '/b/outro')).toBe('fade');
    expect(navTransitionType('/perfil', '/admin/membros')).toBe('fade');
  });

  it('não anima detalhe do card, abas de admin nem telas de login', () => {
    expect(navTransitionType('/b/abc', '/b/abc/c/1')).toBe('none');
    expect(navTransitionType('/b/abc/c/1', '/b/abc')).toBe('none');
    expect(navTransitionType('/admin/membros', '/admin/convites')).toBe('none');
    expect(navTransitionType('/login', '/')).toBe('none');
    expect(navTransitionType('/', '/login')).toBe('none');
  });

  it('profundidade', () => {
    expect(navDepth('/')).toBe(0);
    expect(navDepth('/meus-cards')).toBe(0);
    expect(navDepth('/b/abc/c/1')).toBe(1);
  });
});

describe('installPageTransitions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.navTransition;
  });

  function fakeRouter(pathname: string) {
    const listeners: Array<(s: { location: { pathname: string } }) => void> = [];
    const navigate = vi.fn((_to: unknown, _opts?: unknown) => Promise.resolve());
    const router = {
      state: { location: { pathname } },
      navigate,
      subscribe: (fn: (typeof listeners)[number]) => {
        listeners.push(fn);
        return () => undefined;
      },
    };
    const emit = (p: string) => {
      router.state = { location: { pathname: p } };
      listeners.forEach((fn) => fn(router.state));
    };
    return { router, navigate, emit };
  }

  function install(pathname: string, reduced = false) {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: reduced }) as MediaQueryList),
    );
    const f = fakeRouter(pathname);
    installPageTransitions(f.router as never);
    return f;
  }

  it('liga viewTransition quando troca de página', async () => {
    const { router, navigate } = install('/');
    await router.navigate('/b/abc');
    expect(navigate).toHaveBeenCalledWith('/b/abc', { viewTransition: true });
  });

  it('não liga em replace, só query, detalhe do card ou reduzir movimento', async () => {
    const { router, navigate } = install('/b/abc');
    await router.navigate('/', { replace: true });
    await router.navigate('?prioridade=urgent');
    await router.navigate('/b/abc/c/1');
    expect(navigate).toHaveBeenNthCalledWith(1, '/', { replace: true });
    expect(navigate).toHaveBeenNthCalledWith(2, '?prioridade=urgent', undefined);
    expect(navigate).toHaveBeenNthCalledWith(3, '/b/abc/c/1', undefined);

    const reduced = install('/', true);
    await reduced.router.navigate('/b/abc');
    expect(reduced.navigate).toHaveBeenCalledWith('/b/abc', undefined);
  });

  it('marca a direção no <html> quando a localização muda', () => {
    const { emit } = install('/');
    emit('/b/abc');
    expect(document.documentElement.dataset.navTransition).toBe('push');
    emit('/');
    expect(document.documentElement.dataset.navTransition).toBe('pop');
    emit('/meus-cards');
    expect(document.documentElement.dataset.navTransition).toBe('fade');
  });
});
