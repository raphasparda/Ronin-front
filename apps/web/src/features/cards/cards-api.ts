import {
  activitiesResponseSchema,
  applyPlacement,
  cardDetailResponseSchema,
  cardMutationResultSchema,
  cardSummaryResponseSchema,
  cardSummarySchema,
  completionChangeOnMove,
  sortByPosition,
  type BoardPayload,
  type CardDetail,
  type CardPriority,
  type CardSummary,
  type CompletionChange,
  type Placement,
  type UpdateCardRequest,
} from '@kanban/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { useCallback } from 'react';

import { api, apiRequest } from '../../lib/api-client';
import { dueInputToIso } from '../../lib/due';
import { useSession } from '../auth/auth-api';
import {
  archivedItemsQueryKey,
  boardQueryKey,
  moveCardMutationKey,
  setBoardData,
} from '../boards/boards-api';

export const CARD_POLL_INTERVAL_MS = 30_000;

export const cardQueryKey = (cardId: string) => ['card', cardId] as const;
export const cardActivityQueryKey = (cardId: string) => ['card-activity', cardId] as const;
const createCardMutationKey = (boardId: string) => ['create-card', boardId] as const;

export const cardPath = (boardId: string, cardId: string) => `/b/${boardId}/c/${cardId}`;

/** Estado de navegação de links internos para o detalhe: fechar volta no histórico. */
export interface CardLinkState {
  fromApp: true;
}
export const CARD_LINK_STATE: CardLinkState = { fromApp: true };

/** Cards de uma lista, na ordem do quadro. */
export function cardsInList(cards: readonly CardSummary[], listId: string): CardSummary[] {
  return sortByPosition(cards.filter((card) => card.listId === listId));
}

export function toCardSummary(card: CardDetail): CardSummary {
  return cardSummarySchema.parse(card);
}

function keyBetween(before: string | null, after: string | null): string | null {
  try {
    return generateKeyBetween(before, after);
  } catch {
    return null;
  }
}

function statusAfter(
  card: CardSummary,
  change: CompletionChange | null,
): Pick<CardSummary, 'status' | 'completedAt'> {
  if (change === 'completed') return { status: 'completed', completedAt: new Date().toISOString() };
  if (change === 'reopened') return { status: 'open', completedAt: null };
  return { status: card.status, completedAt: card.completedAt };
}

export interface CardDestination {
  boardId: string;
  listId: string;
  placement: Placement;
}

/**
 * Movimento otimista no payload do quadro: posição temporária entre os vizinhos
 * (`generateKeyBetween`) e status pelas regras de conclusão. Saindo do quadro, o card some.
 * `null` quando o `placement` não vale no destino.
 */
export function moveCardInPayload(
  payload: BoardPayload,
  cardId: string,
  destination: CardDestination,
): BoardPayload | null {
  const card = payload.cards.find((item) => item.id === cardId);
  if (!card) return payload;
  if (destination.boardId !== payload.board.id) {
    return { ...payload, cards: payload.cards.filter((item) => item.id !== cardId) };
  }

  const siblings = cardsInList(payload.cards, destination.listId).filter(
    (item) => item.id !== cardId,
  );
  const order = applyPlacement(
    siblings.map((item) => item.id),
    cardId,
    destination.placement,
  );
  if (order === null) return null;

  const index = order.indexOf(cardId);
  const change = completionChangeOnMove({
    status: card.status,
    fromListIsDone: payload.lists.find((list) => list.id === card.listId)?.isDoneList ?? false,
    toListIsDone: payload.lists.find((list) => list.id === destination.listId)?.isDoneList ?? false,
  });
  const moved = { listId: destination.listId, ...statusAfter(card, change) };

  const position = keyBetween(
    siblings[index - 1]?.position ?? null,
    siblings[index]?.position ?? null,
  );
  if (position !== null) {
    return {
      ...payload,
      cards: payload.cards.map((item) =>
        item.id === cardId ? { ...item, ...moved, position } : item,
      ),
    };
  }

  const keys = new Map(
    generateNKeysBetween(null, null, order.length).map((key, i) => [order[i], key]),
  );
  return {
    ...payload,
    cards: payload.cards.map((item) => {
      const key = keys.get(item.id);
      if (key === undefined) return item;
      return item.id === cardId ? { ...item, ...moved, position: key } : { ...item, position: key };
    }),
  };
}

