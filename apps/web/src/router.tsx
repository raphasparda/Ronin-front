import { createBrowserRouter, type RouteObject } from 'react-router';

import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/auth/LoginPage';
import { RequireAuth, type LoginLocationState } from './features/auth/RequireAuth';
import { NotFoundPage } from './features/home/NotFoundPage';
import { loginPath } from './lib/safe-next';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/paleta',
        lazy: async () => ({ Component: (await import('./features/dev/PalettePage')).PalettePage }),
      },
    ]
  : [];

/**
 * `/login` não é lazy: o redirecionamento de 401 precisa trocar de tela antes que a rota
 * protegida refaça as consultas.
 */
export const routes: RouteObject[] = [
  { path: '/login', Component: LoginPage },
  {
    path: '/setup',
    lazy: async () => ({ Component: (await import('./features/auth/SetupPage')).SetupPage }),
  },
  {
    Component: RequireAuth,
    children: [
      {
        path: '/',
        Component: AppLayout,
        children: [
          {
            index: true,
            lazy: async () => ({ Component: (await import('./features/home/HomePage')).HomePage }),
          },
          ...devRoutes,
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

export type AppRouter = ReturnType<typeof createBrowserRouter>;

/** 401 fora do boot (sessão expirou no meio do uso): volta ao login guardando a rota atual. */
export function redirectToLogin(router: AppRouter): void {
  const { pathname, search, hash } = router.state.location;
  if (pathname === '/login' || pathname === '/setup') return;
  const state: LoginLocationState = { sessionExpired: true };
  void router.navigate(loginPath(`${pathname}${search}${hash}`), { replace: true, state });
}
