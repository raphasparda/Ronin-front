import {
  applyPlacement,
  checklistItemResponseSchema,
  checklistProgress,
  checklistResponseSchema,
  sortByPosition,
  type CardDetail,
  type Checklist,
  type ChecklistItem,
  type Placement,
  type UpdateChecklistItemRequest,
} from '@kanban/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { generateKeyBetween } from 'fractional-indexing';

import { api } from '../../lib/api-client';
import { useSessionUser } from '../auth/auth-api';
import { cardQueryKey, patchCard } from './cards-api';

type Checklists = Checklist[];

/** Troca os checklists do detalhe e atualiza o `x/y` da face no quadro. */
function setChecklists(
  queryClient: QueryClient,
  cardId: string,
  update: (checklists: Checklists) => Checklists,
) {
  const detail = queryClient.getQueryData<CardDetail>(cardQueryKey(cardId));
  if (!detail) return;
  const checklists = update(detail.checklists);
  queryClient.setQueryData<CardDetail>(cardQueryKey(cardId), { ...detail, checklists });
  patchCard(queryClient, detail.boardId, cardId, { checklist: checklistProgress(checklists) });
}

function mapItems(
  checklists: Checklists,
  checklistId: string,
  update: (items: ChecklistItem[]) => ChecklistItem[],
): Checklists {
  return checklists.map((checklist) =>
    checklist.id === checklistId
      ? { ...checklist, items: sortByPosition(update(checklist.items)) }
      : checklist,
  );
}

/**
 * Base das mutações de checklist: fila por card (`scope`), foto dos checklists antes da mudança
 * para o rollback e recarga do detalhe quando a fila esvazia.
 */
function useChecklistMutation<TVariables, TData>(
  cardId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  handlers: {
    optimistic?: (checklists: Checklists, variables: TVariables) => Checklists;
    success?: (checklists: Checklists, data: TData, variables: TVariables) => Checklists;
  },
) {
  const queryClient = useQueryClient();
  const mutationKey = ['checklists', cardId] as const;
  return useMutation({
    mutationKey,
    scope: { id: `checklists-${cardId}` },
    mutationFn,
    // A mudança otimista vem antes do `await`: `mutate()` roda este trecho na hora, e o
    // checkbox controlado já aparece marcado, sem esperar o cancelamento do polling.
    onMutate: async (variables: TVariables) => {
      const snapshot = queryClient.getQueryData<CardDetail>(cardQueryKey(cardId))?.checklists;
      const { optimistic } = handlers;
      if (optimistic)
        setChecklists(queryClient, cardId, (current) => optimistic(current, variables));
      await queryClient.cancelQueries({ queryKey: cardQueryKey(cardId) });
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      const snapshot = context?.snapshot;
      if (snapshot) setChecklists(queryClient, cardId, () => snapshot);
    },
    onSuccess: (data, variables) => {
      const { success } = handlers;
      if (success)
        setChecklists(queryClient, cardId, (current) => success(current, data, variables));
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) <= 1) {
        await queryClient.invalidateQueries({ queryKey: cardQueryKey(cardId) });
      }
    },
    meta: { silentErrors: true },
  });
}

export function useCreateChecklist(cardId: string) {
  return useChecklistMutation(
    cardId,
    (title: string) =>
      api.post(`/api/cards/${cardId}/checklists`, { title }, { schema: checklistResponseSchema }),
    {
      success: (checklists, { checklist }) => [
        ...checklists.filter((item) => item.id !== checklist.id),
        checklist,
      ],
    },
  );
}

export function useRenameChecklist(cardId: string) {
  return useChecklistMutation(
    cardId,
    ({ checklistId, title }: { checklistId: string; title: string }) =>
      api.patch(`/api/checklists/${checklistId}`, { title }, { schema: checklistResponseSchema }),
    {
      optimistic: (checklists, { checklistId, title }) =>
        checklists.map((item) => (item.id === checklistId ? { ...item, title } : item)),
    },
  );
}

