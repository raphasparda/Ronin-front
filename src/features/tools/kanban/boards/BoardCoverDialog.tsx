import type { BoardDetail } from '@raphasparda/ronin-shared';
import { Image as ImageIcon, Replace, Trash2 } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';

import { Button } from '../../../../components/ui/Button';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../../components/ui/Dialog';
import { toast } from '../../../../components/ui/toast-store';
import { COVER_MESSAGES } from './board-messages';
import { BoardCoverBanner } from './BoardCoverImage';
import {
  coverErrorMessage,
  COVER_ACCEPT,
  isAbortError,
  useRemoveBoardCover,
  useUploadBoardCover,
} from './board-cover-api';

interface BoardCoverDialogProps {
  board: BoardDetail;
  open: boolean;
  readOnly: boolean;
  onClose: () => void;
  announce: (message: string) => void;
}

/**
 * "Capa do quadro" (⋯ do quadro): escolher arquivo, progresso do envio, trocar e remover.
 * Só aparece com `features.boardCovers`; em quadro arquivado, a capa é só leitura.
 */
export function BoardCoverDialog({
  board,
  open,
  readOnly,
  onClose,
  announce,
}: BoardCoverDialogProps) {
  const inputId = useId();
  const upload = useUploadBoardCover(board.id);
  const remove = useRemoveBoardCover(board.id);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasCover = board.cover !== null;

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setError(null);
    upload.mutate(file, {
      onSuccess: () => {
        const message = hasCover ? COVER_MESSAGES.replaced : COVER_MESSAGES.added;
        toast.success(message);
        announce(message);
      },
      onError: (uploadError) => {
        if (isAbortError(uploadError)) return;
        setError(coverErrorMessage(uploadError));
      },
    });
  };

  const removeCover = () =>
    remove.mutate(undefined, {
      onSuccess: () => {
        setConfirmRemove(false);
        toast.success(COVER_MESSAGES.removed);
        announce(COVER_MESSAGES.removed);
      },
      onError: (removeError) => {
        setConfirmRemove(false);
        setError(coverErrorMessage(removeError));
        toast.error(COVER_MESSAGES.removeFailed);
      },
    });

  return (
    <>
      <Dialog open={open} title={COVER_MESSAGES.dialogTitle} onClose={onClose}>
        {board.cover ? (
          <BoardCoverBanner
            url={board.cover.url}
            width={board.cover.width}
            height={board.cover.height}
          />
        ) : (
          <p className="text-muted">{COVER_MESSAGES.none}</p>
        )}

        {readOnly ? (
          <p className="text-muted">{COVER_MESSAGES.boardArchived}</p>
        ) : (
          <>
            {/* O campo de arquivo fica invisível, mas focável: o anel de foco aparece no rótulo. */}
            <input
              id={inputId}
              type="file"
              accept={COVER_ACCEPT}
              disabled={upload.isPending}
              onChange={choose}
              className="peer sr-only"
            />
            <label
              htmlFor={inputId}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 self-start rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-text hover:bg-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus md:h-9"
            >
              {hasCover ? <Replace aria-hidden size={16} /> : <ImageIcon aria-hidden size={16} />}
              {hasCover ? COVER_MESSAGES.replace : COVER_MESSAGES.add}
            </label>
            <p className="text-xs text-muted">{COVER_MESSAGES.help}</p>

            {upload.isPending && (
              <div className="flex flex-wrap items-center gap-2">
                <p role="status" aria-live="polite" className="text-muted">
                  {COVER_MESSAGES.uploading(upload.percent)}
                </p>
                <Button variant="ghost" size="sm" onClick={upload.cancel}>
                  {COVER_MESSAGES.cancelUpload}
                </Button>
              </div>
            )}

            {hasCover && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Trash2 size={14} />}
                className="self-start"
                loading={remove.isPending}
                loadingText={COVER_MESSAGES.removing}
                onClick={() => setConfirmRemove(true)}
              >
                {COVER_MESSAGES.remove}
              </Button>
            )}
          </>
        )}

        {error && (
          <p role="alert" className="text-danger">
            {error}
          </p>
        )}
      </Dialog>

      <ConfirmDialog
        open={confirmRemove}
        tone="danger"
        title={COVER_MESSAGES.confirmRemoveTitle}
        description={<p>{COVER_MESSAGES.confirmRemoveDescription}</p>}
        confirmLabel={COVER_MESSAGES.remove}
        pending={remove.isPending}
        pendingLabel={COVER_MESSAGES.removing}
        onConfirm={removeCover}
        onClose={() => setConfirmRemove(false)}
      />
    </>
  );
}
