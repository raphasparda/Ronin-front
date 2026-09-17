import { expect, request as playwrightRequest, test, type Cookie } from '@playwright/test';

import { expectNoSeriousA11yViolations, presetTheme, type Theme } from './support/a11y';
import { setupViaApi } from './support/auth';
import { resetDatabase } from './support/db';
import { WEB_ORIGIN } from './support/env';

const THEMES: Theme[] = ['light', 'dark'];

test.describe('smoke: instância limpa', () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test('app carrega, health ok e instância nova abre o setup', async ({ page }) => {
    const health = await page.request.get('/api/health');
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok', db: 'ok' });

    const status = await page.request.get('/api/setup/status');
    expect(await status.json()).toEqual({ needsSetup: true, requiresSetupToken: false });

    await page.goto('/');
    await expect(page).toHaveURL(/\/setup$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Configurar a equipe' }),
    ).toBeVisible();
    await expect(page).toHaveTitle('Configurar a equipe · Ronin');
  });

  for (const theme of THEMES) {
    test(`axe: /setup sem violações sérias (tema ${theme})`, async ({ page }) => {
      await presetTheme(page, theme);
      await page.goto('/setup');
      await expect(page.getByRole('button', { name: 'Criar conta e começar' })).toBeVisible();
      await expectNoSeriousA11yViolations(page, theme);
    });
  }
});

test.describe('smoke: instância configurada', () => {
  // Um setup por projeto (o POST /api/setup tem limite de 5 / 15 min por IP, em memória).
  let sessionCookies: Cookie[] = [];

  test.beforeAll(async () => {
    await resetDatabase();
    const api = await playwrightRequest.newContext({ baseURL: WEB_ORIGIN });
    try {
      await setupViaApi(api);
      sessionCookies = (await api.storageState()).cookies;
    } finally {
      await api.dispose();
    }
    expect(sessionCookies.length).toBeGreaterThan(0);
  });

  for (const theme of THEMES) {
    test(`axe: /login sem violações sérias (tema ${theme})`, async ({ page }) => {
      await presetTheme(page, theme);
      await page.goto('/login');
      await expect(page.getByRole('heading', { level: 1, name: 'Entrar' })).toBeVisible();
      await expectNoSeriousA11yViolations(page, theme);
    });

    test(`axe: home logada com API online (tema ${theme})`, async ({ page, context }) => {
      await context.addCookies(sessionCookies);
      await presetTheme(page, theme);
      await page.goto('/');
      await expect(page.getByRole('heading', { level: 1, name: 'Quadros' })).toBeVisible();
      await expect(page.getByRole('status').filter({ hasText: 'API online' })).toBeVisible();
      await expectNoSeriousA11yViolations(page, theme);
    });

    test(`axe: /dev/paleta sem violações sérias (tema ${theme})`, async ({ page, context }) => {
      await context.addCookies(sessionCookies);
      await presetTheme(page, theme);
      await page.goto('/dev/paleta');
      await expect(page.getByRole('heading', { name: 'Tema escuro' })).toBeVisible();
      await expectNoSeriousA11yViolations(page, theme);
    });
  }
});
