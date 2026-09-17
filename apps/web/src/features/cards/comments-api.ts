import { commentResponseSchema, type CardDetail, type Comment } from '@kanban/shared';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { cardQueryKey, patchCard } from './cards-api';

/** Troca os comentários do detalhe e atualiza o contador da face no quadro. */
function setComments(
  queryClient: QueryClient,
  cardId: string,
  update: (comments: Comment[]) => Comment[],
) {
  const detail = queryClient.getQueryData<CardDetail>(cardQueryKey(cardId));
  if (!detail) return;
  const comments = update(detail.comments);
  queryClient.setQueryData<CardDetail>(cardQueryKey(cardId), { ...detail, comments });
  patchCard(queryClient, detail.boardId, cardId, { commentCount: comments.length });
}

const scope = (cardId: string) => ({ id: `comments-${cardId}` });

/** Enviar não é otimista: em erro o texto continua no campo (screens §8.9). */
export function useCreateComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: scope(cardId),
    mutationFn: (body: string) =>
      api.post(`/api/cards/${cardId}/comments`, { body }, { schema: commentResponseSchema }),
    onSuccess: ({ comment }) =>
      setComments(queryClient, cardId, (comments) => [
        ...comments.filter((item) => item.id !== comment.id),
        comment,
      ]),
    meta: { silentErrors: true },
  });
}

function snapshot(queryClient: QueryClient, cardId: string) {
  return queryClient.getQueryData<CardDetail>(cardQueryKey(cardId))?.comments;
}

export function useUpdateComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: scope(cardId),
    mutationFn: ({ commentId, body }: { commentId: string; body: string }) =>
      api.patch(`/api/comments/${commentId}`, { body }, { schema: commentResponseSchema }),
    onMutate: async ({ commentId, body }) => {
      await queryClient.cancelQueries({ queryKey: cardQueryKey(cardId) });
      const previous = snapshot(queryClient, cardId);
      const editedAt = new Date().toISOString();
      setComments(queryClient, cardId, (comments) =>
        comments.map((comment) =>
          comment.id === commentId ? { ...comment, body, editedAt } : comment,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      const previous = context?.previous;
      if (previous) setComments(queryClient, cardId, () => previous);
    },
    onSuccess: ({ comment }) =>
      setComments(queryClient, cardId, (comments) =>
        comments.map((item) => (item.id === comment.id ? comment : item)),
      ),
    meta: { silentErrors: true },
  });
}

export function useDeleteComment(cardId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    scope: scope(cardId),
    mutationFn: (commentId: string) => api.delete(`/api/comments/${commentId}`),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: cardQueryKey(cardId) });
      const previous = snapshot(queryClient, cardId);
      setComments(queryClient, cardId, (comments) =>
        comments.filter((comment) => comment.id !== commentId),
      );
      return { previous };
    },
    onError: (_error, _commentId, context) => {
      const previous = context?.previous;
      if (previous) setComments(queryClient, cardId, () => previous);
    },
    meta: { silentErrors: true },
  });
}
