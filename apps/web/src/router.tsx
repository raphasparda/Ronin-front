import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

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
    path: '/convite',
    lazy: async () => ({ Component: (await import('./features/auth/InvitePage')).InvitePage }),
  },
  {
    path: '/redefinir-senha',
    lazy: async () => ({
      Component: (await import('./features/auth/ResetPasswordPage')).ResetPasswordPage,
    }),
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
            lazy: async () => ({
              Component: (await import('./features/boards/BoardsPage')).BoardsPage,
            }),
          },
          {
            path: 'quadros/arquivados',
            lazy: async () => ({
              Component: (await import('./features/boards/ArchivedBoardsPage')).ArchivedBoardsPage,
            }),
          },
          {
            path: 'b/:boardId',
            lazy: async () => ({
              Component: (await import('./features/boards/BoardPage')).BoardPage,
            }),
            children: [
              {
                path: 'c/:cardId',
                lazy: async () => ({
                  Component: (await import('./features/cards/CardDetailRoute')).CardDetailRoute,
                }),
              },
            ],
          },
          {
            path: 'perfil',
            lazy: async () => ({
              Component: (await import('./features/profile/ProfilePage')).ProfilePage,
            }),
          },
          {
            path: 'admin',
            lazy: async () => ({
              Component: (await import('./features/admin/AdminLayout')).AdminLayout,
            }),
            children: [
              { index: true, element: <Navigate to="/admin/membros" replace /> },
              {
                path: 'membros',
                lazy: async () => ({
                  Component: (await import('./features/admin/MembersPage')).MembersPage,
                }),
              },
              {
                path: 'convites',
                lazy: async () => ({
                  Component: (await import('./features/admin/InvitesPage')).InvitesPage,
                }),
              },
              {
                path: 'workspace',
                lazy: async () => ({
                  Component: (await import('./features/admin/WorkspacePage')).WorkspacePage,
                }),
              },
            ],
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
