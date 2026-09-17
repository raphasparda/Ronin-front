import {
  authSessionResponseSchema,
  setupStatusResponseSchema,
  type AuthSessionResponse,
  type LoginRequest,
  type SetupRequest,
  type SetupStatusResponse,
} from '@raphasparda/ronin-shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api, isApiError } from '../../lib/api-client';

export const setupStatusQueryKey = ['setup-status'] as const;
export const sessionQueryKey = ['session'] as const;

/** Atualiza `needsSetup` no cache, mantendo o `requiresSetupToken` já conhecido. */
export function setNeedsSetup(queryClient: QueryClient, needsSetup: boolean) {
  queryClient.setQueryData<SetupStatusResponse>(setupStatusQueryKey, (current) => ({
    requiresSetupToken: current?.requiresSetupToken ?? false,
    needsSetup,
  }));
}

export function useSetupStatus() {
  return useQuery({
    queryKey: setupStatusQueryKey,
    queryFn: ({ signal }) =>
      api.get('/api/setup/status', { schema: setupStatusResponseSchema, signal }),
    staleTime: Infinity,
    meta: { silentErrors: true },
  });
}

/**
 * Sessão atual: `{ user, workspace }` ou `null` sem sessão. O 401 vira `null` aqui para que o
 * boot decida o redirecionamento, sem passar pelo tratamento global de 401.
 */
export async function fetchSession(signal?: AbortSignal): Promise<AuthSessionResponse | null> {
  try {
    return await api.get('/api/auth/me', { schema: authSessionResponseSchema, signal });
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null;
    throw error;
  }
}

export function useSession({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: ({ signal }) => fetchSession(signal),
    enabled,
    staleTime: 60_000,
    meta: { silentErrors: true },
  });
}

export function useSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SetupRequest) =>
      api.post('/api/setup', body, { schema: authSessionResponseSchema }),
    onSuccess: (session) => {
      setNeedsSetup(queryClient, false);
      queryClient.setQueryData(sessionQueryKey, session);
    },
    meta: { silentErrors: true },
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) =>
      api.post('/api/auth/login', body, { schema: authSessionResponseSchema }),
    onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session),
    meta: { silentErrors: true },
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
  });
}

/** Usuário da sessão dentro das rotas logadas (o `RequireAuth` garante o cache preenchido). */
export function useSessionUser() {
  return useSession({ enabled: false }).data?.user ?? null;
}
