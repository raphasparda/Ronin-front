import {
  updateMeResponseSchema,
  type AuthSessionResponse,
  type ChangePasswordRequest,
  type UpdateMeRequest,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { sessionQueryKey } from '../auth/auth-api';
import { usersQueryKey } from '../users/users-api';

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) =>
      api.patch('/api/me', body, { schema: updateMeResponseSchema }),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(
        sessionQueryKey,
        (session: AuthSessionResponse | null | undefined) =>
          session ? { ...session, user } : session,
      );
      // O nome aparece em faces, comentários e histórico via `['users']`.
      void queryClient.invalidateQueries({ queryKey: usersQueryKey });
    },
    meta: { silentErrors: true },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.post('/api/me/password', body),
    meta: { silentErrors: true },
  });
}
