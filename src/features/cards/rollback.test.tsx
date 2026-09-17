import { boardPayloadSchema, type BoardPayload, type MyCard } from '@raphasparda/ronin-shared';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { api } from '../../lib/api-client';
import { apiErrorResponse } from '../../test/auth-handlers';
import { BOARD_ID, CARD_IDS, LIST_IDS } from '../../test/board-handlers';
import { createTestQueryClient } from '../../test/render';
import { server } from '../../test/server';
import { boardQueryKey } from '../boards/boards-api';
import { myCardsQueryKey } from '../my-cards/my-cards-api';
import { patchCard, restoreCardPlacement, useMoveCard } from './cards-api';
import { restoreMyCard, useCardCompletion } from './completion-api';

/** Só o `id` importa para os helpers de Meus cards. */
const myCard = (id: string, title: string) => ({ id, title }) as MyCard;

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function wrapperFor(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

async function seededClient() {
  const queryClient = createTestQueryClient();
  const payload = await api.get(`/api/boards/${BOARD_ID}`, { schema: boardPayloadSchema });
  queryClient.setQueryData(boardQueryKey(BOARD_ID), payload);
  return { queryClient, payload };
}

function cachedCard(queryClient: QueryClient, cardId: string) {
  return queryClient
    .getQueryData<BoardPayload>(boardQueryKey(BOARD_ID))
    ?.cards.find((card) => card.id === cardId);
}

function failAfter(path: string) {
  const gate = deferred();
  server.use(
    http.post(path, async () => {
      await gate.promise;
      return apiErrorResponse('INTERNAL_ERROR');
    }),
  );
  return gate;
}

describe('rollback só do card afetado', () => {
  it('restoreCardPlacement devolve lugar e status sem tocar nos outros campos', async () => {
    const { payload } = await seededClient();
    const budget = payload.cards.find((card) => card.id === CARD_IDS.budget);
    if (!budget) throw new Error('fixture');
    const changed: BoardPayload = {
      ...payload,
      cards: payload.cards.map((card) =>
        card.id === budget.id
          ? { ...card, listId: LIST_IDS.done, position: 'zz', status: 'completed', title: 'Novo' }
          : { ...card, priority: 'urgent' },
      ),
    };

    const restored = restoreCardPlacement(changed, budget);
    expect(restored.cards.find((card) => card.id === budget.id)).toMatchObject({
      listId: budget.listId,
      position: budget.position,
      status: budget.status,
      title: 'Novo',
    });
    expect(
      restored.cards.filter((card) => card.id !== budget.id).map((card) => card.priority),
    ).toEqual(changed.cards.filter((card) => card.id !== budget.id).map(() => 'urgent'));

    const removed = { ...payload, cards: payload.cards.filter((card) => card.id !== budget.id) };
    expect(restoreCardPlacement(removed, budget).cards).toContainEqual(budget);
  });

  it('restoreMyCard devolve o card à posição anterior e mantém a lista atual', () => {
    const first = myCard(CARD_IDS.budget, 'Primeiro');
    const second = myCard(CARD_IDS.campaign, 'Segundo');
    expect(restoreMyCard([], { card: second, index: 1 })).toEqual([second]);
    expect(restoreMyCard([first], { card: second, index: 0 })).toEqual([second, first]);
    expect(restoreMyCard([first, second], { card: second, index: 0 })).toEqual([first, second]);
  });

  it('mover que falha não desfaz outra mudança otimista feita enquanto aguardava', async () => {
    const { queryClient, payload } = await seededClient();
    const gate = failAfter('/api/cards/:cardId/move');
    const onError = vi.fn();
    const { result } = renderHook(() => useMoveCard(BOARD_ID, { onSuccess: vi.fn(), onError }), {
      wrapper: wrapperFor(queryClient),
    });
    const budget = payload.cards.find((card) => card.id === CARD_IDS.budget);
    if (!budget) throw new Error('fixture');

    act(() =>
      result.current.move({
        card: budget,
        toBoard: { id: BOARD_ID, name: 'Quadro' },
        toList: { id: LIST_IDS.todo, name: 'A fazer' },
        placement: { type: 'end' },
        position: 1,
        source: 'dialog',
      }),
    );
    expect(cachedCard(queryClient, budget.id)?.listId).toBe(LIST_IDS.todo);
    act(() => patchCard(queryClient, BOARD_ID, CARD_IDS.campaign, { priority: 'urgent' }));

    gate.resolve();
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    expect(cachedCard(queryClient, budget.id)).toMatchObject({
      listId: budget.listId,
      position: budget.position,
    });
    expect(cachedCard(queryClient, CARD_IDS.campaign)?.priority).toBe('urgent');
  });

  it('concluir que falha não desfaz outra mudança otimista feita enquanto aguardava', async () => {
    const { queryClient, payload } = await seededClient();
    const myCards = [myCard(CARD_IDS.budget, 'Revisar'), myCard(CARD_IDS.campaign, 'Publicar')];
    queryClient.setQueryData(myCardsQueryKey, myCards);
    const campaign = payload.cards.find((card) => card.id === CARD_IDS.campaign);
    if (!campaign) throw new Error('fixture');
    const gate = failAfter('/api/cards/:cardId/complete');
    const { result } = renderHook(() => useCardCompletion(), {
      wrapper: wrapperFor(queryClient),
    });

    act(() => result.current.mutate({ card: campaign, action: 'complete' }));
    await waitFor(() =>
      expect(cachedCard(queryClient, campaign.id)).toMatchObject({
        listId: LIST_IDS.done,
        status: 'completed',
      }),
    );
    expect(queryClient.getQueryData<MyCard[]>(myCardsQueryKey)).toEqual([myCards[0]]);
    act(() => patchCard(queryClient, BOARD_ID, CARD_IDS.budget, { priority: 'urgent' }));

    gate.resolve();
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(cachedCard(queryClient, campaign.id)).toMatchObject({
      listId: campaign.listId,
      position: campaign.position,
      status: 'open',
      completedAt: null,
    });
    expect(cachedCard(queryClient, CARD_IDS.budget)?.priority).toBe('urgent');
    expect(queryClient.getQueryData<MyCard[]>(myCardsQueryKey)).toEqual(myCards);
  });
});
