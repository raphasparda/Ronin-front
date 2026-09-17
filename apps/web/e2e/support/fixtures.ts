import {
  test as base,
  expect,
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  type Page,
  type TestInfo,
} from '@playwright/test';

import { presetTheme, type Theme } from './a11y';
import { Api } from './api';
import { WEB_ORIGIN } from './env';
import { SESSION_COOKIE, type SeededUser } from './seed';

/**
 * Erros de navegador que reprovam o teste: exceção não tratada, `console.error` (exceto o log
 * automático de "Failed to load resource", que só repete o status HTTP) e resposta 5xx da API.
 */
export class BrowserErrors {
  readonly messages: string[] = [];
  private readonly allowed: RegExp[] = [];

  /** Ignora um erro esperado (use com parcimônia e com comentário explicando). */
  allow(pattern: RegExp): void {
    this.allowed.push(pattern);
  }

  watch(page: Page, who: string): void {
    const push = (message: string) => {
      if (!this.allowed.some((pattern) => pattern.test(message))) {
        this.messages.push(`[${who}] ${message}`);
      }
    };
    page.on('pageerror', (error) => push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const text = message.text();
      if (text.startsWith('Failed to load resource')) return;
      push(`console.error: ${text}`);
    });
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 500) {
        push(`HTTP ${response.status()} ${response.request().method()} ${response.url()}`);
      }
    });
  }
}

/** Mesmas opções de contexto do projeto (desktop/mobile) para abrir um segundo usuário. */
function projectContextOptions(testInfo: TestInfo): BrowserContextOptions {
  const use = testInfo.project.use;
  return {
    baseURL: WEB_ORIGIN,
    locale: use.locale,
    timezoneId: use.timezoneId,
    viewport: use.viewport,
    userAgent: use.userAgent,
    deviceScaleFactor: use.deviceScaleFactor,
    isMobile: use.isMobile,
    hasTouch: use.hasTouch,
  };
}

export async function signIn(context: BrowserContext, user: SeededUser): Promise<void> {
  await context.addCookies([
    {
      name: SESSION_COOKIE,
      value: user.token,
      url: WEB_ORIGIN,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

interface Fixtures {
  browserErrors: BrowserErrors;
  /** Abre um contexto novo (outro navegador) logado como `user`, ou anônimo com `null`. */
  openAs: (user: SeededUser | null, options?: { theme?: Theme }) => Promise<Page>;
  /** Cliente de API autenticado como `user` (descartado no fim do teste). */
  apiAs: (user: SeededUser) => Promise<Api>;
}

export const test = base.extend<Fixtures>({
  browserErrors: [
    async ({ page }, use) => {
      const errors = new BrowserErrors();
      errors.watch(page, 'page');
      await use(errors);
      expect(errors.messages, 'erros no navegador durante o teste').toEqual([]);
    },
    { auto: true },
  ],

  openAs: async ({ browser, browserErrors }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    await use((user, options) =>
      openContext(browser, testInfo, contexts, browserErrors, user, options),
    );
    await Promise.all(contexts.map((context) => context.close()));
  },

  // O Playwright exige desestruturar o primeiro argumento, mesmo sem usar outras fixtures.
  // eslint-disable-next-line no-empty-pattern
  apiAs: async ({}, use) => {
    const clients: Api[] = [];
    await use(async (user) => {
      const client = await Api.as(user);
      clients.push(client);
      return client;
    });
    await Promise.all(clients.map((client) => client.dispose()));
  },
});

async function openContext(
  browser: Browser,
  testInfo: TestInfo,
  contexts: BrowserContext[],
  errors: BrowserErrors,
  user: SeededUser | null,
  options: { theme?: Theme } = {},
): Promise<Page> {
  const context = await browser.newContext(projectContextOptions(testInfo));
  contexts.push(context);
  if (user) await signIn(context, user);
  const page = await context.newPage();
  if (options.theme) await presetTheme(page, options.theme);
  errors.watch(page, user?.name ?? 'anônimo');
  return page;
}

export { expect };
