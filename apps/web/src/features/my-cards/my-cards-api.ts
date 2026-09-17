import { myCardsResponseSchema, type MyCard } from '@kanban/shared';
import { useQuery, type QueryClient } from '@tanstack/react-query';

import { api } from '../../lib/api-client';

export const MY_CARDS_POLL_INTERVAL_MS = 60_000;

export const myCardsQueryKey = ['my-cards'] as const;

/** Cards abertos atribuídos a mim, na ordem do servidor (prazo → prioridade → criação). */
export function useMyCards() {
  return useQuery({
    queryKey: myCardsQueryKey,
    queryFn: async ({ signal }) =>
      (await api.get('/api/me/cards', { schema: myCardsResponseSchema, signal })).cards,
    refetchInterval: MY_CARDS_POLL_INTERVAL_MS,
    meta: { silentErrors: true },
  });
}

export function setMyCards(queryClient: QueryClient, update: (cards: MyCard[]) => MyCard[]) {
  queryClient.setQueryData(myCardsQueryKey, (cards: MyCard[] | undefined) =>
    cards ? update(cards) : cards,
  );
}
