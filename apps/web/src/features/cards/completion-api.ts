import {
  cardMutationResultSchema,
  completeTargetListId,
  type BoardPayload,
  type CardDetail,
  type CardMutationResult,
  type CardSummary,
  type MyCard,
} from '@kanban/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';
import { useSessionUser } from '../auth/auth-api';
import { boardQueryKey, setBoardData } from '../boards/boards-api';
import { myCardsQueryKey, setMyCards } from '../my-cards/my-cards-api';
import {
  cardActivityQueryKey,
  cardQueryKey,
  cardsInList,
  keyBetween,
  mergeSummary,
  setCardDetail,
} from './cards-api';

export type CompletionAction = 'complete' | 'reopen';

export interface CompletionVariables {
  card: CardSummary;
  action: CompletionAction;
}

interface CompletionSnapshot {
  payload: BoardPayload | undefined;
  detail: CardDetail | undefined;
  myCards: MyCard[] | undefined;
}

/**
 * Concluído otimista (screens §8.3): status na hora e, se o quadro tem lista de conclusão,
 * o card vai para o fim dela. Reabrir não é otimista: a lista de destino vem da resposta.
 */
function completeInPayload(payload: BoardPayload, cardId: string): BoardPayload {
  const card = payload.cards.find((item) => item.id === cardId);
  if (!card) return payload;
  const targetListId = completeTargetListId(card, payload.lists);
  const last =
    targetListId === null ? null : (cardsInList(payload.cards, targetListId).at(-1) ?? null);
  const moved: Partial<CardSummary> =
    targetListId === null
      ? {}
      : {
          listId: targetListId,
          position: keyBetween(last?.position ?? null, null) ?? card.position,
        };
  const completedAt = new Date().toISOString();
  return {
    ...payload,
    cards: payload.cards.map((item) =>
      item.id === cardId ? { ...item, ...moved, status: 'completed', completedAt } : item,
    ),
  };
}

/**
 * `POST /cards/:id/complete|reopen`. Atualiza quadro, detalhe e Meus cards em cache; em erro,
 * devolve tudo ao estado anterior. Invalida `['board']`, `['card']` e `['my-cards']` no fim.
 */
export function useCardCompletion() {
  const queryClient = useQueryClient();
  const userId = useSessionUser()?.id ?? null;

  return useMutation({
    mutationKey: ['card-completion'],
    scope: { id: 'card-completion' },
    mutationFn: ({ card, action }: CompletionVariables): Promise<CardMutationResult> =>
      api.post(`/api/cards/${card.id}/${action}`, undefined, {
        schema: cardMutationResultSchema,
      }),
    onMutate: async ({ card, action }): Promise<CompletionSnapshot> => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: boardQueryKey(card.boardId) }),
        queryClient.cancelQueries({ queryKey: cardQueryKey(card.id) }),
        queryClient.cancelQueries({ queryKey: myCardsQueryKey }),
      ]);
      const snapshot: CompletionSnapshot = {
        payload: queryClient.getQueryData<BoardPayload>(boardQueryKey(card.boardId)),
        detail: queryClient.getQueryData<CardDetail>(cardQueryKey(card.id)),
        myCards: queryClient.getQueryData<MyCard[]>(myCardsQueryKey),
      };
      if (action === 'complete') {
        setBoardData(queryClient, card.boardId, (payload) => completeInPayload(payload, card.id));
        const next = queryClient.getQueryData<BoardPayload>(boardQueryKey(card.boardId));
        const summary = next?.cards.find((item) => item.id === card.id) ?? {
          ...card,
          status: 'completed' as const,
          completedAt: new Date().toISOString(),
        };
        setCardDetail(queryClient, card.id, (detail) => ({
          ...mergeSummary(detail, summary, next),
          completedBy: userId,
        }));
        setMyCards(queryClient, (cards) => cards.filter((item) => item.id !== card.id));
      }
      return snapshot;
    },
    onSuccess: ({ card }) => {
      setBoardData(queryClient, card.boardId, (payload) => ({
        ...payload,
        cards: payload.cards.map((item) => (item.id === card.id ? card : item)),
      }));
      const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(card.boardId));
      setCardDetail(queryClient, card.id, (detail) => ({
        ...mergeSummary(detail, card, payload),
        completedBy: card.status === 'completed' ? (detail.completedBy ?? userId) : null,
      }));
      if (card.status === 'completed') {
        setMyCards(queryClient, (cards) => cards.filter((item) => item.id !== card.id));
      }
    },
    onError: (_error, { card }, snapshot) => {
      if (!snapshot) return;
      if (snapshot.payload) queryClient.setQueryData(boardQueryKey(card.boardId), snapshot.payload);
      if (snapshot.detail) queryClient.setQueryData(cardQueryKey(card.id), snapshot.detail);
      if (snapshot.myCards) queryClient.setQueryData(myCardsQueryKey, snapshot.myCards);
    },
    onSettled: (_data, _error, { card }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: boardQueryKey(card.boardId) }),
        queryClient.invalidateQueries({ queryKey: cardQueryKey(card.id) }),
        queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(card.id) }),
        queryClient.invalidateQueries({ queryKey: myCardsQueryKey }),
      ]),
    meta: { silentErrors: true },
  });
}
