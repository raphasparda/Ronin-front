import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiErrorResponse, authHandlers, sessionFixture } from '../../test/auth-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const userMenuName = `Menu da conta de ${sessionFixture.user.name}`;

describe('boot', () => {
  it('instância nova vai para /setup', async () => {
    server.use(authHandlers.setupStatus(true));

    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Configurar a equipe' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/setup');
  });

  it('instância nova também tira do /login', async () => {
    server.use(authHandlers.setupStatus(true));

    const { router } = renderApp('/login');

    expect(await screen.findByRole('heading', { name: 'Configurar a equipe' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/setup');
  });

  it('sem sessão (401) vai para /login guardando a rota em next', async () => {
    server.use(authHandlers.meUnauthenticated());

    const { router } = renderApp('/b/123?x=1');

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/b/123?x=1');
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: userMenuName })).not.toBeInTheDocument();
  });

  it('logado abre a home com o menu do usuário', async () => {
    const { router } = renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: userMenuName })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('/setup com instância configurada volta para a home', async () => {
    const { router } = renderApp('/setup');

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('erro ao consultar o status mostra tela de erro com "Tentar de novo"', async () => {
    server.use(
      http.get('/api/setup/status', () => apiErrorResponse('INTERNAL_ERROR'), { once: true }),
    );
    const user = userEvent.setup();

    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
  });

  it('401 no meio do uso volta ao login avisando que a sessão expirou', async () => {
    server.use(http.get('/api/health', () => apiErrorResponse('UNAUTHENTICATED')));

    const { router } = renderApp('/');

    expect(
      await screen.findByText('Sua sessão expirou. Entre de novo para continuar.'),
    ).toBeVisible();
    expect(router.state.location.pathname).toBe('/login');
  });
});

describe('menu do usuário', () => {
  it('abre pelo teclado, fecha com Esc e devolve o foco', async () => {
    const user = userEvent.setup();
    renderApp('/');

    const button = await screen.findByRole('button', { name: userMenuName });
    button.focus();
    await user.keyboard('{Enter}');

    const signOut = screen.getByRole('menuitem', { name: 'Sair' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(sessionFixture.user.email)).toBeVisible();
    await waitFor(() => expect(signOut).toHaveFocus());

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('"Sair" chama o logout e volta para o login', async () => {
    let logoutCalls = 0;
    server.use(
      http.post('/api/auth/logout', ({ request }) => {
        logoutCalls += request.headers.get('X-Kanban-Csrf') === '1' ? 1 : 0;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    const { router, queryClient } = renderApp('/');

    await user.click(await screen.findByRole('button', { name: userMenuName }));
    await user.click(screen.getByRole('menuitem', { name: 'Sair' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
    expect(logoutCalls).toBe(1);
    await waitFor(() => expect(queryClient.getQueryData(['session'])).toBeUndefined());
    expect(screen.queryByText(/Sua sessão expirou/)).not.toBeInTheDocument();
  });
});
