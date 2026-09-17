import {
  applyPlacement,
  boardArchivedResponseSchema,
  boardPayloadSchema,
  boardResponseSchema,
  boardsResponseSchema,
  createBoardResponseSchema,
  listResponseSchema,
  sortByPosition,
  updateListResponseSchema,
  type Board,
  type BoardPayload,
  type CreateListRequestInput,
  type List,
  type Placement,
  type UpdateListRequest,
} from '@kanban/shared';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { api, apiRequest } from '../../lib/api-client';
import { cardQueryKey } from '../cards/cards-api';
import { myCardsQueryKey } from '../my-cards/my-cards-api';

export const BOARD_POLL_INTERVAL_MS = 30_000;

export const boardsQueryKey = (archived: boolean) => ['boards', { archived }] as const;
export const boardQueryKey = (boardId: string) => ['board', boardId] as const;
export const archivedItemsQueryKey = (boardId: string) => ['board-archived', boardId] as const;
export const moveCardMutationKey = (boardId: string) => ['move-card', boardId] as const;
const moveListMutationKey = (boardId: string) => ['move-list', boardId] as const;

function sortBoards(boards: readonly Board[]): Board[] {
  return [...boards].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function useBoards(archived: boolean) {
  return useQuery({
    queryKey: boardsQueryKey(archived),
    queryFn: ({ signal }) =>
      api.get(`/api/boards?archived=${archived}`, { schema: boardsResponseSchema, signal }),
    select: (data) => sortBoards(data.boards),
  });
}

export function fetchBoard(boardId: string, signal?: AbortSignal): Promise<BoardPayload> {
  return api.get(`/api/boards/${boardId}`, { schema: boardPayloadSchema, signal });
}

export function useBoard(boardId: string, { paused = false }: { paused?: boolean } = {}) {
  const movingLists = useIsMutating({ mutationKey: moveListMutationKey(boardId) }) > 0;
  const movingCards = useIsMutating({ mutationKey: moveCardMutationKey(boardId) }) > 0;
  const moving = movingLists || movingCards;
  return useQuery({
    queryKey: boardQueryKey(boardId),
    queryFn: ({ signal }) => fetchBoard(boardId, signal),
    refetchInterval: paused || moving ? false : BOARD_POLL_INTERVAL_MS,
    meta: { silentErrors: true },
  });
}

export function setBoardData(
  queryClient: QueryClient,
  boardId: string,
  update: (payload: BoardPayload) => BoardPayload,
) {
  queryClient.setQueryData(boardQueryKey(boardId), (payload: BoardPayload | undefined) =>
    payload ? update(payload) : payload,
  );
}

function invalidateBoardLists(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ['boards'] });
}

export function useCreateBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post('/api/boards', { name }, { schema: createBoardResponseSchema }),
    onSuccess: ({ board, lists }) => {
      queryClient.setQueryData(boardQueryKey(board.id), {
        board,
        lists: sortByPosition(lists),
        cards: [],
        labels: [],
      } satisfies BoardPayload);
      void invalidateBoardLists(queryClient);
    },
  });
}

function useBoardStateMutation(action: 'archive' | 'restore') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boardId: string) =>
      api.post(`/api/boards/${boardId}/${action}`, undefined, { schema: boardResponseSchema }),
    onSuccess: ({ board }) => {
      setBoardData(queryClient, board.id, (payload) => ({ ...payload, board }));
      void invalidateBoardLists(queryClient);
    },
  });
}

export const useArchiveBoard = () => useBoardStateMutation('archive');
export const useRestoreBoard = () => useBoardStateMutation('restore');

export function useRenameBoard(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.patch(`/api/boards/${boardId}`, { name }, { schema: boardResponseSchema }),
    onMutate: async (name) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        board: { ...payload.board, name },
      }));
      return { previous };
    },
    onError: (_error, _name, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey(boardId), context.previous);
    },
    onSuccess: ({ board }) => {
      setBoardData(queryClient, boardId, (payload) => ({ ...payload, board }));
      void invalidateBoardLists(queryClient);
    },
    meta: { silentErrors: true },
  });
}

export function useDeleteBoard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ boardId, confirmName }: { boardId: string; confirmName: string }) =>
      apiRequest(`/api/boards/${boardId}`, { method: 'DELETE', body: { confirmName } }),
    onSuccess: (_data, { boardId }) => {
      queryClient.removeQueries({ queryKey: boardQueryKey(boardId) });
      void invalidateBoardLists(queryClient);
    },
  });
}

