import {
  ANONYMIZED_USER_NAME,
  usersResponseSchema,
  type UserSummary,
} from '@raphasparda/ronin-shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../../lib/api-client';

export const usersQueryKey = ['users'] as const;

/** Todos os usuários (sem e-mail), para nomes e iniciais (overview §7: `staleTime` 5 min). */
export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: ({ signal }) => api.get('/api/users', { schema: usersResponseSchema, signal }),
    select: (data) => data.users,
    staleTime: 5 * 60_000,
    meta: { silentErrors: true },
  });
}

export function displayName(user: UserSummary | undefined): string {
  if (!user) return 'Alguém';
  return user.anonymized ? ANONYMIZED_USER_NAME : user.name;
}
