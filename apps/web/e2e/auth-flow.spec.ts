import { expect, test, type Page } from '@playwright/test';

import { ADMIN } from './support/auth';
import { resetDatabase } from './support/db';
import { WEB_ORIGIN } from './support/env';

const INVALID_CREDENTIALS = 'E-mail ou senha incorretos.';

async function fillLogin(page: Page, email: string, password: string) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test.beforeEach(async () => {
  await resetDatabase();
});

// A1 (configuração inicial) e A3 (login e logout), docs/product/scope.md.
test('instância limpa: setup → home logada → logout → login errado → login certo', async ({
  page,
  browser,
}) => {
  await test.step('A1: instância sem usuários abre a tela de configuração', async () => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Configurar a equipe' }),
    ).toBeVisible();
  });

  await test.step('A1: cria o Admin e entra logado na home', async () => {
    await page.getByLabel('Nome da equipe').fill(ADMIN.workspaceName);
    await page.getByLabel('Seu nome').fill(ADMIN.name);
    await page.getByLabel('E-mail').fill(ADMIN.email);
    await page.getByLabel('Senha', { exact: true }).fill(ADMIN.password);
    await page.getByLabel('Confirme a senha').fill(ADMIN.password);
    await expect(page.getByLabel('Fuso horário')).toHaveValue('America/Sao_Paulo');
    await page.getByRole('button', { name: 'Criar conta e começar' }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Menu da conta de ${ADMIN.name}` }),
    ).toBeVisible();

    const me = await page.request.get('/api/auth/me');
    expect(me.status()).toBe(200);
    expect(await me.json()).toMatchObject({
      user: { name: ADMIN.name, email: ADMIN.email, role: 'admin' },
      workspace: { name: ADMIN.workspaceName },
    });
  });

  await test.step('A1: a tela de configuração não aparece mais para ninguém', async () => {
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();

    const anonymous = await browser.newContext({ baseURL: WEB_ORIGIN });
    try {
      const other = await anonymous.newPage();
      await other.goto('/setup');
      await expect(other).toHaveURL(/\/login(\?|$)/);
      await expect(other.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
      const status = await other.request.get('/api/setup/status');
      expect(await status.json()).toEqual({ needsSetup: false });
    } finally {
      await anonymous.close();
    }
  });

  await test.step('A3: a sessão continua ativa ao recarregar', async () => {
    await page.reload();
    await expect(
      page.getByRole('button', { name: `Menu da conta de ${ADMIN.name}` }),
    ).toBeVisible();
  });

  await test.step('A3: logout volta ao login e invalida a sessão no servidor', async () => {
    await page.getByRole('button', { name: `Menu da conta de ${ADMIN.name}` }).click();
    await page.getByRole('menuitem', { name: 'Sair' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);

    // Sem sessão, rotas protegidas voltam ao login (`next` só quando a rota não é `/`).
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/rota/protegida?x=1');
    await expect(page).toHaveURL(/\/login\?next=%2Frota%2Fprotegida%3Fx%3D1$/);
  });

  await test.step('A3: login errado mostra mensagem genérica (senha errada e e-mail inexistente)', async () => {
    await page.goto('/login');
    await fillLogin(page, ADMIN.email, 'senha-errada-123');
    await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('');
    await expect(page).toHaveURL(/\/login$/);

    await fillLogin(page, 'ninguem@exemplo.com', ADMIN.password);
    await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get('/api/auth/me')).status()).toBe(401);
  });

  await test.step('A3: login certo entra na home', async () => {
    // E-mail com caixa/espaços diferentes: o servidor normaliza.
    await fillLogin(page, `  ${ADMIN.email.toUpperCase()} `, ADMIN.password);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Menu da conta de ${ADMIN.name}` }),
    ).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: INVALID_CREDENTIALS })).toHaveCount(0);
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  });
});
