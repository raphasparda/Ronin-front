import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test';

import { csrfHeaders } from './auth';
import { WEB_ORIGIN } from './env';
import { SESSION_COOKIE, type SeededUser } from './seed';

/** Tipos mínimos das respostas usadas nos testes (contrato completo: docs/architecture/api.md). */
export type PaletteColor =
  'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'magenta';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface Board {
  id: string;
  name: string;
  archivedAt: string | null;
}
export interface List {
  id: string;
  boardId: string;
  name: string;
  position: string;
  isDoneList: boolean;
  color: PaletteColor;
}
export interface Card {
  id: string;
  boardId: string;
  listId: string;
  title: string;
  position: string;
  status: 'open' | 'completed';
  priority: Priority | null;
  dueAt: string | null;
  labelIds: string[];
  assigneeIds: string[];
  checklist: { done: number; total: number };
  commentCount: number;
  archivedAt: string | null;
}
export interface Label {
  id: string;
  boardId: string;
  name: string;
  color: PaletteColor;
}
export interface BoardPayload {
  board: Board;
  lists: List[];
  cards: Card[];
  labels: Label[];
}
export interface Activity {
  id: string;
  actorId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}
export interface Comment {
  id: string;
  authorId: string;
  body: string;
}

/** Cliente da API autenticado como um usuário semeado (cookie + headers de CSRF), via proxy do Vite. */
export class Api {
  private constructor(
    readonly user: SeededUser,
    readonly http: APIRequestContext,
  ) {}

  static async as(user: SeededUser): Promise<Api> {
    const http = await request.newContext({
      baseURL: WEB_ORIGIN,
      extraHTTPHeaders: { ...csrfHeaders, cookie: `${SESSION_COOKIE}=${user.token}` },
    });
    return new Api(user, http);
  }

  dispose(): Promise<void> {
    return this.http.dispose();
  }

  private async json<T>(response: APIResponse, expected: number): Promise<T> {
    const text = await response.text();
    expect(response.status(), `${response.url()} → ${text}`).toBe(expected);
    return (text === '' ? undefined : JSON.parse(text)) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.http.get(path).then((res) => this.json<T>(res, 200));
  }

  post<T>(path: string, data?: unknown, expected = 200): Promise<T> {
    return this.http.post(path, { data }).then((res) => this.json<T>(res, expected));
  }

  patch<T>(path: string, data: unknown): Promise<T> {
    return this.http.patch(path, { data }).then((res) => this.json<T>(res, 200));
  }

  put<T>(path: string): Promise<T> {
    return this.http.put(path).then((res) => this.json<T>(res, 200));
  }

  async createBoard(name: string): Promise<{ board: Board; lists: List[] }> {
    const result = await this.post<{ board: Board; lists: List[] }>('/api/boards', { name }, 201);
    result.lists.sort((a, b) => (a.position < b.position ? -1 : 1));
    return result;
  }

  board(boardId: string): Promise<BoardPayload> {
    return this.get<BoardPayload>(`/api/boards/${boardId}`);
  }

  async createCard(listId: string, title: string): Promise<Card> {
    const { card } = await this.post<{ card: Card }>(`/api/lists/${listId}/cards`, { title }, 201);
    return card;
  }

  updateCard(
    cardId: string,
    patch: {
      title?: string;
      description?: string;
      due?: { date: string; time: string | null } | null;
      priority?: Priority | null;
    },
  ): Promise<unknown> {
    return this.patch(`/api/cards/${cardId}`, patch);
  }

  updateList(
    listId: string,
    patch: { name?: string; color?: PaletteColor; isDoneList?: boolean },
  ): Promise<unknown> {
    return this.patch(`/api/lists/${listId}`, patch);
  }

  assign(cardId: string, userId: string): Promise<unknown> {
    return this.put(`/api/cards/${cardId}/assignees/${userId}`);
  }

  async createLabel(boardId: string, name: string, color: PaletteColor): Promise<Label> {
    const { label } = await this.post<{ label: Label }>(
      `/api/boards/${boardId}/labels`,
      { name, color },
      201,
    );
    return label;
  }

  applyLabel(cardId: string, labelId: string): Promise<unknown> {
    return this.put(`/api/cards/${cardId}/labels/${labelId}`);
  }

  async comment(cardId: string, body: string): Promise<Comment> {
    const { comment } = await this.post<{ comment: Comment }>(
      `/api/cards/${cardId}/comments`,
      { body },
      201,
    );
    return comment;
  }

  complete(cardId: string): Promise<unknown> {
    return this.post(`/api/cards/${cardId}/complete`);
  }

  archiveCard(cardId: string): Promise<unknown> {
    return this.post(`/api/cards/${cardId}/archive`);
  }

  async activity(cardId: string): Promise<Activity[]> {
    const { activities } = await this.get<{ activities: Activity[] }>(
      `/api/cards/${cardId}/activity`,
    );
    return activities;
  }

  unreadCount(): Promise<number> {
    return this.get<{ unreadCount: number }>('/api/notifications/unread-count').then(
      (body) => body.unreadCount,
    );
  }
}

/** Ids dos cards de uma lista, na ordem do quadro. */
export function cardIdsInList(payload: BoardPayload, listId: string): string[] {
  return payload.cards
    .filter((card) => card.listId === listId)
    .sort((a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0))
    .map((card) => card.id);
}

export function listByName(lists: readonly List[], name: string): List {
  const list = lists.find((item) => item.name === name);
  if (!list) throw new Error(`lista "${name}" não encontrada`);
  return list;
}
