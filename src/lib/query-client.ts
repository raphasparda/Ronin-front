import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { toast } from '../components/ui/toast-store';
import { isApiError } from './api-client';
import { formatWait } from './format-wait';

export interface AppRequestMeta extends Record<string, unknown> {
  /** A tela trata o erro sozinha: sem toast global. 401 continua redirecionando. */
  silentErrors?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppRequestMeta;
    mutationMeta: AppRequestMeta;
  }
}

export const MESSAGES = {
  forbidden: 'Você não tem permissão para isso.',
  generic: 'Algo deu errado. Tente de novo.',
  rateLimited: (seconds: number | null) =>
    seconds === null
      ? 'Muitas tentativas. Tente de novo em instantes.'
      : `Muitas tentativas. Tente de novo em ${formatWait(seconds)}.`,
} as const;

export interface GlobalErrorHandlers {
  onUnauthenticated: () => void;
}

export function handleGlobalError(
  error: unknown,
  handlers: GlobalErrorHandlers,
  meta: AppRequestMeta | undefined,
): void {
  if (isApiError(error) && error.code === 'UNAUTHENTICATED') {
    handlers.onUnauthenticated();
    return;
  }
  if (meta?.silentErrors) return;

  if (!isApiError(error) || error.isNetworkError || error.status >= 500) {
    toast.error(MESSAGES.generic);
    return;
  }
  if (error.status === 403) {
    toast.error(MESSAGES.forbidden);
    return;
  }
  if (error.status === 429) {
    toast.error(MESSAGES.rateLimited(error.retryAfterSeconds));
  }
}

function shouldRetry(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false;
  const transient = error.isNetworkError || error.status >= 500;
  return transient && failureCount < 2;
}

export interface CreateQueryClientOptions {
  onUnauthenticated: () => void;
}

export function createQueryClient({ onUnauthenticated }: CreateQueryClientOptions): QueryClient {
  const handlers: GlobalErrorHandlers = {
    onUnauthenticated: () => {
      queryClient.clear();
      onUnauthenticated();
    },
  };

  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleGlobalError(error, handlers, query.meta),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        handleGlobalError(error, handlers, mutation.meta),
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        refetchOnWindowFocus: true,
        refetchIntervalInBackground: false,
      },
      mutations: { retry: false },
    },
  });

  return queryClient;
}
