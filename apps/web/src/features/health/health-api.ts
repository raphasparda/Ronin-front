import { healthResponseSchema } from '@kanban/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '../../lib/api-client';

export const healthQueryKey = ['health'] as const;

export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) => api.get('/api/health', { schema: healthResponseSchema, signal }),
    retry: false,
    meta: { silentErrors: true },
  });
}
