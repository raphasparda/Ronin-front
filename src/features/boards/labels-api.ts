import {
  labelResponseSchema,
  type BoardPayload,
  type CardDetail,
  type CreateLabelRequest,
  type Label,
  type UpdateLabelRequest,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { boardQueryKey, setBoardData } from './boards-api';

/** Etiquetas do payload vêm por nome (api.md §9). */
export function sortLabels(labels: readonly Label[]): Label[] {
  return [...labels].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

/** Nome já usado por outra etiqueta do quadro (sem diferenciar caixa e acentos nas pontas). */
export function isDuplicateLabelName(
  labels: readonly Label[],
  name: string,
  exceptId?: string,
): boolean {
  const normalized = name.trim().toLocaleLowerCase('pt-BR');
  return labels.some(
    (label) => label.id !== exceptId && label.name.trim().toLocaleLowerCase('pt-BR') === normalized,
  );
}

function setLabels(
  queryClient: QueryClient,
  boardId: string,
  update: (labels: Label[]) => Label[],
) {
  setBoardData(queryClient, boardId, (payload) => ({
    ...payload,
    labels: sortLabels(update(payload.labels)),
  }));
}

export function useCreateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateLabelRequest) =>
      api.post(`/api/boards/${boardId}/labels`, body, { schema: labelResponseSchema }),
    onSuccess: ({ label }) =>
      setLabels(queryClient, boardId, (labels) => [
        ...labels.filter((item) => item.id !== label.id),
        label,
      ]),
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    meta: { silentErrors: true },
  });
}

export interface UpdateLabelVariables {
  labelId: string;
  changes: UpdateLabelRequest;
}

export function useUpdateLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `labels-${boardId}` },
    mutationFn: ({ labelId, changes }: UpdateLabelVariables) =>
      api.patch(`/api/labels/${labelId}`, changes, { schema: labelResponseSchema }),
    onMutate: async ({ labelId, changes }) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const previous = queryClient
        .getQueryData<BoardPayload>(boardQueryKey(boardId))
        ?.labels.find((label) => label.id === labelId);
      setLabels(queryClient, boardId, (labels) =>
        labels.map((label) => (label.id === labelId ? { ...label, ...changes } : label)),
      );
      return { previous };
    },
    onError: (_error, { labelId }, context) => {
      const previous = context?.previous;
      if (!previous) return;
      setLabels(queryClient, boardId, (labels) =>
        labels.map((label) => (label.id === labelId ? previous : label)),
      );
    },
    onSuccess: ({ label }) =>
      setLabels(queryClient, boardId, (labels) =>
        labels.map((item) => (item.id === label.id ? label : item)),
      ),
    meta: { silentErrors: true },
  });
}

/** Excluir etiqueta: some do quadro e de todos os cards (payload e detalhes em cache). */
export function useDeleteLabel(boardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: { id: `labels-${boardId}` },
    mutationFn: (labelId: string) => api.delete(`/api/labels/${labelId}`),
    onMutate: async (labelId) => {
      await queryClient.cancelQueries({ queryKey: boardQueryKey(boardId) });
      const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(boardId));
      const details = queryClient.getQueriesData<CardDetail>({ queryKey: ['card'] });
      const without = (ids: string[]) => ids.filter((id) => id !== labelId);
      setBoardData(queryClient, boardId, (current) => ({
        ...current,
        labels: current.labels.filter((label) => label.id !== labelId),
        cards: current.cards.map((card) => ({ ...card, labelIds: without(card.labelIds) })),
      }));
      queryClient.setQueriesData<CardDetail>({ queryKey: ['card'] }, (detail) =>
        detail && detail.boardId === boardId
          ? { ...detail, labelIds: without(detail.labelIds) }
          : detail,
      );
      return { payload, details };
    },
    onError: (_error, _labelId, context) => {
      if (!context) return;
      if (context.payload) queryClient.setQueryData(boardQueryKey(boardId), context.payload);
      for (const [key, detail] of context.details) {
        queryClient.setQueryData(key, detail);
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) }),
    meta: { silentErrors: true },
  });
}
