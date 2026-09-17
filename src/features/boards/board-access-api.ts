import {
  boardResponseSchema,
  boardViewersResponseSchema,
  type BoardVisibility,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { setBoardData } from './boards-api';

/**
 * Visibilidade do quadro (`PUT /api/boards/:boardId/visibility`, ADR 0015). A resposta traz o
 * quadro inteiro, com a lista de acesso já montada pelo servidor (ator + quem já participava).
 */
export function useSetBoardVisibility(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `board-access-${boardId}` },
    mutationFn: (visibility: BoardVisibility) =>
      api.put(`/api/boards/${boardId}/visibility`, { visibility }, { schema: boardResponseSchema }),
    onSuccess: ({ board }) =>
      setBoardData(queryClient, boardId, (payload) => ({ ...payload, board })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
    meta: { silentErrors: true },
  });
}

export interface ToggleViewerVariables {
  userId: string;
  add: boolean;
}

/** Lista de acesso do quadro (`PUT|DELETE /api/boards/:boardId/viewers/:userId`). */
export function useBoardViewers(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `board-access-${boardId}` },
    mutationFn: async ({ userId, add }: ToggleViewerVariables) => {
      const path = `/api/boards/${boardId}/viewers/${userId}`;
      const options = { schema: boardViewersResponseSchema };
      const result = add
        ? await api.put(path, undefined, options)
        : await api.delete(path, options);
      return result.viewerIds;
    },
    onSuccess: (viewerIds) => {
      setBoardData(queryClient, boardId, (payload) => ({
        ...payload,
        board: { ...payload.board, viewerIds },
      }));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['boards'] }),
    meta: { silentErrors: true },
  });
}