function mergeSummary(detail: CardDetail, card: CardSummary, payload?: BoardPayload): CardDetail {
  const list = payload?.lists.find((item) => item.id === card.listId);
  return {
    ...detail,
    ...card,
    list: list
      ? {
          id: list.id,
          name: list.name,
          color: list.color,
          isDoneList: list.isDoneList,
          archived: list.archivedAt !== null,
        }
      : detail.list,
  };
}

export function setCardDetail(
  queryClient: QueryClient,
  cardId: string,
  update: (card: CardDetail) => CardDetail,
) {
  queryClient.setQueryData(cardQueryKey(cardId), (card: CardDetail | undefined) =>
    card ? update(card) : card,
  );
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export function useCard(cardId: string) {
  return useQuery({
    queryKey: cardQueryKey(cardId),
    queryFn: async ({ signal }) =>
      (await api.get(`/api/cards/${cardId}`, { schema: cardDetailResponseSchema, signal })).card,
    refetchInterval: CARD_POLL_INTERVAL_MS,
    meta: { silentErrors: true },
  });
}

export function useCardActivity(cardId: string) {
  return useQuery({
    queryKey: cardActivityQueryKey(cardId),
    queryFn: async ({ signal }) =>
      (
        await api.get(`/api/cards/${cardId}/activity`, {
          schema: activitiesResponseSchema,
          signal,
        })
      ).activities,
    meta: { silentErrors: true },
  });
}

// ---------------------------------------------------------------------------
// Criar
// ---------------------------------------------------------------------------

export interface CreateCardVariables {
  listId: string;
  title: string;
  tempId: string;
}

export function useCreateCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: createCardMutationKey(boardId),
    scope: { id: `create-card-${boardId}` },
    mutationFn: ({ listId, title }: CreateCardVariables) =>
      api.post(`/api/lists/${listId}/cards`, { title }, { schema: cardSummaryResponseSchema }),
    onMutate: async ({ listId, title, tempId }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      setBoardData(queryClient, boardId, (payload) => {
        const last = cardsInList(payload.cards, listId).at(-1)?.position ?? null;
        const temp: CardSummary = {
          id: tempId,
          boardId,
          listId,
          title,
          position: keyBetween(last, null) ?? `${last ?? ''}~`,
          status: 'open',
          completedAt: null,
          dueAt: null,
          dueHasTime: false,
          priority: null,
          labelIds: [],
          assigneeIds: [],
          checklist: { done: 0, total: 0 },
          commentCount: 0,
          hasDescription: false,
          archivedAt: null,
        };
        return { ...payload, cards: [...payload.cards, temp] };
      });
    },
    onError: (_error, { tempId }) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        cards: payload.cards.filter((card) => card.id !== tempId),
      }));
    },
    onSuccess: ({ card }, { tempId }) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        cards: payload.cards.map((item) => (item.id === tempId ? card : item)),
      }));
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: createCardMutationKey(boardId) }) <= 1) {
        await queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
      }
    },
    meta: { silentErrors: true },
  });
}

// ---------------------------------------------------------------------------
// Editar (título, descrição, prazo e prioridade)
// ---------------------------------------------------------------------------

/** Campos da face que mudam juntos no detalhe e no payload do quadro. */
export type CardSummaryPatch = Partial<
  Pick<
    CardSummary,
    | 'title'
    | 'priority'
    | 'dueAt'
    | 'dueHasTime'
    | 'labelIds'
    | 'assigneeIds'
    | 'checklist'
    | 'commentCount'
  >
>;

/** Aplica o mesmo patch no detalhe (`['card', id]`) e na face do card no payload do quadro. */
export function patchCard(
  queryClient: QueryClient,
  boardId: string,
  cardId: string,
  patch: CardSummaryPatch,
) {
  setCardDetail(queryClient, cardId, (card) => ({ ...card, ...patch }));
  setBoardData(queryClient, boardId, (payload) => ({
    ...payload,
    cards: payload.cards.map((card) => (card.id === cardId ? { ...card, ...patch } : card)),
  }));
}

function pickPatch(card: CardSummary, keys: readonly (keyof CardSummaryPatch)[]): CardSummaryPatch {
  return Object.fromEntries(keys.map((key) => [key, card[key]]));
}

function optimisticPatch(
  changes: UpdateCardRequest,
  timeZone: string | undefined,
): CardSummaryPatch {
  const patch: CardSummaryPatch = {};
  if (changes.title !== undefined) patch.title = changes.title;
  if (changes.priority !== undefined) patch.priority = changes.priority;
  if (changes.due !== undefined) {
    patch.dueAt = changes.due === null ? null : dueInputToIso(changes.due, timeZone);
    patch.dueHasTime = changes.due?.time != null;
  }
  return patch;
}

