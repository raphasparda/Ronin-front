import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { server } from '../test/server';
import { ApiError, api, apiRequest, parseRetryAfter } from './api-client';

async function catchError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('A chamada deveria ter falhado.');
}

describe('apiRequest', () => {
  it('envia o header CSRF, JSON e devolve o corpo validado pelo schema', async () => {
    let captured: Request | undefined;
    server.use(
      http.post('/api/boards', ({ request }) => {
        captured = request.clone();
        return HttpResponse.json({ id: 'b1', name: 'Sprint' }, { status: 201 });
      }),
    );

    const schema = z.object({ id: z.string(), name: z.string() });
    const result = await api.post('/api/boards', { name: 'Sprint' }, { schema });

    expect(result).toEqual({ id: 'b1', name: 'Sprint' });
    expect(captured?.headers.get('X-Ronin-Csrf')).toBe('1');
    expect(captured?.headers.get('Content-Type')).toBe('application/json');
    expect(captured?.credentials).toBe('same-origin');
    expect(await captured?.json()).toEqual({ name: 'Sprint' });
  });

  it('envia o header CSRF também em GET, sem Content-Type', async () => {
    let captured: Request | undefined;
    server.use(
      http.get('/api/auth/me', ({ request }) => {
        captured = request;
        return HttpResponse.json({ ok: true });
      }),
    );

    await api.get('/api/auth/me');

    expect(captured?.headers.get('X-Ronin-Csrf')).toBe('1');
    expect(captured?.headers.get('Content-Type')).toBeNull();
  });

  it('devolve undefined em 204', async () => {
    server.use(http.post('/api/auth/logout', () => new HttpResponse(null, { status: 204 })));

    await expect(api.post('/api/auth/logout')).resolves.toBeUndefined();
  });

  it('lança ApiError tipado a partir do envelope de erro', async () => {
    server.use(
      http.post('/api/setup', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Dados inválidos.',
              details: [{ path: 'email', message: 'E-mail inválido.' }],
            },
          },
          { status: 400 },
        ),
      ),
    );

    const error = await catchError(api.post('/api/setup', { email: 'x' }));

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toBe('Dados inválidos.');
    expect(error.details).toEqual([{ path: 'email', message: 'E-mail inválido.' }]);
    expect(error.fromServer).toBe(true);
  });

  it('lê o Retry-After em 429', async () => {
    server.use(
      http.post('/api/auth/login', () =>
        HttpResponse.json(
          { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Muitas tentativas.' } },
          { status: 429, headers: { 'Retry-After': '120' } },
        ),
      ),
    );

    const error = await catchError(api.post('/api/auth/login', {}));

    expect(error.code).toBe('TOO_MANY_ATTEMPTS');
    expect(error.retryAfterSeconds).toBe(120);
  });

  it('usa código pelo status quando a resposta não tem envelope (ex.: proxy)', async () => {
    server.use(http.get('/api/health', () => new HttpResponse('Bad Gateway', { status: 502 })));

    const error = await catchError(api.get('/api/health'));

    expect(error.status).toBe(502);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Algo deu errado. Tente de novo.');
    expect(error.fromServer).toBe(false);
  });

  it('também ignora envelope com código desconhecido', async () => {
    server.use(
      http.get('/api/x', () =>
        HttpResponse.json({ error: { code: 'NOPE', message: 'x' } }, { status: 401 }),
      ),
    );

    const error = await catchError(api.get('/api/x'));

    expect(error.code).toBe('UNAUTHENTICATED');
    expect(error.fromServer).toBe(false);
  });

  it('converte falha de rede em ApiError com status 0', async () => {
    server.use(http.get('/api/health', () => HttpResponse.error()));

    const error = await catchError(api.get('/api/health'));

    expect(error.status).toBe(0);
    expect(error.isNetworkError).toBe(true);
    expect(error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('rejeita resposta 2xx fora do schema', async () => {
    server.use(http.get('/api/health', () => HttpResponse.json({ status: 'talvez' })));

    const error = await catchError(
      apiRequest('/api/health', { schema: z.object({ status: z.literal('ok') }) }),
    );

    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.fromServer).toBe(false);
  });
});

describe('parseRetryAfter', () => {
  it('aceita segundos, data HTTP e valores ausentes', () => {
    const now = Date.parse('2026-09-16T12:00:00Z');

    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter('Wed, 16 Sep 2026 12:02:00 GMT', now)).toBe(120);
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter('amanhã')).toBeNull();
  });
});
