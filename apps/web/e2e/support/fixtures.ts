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

/**
 * CONTORNO do bug "página do quadro mais larga que o celular" (integration-bugs.spec.ts):
 * sem ele, no projeto mobile a página inteira fica com ~1089 px e os cliques no detalhe do card
 * caem em outros elementos, o que esconderia todo o resto dos fluxos. O teste do bug roda sem o
 * contorno (`mobileOverflowWorkaround: false`) e continua falhando até a correção.
 */
export async function applyMobileOverflowWorkaround(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const style = () => {
      const tag = document.createElement('style');
      tag.dataset.e2eWorkaround = 'mobile-overflow';
      tag.textContent = 'ol[aria-label="Listas do quadro"] section { position: relative; }';
      document.head.appendChild(tag);
    };
    if (document.head) style();
    else document.addEventListener('DOMContentLoaded', style);
  });
}

interface Fixtures {
  mobileOverflowWorkaround: boolean;
  browserErrors: BrowserErrors;
  /** Abre um contexto novo (outro navegador) logado como `user`, ou anônimo com `null`. */
  openAs: (user: SeededUser | null, options?: { theme?: Theme }) => Promise<Page>;
  /** Cliente de API autenticado como `user` (descartado no fim do teste). */
  apiAs: (user: SeededUser) => Promise<Api>;
}

export const test = base.extend<Fixtures>({
  mobileOverflowWorkaround: [true, { option: true }],

  browserErrors: [
    async ({ page, isMobile, mobileOverflowWorkaround }, use) => {
      if (isMobile && mobileOverflowWorkaround) await applyMobileOverflowWorkaround(page);
      const errors = new BrowserErrors();
      errors.watch(page, 'page');
      await use(errors);
      expect(errors.messages, 'erros no navegador durante o teste').toEqual([]);
    },
    { auto: true },
  ],

  openAs: async ({ browser, browserErrors, isMobile, mobileOverflowWorkaround }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    await use(async (user, options) => {
      const page = await openContext(browser, testInfo, contexts, browserErrors, user, options);
      if (isMobile && mobileOverflowWorkaround) await applyMobileOverflowWorkaround(page);
      return page;
    });
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
