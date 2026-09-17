import {
  updateMeResponseSchema,
  type AuthSessionResponse,
  type ChangePasswordRequest,
  type UpdateMeRequest,
} from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { sessionQueryKey } from '../auth/auth-api';

export function useUpdateMe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateMeRequest) =>
      api.patch('/api/me', body, { schema: updateMeResponseSchema }),
    onSuccess: ({ user }) =>
      queryClient.setQueryData(
        sessionQueryKey,
        (session: AuthSessionResponse | null | undefined) =>
          session ? { ...session, user } : session,
      ),
    meta: { silentErrors: true },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => api.post('/api/me/password', body),
    meta: { silentErrors: true },
  });
}
