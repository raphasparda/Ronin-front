import type { Board } from '@raphasparda/ronin-shared';
import { useState } from 'react';

import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Input } from '../../../../components/ui/Input';
import { toast } from '../../../../components/ui/toast-store';
import { isApiError } from '../../../../lib/api-client';
import { isGloballyHandled, serverMessage } from '../../../../lib/api-errors';
import { useDeleteBoard } from './boards-api';

export const DELETE_BOARD_MESSAGES = {
  mismatch: 'O nome digitado não confere.',
  deleted: (name: string) => `Quadro "${name}" excluído.`,
} as const;

interface DeleteBoardDialogProps {
  board: Board | null;
  onClose: () => void;
  onDeleted?: () => void;
}

/** Exclusão definitiva (Admin): o botão só habilita quando o nome digitado confere (trim). */
export function DeleteBoardDialog({ board, onClose, onDeleted }: DeleteBoardDialogProps) {
  const deleteBoard = useDeleteBoard();
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | undefined>();

  const close = () => {
    setTyped('');
    setError(undefined);
    onClose();
  };

  const matches = board !== null && typed.trim() === board.name.trim();

  const confirm = () => {
    if (!board || !matches) return;
    deleteBoard.mutate(
      { boardId: board.id, confirmName: typed.trim() },
      {
        onSuccess: () => {
          toast.success(DELETE_BOARD_MESSAGES.deleted(board.name));
          close();
          onDeleted?.();
        },
        onError: (mutationError) => {
          if (isApiError(mutationError) && mutationError.code === 'CONFIRMATION_MISMATCH') {
            setError(DELETE_BOARD_MESSAGES.mismatch);
            return;
          }
          if (!isGloballyHandled(mutationError)) setError(serverMessage(mutationError));
        },
      },
    );
  };

  return (
    <ConfirmDialog
      open={board !== null}
      tone="danger"
      title="Excluir quadro definitivamente"
      description={
        <>
          <p>
            Isto apaga o quadro, as listas, os cards, os comentários e o histórico. Não dá para
            desfazer.
          </p>
          <p>
            Para confirmar, digite: <strong className="break-words">{board?.name}</strong>
          </p>
        </>
      }
      confirmLabel="Excluir quadro"
      pending={deleteBoard.isPending}
      pendingLabel="Excluindo…"
      confirmDisabled={!matches}
      onConfirm={confirm}
      onClose={close}
    >
      <Input
        label="Nome do quadro"
        autoComplete="off"
        value={typed}
        error={error}
        onChange={(event) => {
          setTyped(event.target.value);
          setError(undefined);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            confirm();
          }
        }}
      />
    </ConfirmDialog>
  );
}
