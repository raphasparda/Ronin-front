import { errorResponseSchema, type ErrorCode, type ErrorDetail } from '@raphasparda/ronin-shared';
import type { z } from 'zod';

export const CSRF_HEADER = 'X-Ronin-Csrf';

const GENERIC_ERROR_MESSAGE = 'Algo deu errado. Tente de novo.';
const NETWORK_ERROR_MESSAGE = 'Sem conexão com o servidor.';

interface ApiErrorInit {
  status: number;
  code: ErrorCode;
  message: string;
  details?: ErrorDetail[];
  retryAfterSeconds?: number | null;
  fromServer: boolean;
}

/** Erro de qualquer chamada à API. `status` 0 = falha de rede (API inacessível). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: ErrorDetail[];
  readonly retryAfterSeconds: number | null;
  /** `true` quando a resposta trouxe o envelope de erro da API (e não de um proxy ou da rede). */
  readonly fromServer: boolean;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? [];
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
    this.fromServer = init.fromServer;
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TSchema extends z.ZodType | undefined = undefined> {
  method?: HttpMethod;
  body?: unknown;
  schema?: TSchema;
  signal?: AbortSignal;
}

type ResponseOf<TSchema> = TSchema extends z.ZodType ? z.infer<TSchema> : unknown;

function fallbackCode(status: number): ErrorCode {
  if (status === 400) return 'VALIDATION_ERROR';
  if (status === 401) return 'UNAUTHENTICATED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 410) return 'TOKEN_INVALID';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}

/** `Retry-After` em segundos (aceita número ou data HTTP). */
export function parseRetryAfter(value: string | null, now = Date.now()): number | null {
  if (value === null || value.trim() === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - now) / 1000));
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === '') return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const retryAfterSeconds = parseRetryAfter(response.headers.get('Retry-After'));
  const parsed = errorResponseSchema.safeParse(await readJson(response));

  if (parsed.success) {
    const { code, message, details } = parsed.data.error;
    return new ApiError({
      status: response.status,
      code,
      message,
      details,
      retryAfterSeconds,
      fromServer: true,
    });
  }

  return new ApiError({
    status: response.status,
    code: fallbackCode(response.status),
    message: GENERIC_ERROR_MESSAGE,
    retryAfterSeconds,
    fromServer: false,
  });
}

/**
 * Chamada à API na mesma origem: cookie de sessão (`same-origin`), header CSRF em toda
 * requisição e JSON. Lança `ApiError` para status fora de 2xx, falha de rede ou resposta
 * que não bate com o `schema` informado.
 */
export async function apiRequest<TSchema extends z.ZodType | undefined = undefined>(
  path: string,
  options: RequestOptions<TSchema> = {},
): Promise<ResponseOf<TSchema>> {
  const { method = 'GET', body, schema, signal } = options;
  const headers: Record<string, string> = { Accept: 'application/json', [CSRF_HEADER]: '1' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(new URL(path, window.location.origin), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError({
      status: 0,
      code: 'SERVICE_UNAVAILABLE',
      message: NETWORK_ERROR_MESSAGE,
      fromServer: false,
    });
  }

  if (!response.ok) throw await toApiError(response);

  const data = response.status === 204 ? undefined : await readJson(response);
  if (!schema) return data as ResponseOf<TSchema>;

  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError({
      status: response.status,
      code: 'INTERNAL_ERROR',
      message: GENERIC_ERROR_MESSAGE,
      fromServer: false,
    });
  }
  return result.data as ResponseOf<TSchema>;
}

export const api = {
  get: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
  ) => apiRequest(path, { ...options, method: 'GET' }),
  post: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
  ) => apiRequest(path, { ...options, method: 'POST', body }),
  put: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
  ) => apiRequest(path, { ...options, method: 'PUT', body }),
  patch: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
  ) => apiRequest(path, { ...options, method: 'PATCH', body }),
  delete: <TSchema extends z.ZodType | undefined = undefined>(
    path: string,
    options?: Omit<RequestOptions<TSchema>, 'method' | 'body'>,
  ) => apiRequest(path, { ...options, method: 'DELETE' }),
};
