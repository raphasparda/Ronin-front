import { describe, expect, it, vi } from 'vitest';

import { getToasts } from '../components/ui/toast-store';
import { ApiError } from './api-client';
import { formatWait } from './format-wait';
import { createQueryClient, handleGlobalError } from './query-client';

function apiError(status: number, code: ApiError['code'], retryAfterSeconds: number | null = null) {
  return new ApiError({ status, code, message: 'x', retryAfterSeconds, fromServer: true });
}

const messages = () => getToasts().map((item) => item.message);

describe('handleGlobalError', () => {
  it('401 chama onUnauthenticated sem toast, mesmo com erros silenciosos', () => {
    const onUnauthenticated = vi.fn();

    handleGlobalError(
      apiError(401, 'UNAUTHENTICATED'),
      { onUnauthenticated },
      { silentErrors: true },
    );

    expect(onUnauthenticated).toHaveBeenCalledOnce();
    expect(messages()).toEqual([]);
  });

  it('403 mostra aviso de permissão', () => {
    handleGlobalError(apiError(403, 'FORBIDDEN'), { onUnauthenticated: vi.fn() }, undefined);

    expect(messages()).toEqual(['Você não tem permissão para isso.']);
  });

  it('429 mostra o tempo de espera do Retry-After', () => {
    handleGlobalError(
      apiError(429, 'RATE_LIMITED', 120),
      { onUnauthenticated: vi.fn() },
      undefined,
    );

    expect(messages()).toEqual(['Muitas tentativas. Tente de novo em 2 minutos.']);
  });

  it('5xx e rede mostram erro genérico uma vez só', () => {
    const handlers = { onUnauthenticated: vi.fn() };
    handleGlobalError(apiError(500, 'INTERNAL_ERROR'), handlers, undefined);
    handleGlobalError(
      new ApiError({ status: 0, code: 'SERVICE_UNAVAILABLE', message: 'x', fromServer: false }),
      handlers,
      undefined,
    );

    expect(messages()).toEqual(['Algo deu errado. Tente de novo.']);
  });

  it('não mostra toast para erros tratados pela tela (400, 404, 409) nem com silentErrors', () => {
    const handlers = { onUnauthenticated: vi.fn() };
    handleGlobalError(apiError(400, 'VALIDATION_ERROR'), handlers, undefined);
    handleGlobalError(apiError(404, 'NOT_FOUND'), handlers, undefined);
    handleGlobalError(apiError(409, 'BOARD_ARCHIVED'), handlers, undefined);
    handleGlobalError(apiError(500, 'INTERNAL_ERROR'), handlers, { silentErrors: true });

    expect(messages()).toEqual([]);
  });
});

describe('createQueryClient', () => {
  it('limpa o cache e redireciona quando uma query recebe 401', async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });
    client.setQueryData(['boards'], ['quadro']);

    await client
      .fetchQuery({
        queryKey: ['me'],
        queryFn: () => Promise.reject(apiError(401, 'UNAUTHENTICATED')),
        retry: false,
      })
      .catch(() => undefined);

    expect(onUnauthenticated).toHaveBeenCalledOnce();
    expect(client.getQueryData(['boards'])).toBeUndefined();
  });
});

describe('formatWait', () => {
  it('formata segundos e minutos em pt-BR', () => {
    expect(formatWait(1)).toBe('1 segundo');
    expect(formatWait(45)).toBe('45 segundos');
    expect(formatWait(60)).toBe('1 minuto');
    expect(formatWait(61)).toBe('2 minutos');
  });
});
