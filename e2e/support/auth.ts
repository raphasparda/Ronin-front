import { expect, type APIRequestContext } from '@playwright/test';

import { WEB_ORIGIN } from './env';

export const ADMIN = {
  workspaceName: 'Equipe E2E',
  name: 'Ana Admin',
  email: 'ana.admin@exemplo.com',
  password: 'senha-muito-segura-e2e',
} as const;

/** Headers que passam no CSRF da API (Origin = APP_ORIGIN + X-Ronin-Csrf). */
export const csrfHeaders = { origin: WEB_ORIGIN, 'x-ronin-csrf': '1' } as const;

/**
 * Setup inicial direto pela API (via proxy do Vite), para testes que só precisam de alguém
 * logado. O cookie de sessão fica no `request` (use `page.request` para compartilhar com a página).
 */
export async function setupViaApi(request: APIRequestContext): Promise<void> {
  const res = await request.post('/api/setup', { headers: csrfHeaders, data: ADMIN });
  expect(res.status(), await res.text()).toBe(201);
}
