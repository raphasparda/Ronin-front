import {
  acceptInviteResponseSchema,
  inviteLookupResponseSchema,
  passwordResetLookupResponseSchema,
  tokenSchema,
  type AcceptInviteRequest,
  type CompletePasswordResetRequest,
} from '@kanban/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { api, isApiError } from '../../lib/api-client';
import { formatWait } from '../../lib/format-wait';
import { sessionQueryKey } from './auth-api';

export function tokenRateLimitedMessage(seconds: number | null): string {
  return seconds === null
    ? 'Muitas tentativas. Tente de novo em instantes.'
    : `Muitas tentativas. Tente de novo em ${formatWait(seconds)}.`;
}

/** Token malformado (400) e inexistente/usado/expirado/revogado (410) = "link inválido" (api.md §18.6). */
export function isInvalidTokenError(error: unknown): boolean {
  return isApiError(error) && (error.status === 400 || error.status === 410);
}

function tokenFromHash(hash: string): string | null {
  const value = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return value === null || value === '' ? null : value;
}

/**
 * Lê `#token=…` uma vez e tira o fragmento da URL (substitui a entrada do histórico), para
 * o token não ficar na barra de endereço, no histórico nem em capturas de tela.
 */
export function useTokenFromFragment(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [token] = useState(() => tokenFromHash(location.hash));
  const { pathname, search, hash } = location;
  const state: unknown = location.state;

  useEffect(() => {
    if (hash === '') return;
    void navigate({ pathname, search, hash: '' }, { replace: true, state });
  }, [hash, pathname, search, state, navigate]);

  return token;
}

/** Token com o formato do contrato (43 caracteres base64url). */
export function isWellFormedToken(token: string | null): token is string {
  return token !== null && tokenSchema.safeParse(token).success;
}

/** `null` quando o token nem tem o formato válido: a tela mostra "link inválido" sem chamar a API. */
function wellFormed(token: string | null): string | null {
  return isWellFormedToken(token) ? token : null;
}

export function useInviteLookup(token: string | null) {
  const valid = wellFormed(token);
  return useQuery({
    queryKey: ['invite-lookup', valid],
    queryFn: ({ signal }) =>
      api.post(
        '/api/auth/invites/lookup',
        { token: valid },
        {
          schema: inviteLookupResponseSchema,
          signal,
        },
      ),
    enabled: valid !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { silentErrors: true },
  });
}

export function useAcceptInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: AcceptInviteRequest) =>
      api.post('/api/auth/invites/accept', body, { schema: acceptInviteResponseSchema }),
    onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session),
    meta: { silentErrors: true },
  });
}

export function usePasswordResetLookup(token: string | null) {
  const valid = wellFormed(token);
  return useQuery({
    queryKey: ['password-reset-lookup', valid],
    queryFn: ({ signal }) =>
      api.post(
        '/api/auth/password-resets/lookup',
        { token: valid },
        {
          schema: passwordResetLookupResponseSchema,
          signal,
        },
      ),
    enabled: valid !== null,
    retry: false,
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    meta: { silentErrors: true },
  });
}

export function useCompletePasswordReset() {
  return useMutation({
    mutationFn: (body: CompletePasswordResetRequest) =>
      api.post('/api/auth/password-resets/complete', body),
    meta: { silentErrors: true },
  });
}
