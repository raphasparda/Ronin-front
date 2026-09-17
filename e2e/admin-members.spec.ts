// Fatia 2 (tarefa 2.6): A2 (convite), A4 (redefinição), A5 (membros) e A6 (perfil), scope.md.
import type { Page } from '@playwright/test';

import { WEB_ORIGIN } from './support/env';
import { expect, signIn, test } from './support/fixtures';
import { ANA, seedTeam } from './support/seed';
import { toast } from './support/ui';

const BRUNO_EMAIL = 'bruno.convidado@exemplo.com';
const BRUNO_PASSWORD = 'senha-do-bruno-123';
const BRUNO_NEW_PASSWORD = 'nova-senha-do-bruno-456';
const CSRF = { origin: WEB_ORIGIN, 'x-kanban-csrf': '1' };

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('Admin convida → pessoa aceita e entra como Member → Member sem admin (UI e API) → Admin gera reset → Member redefine e a sessão antiga cai', async ({
  page,
  openAs,
  isMobile,
}) => {
  const team = await seedTeam({ ana: ANA });
  await signIn(page.context(), team.ana);
  let inviteUrl = '';

  await test.step('A2: Admin gera convite com e-mail fixo e papel Membro', async () => {
    await page.goto('/admin/convites');
    await expect(
      page.getByText('Por enquanto, só você está por aqui.', { exact: false }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Novo convite' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo convite' });
    await dialog.getByLabel('E-mail (opcional)').fill(BRUNO_EMAIL);
    await expect(dialog.getByRole('radio', { name: 'Membro' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Criar convite' }).click();

    const created = page.getByRole('dialog', { name: 'Convite criado' });
    inviteUrl = await created.getByLabel('Link do convite').inputValue();
    expect(inviteUrl).toMatch(new RegExp(`^${WEB_ORIGIN}/convite#token=[A-Za-z0-9_-]{43}$`));
    await expect(created.getByText('Este link não aparece de novo.')).toBeVisible();
    await created.getByRole('button', { name: 'Concluir' }).click();
    await expect(page.getByRole('list', { name: 'Convites pendentes' })).toContainText(BRUNO_EMAIL);
  });

  const brunoPage = await openAs(null);

  await test.step('A2: outra pessoa abre o link, cria a conta e entra como Member', async () => {
    await brunoPage.goto(inviteUrl);
    await expect(
      brunoPage.getByRole('heading', { level: 1, name: 'Aceitar convite' }),
    ).toBeVisible();
    await expect(brunoPage.getByLabel('E-mail')).toHaveValue(BRUNO_EMAIL);
    // O token sai da barra de endereço assim que é lido.
    await expect(brunoPage).toHaveURL(`${WEB_ORIGIN}/convite`);
    await expect(brunoPage.getByLabel('E-mail')).toHaveAttribute('readonly', '');
    await brunoPage.getByLabel('Seu nome').fill('Bruno Convidado');
    await brunoPage.getByLabel('Senha', { exact: true }).fill(BRUNO_PASSWORD);
    await brunoPage.getByRole('button', { name: 'Criar conta' }).click();
    await expect(brunoPage.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();
    await expect(brunoPage).toHaveURL(`${WEB_ORIGIN}/`);
    await expect(toast(brunoPage, 'Boas-vindas à equipe, Bruno.')).toBeVisible();
    const me = await brunoPage.request.get('/api/auth/me');
    expect(await me.json()).toMatchObject({ user: { email: BRUNO_EMAIL, role: 'member' } });
  });

  await test.step('A2: o link usado não vale mais e o Admin vê o convite como "Usado"', async () => {
    const other = await openAs(null);
    await other.goto(inviteUrl);
    await expect(
      other.getByRole('heading', { level: 1, name: 'Este convite não vale mais' }),
    ).toBeVisible();
    await expect(other.getByLabel('Seu nome')).toHaveCount(0);

    await page.reload();
    const history = page.getByRole('list', { name: 'Histórico de convites' });
    await expect(history).toContainText('Usado');
    await expect(history).toContainText('por Bruno Convidado');
  });

  await test.step('A5: Member não vê administração e /admin/* nega na UI e na API (403)', async () => {
    if (!isMobile) {
      await expect(
        brunoPage.getByRole('banner').getByRole('link', { name: 'Administração' }),
      ).toHaveCount(0);
    }
    await brunoPage.getByRole('button', { name: 'Menu da conta de Bruno Convidado' }).click();
    const menu = brunoPage.getByRole('menu');
    await expect(menu.getByRole('menuitem', { name: 'Meu perfil' })).toBeVisible();
    await expect(menu.getByRole('menuitem', { name: 'Membros' })).toHaveCount(0);
    await expect(menu.getByRole('menuitem', { name: 'Convites' })).toHaveCount(0);
    await brunoPage.keyboard.press('Escape');

    for (const path of ['/admin/membros', '/admin/convites', '/admin/workspace']) {
      await brunoPage.goto(path);
      await expect(
        brunoPage.getByRole('heading', { level: 1, name: 'Área de administração' }),
      ).toBeVisible();
      await expect(
        brunoPage.getByText('Só Admins acessam esta área.', { exact: false }),
      ).toBeVisible();
      await expect(brunoPage.getByRole('button', { name: 'Novo convite' })).toHaveCount(0);
    }

    const api = brunoPage.request;
    expect((await api.get('/api/admin/users')).status()).toBe(403);
    expect((await api.get('/api/admin/invites')).status()).toBe(403);
    expect(
      (
        await api.post('/api/admin/invites', {
          headers: CSRF,
          data: { email: null, role: 'admin' },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await api.patch('/api/admin/workspace', { headers: CSRF, data: { name: 'Tomada' } })
      ).status(),
    ).toBe(403);
    const users: unknown = await (await api.get('/api/users')).json();
    expect(JSON.stringify(users)).not.toContain('@exemplo.com');
  });

  let resetUrl = '';
  await test.step('A4: Admin gera o link de redefinição em Membros', async () => {
    await page.goto('/admin/membros');
    await page.getByRole('button', { name: 'Ações para Bruno Convidado' }).click();
    await page.getByRole('menuitem', { name: 'Gerar link de redefinição de senha' }).click();
    const dialog = page.getByRole('dialog', { name: 'Link de redefinição para Bruno Convidado' });
    resetUrl = await dialog.getByLabel('Link de redefinição').inputValue();
    expect(resetUrl).toMatch(new RegExp(`^${WEB_ORIGIN}/redefinir-senha#token=[A-Za-z0-9_-]{43}$`));
    await dialog.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialog).toBeHidden();
  });

  await test.step('A4: Member redefine em outro navegador; a sessão antiga cai', async () => {
    const resetPage = await openAs(null);
    await resetPage.goto(resetUrl);
    await expect(
      resetPage.getByRole('heading', { level: 1, name: 'Criar nova senha' }),
    ).toBeVisible();
    await expect(resetPage).toHaveURL(`${WEB_ORIGIN}/redefinir-senha`);
    await expect(resetPage.getByText('Olá, Bruno.', { exact: false })).toBeVisible();
    await resetPage.getByLabel('Nova senha', { exact: true }).fill(BRUNO_NEW_PASSWORD);
    await resetPage.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(resetPage).toHaveURL(`${WEB_ORIGIN}/login`);
    await expect(resetPage.getByText('Senha alterada. Entre com a nova senha.')).toBeVisible();

    expect((await brunoPage.request.get('/api/auth/me')).status()).toBe(401);
    await brunoPage.goto('/');
    await expect(brunoPage.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    await expect(brunoPage).toHaveURL(/\/login(\?|$)/);

    // Senha antiga não entra; a nova entra.
    await login(resetPage, BRUNO_EMAIL, BRUNO_PASSWORD);
    await expect(resetPage.getByText('E-mail ou senha incorretos.')).toBeVisible();
    await login(resetPage, BRUNO_EMAIL, BRUNO_NEW_PASSWORD);
    await expect(resetPage.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();

    // O link é de uso único.
    const reused = await openAs(null);
    await reused.goto(resetUrl);
    await expect(
      reused.getByRole('heading', { level: 1, name: 'Este link não vale mais' }),
    ).toBeVisible();

    // A6: trocar a senha exige a senha atual.
    const res = await resetPage.request.post('/api/me/password', {
      headers: CSRF,
      data: { currentPassword: 'senha-errada-000', newPassword: 'qualquer-outra-senha' },
    });
    expect(res.status()).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'PASSWORD_INCORRECT',
    );
  });
});
