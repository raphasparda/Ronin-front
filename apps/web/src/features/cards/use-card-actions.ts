import {
  comparePosition,
  type BoardPayload,
  type CardDetail,
  type CardMutationResult,
  type CardSummary,
  type Placement,
} from '@kanban/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { toast, type ToastAction } from '../../components/ui/toast-store';
import { api, isApiError } from '../../lib/api-client';
import { handleBoardError, useBoardErrorHandler } from '../boards/board-errors';
import { boardQueryKey, fetchBoard } from '../boards/boards-api';
import { myCardsQueryKey } from '../my-cards/my-cards-api';
import { CARD_MESSAGES, completionSuffix } from './card-messages';
import {
  CARD_LINK_STATE,
  cardActivityQueryKey,
  cardPath,
  cardQueryKey,
  cardsInList,
  fetchCard,
  useArchiveCard,
  useMoveCard,
  useRestoreCard,
} from './cards-api';
import { useCardCompletion, type CompletionAction } from './completion-api';

/**
 * Mover card com o retorno da UI (screens §0.3 e §7.5): o toast decide pelo `completionChange`
 * da resposta; erro devolve o card e avisa.
 */
export function useCardMover(boardId: string) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const handleError = useBoardErrorHandler(boardId);

  return useMoveCard(boardId, {
    onSuccess: (
      { completionChange, removedLabelIds },
      { card, toBoard, toList, position, source },
    ) => {
      const suffix = completionSuffix(completionChange);
      if (toBoard.id !== boardId) {
        toast.success(
          `${CARD_MESSAGES.movedToBoard(toBoard.name, removedLabelIds.length)}${suffix}`,
          {
            label: 'Abrir',
            onClick: () => void navigate(cardPath(toBoard.id, card.id), { state: CARD_LINK_STATE }),
          },
        );
      } else if (source === 'dialog') {
        toast.success(`${CARD_MESSAGES.moved(toList.name, position)}${suffix}`);
      } else if (completionChange) {
        toast.success(suffix.trim());
      }
    },
    onError: (error, { toBoard }) => {
      if (isApiError(error) && error.code === 'LIST_ARCHIVED') {
        toast.error(CARD_MESSAGES.destinationArchived);
        void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
        void queryClient.invalidateQueries({ queryKey: boardQueryKey(toBoard.id) });
        return;
      }
      handleError(error, CARD_MESSAGES.moveFailed);
    },
  });
}

export interface RestoreTarget {
  card: Pick<CardSummary, 'id' | 'status'>;
  listName: string;
}

/** Arquivar (com "Desfazer") e restaurar card, com as mensagens de screens §7.7. */
export function useCardArchiving(boardId: string) {
  const archiveCard = useArchiveCard(boardId);
  const restoreCard = useRestoreCard(boardId);
  const handleError = useBoardErrorHandler(boardId);

  const restore = ({ card, listName }: RestoreTarget) =>
    restoreCard.mutate(card.id, {
      onSuccess: ({ card: restored }) =>
        toast.success(
          card.status === 'open' && restored.status === 'completed'
            ? CARD_MESSAGES.restoredCompleted(listName)
            : CARD_MESSAGES.restored(listName),
        ),
      onError: (error) => {
        if (isApiError(error) && error.code === 'LIST_ARCHIVED') {
          toast.error(CARD_MESSAGES.restoreListFirst(listName));
          return;
        }
        handleError(error, CARD_MESSAGES.restoreFailed);
      },
    });

  const archive = (target: RestoreTarget) =>
    archiveCard.mutate(target.card.id, {
      onSuccess: () =>
        toast.success(CARD_MESSAGES.archived, {
          label: 'Desfazer',
          onClick: () => restore(target),
        }),
      onError: (error) => handleError(error, CARD_MESSAGES.archiveFailed),
    });

  return {
    archive,
    restore,
    archivePending: archiveCard.isPending,
    restoringId: restoreCard.isPending ? restoreCard.variables : undefined,
  };
}

export interface CompletionRequest {
  card: CardSummary;
  action: CompletionAction;
  /** Lista atual do card, quando conhecida (decide "continua em {lista}" ao reabrir). */
  list: { name: string; isDoneList: boolean } | null;
  /** `my-cards`: toast simples com "Desfazer"; `board`: reabrir movido oferece "Ver card". */
  source: 'detail' | 'board' | 'my-cards';
  announce?: (message: string) => void;
  /**
   * "Desfazer" de uma conclusão: o card como estava antes de concluir. Depois de reabrir, se o
   * servidor o tirou da lista, ele volta para a lista e o lugar de antes.
   */
  undo?: { card: CardSummary; listName: string };
}

/**
 * Lugar do card antes de concluir, no quadro de agora: logo depois do último card que estava
 * antes dele na lista (ou no topo). `null` quando a lista sumiu ou virou lista de conclusão.
 */
export function placementBefore(payload: BoardPayload, original: CardSummary): Placement | null {
  const list = payload.lists.find((item) => item.id === original.listId);
  if (!list || list.archivedAt !== null || list.isDoneList) return null;
  const previous = cardsInList(payload.cards, list.id)
    .filter((card) => card.id !== original.id)
    .findLast((card) => comparePosition(card.position, original.position) < 0);
  return previous ? { type: 'after', id: previous.id } : { type: 'start' };
}

