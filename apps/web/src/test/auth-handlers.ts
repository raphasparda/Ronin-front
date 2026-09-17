import {
  ERROR_HTTP_STATUS,
  authSessionResponseSchema,
  errorResponseSchema,
  loginRequestSchema,
  setupRequestSchema,
  setupStatusResponseSchema,
  type AuthSessionResponse,
  type ErrorCode,
  type ErrorDetail,
} from '@kanban/shared';
import { http, HttpResponse } from 'msw';
import type { z } from 'zod';

export const sessionFixture: AuthSessionResponse = authSessionResponseSchema.parse({
  user: {
    id: '0f5b8f5e-6d0c-4f8e-9a51-6a7f2a6f1c11',
    name: 'Ana Souza',
    email: 'ana@empresa.com',
    role: 'admin',
  },
  workspace: { name: 'Equipe Ronin', timezone: 'America/Sao_Paulo' },
});

interface ErrorInit {
  message?: string;
  details?: ErrorDetail[];
  retryAfterSeconds?: number;
}

/** Resposta de erro no envelope da API (validada pelo schema compartilhado). */
export function apiErrorResponse(code: ErrorCode, init: ErrorInit = {}) {
  const body = errorResponseSchema.parse({
    error: { code, message: init.message ?? 'Erro.', details: init.details },
  });
  const headers: Record<string, string> =
    init.retryAfterSeconds === undefined ? {} : { 'Retry-After': String(init.retryAfterSeconds) };
  return HttpResponse.json(body, { status: ERROR_HTTP_STATUS[code], headers });
}

function validationError(error: z.ZodError) {
  return apiErrorResponse('VALIDATION_ERROR', {
    message: 'Dados inválidos.',
    details: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

export const authHandlers = {
  setupStatus: (needsSetup: boolean) =>
    http.get('/api/setup/status', () =>
      HttpResponse.json(setupStatusResponseSchema.parse({ needsSetup })),
    ),

  me: (session: AuthSessionResponse = sessionFixture) =>
    http.get('/api/auth/me', () => HttpResponse.json(authSessionResponseSchema.parse(session))),

  meUnauthenticated: () =>
    http.get('/api/auth/me', () =>
      apiErrorResponse('UNAUTHENTICATED', { message: 'Sessão inválida ou expirada.' }),
    ),

  /** Valida o corpo com o schema compartilhado; aceita `ana@empresa.com` / `senha-correta-1`. */
  login: () =>
    http.post('/api/auth/login', async ({ request }) => {
      const parsed = loginRequestSchema.safeParse(await request.json());
      if (!parsed.success) return validationError(parsed.error);
      if (
        parsed.data.email !== sessionFixture.user.email ||
        parsed.data.password !== 'senha-correta-1'
      ) {
        return apiErrorResponse('INVALID_CREDENTIALS', { message: 'E-mail ou senha incorretos.' });
      }
      return HttpResponse.json(sessionFixture);
    }),

  loginError: (code: ErrorCode, init: ErrorInit = {}) =>
    http.post('/api/auth/login', () => apiErrorResponse(code, init)),

  logout: () => http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })),

  /** Valida o corpo com o schema compartilhado e devolve a sessão do admin criado. */
  setup: () =>
    http.post('/api/setup', async ({ request }) => {
      const parsed = setupRequestSchema.safeParse(await request.json());
      if (!parsed.success) return validationError(parsed.error);
      const { name, email, workspaceName, timezone } = parsed.data;
      return HttpResponse.json(
        authSessionResponseSchema.parse({
          user: { ...sessionFixture.user, name, email },
          workspace: { name: workspaceName, timezone },
        }),
        { status: 201 },
      );
    }),

  setupError: (code: ErrorCode, init: ErrorInit = {}) =>
    http.post('/api/setup', () => apiErrorResponse(code, init)),
};
