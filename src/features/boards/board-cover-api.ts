import {
  boardCoverUploadUrlResponseSchema,
  boardResponseSchema,
  BOARD_COVER_CONTENT_TYPES,
  BOARD_COVER_MAX_BYTES,
  type BoardDetail,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { api } from '../../lib/api-client';
import { putCoverToStorage } from '../../lib/cover-upload';
import { prepareCoverImage, UnreadableImageError } from '../../lib/image-resize';
import { useSession } from '../auth/auth-api';
import { COVER_MESSAGES } from './board-messages';
import { setBoardData } from './boards-api';

/** Tipos que o seletor de arquivo oferece (RN21). */
export const COVER_ACCEPT = BOARD_COVER_CONTENT_TYPES.join(',');

/** `true` quando a instância tem o R2 configurado (`features.boardCovers`, ADR 0016). */
export function useBoardCoversEnabled(): boolean {
  return useSession({ enabled: false }).data?.features.boardCovers === true;
}

/** Erro já traduzido para a pessoa (formato, tamanho, leitura). */
export class CoverRejectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoverRejectedError';
  }
}

const megabytes = (bytes: number) => (bytes / 1024 / 1024).toFixed(1).replace('.', ',');

/** Barra tipo e tamanho **antes** de pedir a URL de envio (scope §11.4, E1). */
export function checkCoverFile({ type, size }: { type: string; size: number }): string | null {
  if (!(BOARD_COVER_CONTENT_TYPES as readonly string[]).includes(type)) {
    return COVER_MESSAGES.wrongType;
  }
  if (size > BOARD_COVER_MAX_BYTES) return COVER_MESSAGES.tooLarge(megabytes(size));
  return null;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Mensagem de erro do envio, por caso. */
export function coverErrorMessage(error: unknown): string {
  if (error instanceof CoverRejectedError) return error.message;
  if (error instanceof UnreadableImageError) return COVER_MESSAGES.unreadable;
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const { code } = error;
    if (code === 'COVER_STORAGE_UNAVAILABLE') return COVER_MESSAGES.storageUnavailable;
    if (code === 'BOARD_ARCHIVED') return COVER_MESSAGES.boardArchived;
  }
  return COVER_MESSAGES.uploadFailed;
}

function useApplyCover(boardId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    ({ board }: { board: BoardDetail }) => {
      setBoardData(queryClient, boardId, (payload) => ({ ...payload, board }));
      void queryClient.invalidateQueries({ queryKey: ['boards'] });
    },
    [boardId, queryClient],
  );
}

/**
 * Envio da capa em três passos (ADR 0016): pede a URL assinada, manda os bytes direto para o R2
 * (com progresso) e confirma na API. A imagem é reduzida no navegador antes de subir.
 */
export function useUploadBoardCover(boardId: string) {
  const applyCover = useApplyCover(boardId);
  const [percent, setPercent] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  const mutation = useMutation({
    scope: { id: `board-cover-${boardId}` },
    mutationFn: async (file: File) => {
      const rejected = checkCoverFile(file);
      if (rejected) throw new CoverRejectedError(rejected);

      const image = await prepareCoverImage(file);
      const stillRejected = checkCoverFile({ type: image.contentType, size: image.blob.size });
      if (stillRejected) throw new CoverRejectedError(stillRejected);

      const ticket = await api.post(
        `/api/boards/${boardId}/cover/upload-url`,
        { contentType: image.contentType, sizeBytes: image.blob.size },
        { schema: boardCoverUploadUrlResponseSchema },
      );

      controller.current = new AbortController();
      await putCoverToStorage({
        uploadUrl: ticket.uploadUrl,
        blob: image.blob,
        headers: ticket.headers,
        onProgress: setPercent,
        signal: controller.current.signal,
      });

      return api.put(
        `/api/boards/${boardId}/cover`,
        {
          objectKey: ticket.objectKey,
          ...(image.width !== null && { width: image.width }),
          ...(image.height !== null && { height: image.height }),
        },
        { schema: boardResponseSchema },
      );
    },
    onMutate: () => setPercent(null),
    onSuccess: applyCover,
    onSettled: () => {
      controller.current = null;
      setPercent(null);
    },
    meta: { silentErrors: true },
  });

  const cancel = useCallback(() => controller.current?.abort(), []);

  return { ...mutation, percent, cancel };
}

/** Remove a capa (linha e objeto no R2). Idempotente no servidor. */
export function useRemoveBoardCover(boardId: string) {
  const applyCover = useApplyCover(boardId);
  return useMutation({
    scope: { id: `board-cover-${boardId}` },
    mutationFn: () => api.delete(`/api/boards/${boardId}/cover`, { schema: boardResponseSchema }),
    onSuccess: applyCover,
    meta: { silentErrors: true },
  });
}
