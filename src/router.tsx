import { createBrowserRouter, Navigate, type RouteObject } from 'react-router';

import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './features/platform/auth/LoginPage';
import { RequireAuth, type LoginLocationState } from './features/platform/auth/RequireAuth';
import { NotFoundPage } from './features/platform/home/NotFoundPage';
import { installPageTransitions } from './lib/page-transitions';
import { loginPath } from './lib/safe-next';

const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/paleta',
        lazy: async () => ({
          Component: (await import('./features/platform/dev/PalettePage')).PalettePage,
        }),
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
    lazy: async () => ({
      Component: (await import('./features/platform/auth/SetupPage')).SetupPage,
    }),
  },
  {
    path: '/convite',
    lazy: async () => ({
      Component: (await import('./features/platform/auth/InvitePage')).InvitePage,
    }),
  },
  {
    path: '/redefinir-senha',
    lazy: async () => ({
      Component: (await import('./features/platform/auth/ResetPasswordPage')).ResetPasswordPage,
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
              Component: (await import('./features/tools/kanban/boards/BoardsPage')).BoardsPage,
            }),
          },
          {
            path: 'quadros/arquivados',
            lazy: async () => ({
              Component: (await import('./features/tools/kanban/boards/ArchivedBoardsPage'))
                .ArchivedBoardsPage,
            }),
          },
          {
            path: 'b/:boardId',
            lazy: async () => ({
              Component: (await import('./features/tools/kanban/boards/BoardPage')).BoardPage,
            }),
            children: [
              {
                path: 'c/:cardId',
                lazy: async () => ({
                  Component: (await import('./features/tools/kanban/cards/CardDetailRoute'))
                    .CardDetailRoute,
                }),
              },
            ],
          },
          {
            path: 'meus-cards',
            lazy: async () => ({
              Component: (await import('./features/tools/kanban/my-cards/MyCardsPage')).MyCardsPage,
            }),
          },
          {
            path: 'perfil',
            lazy: async () => ({
              Component: (await import('./features/platform/profile/ProfilePage')).ProfilePage,
            }),
          },
          {
            path: 'admin',
            lazy: async () => ({
              Component: (await import('./features/platform/admin/AdminLayout')).AdminLayout,
            }),
            children: [
              { index: true, element: <Navigate to="/admin/membros" replace /> },
              {
                path: 'membros',
                lazy: async () => ({
                  Component: (await import('./features/platform/admin/MembersPage')).MembersPage,
                }),
              },
              {
                path: 'convites',
                lazy: async () => ({
                  Component: (await import('./features/platform/admin/InvitesPage')).InvitesPage,
                }),
              },
              {
                path: 'workspace',
                lazy: async () => ({
                  Component: (await import('./features/platform/admin/WorkspacePage'))
                    .WorkspacePage,
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
  const router = createBrowserRouter(routes);
  installPageTransitions(router);
  return router;
}

export type AppRouter = ReturnType<typeof createBrowserRouter>;

/** 401 fora do boot (sessão expirou no meio do uso): volta ao login guardando a rota atual. */
export function redirectToLogin(router: AppRouter): void {
  const { pathname, search, hash } = router.state.location;
  if (pathname === '/login' || pathname === '/setup') return;
  const state: LoginLocationState = { sessionExpired: true };
  void router.navigate(loginPath(`${pathname}${search}${hash}`), { replace: true, state });
}