export function useUpdateCard(cardId: string) {
  const queryClient = useQueryClient();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  return useMutation({
    scope: { id: `update-card-${cardId}` },
    mutationFn: (changes: UpdateCardRequest) =>
      api.patch(`/api/cards/${cardId}`, changes, { schema: cardDetailResponseSchema }),
    onMutate: async (changes) => {
      const previous = queryClient.getQueryData<CardDetail>(cardQueryKey(cardId));
      const patch = optimisticPatch(changes, timeZone);
      const keys = Object.keys(patch) as (keyof CardSummaryPatch)[];
      if (keys.length === 0 || !previous) return undefined;
      await queryClient.cancelQueries({ queryKey: cardQueryKey(cardId) });
      patchCard(queryClient, previous.boardId, cardId, patch);
      return { boardId: previous.boardId, rollback: pickPatch(previous, keys) };
    },
    onError: (_error, _changes, context) => {
      if (context) patchCard(queryClient, context.boardId, cardId, context.rollback);
    },
    onSuccess: ({ card }) => {
      queryClient.setQueryData(cardQueryKey(cardId), card);
      const summary = toCardSummary(card);
      setBoardData(queryClient, card.boardId, (payload) => ({
        ...payload,
        cards: payload.cards.map((item) => (item.id === cardId ? summary : item)),
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
    meta: { silentErrors: true },
  });
}

export interface SetPriorityVariables {
  cardId: string;
  priority: CardPriority | null;
}

/** Prioridade pelo menu da face (sem o detalhe aberto): otimista na face e no detalhe em cache. */
export function useSetCardPriority(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `card-priority-${boardId}` },
    mutationFn: ({ cardId, priority }: SetPriorityVariables) =>
      api.patch(`/api/cards/${cardId}`, { priority }, { schema: cardDetailResponseSchema }),
    onMutate: async ({ cardId, priority }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      const previous = payload?.cards.find((card) => card.id === cardId)?.priority ?? null;
      patchCard(queryClient, boardId, cardId, { priority });
      return { previous };
    },
    onError: (_error, { cardId }, context) => {
      if (context) patchCard(queryClient, boardId, cardId, { priority: context.previous });
    },
    onSuccess: ({ card }) => queryClient.setQueryData(cardQueryKey(card.id), card),
    onSettled: (_data, _error, { cardId }) =>
      queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
    meta: { silentErrors: true },
  });
}

// ---------------------------------------------------------------------------
// Mover
// ---------------------------------------------------------------------------

export interface MoveCardVariables {
  card: CardSummary;
  toBoard: { id: string; name: string };
  toList: { id: string; name: string };
  placement: Placement;
  /** Posição 1-based no destino, para a mensagem. */
  position: number;
  source: 'drag' | 'dialog';
}

interface MoveSnapshot {
  payload: BoardPayload | undefined;
  detail: CardDetail | undefined;
}

type MoveCardRequest = MoveCardVariables & { snapshot: MoveSnapshot };

export interface MoveCardCallbacks {
  onSuccess: (
    result: { completionChange: CompletionChange | null; removedLabelIds: string[] },
    variables: MoveCardVariables,
  ) => void;
  onError: (error: unknown, variables: MoveCardVariables) => void;
}

/**
 * Mover card (arrastar, "Mover para…"). A atualização otimista é aplicada **antes** de
 * `mutate` para o card não "piscar" na origem ao soltar. Movimentos do mesmo quadro rodam em
 * fila (`scope`) e o quadro só é recarregado quando a fila esvazia.
 */
export function useMoveCard(boardId: string, callbacks: MoveCardCallbacks) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationKey: moveCardMutationKey(boardId),
    scope: { id: `move-card-${boardId}` },
    mutationFn: ({ card, toList, placement }: MoveCardRequest) =>
      api.post(
        `/api/cards/${card.id}/move`,
        { toListId: toList.id, placement },
        { schema: cardMutationResultSchema },
      ),
    onSuccess: (result, variables) => {
      const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      if (variables.toBoard.id === boardId) {
        setBoardData(queryClient, boardId, (current) => ({
          ...current,
          cards: current.cards.map((card) => (card.id === result.card.id ? result.card : card)),
        }));
      }
      setCardDetail(queryClient, result.card.id, (detail) =>
        mergeSummary(detail, result.card, variables.toBoard.id === boardId ? payload : undefined),
      );
      callbacks.onSuccess(result, variables);
    },
    onError: (error, variables) => {
      const { snapshot } = variables;
      if (snapshot.payload) queryClient.setQueryData(boardQueryKey(boardId), snapshot.payload);
      if (snapshot.detail)
        queryClient.setQueryData(cardQueryKey(variables.card.id), snapshot.detail);
      callbacks.onError(error, variables);
    },
    onSettled: async (_data, _error, { card, toBoard }) => {
      void queryClient.invalidateQueries({ queryKey: cardQueryKey(card.id) });
      void queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(card.id) });
      if (toBoard.id !== boardId) {
        void queryClient.invalidateQueries({ queryKey: boardQueryKey(toBoard.id) });
      }
      if (queryClient.isMutating({ mutationKey: moveCardMutationKey(boardId) }) <= 1) {
        await queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
      }
    },
    meta: { silentErrors: true },
  });

  const { mutate } = mutation;
  const move = useCallback(
    (variables: MoveCardVariables) => {
      const key = boardQueryKey(boardId);
      void queryClient.cancelQueries({ queryKey: key });
      void queryClient.cancelQueries({ queryKey: cardQueryKey(variables.card.id) });
      const snapshot: MoveSnapshot = {
        payload: queryClient.getQueryData<BoardPayload>(key),
        detail: queryClient.getQueryData<CardDetail>(cardQueryKey(variables.card.id)),
      };
      const destination = {
        boardId: variables.toBoard.id,
        listId: variables.toList.id,
        placement: variables.placement,
      };
      if (snapshot.payload) {
        const next = moveCardInPayload(snapshot.payload, variables.card.id, destination);
        if (next) {
          queryClient.setQueryData(key, next);
          const moved = next.cards.find((card) => card.id === variables.card.id);
          if (moved) {
            setCardDetail(queryClient, moved.id, (detail) => mergeSummary(detail, moved, next));
          }
        }
      }
      mutate({ ...variables, snapshot });
    },
    [boardId, mutate, queryClient],
  );

  return { move, isPending: mutation.isPending };
}

