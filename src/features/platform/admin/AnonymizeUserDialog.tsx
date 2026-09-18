import type { AdminUser } from '@raphasparda/ronin-shared';
import { useState } from 'react';

import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Input } from '../../../components/ui/Input';

interface AnonymizeUserDialogProps {
  user: AdminUser | null;
  pending: boolean;
  onConfirm: (user: AdminUser) => void;
  onClose: () => void;
}

/** Confirmação forte (irreversível): o botão só habilita com o nome da pessoa digitado (trim). */
export function AnonymizeUserDialog({
  user,
  pending,
  onConfirm,
  onClose,
}: AnonymizeUserDialogProps) {
  const [typed, setTyped] = useState('');
  const matches = user !== null && typed.trim() === user.name.trim();

  const close = () => {
    setTyped('');
    onClose();
  };

  const confirm = () => {
    if (!user || !matches) return;
    setTyped('');
    onConfirm(user);
  };

  return (
    <ConfirmDialog
      open={user !== null}
      tone="danger"
      title={`Anonimizar ${user?.name ?? ''}?`}
      description={
        <>
          <p>
            O nome vira &quot;Usuário removido&quot; e o e-mail é apagado. Os cards e comentários
            continuam. Não dá para desfazer.
          </p>
          <p>
            Para confirmar, digite: <strong className="break-words">{user?.name}</strong>
          </p>
        </>
      }
      confirmLabel="Anonimizar conta"
      pending={pending}
      pendingLabel="Anonimizando…"
      confirmDisabled={!matches}
      onConfirm={confirm}
      onClose={close}
    >
      <Input
        label="Nome da pessoa"
        autoComplete="off"
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
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
