import { http, HttpResponse } from 'msw';

import { authHandlers } from './auth-handlers';

/** Estado padrão: instância configurada, usuário logado. Os testes sobrescrevem com `server.use`. */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', db: 'ok' })),
  authHandlers.setupStatus(false),
  authHandlers.me(),
  authHandlers.login(),
  authHandlers.logout(),
  authHandlers.setup(),
];
