import { isApiError } from './api-client';
import { MESSAGES } from './query-client';

/** Mensagem do servidor para erros 4xx com envelope; genérica para rede, 5xx e desconhecidos. */
export function serverMessage(error: unknown): string {
  return isApiError(error) && error.fromServer && error.status < 500 && !error.isNetworkError
    ? error.message
    : MESSAGES.generic;
}

/** `true` para erros que o tratamento global já anuncia (rede, 5xx, 403, 429). */
export function isGloballyHandled(error: unknown): boolean {
  if (!isApiError(error)) return true;
  return (
    error.isNetworkError || error.status >= 500 || error.status === 403 || error.status === 429
  );
}
