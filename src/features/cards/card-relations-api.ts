import {
  cardAssigneesResponseSchema,
  cardLabelsResponseSchema,
  type BoardPayload,
  type CardDetail,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { boardQueryKey } from '../boards/boards-api';
import { cardActivityQueryKey, cardQueryKey, findUnlockedCard, patchCard } from './cards-api';

type RelationField = 'assigneeIds' | 'labelIds';

export interface ToggleRelationVariables {
  /** `userId` (responsável) ou `labelId` (etiqueta). */
  id: string;
  /** `true` adiciona (`PUT`), `false` remove (`DELETE`). */
  add: boolean;
}

function currentIds(
  queryClient: QueryClient,
  boardId: string,
  cardId: string,
  field: RelationField,
): string[] {
  const detail = queryClient.getQueryData<CardDetail>(cardQueryKey(cardId));
  if (detail) return detail[field];
  const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
  return findUnlockedCard(payload?.cards, cardId)?.[field] ?? [];
}

/**
 * Responsáveis e etiquetas do card: `PUT`/`DELETE` idempotentes, otimistas no detalhe e na face.
 * As chamadas do mesmo card rodam em fila; a resposta só substitui a lista quando a fila esvazia
 * (para não desfazer um clique que ainda está esperando).
 */
function useCardRelation(boardId: string, cardId: string, field: RelationField) {
  const queryClient = useQueryClient();
  const segment = field === 'assigneeIds' ? 'assignees' : 'labels';
  const mutationKey = ['card-relation', field, cardId] as const;

  return useMutation({
    mutationKey,
    scope: { id: `card-${segment}-${cardId}` },
    mutationFn: async ({ id, add }: ToggleRelationVariables): Promise<string[]> => {
      const path = `/api/cards/${cardId}/${segment}/${id}`;
      if (field === 'assigneeIds') {
        const options = { schema: cardAssigneesResponseSchema };
        const result = add
          ? await api.put(path, undefined, options)
          : await api.delete(path, options);
        return result.assigneeIds;
      }
      const options = { schema: cardLabelsResponseSchema };
      const result = add
        ? await api.put(path, undefined, options)
        : await api.delete(path, options);
      return result.labelIds;
    },
    onMutate: async ({ id, add }) => {
      await queryClient.cancelQueries({ queryKey: cardQueryKey(cardId) });
      const previous = currentIds(queryClient, boardId, cardId, field);
      const next = add
        ? [...previous.filter((item) => item !== id), id]
        : previous.filter((item) => item !== id);
      patchCard(queryClient, boardId, cardId, { [field]: next });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context) patchCard(queryClient, boardId, cardId, { [field]: context.previous });
    },
    onSuccess: (ids) => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        patchCard(queryClient, boardId, cardId, { [field]: ids });
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) }),
    meta: { silentErrors: true },
  });
}

export const useCardAssignees = (boardId: string, cardId: string) =>
  useCardRelation(boardId, cardId, 'assigneeIds');

export const useCardLabels = (boardId: string, cardId: string) =>
  useCardRelation(boardId, cardId, 'labelIds');