// ---------------------------------------------------------------------------
// Arquivar, restaurar e excluir
// ---------------------------------------------------------------------------

function invalidateCardAndBoard(queryClient: QueryClient, boardId: string, cardId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    queryClient.invalidateQueries({ queryKey: archivedItemsQueryKey(boardId) }),
    queryClient.invalidateQueries({ queryKey: cardQueryKey(cardId) }),
    queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
  ]);
}

export function useArchiveCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      api.post(`/api/cards/${cardId}/archive`, undefined, { schema: cardSummaryResponseSchema }),
    onMutate: async (cardId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      const archivedAt = new Date().toISOString();
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        cards: payload.cards.filter((card) => card.id !== cardId),
      }));
      setCardDetail(queryClient, cardId, (card) => ({ ...card, archivedAt }));
      return { card: previous?.cards.find((card) => card.id === cardId) };
    },
    onError: (_error, cardId, context) => {
      const card = context?.card;
      if (card) {
        setBoardData(queryClient, boardId, (payload) => ({
          ...payload,
          cards: payload.cards.some((item) => item.id === cardId)
            ? payload.cards
            : [...payload.cards, card],
        }));
      }
      setCardDetail(queryClient, cardId, (detail) => ({ ...detail, archivedAt: null }));
    },
    onSuccess: ({ card }) =>
      setCardDetail(queryClient, card.id, (detail) => ({ ...detail, ...card })),
    onSettled: (_data, _error, cardId) => invalidateCardAndBoard(queryClient, boardId, cardId),
    meta: { silentErrors: true },
  });
}

export function useRestoreCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      api.post(`/api/cards/${cardId}/restore`, undefined, { schema: cardSummaryResponseSchema }),
    onSuccess: ({ card }) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        cards: payload.lists.some((list) => list.id === card.listId)
          ? [...payload.cards.filter((item) => item.id !== card.id), card]
          : payload.cards,
      }));
      setCardDetail(queryClient, card.id, (detail) => ({ ...detail, ...card }));
    },
    onSettled: (_data, _error, cardId) => invalidateCardAndBoard(queryClient, boardId, cardId),
    meta: { silentErrors: true },
  });
}

export function useDeleteCard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) => apiRequest(`/api/cards/${cardId}`, { method: 'DELETE' }),
    onSuccess: (_data, cardId) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        cards: payload.cards.filter((card) => card.id !== cardId),
      }));
      queryClient.removeQueries({ queryKey: cardQueryKey(cardId) });
      queryClient.removeQueries({ queryKey: cardActivityQueryKey(cardId) });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
        queryClient.invalidateQueries({ queryKey: archivedItemsQueryKey(boardId) }),
      ]),
    meta: { silentErrors: true },
  });
}
