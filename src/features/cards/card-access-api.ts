import {
  cardDetailResponseSchema,
  cardViewersResponseSchema,
  type CardVisibility,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { boardQueryKey } from '../boards/boards-api';
import { cardActivityQueryKey, cardQueryKey, patchCard, setCardDetail } from './cards-api';

/**
 * Visibilidade do card (`PUT /api/cards/:cardId/visibility`, ADR 0015). A resposta traz o
 * detalhe inteiro, com a lista de acesso já montada pelo servidor (ator + responsáveis).
 */
export function useSetCardVisibility(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `card-access-${cardId}` },
    mutationFn: (visibility: CardVisibility) =>
      api.put(
        `/api/cards/${cardId}/visibility`,
        { visibility },
        { schema: cardDetailResponseSchema },
      ),
    onSuccess: ({ card }) => {
      queryClient.setQueryData(cardQueryKey(cardId), card);
      patchCard(queryClient, boardId, cardId, { visibility: card.visibility });
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
      ]),
    meta: { silentErrors: true },
  });
}

export interface ToggleViewerVariables {
  userId: string;
  add: boolean;
}

/** Lista de acesso do card (`PUT|DELETE /api/cards/:cardId/viewers/:userId`). */
export function useCardViewers(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `card-access-${cardId}` },
    mutationFn: async ({ userId, add }: ToggleViewerVariables) => {
      const path = `/api/cards/${cardId}/viewers/${userId}`;
      const options = { schema: cardViewersResponseSchema };
      const result = add
        ? await api.put(path, undefined, options)
        : await api.delete(path, options);
      return result.viewerIds;
    },
    onSuccess: (viewerIds) => {
      setCardDetail(queryClient, cardId, (card) => ({ ...card, viewerIds }));
    },
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
        queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
      ]),
    meta: { silentErrors: true },
  });
}
