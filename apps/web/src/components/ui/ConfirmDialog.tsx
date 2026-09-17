import type { ReactNode } from 'react';

import { Button } from './Button';
import { Dialog } from './Dialog';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  tone?: 'primary' | 'danger';
  pending?: boolean;
  pendingLabel?: string;
  confirmDisabled?: boolean;
  children?: ReactNode;
}

/** Confirmação com a consequência da ação e dois botões: Cancelar e a ação. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
  tone = 'primary',
  pending = false,
  pendingLabel,
  confirmDisabled = false,
  children,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={tone}
            loading={pending}
            loadingText={pendingLabel}
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
