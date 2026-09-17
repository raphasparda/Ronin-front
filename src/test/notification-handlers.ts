import {
  notificationIdParamsSchema,
  notificationsQuerySchema,
  notificationsResponseSchema,
  unreadCountResponseSchema,
  type Notification,
} from '@raphasparda/ronin-shared';
import { randomUUID } from 'node:crypto';
import { http, HttpResponse } from 'msw';

import { MEMBER_ID, type RecordedRequest } from './admin-handlers';
import { apiErrorResponse } from './auth-handlers';
import { BOARD_ID, CARD_IDS } from './board-handlers';

interface NotificationDb {
  notifications: Notification[];
  requests: RecordedRequest[];
}

const seed = (): NotificationDb => ({ notifications: [], requests: [] });

export let notificationDb: NotificationDb = seed();

export function resetNotificationDb(): void {
  notificationDb = seed();
}

export function notificationRequests(path: string): RecordedRequest[] {
  return notificationDb.requests.filter((item) => item.path === path);
}

/** Notificação de exemplo (Bruno atribuiu você a "Revisar orçamento"), com `overrides`. */
export function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: randomUUID(),
    type: 'card_assigned',
    actorId: MEMBER_ID,
    card: {
      id: CARD_IDS.budget,
      title: 'Revisar orçamento',
      boardId: BOARD_ID,
      boardName: 'Marketing',
    },
    commentId: null,
    readAt: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function seedNotifications(notifications: readonly Notification[]): void {
  notificationDb.notifications.push(...notifications);
}

const unreadCount = () => notificationDb.notifications.filter((item) => !item.readAt).length;

function validationError() {
  return apiErrorResponse('VALIDATION_ERROR', { message: 'Dados inválidos.' });
}

/** Notificações do usuário logado (api.md §15): cursor `before`, mais recentes primeiro. */
export const notificationHandlers = [
  http.get('/api/notifications/unread-count', () =>
    HttpResponse.json(unreadCountResponseSchema.parse({ unreadCount: unreadCount() })),
  ),

  http.get('/api/notifications', ({ request }) => {
    const url = new URL(request.url);
    const query = notificationsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!query.success) return validationError();
    notificationDb.requests.push({ method: 'GET', path: 'notifications', body: query.data });
    const { limit, before } = query.data;
    const sorted = [...notificationDb.notifications]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((item) => before === undefined || item.createdAt < before);
    const page = sorted.slice(0, limit);
    return HttpResponse.json(
      notificationsResponseSchema.parse({
        notifications: page,
        unreadCount: unreadCount(),
        nextBefore: sorted.length > limit ? (page.at(-1)?.createdAt ?? null) : null,
      }),
    );
  }),

  http.post('/api/notifications/read-all', () => {
    notificationDb.requests.push({
      method: 'POST',
      path: 'notifications/read-all',
      body: undefined,
    });
    const readAt = new Date().toISOString();
    notificationDb.notifications = notificationDb.notifications.map((item) =>
      item.readAt ? item : { ...item, readAt },
    );
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/notifications/:notificationId/read', ({ params }) => {
    const parsed = notificationIdParamsSchema.safeParse(params);
    if (!parsed.success) return validationError();
    const { notificationId } = parsed.data;
    notificationDb.requests.push({
      method: 'POST',
      path: 'notifications/read',
      body: notificationId,
    });
    const found = notificationDb.notifications.find((item) => item.id === notificationId);
    if (!found) return apiErrorResponse('NOT_FOUND');
    notificationDb.notifications = notificationDb.notifications.map((item) =>
      item.id === notificationId
        ? { ...item, readAt: item.readAt ?? new Date().toISOString() }
        : item,
    );
    return new HttpResponse(null, { status: 204 });
  }),
];
