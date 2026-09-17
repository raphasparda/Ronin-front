import {
  notificationsResponseSchema,
  unreadCountResponseSchema,
  type Notification,
  type NotificationsResponse,
  type UnreadCountResponse,
} from '@raphasparda/ronin-shared';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';

import { api, apiRequest } from '../../lib/api-client';

export const NOTIFICATIONS_POLL_INTERVAL_MS = 60_000;

export const notificationsQueryKey = ['notifications'] as const;
export const unreadCountQueryKey = ['notifications', 'unread-count'] as const;
export const notificationListQueryKey = ['notifications', 'list'] as const;

type ListData = InfiniteData<NotificationsResponse, string | null>;

/** Contador do sino: polling de 60 s (screens §10). */
export function useUnreadCount() {
  return useQuery({
    queryKey: unreadCountQueryKey,
    queryFn: ({ signal }) =>
      api.get('/api/notifications/unread-count', { schema: unreadCountResponseSchema, signal }),
    select: (data) => data.unreadCount,
    refetchInterval: NOTIFICATIONS_POLL_INTERVAL_MS,
    meta: { silentErrors: true },
  });
}

/** Lista paginada por cursor (`before` = `nextBefore` da página anterior). */
export function useNotificationList({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  return useInfiniteQuery({
    queryKey: notificationListQueryKey,
    queryFn: async ({ pageParam, signal }) => {
      const query = pageParam === null ? '' : `?before=${encodeURIComponent(pageParam)}`;
      const page = await api.get(`/api/notifications${query}`, {
        schema: notificationsResponseSchema,
        signal,
      });
      queryClient.setQueryData<UnreadCountResponse>(unreadCountQueryKey, {
        unreadCount: page.unreadCount,
      });
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    enabled,
    meta: { silentErrors: true },
  });
}

interface ReadSnapshot {
  list: ListData | undefined;
  count: UnreadCountResponse | undefined;
}

async function markInCache(
  queryClient: QueryClient,
  shouldMark: (notification: Notification) => boolean,
): Promise<ReadSnapshot> {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: notificationListQueryKey }),
    queryClient.cancelQueries({ queryKey: unreadCountQueryKey }),
  ]);
  const snapshot: ReadSnapshot = {
    list: queryClient.getQueryData<ListData>(notificationListQueryKey),
    count: queryClient.getQueryData<UnreadCountResponse>(unreadCountQueryKey),
  };
  const readAt = new Date().toISOString();
  queryClient.setQueryData<ListData>(notificationListQueryKey, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            notifications: page.notifications.map((item) =>
              item.readAt === null && shouldMark(item) ? { ...item, readAt } : item,
            ),
          })),
        }
      : data,
  );
  return snapshot;
}

function restore(queryClient: QueryClient, snapshot: ReadSnapshot | undefined) {
  if (!snapshot) return;
  queryClient.setQueryData(notificationListQueryKey, snapshot.list);
  queryClient.setQueryData(unreadCountQueryKey, snapshot.count);
}

function setUnreadCount(queryClient: QueryClient, update: (count: number) => number) {
  queryClient.setQueryData<UnreadCountResponse>(unreadCountQueryKey, (data) =>
    data ? { unreadCount: Math.max(0, update(data.unreadCount)) } : data,
  );
}

/** Marca uma não lida como lida (otimista: some o destaque e o contador desce na hora). */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: 'notifications-read' },
    mutationFn: (notificationId: string) =>
      apiRequest(`/api/notifications/${notificationId}/read`, { method: 'POST' }),
    onMutate: async (notificationId) => {
      const snapshot = await markInCache(queryClient, (item) => item.id === notificationId);
      setUnreadCount(queryClient, (count) => count - 1);
      return snapshot;
    },
    onError: (_error, _id, snapshot) => restore(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: unreadCountQueryKey }),
    meta: { silentErrors: true },
  });
}

/** "Marcar todas como lidas" (otimista, com rollback). */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: 'notifications-read' },
    mutationFn: () => apiRequest('/api/notifications/read-all', { method: 'POST' }),
    onMutate: async () => {
      const snapshot = await markInCache(queryClient, () => true);
      setUnreadCount(queryClient, () => 0);
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => restore(queryClient, snapshot),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey }),
    meta: { silentErrors: true },
  });
}
