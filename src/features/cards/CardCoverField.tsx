import type { CardDetail } from '@raphasparda/ronin-shared';
import { Image as ImageIcon, Replace, Trash2 } from 'lucide-react';
import { useId, useState, type ChangeEvent } from 'react';

import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { toast } from '../../components/ui/toast-store';
import { useSession } from '../auth/auth-api';
import {
  coverErrorMessage,
  COVER_ACCEPT,
  isAbortError,
  useRemoveCardCover,
  useUploadCardCover,
} from './card-cover-api';
import { COVER_MESSAGES } from './card-messages';

/** `true` quando a instância tem o R2 configurado (`features.cardCovers`, ADR 0016). */
export function useCardCoversEnabled(): boolean {
  return useSession({ enabled: false }).data?.features.cardCovers === true;
}

interface CardCoverFieldProps {
  card: CardDetail;
  readOnly: boolean;
  announce: (message: string) => void;
}

/**
 * Campo "Capa" na lateral do detalhe: escolher arquivo, progresso do envio, trocar e remover.
 * Só existe com `features.cardCovers`; em quadro arquivado, a capa é só leitura.
 */
export function CardCoverField({ card, readOnly, announce }: CardCoverFieldProps) {
  const labelId = useId();
  const inputId = useId();
  const enabled = useCardCoversEnabled();
  const upload = useUploadCardCover(card.boardId, card.id);
  const remove = useRemoveCardCover(card.boardId, card.id);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) return null;

  const hasCover = card.cover !== null;

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
    <section aria-labelledby={labelId} className="flex flex-col gap-2">
      <h3 id={labelId} className="text-xs font-semibold tracking-wide text-muted uppercase">
        Capa
      </h3>

      {readOnly ? (
        <p className="text-muted">
          {hasCover ? COVER_MESSAGES.boardArchived : 'Este card não tem capa.'}
        </p>
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
                Cancelar envio
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
              loadingText="Removendo…"
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

      <ConfirmDialog
        open={confirmRemove}
        tone="danger"
        title={COVER_MESSAGES.confirmRemoveTitle}
        description={<p>{COVER_MESSAGES.confirmRemoveDescription}</p>}
        confirmLabel={COVER_MESSAGES.remove}
        pending={remove.isPending}
        pendingLabel="Removendo…"
        onConfirm={removeCover}
        onClose={() => setConfirmRemove(false)}
      />
    </section>
  );
}
