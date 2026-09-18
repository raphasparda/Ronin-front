import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { getToasts } from '../../../components/ui/toast-store';
import type * as avatarFile from '../../../lib/avatar-file';
import { AvatarFileError } from '../../../lib/avatar-file';
import { AVATAR_UPDATED_AT, CURRENT_PASSWORD, requestsTo } from '../../../test/admin-handlers';
import { sessionFixture } from '../../../test/auth-handlers';
import { renderApp } from '../../../test/render';

// O recorte usa canvas, que o jsdom não tem: `prepareAvatar` é testado em `lib/avatar-file.test.ts`.
const prepareAvatar = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/avatar-file', async (importOriginal) => ({
  ...(await importOriginal<typeof avatarFile>()),
  prepareAvatar,
}));

const AVATAR_BODY = { contentType: 'image/webp', data: 'UklGRg==' };
const pickFile = async (user: ReturnType<typeof userEvent.setup>) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  expect(input).not.toBeNull();
  await user.upload(input as HTMLInputElement, new File(['x'], 'foto.png', { type: 'image/png' }));
};

const avatarImage = () => document.querySelector<HTMLImageElement>('img[src*="/avatar"]');

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

  it('envia a foto, mostra no perfil e no cabeçalho, e depois remove', async () => {
    prepareAvatar.mockResolvedValue(AVATAR_BODY);
    const user = userEvent.setup();
    renderApp('/perfil');

    expect(await screen.findByRole('button', { name: 'Enviar foto' })).toBeVisible();
    expect(avatarImage()).toBeNull();

    await pickFile(user);

    await waitFor(() => expect(toastMessages()).toContain('Foto atualizada.'));
    expect(requestsTo('me/avatar')[0]).toMatchObject({ method: 'PUT', body: AVATAR_BODY });
    // A URL carrega a versão devolvida pela API (cache).
    expect(avatarImage()?.getAttribute('src')).toBe(
      `/api/users/${sessionFixture.user.id}/avatar?v=${encodeURIComponent(AVATAR_UPDATED_AT)}`,
    );
    expect(await screen.findByRole('button', { name: 'Trocar foto' })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Remover' }));

    await waitFor(() => expect(toastMessages()).toContain('Foto removida.'));
    expect(requestsTo('me/avatar')[1]).toMatchObject({ method: 'DELETE' });
    expect(avatarImage()).toBeNull();
    expect(screen.getByRole('button', { name: 'Enviar foto' })).toBeVisible();
  });

  it('arquivo que não dá para usar mostra o motivo e não chama a API', async () => {
    prepareAvatar.mockRejectedValue(new AvatarFileError('Escolha um arquivo de imagem.'));
    const user = userEvent.setup();
    renderApp('/perfil');

    await screen.findByRole('button', { name: 'Enviar foto' });
    await pickFile(user);

    expect(await screen.findByText('Escolha um arquivo de imagem.')).toBeVisible();
    expect(requestsTo('me/avatar')).toEqual([]);
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
