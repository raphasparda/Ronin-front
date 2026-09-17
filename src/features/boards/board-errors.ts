import { useQueryClient, type QueryClient } from '@tanstack/react-query';

import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { MESSAGES } from '../../lib/query-client';
import { boardQueryKey } from './boards-api';

export const BOARD_ERROR_MESSAGES = {
  boardArchived: 'Este quadro foi arquivado. Restaure o quadro para editar.',
  listArchived: 'Esta lista foi arquivada. O quadro foi atualizado.',
  notFound: 'Não encontramos este item. Ele pode ter sido excluído. O quadro foi atualizado.',
} as const;

/**
 * Erro de mutação no quadro (as mutações são `silentErrors`): mostra um único toast e, quando o
 * estado mudou no servidor (arquivado, excluído, posição inválida), recarrega o quadro.
 */
export function useBoardErrorHandler(boardId: string) {
  const queryClient = useQueryClient();
  return (error: unknown, fallback: string) =>
    handleBoardError(queryClient, boardId, error, fallback);
}

/** Mesmo tratamento de `useBoardErrorHandler`, para quando o quadro só é conhecido na ação. */
export function handleBoardError(
  queryClient: QueryClient,
  boardId: string,
  error: unknown,
  fallback: string,
): void {
  const refresh = () => void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
  if (!isApiError(error) || error.isNetworkError || error.status >= 500) {
    toast.error(fallback);
    return;
  }
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return;
    case 'BOARD_ARCHIVED':
      toast.error(BOARD_ERROR_MESSAGES.boardArchived);
      refresh();
      return;
    case 'LIST_ARCHIVED':
      toast.error(BOARD_ERROR_MESSAGES.listArchived);
      refresh();
      return;
    case 'NOT_FOUND':
      toast.error(BOARD_ERROR_MESSAGES.notFound);
      refresh();
      return;
    case 'FORBIDDEN':
      toast.error(MESSAGES.forbidden);
      return;
    case 'RATE_LIMITED':
    case 'TOO_MANY_ATTEMPTS':
      toast.error(MESSAGES.rateLimited(error.retryAfterSeconds));
      return;
    case 'INVALID_PLACEMENT':
      toast.error(fallback);
      refresh();
      return;
    default:
      toast.error(error.fromServer ? error.message : fallback);
  }
}
