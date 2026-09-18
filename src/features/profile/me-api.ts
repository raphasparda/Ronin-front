import {
  updateAvatarResponseSchema,
  updateMeResponseSchema,
  type AuthSessionResponse,
  type ChangePasswordRequest,
  type SessionUser,
  type UpdateAvatarRequest,
  type UpdateMeRequest,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { sessionQueryKey } from '../auth/auth-api';
import { usersQueryKey } from '../users/users-api';

/** Espelha o usuário da sessão no cache e recarrega `['users']` (nome e foto aparecem lá). */
function syncSessionUser(queryClient: QueryClient, update: (user: SessionUser) => SessionUser) {
  queryClient.setQueryData(sessionQueryKey, (session: AuthSessionResponse | null | undefined) =>
    session ? { ...session, user: update(session.user) } : session,
  );
  // O nome e a foto aparecem em faces, comentários e histórico via `['users']`.
  void queryClient.invalidateQueries({ queryKey: usersQueryKey });
}

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) =>
      api.patch('/api/me', body, { schema: updateMeResponseSchema }),
    onSuccess: ({ user }) => syncSessionUser(queryClient, () => user),
    meta: { silentErrors: true },
  });
}

/** `PUT /api/me/avatar`: a imagem já vem recortada e comprimida por `prepareAvatar`. */
export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateAvatarRequest) =>
      api.put('/api/me/avatar', body, { schema: updateAvatarResponseSchema }),
    onSuccess: ({ user }) => syncSessionUser(queryClient, () => user),
    meta: { silentErrors: true },
  });
}

/** `DELETE /api/me/avatar`: volta para as iniciais. */
export function useRemoveAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/me/avatar'),
    onSuccess: () => syncSessionUser(queryClient, (user) => ({ ...user, avatarUpdatedAt: null })),
    meta: { silentErrors: true },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.post('/api/me/password', body),
    meta: { silentErrors: true },
  });
}
