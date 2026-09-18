import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getToasts } from '../../../components/ui/toast-store';
import { apiErrorResponse, authHandlers, sessionFixture } from '../../../test/auth-handlers';
import { renderApp } from '../../../test/render';
import { server } from '../../../test/server';

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('E-mail'), email);
  await user.type(screen.getByLabelText('Senha'), password);
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  return user;
}

describe('LoginPage', () => {
  it('entra e vai para a rota interna do next', async () => {
    const { router } = renderApp('/login?next=%2Fb%2F123%3Fx%3D1');

    await fillAndSubmit('  ANA@empresa.com ', 'senha-correta-1');

    await waitFor(() => expect(router.state.location.pathname).toBe('/b/123'));
    expect(router.state.location.search).toBe('?x=1');
    expect(
      await screen.findByRole('button', { name: `Menu da conta de ${sessionFixture.user.name}` }),
    ).toBeInTheDocument();
  });

  it('ignora next externo e vai para a home', async () => {
    const { router } = renderApp('/login?next=%2F%2Fevil.com');

    await fillAndSubmit('ana@empresa.com', 'senha-correta-1');

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('credenciais erradas mostram a mensagem genérica, limpam e focam a senha', async () => {
    renderApp('/login');

    await fillAndSubmit('ana@empresa.com', 'senha-errada-123');

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
    const password = screen.getByLabelText('Senha');
    expect(password).toHaveValue('');
    await waitFor(() => expect(password).toHaveFocus());
    expect(getToasts()).toEqual([]);
  });

  it('429 mostra o tempo do Retry-After e bloqueia o botão', async () => {
    server.use(
      authHandlers.loginError('TOO_MANY_ATTEMPTS', {
        message: 'Muitas tentativas.',
        retryAfterSeconds: 300,
      }),
    );
    renderApp('/login');

    await fillAndSubmit('ana@empresa.com', 'qualquer-senha');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas seguidas. Tente de novo em 5 minutos.',
    );
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled();
    expect(getToasts()).toEqual([]);
  });

  it('valida no cliente com o schema compartilhado e foca o primeiro erro', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    await user.type(await screen.findByLabelText('E-mail'), 'ana@');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    const email = screen.getByLabelText('E-mail');
    expect(
      await screen.findByText('Digite um e-mail válido, como nome@empresa.com.'),
    ).toBeVisible();
    expect(screen.getByText('Informe sua senha.')).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('Corrija 2 campos para continuar.');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription('Digite um e-mail válido, como nome@empresa.com.');
    expect(email).toHaveFocus();
  });

  it('mapeia os details de VALIDATION_ERROR para os campos', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        apiErrorResponse('VALIDATION_ERROR', {
          message: 'Dados inválidos.',
          details: [{ path: 'email', message: 'E-mail inválido' }],
        }),
      ),
    );
    renderApp('/login');

    await fillAndSubmit('ana@empresa.com', 'x');

    const email = await screen.findByLabelText('E-mail');
    await waitFor(() => expect(email).toHaveAccessibleDescription('E-mail inválido.'));
    expect(email).toHaveFocus();
  });

  it('mostra ou oculta a senha', async () => {
    const user = userEvent.setup();
    renderApp('/login');

    const password = await screen.findByLabelText('Senha');
    const toggle = screen.getByRole('button', { name: 'Mostrar senha' });
    expect(password).toHaveAttribute('type', 'password');

    await user.click(toggle);

    expect(password).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });
});
