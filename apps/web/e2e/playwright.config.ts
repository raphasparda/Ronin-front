import { defineConfig, devices } from '@playwright/test';

import { API_ORIGIN, API_PORT, E2E_DATABASE_URL, WEB_ORIGIN, WEB_PORT } from './support/env';

/**
 * E2E do Ronin. Rode com `pnpm test:e2e` (raiz ou apps/web): o `e2e/run.mjs` prepara o banco
 * `kanban_e2e` e chama este config. Os testes compartilham um único banco real e o truncam,
 * por isso rodam em série (1 worker).
 */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]]
    : [['list']],
  use: {
    baseURL: WEB_ORIGIN,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    // Chromium com viewport/toque de celular (o CI só instala o Chromium).
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      name: 'api',
      command: 'pnpm exec tsx src/server.ts',
      cwd: '../../api',
      url: `${API_ORIGIN}/api/health`,
      // Nunca reaproveitar: um servidor já rodando nessa porta poderia estar em outro banco.
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'development',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        DATABASE_URL: E2E_DATABASE_URL,
        APP_ORIGIN: WEB_ORIGIN,
        TRUST_PROXY: 'false',
        LOG_LEVEL: 'warn',
      },
    },
    {
      name: 'web',
      // Servidor de dev do Vite: a rota /dev/paleta só existe em modo DEV.
      cwd: '..',
      command: `pnpm exec vite --host 127.0.0.1 --port ${WEB_PORT} --strictPort`,
      url: WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'ignore',
      stderr: 'pipe',
      env: { API_PROXY_TARGET: API_ORIGIN },
    },
  ],
});