export function useCreateList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateListRequestInput) =>
      api.post(`/api/boards/${boardId}/lists`, body, { schema: listResponseSchema }),
    onSuccess: ({ list }) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        lists: sortByPosition([...payload.lists.filter((item) => item.id !== list.id), list]),
      }));
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    },
    meta: { silentErrors: true },
  });
}

export interface UpdateListVariables {
  listId: string;
  changes: UpdateListRequest;
}

/** Nome, cor e marcação de conclusão. Nome e cor são otimistas; a resposta traz todas as listas. */
export function useUpdateList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `update-list-${boardId}` },
    mutationFn: ({ listId, changes }: UpdateListVariables) =>
      api.patch(`/api/lists/${listId}`, changes, { schema: updateListResponseSchema }),
    onMutate: async ({ listId, changes }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      const { name, color } = changes;
      if (name !== undefined || color !== undefined) {
        setBoardData(queryClient, boardId, (payload) => ({
          ...payload,
          lists: payload.lists.map((list) =>
            list.id === listId
              ? {
                  ...list,
                  ...(name !== undefined && { name }),
                  ...(color !== undefined && { color }),
                }
              : list,
          ),
        }));
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey(boardId), context.previous);
    },
    onSuccess: ({ lists, completedCardIds }) => {
      if (completedCardIds.length > 0) {
        void queryClient.invalidateQueries({ queryKey: myCardsQueryKey });
        for (const cardId of completedCardIds) {
          void queryClient.invalidateQueries({ queryKey: cardQueryKey(cardId) });
        }
      }
      const completedAt = new Date().toISOString();
      const completed = new Set(completedCardIds);
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        lists: sortByPosition(lists),
        cards: payload.cards.map((card) =>
          completed.has(card.id) ? { ...card, status: 'completed', completedAt } : card,
        ),
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    meta: { silentErrors: true },
  });
}

/**
 * Nova ordem otimista: reaproveita as mesmas chaves de posição, redistribuídas na ordem nova.
 * A ordem final (e as chaves reais) vêm do refetch após a resposta.
 */
export function reorderLists(
  lists: readonly List[],
  listId: string,
  placement: Placement,
): List[] | null {
  const ordered = sortByPosition(lists);
  const order = applyPlacement(
    ordered.map((list) => list.id),
    listId,
    placement,
  );
  if (order === null) return null;
  const positions = ordered.map((list) => list.position);
  const byId = new Map(ordered.map((list) => [list.id, list]));
  return order.map((id, index) => ({
    ...(byId.get(id) as List),
    position: positions[index] as string,
  }));
}

export function useMoveList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: moveListMutationKey(boardId),
    mutationFn: ({ listId, placement }: { listId: string; placement: Placement }) =>
      api.post(`/api/lists/${listId}/move`, { placement }, { schema: listResponseSchema }),
    onMutate: async ({ listId, placement }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        lists: reorderLists(payload.lists, listId, placement) ?? payload.lists,
      }));
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey(boardId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    meta: { silentErrors: true },
  });
}

export function useArchiveList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      api.post(`/api/lists/${listId}/archive`, undefined, { schema: listResponseSchema }),
    onMutate: async (listId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        lists: payload.lists.filter((list) => list.id !== listId),
        cards: payload.cards.filter((card) => card.listId !== listId),
      }));
      return { previous };
    },
    onError: (_error, _listId, context) => {
      if (context?.previous) queryClient.setQueryData(boardQueryKey(boardId), context.previous);
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
        queryClient.invalidateQueries({ queryKey: archivedItemsQueryKey(boardId) }),
      ]),
    meta: { silentErrors: true },
  });
}

/** Listas e cards arquivados do quadro ("Itens arquivados…"). */
export function useArchivedItems(boardId: string, enabled: boolean) {
  return useQuery({
    queryKey: archivedItemsQueryKey(boardId),
    queryFn: ({ signal }) =>
      api.get(`/api/boards/${boardId}/archived`, { schema: boardArchivedResponseSchema, signal }),
    enabled,
  });
}

export function useRestoreList(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (listId: string) =>
      api.post(`/api/lists/${listId}/restore`, undefined, { schema: listResponseSchema }),
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
        queryClient.invalidateQueries({ queryKey: archivedItemsQueryKey(boardId) }),
      ]),
    meta: { silentErrors: true },
  });
}
