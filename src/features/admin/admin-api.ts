import {
  adminUserResponseSchema,
  adminUsersResponseSchema,
  createInviteResponseSchema,
  invitesResponseSchema,
  passwordResetLinkResponseSchema,
  workspaceResponseSchema,
  type AdminUser,
  type AnonymizeUserRequest,
  type AuthSessionResponse,
  type CreateInviteRequest,
  type Role,
  type UpdateWorkspaceRequest,
} from '@raphasparda/ronin-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { sessionQueryKey } from '../auth/auth-api';
import { usersQueryKey } from '../users/users-api';

export const adminUsersQueryKey = ['admin-users'] as const;
export const adminInvitesQueryKey = ['admin-invites'] as const;

export function useAdminUsers() {
  return useQuery({
    queryKey: adminUsersQueryKey,
    queryFn: ({ signal }) =>
      api.get('/api/admin/users', { schema: adminUsersResponseSchema, signal }),
    select: (data) => data.users,
  });
}

/** Troca a pessoa na lista do Admin e relê `['users']` (papel e conta ativa aparecem lá). */
function useReplaceAdminUser() {
  const queryClient = useQueryClient();
  return (user: AdminUser) => {
    queryClient.setQueryData(adminUsersQueryKey, (data: { users: AdminUser[] } | undefined) =>
      data ? { users: data.users.map((item) => (item.id === user.id ? user : item)) } : data,
    );
    void queryClient.invalidateQueries({ queryKey: adminUsersQueryKey });
    void queryClient.invalidateQueries({ queryKey: usersQueryKey });
  };
}

export function useChangeRole() {
  const replace = useReplaceAdminUser();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch(`/api/admin/users/${userId}`, { role }, { schema: adminUserResponseSchema }),
    onSuccess: ({ user }) => replace(user),
  });
}

export function useSetUserActive() {
  const replace = useReplaceAdminUser();
  return useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      api.post(`/api/admin/users/${userId}/${active ? 'reactivate' : 'deactivate'}`, undefined, {
        schema: adminUserResponseSchema,
      }),
    onSuccess: ({ user }) => replace(user),
  });
}

/** Irreversível: nome vira "Usuário removido" e o e-mail é apagado (nomes em cache são relidos). */
export function useAnonymizeUser() {
  const replace = useReplaceAdminUser();
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(
        `/api/admin/users/${userId}/anonymize`,
        { confirm: true } satisfies AnonymizeUserRequest,
        { schema: adminUserResponseSchema },
      ),
    onSuccess: ({ user }) => replace(user),
  });
}

export function useCreatePasswordResetLink() {
  return useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/admin/users/${userId}/password-reset-links`, undefined, {
        schema: passwordResetLinkResponseSchema,
      }),
  });
}

export function useAdminInvites() {
  return useQuery({
    queryKey: adminInvitesQueryKey,
    queryFn: ({ signal }) =>
      api.get('/api/admin/invites', { schema: invitesResponseSchema, signal }),
    select: (data) => data.invites,
  });
}

export function useCreateInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateInviteRequest) =>
      api.post('/api/admin/invites', body, { schema: createInviteResponseSchema }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey }),
  });
}

export function useRevokeInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => api.delete(`/api/admin/invites/${inviteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminInvitesQueryKey }),
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkspaceRequest) =>
      api.patch('/api/admin/workspace', body, { schema: workspaceResponseSchema }),
    onSuccess: ({ workspace }) =>
      queryClient.setQueryData(
        sessionQueryKey,
        (session: AuthSessionResponse | null | undefined) =>
          session ? { ...session, workspace } : session,
      ),
  });
}
