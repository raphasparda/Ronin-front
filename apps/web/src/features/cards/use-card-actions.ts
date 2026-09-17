import type { CardSummary } from '@kanban/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';

import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { useBoardErrorHandler } from '../boards/board-errors';
import { boardQueryKey } from '../boards/boards-api';
import { CARD_MESSAGES, completionSuffix } from './card-messages';
import {
  CARD_LINK_STATE,
  cardPath,
  useArchiveCard,
  useMoveCard,
  useRestoreCard,
} from './cards-api';

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
