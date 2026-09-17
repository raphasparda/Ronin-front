import { http, HttpResponse } from 'msw';

import { adminHandlers } from './admin-handlers';
import { authHandlers } from './auth-handlers';
import { boardHandlers } from './board-handlers';

/**
 * Estado padrão: instância configurada, usuário Admin logado e um backend simulado (com estado)
 * para administração, quadros e listas. Os testes sobrescrevem com `server.use`.
 */
export const handlers = [
  http.get('/api/health', () => HttpResponse.json({ status: 'ok', db: 'ok' })),
  authHandlers.setupStatus(false),
  authHandlers.me(),
  authHandlers.login(),
  authHandlers.logout(),
  authHandlers.setup(),
  ...adminHandlers,
  ...boardHandlers,
];
