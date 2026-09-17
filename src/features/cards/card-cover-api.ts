import {
  cardCoverUploadUrlResponseSchema,
  cardDetailResponseSchema,
  CARD_COVER_CONTENT_TYPES,
  CARD_COVER_MAX_BYTES,
  type CardDetail,
} from '@raphasparda/ronin-shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import { api } from '../../lib/api-client';
import { prepareCoverImage, UnreadableImageError } from '../../lib/image-resize';
import { boardQueryKey } from '../boards/boards-api';
import { COVER_MESSAGES } from './card-messages';
import { cardActivityQueryKey, cardQueryKey, patchCard } from './cards-api';
import { putCoverToStorage } from './cover-upload';

/** Tipos que o seletor de arquivo oferece (RN21). */
export const COVER_ACCEPT = CARD_COVER_CONTENT_TYPES.join(',');

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
  if (!(CARD_COVER_CONTENT_TYPES as readonly string[]).includes(type)) {
    return COVER_MESSAGES.wrongType;
  }
  if (size > CARD_COVER_MAX_BYTES) return COVER_MESSAGES.tooLarge(megabytes(size));
  return null;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/** Mensagem de erro do envio, por caso (scope §11.11). */
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

interface CoverMutationContext {
  card: CardDetail;
}

function useApplyCover(boardId: string, cardId: string) {
  const queryClient = useQueryClient();
  return useCallback(
    ({ card }: CoverMutationContext) => {
      queryClient.setQueryData(cardQueryKey(cardId), card);
      patchCard(queryClient, boardId, cardId, { cover: card.cover });
      void queryClient.invalidateQueries({ queryKey: cardActivityQueryKey(cardId) });
      void queryClient.invalidateQueries({ queryKey: boardQueryKey(boardId) });
    },
    [boardId, cardId, queryClient],
  );
}

/**
 * Envio da capa em três passos (ADR 0016): pede a URL assinada, manda os bytes direto para o R2
 * (com progresso) e confirma na API. A imagem é reduzida no navegador antes de subir.
 */
export function useUploadCardCover(boardId: string, cardId: string) {
  const applyCover = useApplyCover(boardId, cardId);
  const [percent, setPercent] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);

  const mutation = useMutation({
    scope: { id: `card-cover-${cardId}` },
    mutationFn: async (file: File) => {
      const rejected = checkCoverFile(file);
      if (rejected) throw new CoverRejectedError(rejected);

      const image = await prepareCoverImage(file);
      const stillRejected = checkCoverFile({ type: image.contentType, size: image.blob.size });
      if (stillRejected) throw new CoverRejectedError(stillRejected);

      const ticket = await api.post(
        `/api/cards/${cardId}/cover/upload-url`,
        { contentType: image.contentType, sizeBytes: image.blob.size },
        { schema: cardCoverUploadUrlResponseSchema },
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
        `/api/cards/${cardId}/cover`,
        {
          objectKey: ticket.objectKey,
          ...(image.width !== null && { width: image.width }),
          ...(image.height !== null && { height: image.height }),
        },
        { schema: cardDetailResponseSchema },
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
export function useRemoveCardCover(boardId: string, cardId: string) {
  const applyCover = useApplyCover(boardId, cardId);
  return useMutation({
    scope: { id: `card-cover-${cardId}` },
    mutationFn: () =>
      api.delete(`/api/cards/${cardId}/cover`, { schema: cardDetailResponseSchema }),
    onSuccess: applyCover,
    meta: { silentErrors: true },
  });
}
