import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { requestsTo, TOKEN } from '../../test/admin-handlers';
import { apiErrorResponse } from '../../test/auth-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

const OTHER_TOKEN = 'Z'.repeat(43);

async function fillAndSubmit(name: string, email: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Seu nome'), name);
  await user.type(screen.getByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), 'senha-forte-123');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
}

describe('/convite', () => {
  it('lê o token do fragmento, tira o token da URL e cria a conta', async () => {
    const { router } = renderApp(`/convite#token=${TOKEN}`);

    expect(await screen.findByText(/entrar na equipe como Membro/)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/convite');
    expect(router.state.location.hash).toBe('');
    expect(requestsTo('invites/lookup')).toEqual([
      { method: 'POST', path: 'invites/lookup', body: { token: TOKEN } },
    ]);

    await fillAndSubmit('Maria Clara', 'maria@empresa.com');

    expect(await screen.findByRole('heading', { level: 1, name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(getToasts().map((item) => item.message)).toContain('Boas-vindas à equipe, Maria.');
    expect(requestsTo('invites/accept')[0]?.body).toEqual({
      token: TOKEN,
      name: 'Maria Clara',
      email: 'maria@empresa.com',
      password: 'senha-forte-123',
    });
  });

  it('convite expirado, usado ou revogado (410) mostra "link inválido"', async () => {
    const { router } = renderApp(`/convite#token=${OTHER_TOKEN}`);

    expect(
      await screen.findByRole('heading', { name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login');
    expect(router.state.location.hash).toBe('');
  });

  it('400 no lookup também é "link inválido"', async () => {
    server.use(http.post('/api/auth/invites/lookup', () => apiErrorResponse('VALIDATION_ERROR')));
    renderApp(`/convite#token=${TOKEN}`);

    expect(
      await screen.findByRole('heading', { name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
  });

  it('sem token ou com token malformado não chama a API', async () => {
    const { unmount } = renderApp('/convite');
    expect(
      await screen.findByRole('heading', { name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
    unmount();

    renderApp('/convite#token=abc');
    expect(
      await screen.findByRole('heading', { name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
    expect(requestsTo('invites/lookup')).toEqual([]);
  });

  it('e-mail já cadastrado aparece no campo', async () => {
    renderApp(`/convite#token=${TOKEN}`);

    await fillAndSubmit('Bruno', 'bruno@empresa.com');

    const email = screen.getByLabelText('E-mail');
    await waitFor(() =>
      expect(email).toHaveAccessibleDescription(
        'Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.',
      ),
    );
    expect(email).toHaveFocus();
  });

  it('token recusado no aceite (410) troca para "link inválido"', async () => {
    server.use(http.post('/api/auth/invites/accept', () => apiErrorResponse('TOKEN_INVALID')));
    renderApp(`/convite#token=${TOKEN}`);

    await fillAndSubmit('Maria', 'maria@empresa.com');

    expect(
      await screen.findByRole('heading', { name: 'Este convite não vale mais' }),
    ).toBeInTheDocument();
  });
});