export function useDeleteChecklist(cardId: string) {
  return useChecklistMutation(
    cardId,
    (checklistId: string) => api.delete(`/api/checklists/${checklistId}`),
    {
      optimistic: (checklists, checklistId) => checklists.filter((item) => item.id !== checklistId),
    },
  );
}

export interface CreateItemVariables {
  checklistId: string;
  text: string;
  tempId: string;
}

/** Item novo no fim, otimista (id temporário até a resposta). */
export function useCreateChecklistItem(cardId: string) {
  return useChecklistMutation(
    cardId,
    ({ checklistId, text }: CreateItemVariables) =>
      api.post(
        `/api/checklists/${checklistId}/items`,
        { text },
        { schema: checklistItemResponseSchema },
      ),
    {
      optimistic: (checklists, { checklistId, text, tempId }) =>
        mapItems(checklists, checklistId, (items) => [
          ...items,
          {
            id: tempId,
            checklistId,
            text,
            position: generateKeyBetween(sortByPosition(items).at(-1)?.position ?? null, null),
            isChecked: false,
            checkedBy: null,
            checkedAt: null,
          },
        ]),
      success: (checklists, { item }, { checklistId, tempId }) =>
        mapItems(checklists, checklistId, (items) =>
          items.map((current) => (current.id === tempId ? item : current)),
        ),
    },
  );
}

export interface UpdateItemVariables {
  checklistId: string;
  itemId: string;
  changes: UpdateChecklistItemRequest;
}

export function useUpdateChecklistItem(cardId: string) {
  const userId = useSessionUser()?.id ?? null;
  return useChecklistMutation(
    cardId,
    ({ itemId, changes }: UpdateItemVariables) =>
      api.patch(`/api/checklist-items/${itemId}`, changes, { schema: checklistItemResponseSchema }),
    {
      optimistic: (checklists, { checklistId, itemId, changes }) =>
        mapItems(checklists, checklistId, (items) =>
          items.map((item) => {
            if (item.id !== itemId) return item;
            const next = { ...item, ...(changes.text !== undefined && { text: changes.text }) };
            if (changes.isChecked === undefined) return next;
            return {
              ...next,
              isChecked: changes.isChecked,
              checkedBy: changes.isChecked ? userId : null,
              checkedAt: changes.isChecked ? new Date().toISOString() : null,
            };
          }),
        ),
    },
  );
}

export interface MoveItemVariables {
  checklistId: string;
  itemId: string;
  placement: Placement;
}

/** Nova ordem otimista entre os vizinhos; a chave real vem da resposta. */
export function reorderItems(
  items: readonly ChecklistItem[],
  itemId: string,
  placement: Placement,
): ChecklistItem[] {
  const ordered = sortByPosition(items);
  const order = applyPlacement(
    ordered.map((item) => item.id),
    itemId,
    placement,
  );
  if (order === null) return ordered;
  const index = order.indexOf(itemId);
  const siblings = ordered.filter((item) => item.id !== itemId);
  let position: string;
  try {
    position = generateKeyBetween(
      siblings[index - 1]?.position ?? null,
      siblings[index]?.position ?? null,
    );
  } catch {
    return ordered;
  }
  return sortByPosition(ordered.map((item) => (item.id === itemId ? { ...item, position } : item)));
}

export function useMoveChecklistItem(cardId: string) {
  return useChecklistMutation(
    cardId,
    ({ itemId, placement }: MoveItemVariables) =>
      api.post(
        `/api/checklist-items/${itemId}/move`,
        { placement },
        { schema: checklistItemResponseSchema },
      ),
    {
      optimistic: (checklists, { checklistId, itemId, placement }) =>
        mapItems(checklists, checklistId, (items) => reorderItems(items, itemId, placement)),
    },
  );
}

export function useDeleteChecklistItem(cardId: string) {
  return useChecklistMutation(
    cardId,
    ({ itemId }: { checklistId: string; itemId: string }) =>
      api.delete(`/api/checklist-items/${itemId}`),
    {
      optimistic: (checklists, { checklistId, itemId }) =>
        mapItems(checklists, checklistId, (items) => items.filter((item) => item.id !== itemId)),
    },
  );
}