/** O card já está no lugar indicado por `placement` (mesma lista e mesmo vizinho de cima). */
function isAt(payload: BoardPayload, original: CardSummary, placement: Placement): boolean {
  const current = payload.cards.find((card) => card.id === original.id);
  if (!current || current.listId !== original.listId) return false;
  const siblings = cardsInList(payload.cards, original.listId);
  const index = siblings.findIndex((card) => card.id === original.id);
  const above = siblings[index - 1];
  return placement.type === 'start'
    ? above === undefined
    : placement.type === 'after' && above?.id === placement.id;
}

/**
 * Move o card reaberto de volta para onde estava, inclusive dentro da mesma lista (o reopen pode
 * tê-lo posto no topo); `false` se não deu (fica onde o reopen pôs).
 */
async function moveBack(queryClient: QueryClient, original: CardSummary): Promise<boolean> {
  try {
    const payload = await queryClient.fetchQuery({
      queryKey: boardQueryKey(original.boardId),
      queryFn: ({ signal }) => fetchBoard(original.boardId, signal),
      staleTime: 0,
    });
    const placement = placementBefore(payload, original);
    if (!placement) return false;
    if (isAt(payload, original, placement)) return true;
    await api.post(`/api/cards/${original.id}/move`, { toListId: original.listId, placement });
    return true;
  } catch {
    return false;
  } finally {
    void queryClient.invalidateQueries({ queryKey: boardQueryKey(original.boardId) });
    void queryClient.invalidateQueries({ queryKey: cardQueryKey(original.id) });
    void queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(original.id) });
    void queryClient.invalidateQueries({ queryKey: myCardsQueryKey });
  }
}

/** Nome da lista final do card: do quadro ou do detalhe em cache; senão, relê o detalhe. */
async function listNameOf(queryClient: QueryClient, card: CardSummary): Promise<string | null> {
  const payload = queryClient.getQueryData<BoardPayload>(boardQueryKey(card.boardId));
  const fromBoard = payload?.lists.find((list) => list.id === card.listId)?.name;
  if (fromBoard) return fromBoard;
  const detail = queryClient.getQueryData<CardDetail>(cardQueryKey(card.id));
  if (detail?.list.id === card.listId) return detail.list.name;
  try {
    const fresh = await queryClient.fetchQuery({
      queryKey: cardQueryKey(card.id),
      queryFn: ({ signal }) => fetchCard(card.id, signal),
    });
    return fresh.list.name;
  } catch {
    return null;
  }
}

async function completionMessage(
  queryClient: QueryClient,
  { card, action, list, source, undo }: CompletionRequest,
  result: CardMutationResult,
): Promise<string> {
  if (undo && (await moveBack(queryClient, undo.card))) {
    return CARD_MESSAGES.completionUndone(undo.listName);
  }
  const moved = result.card.listId !== card.listId;
  if (action === 'complete') {
    if (source === 'my-cards' || !moved) return CARD_MESSAGES.completed;
    const name = await listNameOf(queryClient, result.card);
    return name ? CARD_MESSAGES.completedMoved(name) : CARD_MESSAGES.completed;
  }
  if (moved) {
    const name = await listNameOf(queryClient, result.card);
    return name ? CARD_MESSAGES.reopenedMoved(name) : CARD_MESSAGES.reopened;
  }
  if (list?.isDoneList && result.completionChange === 'reopened') {
    return CARD_MESSAGES.reopenedStayed(list.name);
  }
  return CARD_MESSAGES.reopened;
}

/**
 * Concluir e reabrir com o retorno de screens §0.3 e §8.3: toast (e anúncio `aria-live`) pela
 * resposta; em Meus cards, "Desfazer" reabre e devolve o card ao lugar de antes; erro volta o
 * estado e avisa.
 */
export function useCardCompletionAction() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const completion = useCardCompletion();

  const run = (request: CompletionRequest) => {
    const { card, action, source, announce } = request;
    const notify = async (result: CardMutationResult) => {
      const message = await completionMessage(queryClient, request, result);
      let toastAction: ToastAction | undefined;
      if (source === 'my-cards' && action === 'complete') {
        toastAction = {
          label: 'Desfazer',
          onClick: () =>
            run({
              card: result.card,
              action: 'reopen',
              list: null,
              source,
              announce,
              undo: { card, listName: request.list?.name ?? '' },
            }),
        };
      } else if (source === 'board' && action === 'reopen' && result.card.listId !== card.listId) {
        toastAction = {
          label: 'Ver card',
          onClick: () =>
            void navigate(cardPath(result.card.boardId, result.card.id), {
              state: CARD_LINK_STATE,
            }),
        };
      }
      toast.success(message, toastAction);
      announce?.(message);
    };

    completion.mutate(
      { card, action },
      {
        onSuccess: (result) => void notify(result),
        onError: (error) => {
          if (isApiError(error) && error.code === 'CONFLICT') {
            toast.error(CARD_MESSAGES.completionArchived);
            return;
          }
          handleBoardError(
            queryClient,
            card.boardId,
            error,
            action === 'complete' ? CARD_MESSAGES.completeFailed : CARD_MESSAGES.reopenFailed,
          );
        },
      },
    );
  };

  const variables = completion.isPending ? completion.variables : undefined;
  return {
    run,
    pending: variables ? { cardId: variables.card.id, action: variables.action } : null,
  };
}
