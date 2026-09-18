import { DEFAULT_TIMEZONE } from '@raphasparda/ronin-shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { getToasts } from '../../../components/ui/toast-store';
import { authHandlers } from '../../../test/auth-handlers';
import { renderApp } from '../../../test/render';
import { server } from '../../../test/server';

const VALID = {
  workspaceName: 'Equipe Ronin',
  name: 'Ana Souza',
  email: 'ana@empresa.com',
  password: 'senha-forte-123',
};

async function fillForm(overrides: Partial<typeof VALID & { confirmation: string }> = {}) {
  const values = { ...VALID, confirmation: VALID.password, ...overrides };
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Nome da equipe'), values.workspaceName);
  await user.type(screen.getByLabelText('Seu nome'), values.name);
  await user.type(screen.getByLabelText('E-mail'), values.email);
  await user.type(screen.getByLabelText('Senha'), values.password);
  await user.type(screen.getByLabelText('Confirme a senha'), values.confirmation);
  return user;
}

describe('SetupPage', () => {
  it('cria o admin com o fuso padrão, sem enviar a confirmação, e abre a home', async () => {
    server.use(authHandlers.setupStatus(true));
    let body: unknown;
    server.use(
      http.post('/api/setup', async ({ request }) => {
        body = await request.clone().json();
        return undefined;
      }),
    );
    const { router } = renderApp('/setup');

    expect(await screen.findByLabelText('Fuso horário')).toHaveValue(DEFAULT_TIMEZONE);
    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(body).toEqual({ ...VALID, timezone: DEFAULT_TIMEZONE });
  });

  it('sem requiresSetupToken, não mostra o campo de código nem envia setupToken', async () => {
    server.use(authHandlers.setupStatus(true, { requiresSetupToken: false }));
    let body: unknown;
    server.use(
      http.post('/api/setup', async ({ request }) => {
        body = await request.clone().json();
        return undefined;
      }),
    );
    renderApp('/setup');

    const user = await fillForm();
    expect(screen.queryByLabelText('Código de configuração')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(body).not.toHaveProperty('setupToken');
  });

  it('com requiresSetupToken, pede o código no topo, oculto, e envia setupToken', async () => {
    server.use(
      authHandlers.setupStatus(true, { requiresSetupToken: true }),
      authHandlers.setup({ setupToken: 'codigo-do-servidor-123' }),
    );
    let body: unknown;
    server.use(
      http.post('/api/setup', async ({ request }) => {
        body = await request.clone().json();
        return undefined;
      }),
    );
    const { router } = renderApp('/setup');

    const code = await screen.findByLabelText('Código de configuração');
    const fields = screen.getAllByRole('textbox');
    expect(
      code.compareDocumentPosition(fields[0]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(code).toHaveAttribute('type', 'password');
    expect(code).toHaveAttribute('autocomplete', 'off');
    expect(code).toHaveAccessibleDescription('Peça o código a quem instalou o Ronin no servidor.');

    const user = userEvent.setup();
    await user.type(code, 'codigo-do-servidor-123');
    await user.click(screen.getByRole('button', { name: 'Mostrar código' }));
    expect(code).toHaveAttribute('type', 'text');
    await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
    expect(body).toEqual({
      ...VALID,
      timezone: DEFAULT_TIMEZONE,
      setupToken: 'codigo-do-servidor-123',
    });
  });

  it('com requiresSetupToken, código vazio é barrado no cliente', async () => {
    server.use(authHandlers.setupStatus(true, { requiresSetupToken: true }));
    renderApp('/setup');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    const code = screen.getByLabelText('Código de configuração');
    expect(await screen.findByText('Informe o código de configuração.')).toBeVisible();
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveFocus();
  });

  it('SETUP_TOKEN_INVALID mostra o erro no campo de código e foca nele', async () => {
    server.use(
      authHandlers.setupStatus(true, { requiresSetupToken: true }),
      authHandlers.setup({ setupToken: 'codigo-do-servidor-123' }),
    );
    renderApp('/setup');

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Código de configuração'), 'codigo-errado');
    await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    const code = screen.getByLabelText('Código de configuração');
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveAttribute('aria-invalid', 'true');
    expect(code).toHaveAccessibleDescription(
      'Código de configuração inválido. Peça o código a quem instalou o Ronin no servidor.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Corrija 1 campo para continuar.');
    expect(screen.getByRole('heading', { name: 'Configurar a equipe' })).toBeInTheDocument();
  });

  it('SETUP_TOKEN_INVALID sem o campo na tela recarrega o status e passa a pedir o código', async () => {
    server.use(
      authHandlers.setupStatus(true, { requiresSetupToken: false }),
      authHandlers.setupError('SETUP_TOKEN_INVALID', {
        message: 'Código de configuração inválido.',
      }),
    );
    renderApp('/setup');

    const user = await fillForm();
    server.use(authHandlers.setupStatus(true, { requiresSetupToken: true }));
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByLabelText('Código de configuração')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Esta instância pede um código de configuração. Preencha o campo e tente de novo.',
    );
  });

  it('mostra os details de VALIDATION_ERROR nos campos e foca o primeiro', async () => {
    server.use(
      authHandlers.setupStatus(true),
      authHandlers.setupError('VALIDATION_ERROR', {
        message: 'Dados inválidos.',
        details: [
          { path: 'password', message: 'A senha não pode ser igual ao e-mail' },
          {
            path: 'workspaceName',
            message: 'O nome do workspace pode ter no máximo 100 caracteres',
          },
          { path: 'timezone', message: 'Fuso horário inválido' },
        ],
      }),
    );
    renderApp('/setup');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    const workspace = screen.getByLabelText('Nome da equipe');
    await waitFor(() =>
      expect(workspace).toHaveAccessibleDescription(
        'O nome do workspace pode ter no máximo 100 caracteres.',
      ),
    );
    expect(workspace).toHaveAttribute('aria-invalid', 'true');
    expect(workspace).toHaveFocus();
    expect(screen.getByLabelText('Senha')).toHaveAccessibleDescription(
      'A senha não pode ser igual ao e-mail.',
    );
    expect(screen.getByLabelText('Fuso horário')).toHaveAccessibleDescription(
      'Fuso horário inválido. Usado nos prazos dos cards. Dá para mudar depois.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Corrija 3 campos para continuar.');
  });

  it('valida no cliente: vazios, e-mail, senha curta e confirmação', async () => {
    server.use(authHandlers.setupStatus(true));
    const user = userEvent.setup();
    renderApp('/setup');

    await user.click(await screen.findByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByText('Informe o nome da equipe.')).toBeVisible();
    expect(screen.getByText('Informe seu nome.')).toBeVisible();
    expect(screen.getByLabelText('Nome da equipe')).toHaveFocus();

    await user.type(screen.getByLabelText('E-mail'), 'ana');
    await user.type(screen.getByLabelText('Senha'), 'curta');
    await user.type(screen.getByLabelText('Confirme a senha'), 'outra');
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(
      await screen.findByText('Digite um e-mail válido, como nome@empresa.com.'),
    ).toBeVisible();
    expect(screen.getByText('A senha precisa ter pelo menos 10 caracteres.')).toBeVisible();
    expect(screen.getByText('As senhas não conferem.')).toBeVisible();
  });

  it('instância já configurada avisa e vai para o login', async () => {
    server.use(
      authHandlers.setupStatus(true),
      authHandlers.meUnauthenticated(),
      authHandlers.setupError('SETUP_ALREADY_DONE', { message: 'Já configurada.' }),
    );
    const { router } = renderApp('/setup');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe('');
    expect(getToasts().map((item) => item.message)).toEqual([
      'Esta instância já foi configurada. Entre com sua conta.',
    ]);
  });

  it('instância já configurada com sessão ativa vai para a home', async () => {
    server.use(
      authHandlers.setupStatus(true),
      authHandlers.setupError('SETUP_ALREADY_DONE', { message: 'Já configurada.' }),
    );
    const { router } = renderApp('/setup');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('heading', { name: 'Quadros' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/');
  });

  it('429 mostra o tempo de espera', async () => {
    server.use(
      authHandlers.setupStatus(true),
      http.post('/api/setup', () =>
        HttpResponse.json(
          { error: { code: 'RATE_LIMITED', message: 'Limite.' } },
          { status: 429, headers: { 'Retry-After': '90' } },
        ),
      ),
    );
    renderApp('/setup');

    const user = await fillForm();
    await user.click(screen.getByRole('button', { name: 'Criar conta e começar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas seguidas. Tente de novo em 2 minutos.',
    );
  });
});
