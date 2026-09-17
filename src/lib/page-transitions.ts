import type { createBrowserRouter } from 'react-router';

import { pageTransitionKey } from './use-page-transition';

type Router = ReturnType<typeof createBrowserRouter>;

/**
 * `push`: entrar um nível; `pop`: voltar um nível; `fade`: trocar de seção no mesmo nível;
 * `enter`: do login/setup/convite para dentro da plataforma; `exit`: sair para o login.
 */
export type NavTransition = 'push' | 'pop' | 'fade' | 'enter' | 'exit' | 'none';

const AUTH_PATHS = ['/login', '/setup', '/convite', '/redefinir-senha'];

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Profundidade na hierarquia de navegação, como numa pilha do iOS:
 * seções do topo (Quadros, Meus cards, Perfil, Administração) = 0; o que se abre a partir
 * delas (um quadro, quadros arquivados) = 1.
 */
export function navDepth(pathname: string): number {
  const key = pageTransitionKey(pathname);
  if (key.startsWith('/b/') || key.startsWith('/quadros/') || key.startsWith('/dev/')) return 1;
  return 0;
}

export function navTransitionType(fromPathname: string, toPathname: string): NavTransition {
  const fromAuth = isAuthPath(fromPathname);
  const toAuth = isAuthPath(toPathname);
  if (fromAuth && !toAuth) return 'enter';
  if (!fromAuth && toAuth) return 'exit';
  // Entre telas de login/setup: o AuthLayout já faz fade ao montar.
  if (fromAuth && toAuth) return 'none';
  // Admin: as abas são um controle segmentado, não uma pilha.
  const fromKey = fromPathname.startsWith('/admin') ? '/admin' : pageTransitionKey(fromPathname);
  const toKey = toPathname.startsWith('/admin') ? '/admin' : pageTransitionKey(toPathname);
  if (fromKey === toKey) return 'none';
  const from = navDepth(fromPathname);
  const to = navDepth(toPathname);
  if (to > from) return 'push';
  if (to < from) return 'pop';
  return 'fade';
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function resolvePathname(to: unknown, current: string): string | null {
  if (typeof to === 'string') return new URL(to, `http://x${current}`).pathname;
  if (to && typeof to === 'object' && 'pathname' in to) {
    const { pathname } = to as { pathname?: string };
    return pathname ? new URL(pathname, `http://x${current}`).pathname : current;
  }
  return null;
}

/**
 * Transições estilo iOS entre páginas com a View Transitions API.
 *
 * - `router.navigate` (usado por `<Link>` e `useNavigate`) liga `viewTransition` quando a
 *   navegação troca de página; `replace` (redirecionamentos) e mudanças só de query não animam,
 *   exceto entrar na plataforma pelo login e sair para o login.
 * - Voltar pelo navegador reaproveita a transição aplicada na ida (comportamento do React Router).
 * - O tipo (`push`/`pop`/`fade`) vai em `html[data-nav-transition]` antes do snapshot novo;
 *   o CSS em globals.css desenha o deslize.
 */
export function installPageTransitions(router: Router): void {
  const originalNavigate = router.navigate.bind(router);

  router.navigate = (to: unknown, opts?: Record<string, unknown>) => {
    if (typeof to === 'number' || opts?.viewTransition !== undefined) {
      return originalNavigate(to as never, opts as never);
    }
    const current = router.state.location.pathname;
    const target = resolvePathname(to, current);
    const type = target ? navTransitionType(current, target) : 'none';
    // `replace` costuma ser redirecionamento e não anima, exceto entrar/sair da plataforma
    // (o login e o logout navegam com replace).
    const replaceAllowed = type === 'enter' || type === 'exit';
    if (type === 'none' || (opts?.replace && !replaceAllowed) || prefersReducedMotion()) {
      return originalNavigate(to as never, opts as never);
    }
    return originalNavigate(to as never, { ...opts, viewTransition: true } as never);
  };

  let previous = router.state.location.pathname;
  router.subscribe((state) => {
    const next = state.location.pathname;
    if (next === previous) return;
    document.documentElement.dataset.navTransition = navTransitionType(previous, next);
    previous = next;
  });
}
