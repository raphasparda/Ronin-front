import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { getToasts } from '../../components/ui/toast-store';
import { CURRENT_PASSWORD, requestsTo } from '../../test/admin-handlers';
import { sessionFixture } from '../../test/auth-handlers';
import { renderApp } from '../../test/render';

const toastMessages = () => getToasts().map((item) => item.message);

describe('/perfil', () => {
  it('abre pelo menu do usuário e mostra e-mail e papel', async () => {
    const user = userEvent.setup();
    const { router } = renderApp('/');

    await user.click(
      await screen.findByRole('button', { name: `Menu da conta de ${sessionFixture.user.name}` }),
    );
    await user.click(screen.getByRole('menuitem', { name: 'Meu perfil' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Meu perfil' })).toBeVisible();
    expect(router.state.location.pathname).toBe('/perfil');
    expect(screen.getByText(sessionFixture.user.email, { selector: 'dd' })).toBeVisible();
    expect(screen.getByText('Admin')).toBeVisible();
  });

  it('salva o nome e atualiza o cabeçalho', async () => {
    const user = userEvent.setup();
    renderApp('/perfil');

    const name = await screen.findByLabelText('Nome');
    await user.clear(name);
    await user.type(name, 'Ana Paula');
    await user.click(screen.getByRole('button', { name: 'Salvar nome' }));

    expect(
      await screen.findByRole('button', { name: 'Menu da conta de Ana Paula' }),
    ).toBeInTheDocument();
    expect(toastMessages()).toContain('Nome atualizado.');
    expect(requestsTo('me')[0]?.body).toEqual({ name: 'Ana Paula' });
  });

  it('senha atual errada aparece no campo', async () => {
    const user = userEvent.setup();
    renderApp('/perfil');

    await user.type(await screen.findByLabelText('Senha atual'), 'senha-errada');
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-123');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    const current = screen.getByLabelText('Senha atual');
    await waitFor(() =>
      expect(current).toHaveAccessibleDescription('A senha atual está incorreta.'),
    );
    expect(current).toHaveFocus();
  });

  it('troca a senha, avisa e limpa o formulário', async () => {
    const user = userEvent.setup();
    renderApp('/perfil');

    await user.type(await screen.findByLabelText('Senha atual'), CURRENT_PASSWORD);
    await user.type(screen.getByLabelText('Nova senha'), 'nova-senha-123');
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() =>
      expect(toastMessages()).toContain('Senha alterada. Você saiu dos outros dispositivos.'),
    );
    expect(screen.getByLabelText('Senha atual')).toHaveValue('');
    expect(requestsTo('me/password')[0]?.body).toEqual({
      currentPassword: CURRENT_PASSWORD,
      newPassword: 'nova-senha-123',
    });
  });

  it('nova senha igual ao e-mail é recusada no cliente', async () => {
    const user = userEvent.setup();
    renderApp('/perfil');

    await user.type(await screen.findByLabelText('Senha atual'), CURRENT_PASSWORD);
    await user.type(screen.getByLabelText('Nova senha'), sessionFixture.user.email);
    await user.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() =>
      expect(screen.getByLabelText('Nova senha')).toHaveAccessibleDescription(
        'A senha não pode ser igual ao e-mail.',
      ),
    );
    expect(requestsTo('me/password')).toEqual([]);
  });
});
