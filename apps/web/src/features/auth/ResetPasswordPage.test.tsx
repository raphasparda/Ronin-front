import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { requestsTo, TOKEN } from '../../test/admin-handlers';
import { apiErrorResponse } from '../../test/auth-handlers';
import { renderApp } from '../../test/render';
import { server } from '../../test/server';

describe('/redefinir-senha', () => {
  it('tira o token da URL, salva a nova senha e volta ao login com aviso', async () => {
    const user = userEvent.setup();
    const { router } = renderApp(`/redefinir-senha#token=${TOKEN}`);

    expect(
      await screen.findByText('Olá, Bruno. Escolha uma nova senha para sua conta.'),
    ).toBeVisible();
    expect(router.state.location.hash).toBe('');

    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-123');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(screen.getByText('Senha alterada. Entre com a nova senha.')).toBeVisible();
    expect(requestsTo('password-resets/complete')[0]?.body).toEqual({
      token: TOKEN,
      password: 'nova-senha-123',
    });
  });

  it('link inválido (410) mostra a mensagem e o caminho para o login', async () => {
    server.use(
      http.post('/api/auth/password-resets/lookup', () => apiErrorResponse('TOKEN_INVALID')),
    );
    const { router } = renderApp(`/redefinir-senha#token=${TOKEN}`);

    expect(await screen.findByRole('heading', { name: 'Este link não vale mais' })).toBeVisible();
    expect(screen.getByText('Peça um novo ao administrador da equipe.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Ir para o login' })).toBeVisible();
    expect(router.state.location.hash).toBe('');
  });

  it('senha curta é validada no cliente', async () => {
    const user = userEvent.setup();
    renderApp(`/redefinir-senha#token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Nova senha')).toHaveAccessibleDescription(
        'A senha precisa ter pelo menos 10 caracteres.',
      ),
    );
    expect(requestsTo('password-resets/complete')).toEqual([]);
  });

  it('senha igual ao e-mail (400 em password) fica no campo, sem invalidar o link', async () => {
    server.use(
      http.post('/api/auth/password-resets/complete', () =>
        apiErrorResponse('VALIDATION_ERROR', {
          details: [{ path: 'password', message: 'A senha não pode ser igual ao e-mail' }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderApp(`/redefinir-senha#token=${TOKEN}`);

    await user.type(await screen.findByLabelText('Nova senha'), 'bruno@empresa.com');
    await user.click(screen.getByRole('button', { name: 'Salvar nova senha' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Nova senha')).toHaveAccessibleDescription(
        'A senha não pode ser igual ao e-mail.',
      ),
    );
    expect(screen.getByRole('heading', { name: 'Criar nova senha' })).toBeVisible();
  });
});
