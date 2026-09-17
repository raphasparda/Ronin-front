import type { AdminUser, Role } from '@raphasparda/ronin-shared';
import { KeyRound, MoreHorizontal, UserCheck, UserRoundX, UserX } from 'lucide-react';
import { useState } from 'react';

import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { CopyField } from '../../components/ui/CopyField';
import { Dialog } from '../../components/ui/Dialog';
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu';
import { Pill } from '../../components/ui/Pill';
import { ListSkeleton, LoadError } from '../../components/ui/QueryState';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { isGloballyHandled, serverMessage } from '../../lib/api-errors';
import { useSessionUser } from '../auth/auth-api';
import { AnonymizeUserDialog } from './AnonymizeUserDialog';
import {
  useAnonymizeUser,
  useAdminUsers,
  useChangeRole,
  useCreatePasswordResetLink,
  useSetUserActive,
} from './admin-api';

export const MEMBER_MESSAGES = {
  roleChanged: (name: string, role: Role) =>
    `Papel de ${name} alterado para ${role === 'admin' ? 'Admin' : 'Membro'}.`,
  deactivated: (name: string) => `A conta de ${name} foi desativada.`,
  reactivated: (name: string) =>
    `A conta de ${name} foi reativada. Gere um link de redefinição se a pessoa não lembrar a senha.`,
  lastAdmin: 'É o último Admin ativo.',
  self: 'Você não pode fazer isso com a sua própria conta.',
  anonymized: 'Esta conta foi anonimizada.',
  reactivateFirst: 'Reative a conta antes de gerar o link.',
  notFound: 'Pessoa não encontrada. A lista foi atualizada.',
  anonymizedDone: 'A conta foi anonimizada. O nome agora aparece como "Usuário removido".',
  deactivateFirst: 'Desative a conta antes de anonimizar.',
} as const;

function mutationErrorToast(error: unknown) {
  if (isGloballyHandled(error)) return;
  if (!isApiError(error)) return;
  const byCode: Partial<Record<string, string>> = {
    LAST_ADMIN: MEMBER_MESSAGES.lastAdmin,
    CANNOT_TARGET_SELF: MEMBER_MESSAGES.self,
    USER_ANONYMIZED: MEMBER_MESSAGES.anonymized,
    USER_NOT_ACTIVE: MEMBER_MESSAGES.reactivateFirst,
    USER_NOT_DEACTIVATED: MEMBER_MESSAGES.deactivateFirst,
    NOT_FOUND: MEMBER_MESSAGES.notFound,
  };
  toast.error(byCode[error.code] ?? serverMessage(error));
}

function StatusPill({ user }: { user: AdminUser }) {
  if (user.anonymized) return <Pill>Conta anonimizada</Pill>;
  if (user.status === 'deactivated') return <Pill color="gray">Conta desativada</Pill>;
  return <Pill color="green">Conta ativa</Pill>;
}

const ROLE_OPTIONS: ReadonlyArray<{ value: Role; label: string }> = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Membro' },
];

interface MemberRowProps {
  user: AdminUser;
  isSelf: boolean;
  onRoleChange: (user: AdminUser, role: Role) => void;
  onDeactivate: (user: AdminUser) => void;
  onReactivate: (user: AdminUser) => void;
  onResetLink: (user: AdminUser) => void;
  onAnonymize: (user: AdminUser) => void;
  busy: boolean;
}

function MemberRow({
  user,
  isSelf,
  onRoleChange,
  onDeactivate,
  onReactivate,
  onResetLink,
  onAnonymize,
  busy,
}: MemberRowProps) {
  const displayName = user.name;
  const canManage = !isSelf && !user.anonymized;
  const roleLabel = user.role === 'admin' ? 'Admin' : 'Membro';

  return (
    <li className="relative flex flex-col gap-3 p-4 md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_9rem_8rem_2.5rem] md:items-center md:gap-4 md:py-3">
      <div className="flex min-w-0 items-center gap-2.5 pr-10 md:pr-0">
        <Avatar id={user.id} name={user.anonymized ? '?' : displayName} />
        <span className="truncate font-semibold">
          {displayName}
          {isSelf && <span className="font-normal text-muted"> (você)</span>}
        </span>
      </div>
      <span className="truncate text-muted">
        <span className="sr-only md:hidden">E-mail: </span>
        {user.email ?? '—'}
      </span>
      <div>
        {canManage ? (
          <select
            aria-label={`Papel de ${displayName}`}
            value={user.role}
            disabled={busy}
            onChange={(event) => onRoleChange(user, event.target.value as Role)}
            className="h-10 w-full rounded-md border border-border-strong bg-surface px-2 text-text md:h-8 disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-sunken disabled:text-muted"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span>
            <span className="sr-only">Papel: </span>
            {isSelf ? `${roleLabel} · Você` : roleLabel}
          </span>
        )}
      </div>
      <div>
        <StatusPill user={user} />
      </div>
      <div className="absolute top-3 right-3 flex justify-end md:static">
        {canManage && (
          <Menu
            label={`Ações para ${displayName}`}
            trigger={<MoreHorizontal aria-hidden size={18} />}
            triggerClassName="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-text md:size-8"
          >
            <MenuItem
              icon={<KeyRound size={16} />}
              disabled={user.status !== 'active'}
              hint={user.status !== 'active' ? MEMBER_MESSAGES.reactivateFirst : undefined}
              onSelect={() => onResetLink(user)}
            >
              Gerar link de redefinição de senha
            </MenuItem>
            {user.status === 'active' ? (
              <MenuItem
                icon={<UserX size={16} />}
                tone="danger"
                onSelect={() => onDeactivate(user)}
              >
                Desativar
              </MenuItem>
            ) : (
              <>
                <MenuItem icon={<UserCheck size={16} />} onSelect={() => onReactivate(user)}>
                  Reativar
                </MenuItem>
                <MenuSeparator />
                <MenuItem
                  icon={<UserRoundX size={16} />}
                  tone="danger"
                  onSelect={() => onAnonymize(user)}
                >
                  Anonimizar…
                </MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </li>
  );
}

export function MembersPage() {
  const session = useSessionUser();
  const users = useAdminUsers();
  const changeRole = useChangeRole();
  const setActive = useSetUserActive();
  const createResetLink = useCreatePasswordResetLink();
  const anonymizeUser = useAnonymizeUser();

  const [demoting, setDemoting] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [anonymizing, setAnonymizing] = useState<AdminUser | null>(null);
  const [resetLink, setResetLink] = useState<{ name: string; url: string } | null>(null);

  const applyRole = (user: AdminUser, role: Role) => {
    changeRole.mutate(
      { userId: user.id, role },
      {
        onSuccess: ({ user: updated }) => {
          setDemoting(null);
          toast.success(MEMBER_MESSAGES.roleChanged(updated.name, updated.role));
        },
        onError: (error) => {
          setDemoting(null);
          mutationErrorToast(error);
        },
      },
    );
  };

  const onRoleChange = (user: AdminUser, role: Role) => {
    if (role === user.role) return;
    if (role === 'member') setDemoting(user);
    else applyRole(user, role);
  };

  const deactivate = (user: AdminUser) => {
    setActive.mutate(
      { userId: user.id, active: false },
      {
        onSuccess: ({ user: updated }) => {
          setDeactivating(null);
          toast.success(MEMBER_MESSAGES.deactivated(updated.name));
        },
        onError: (error) => {
          setDeactivating(null);
          mutationErrorToast(error);
        },
      },
    );
  };

  const reactivate = (user: AdminUser) => {
    setActive.mutate(
      { userId: user.id, active: true },
      {
        onSuccess: ({ user: updated }) => toast.success(MEMBER_MESSAGES.reactivated(updated.name)),
        onError: mutationErrorToast,
      },
    );
  };

  const anonymize = (user: AdminUser) => {
    anonymizeUser.mutate(user.id, {
      onSuccess: () => {
        setAnonymizing(null);
        toast.success(MEMBER_MESSAGES.anonymizedDone);
      },
      onError: (error) => {
        setAnonymizing(null);
        mutationErrorToast(error);
      },
    });
  };

  const generateResetLink = (user: AdminUser) => {
    createResetLink.mutate(user.id, {
      onSuccess: ({ url }) => setResetLink({ name: user.name, url }),
      onError: mutationErrorToast,
    });
  };

  return (
    <section aria-labelledby="membros-titulo" className="flex flex-col gap-4">
      <title>Membros · Administração · Ronin</title>
      <h2 id="membros-titulo" className="text-lg">
        Membros
      </h2>

      {users.isPending ? (
        <ListSkeleton label="Carregando membros…" />
      ) : users.isError ? (
        <LoadError onRetry={() => void users.refetch()} retrying={users.isFetching} />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div
            aria-hidden
            className="hidden border-b border-border px-4 py-2 text-xs font-semibold text-muted md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_9rem_8rem_2.5rem] md:gap-4"
          >
            <span>Nome</span>
            <span>E-mail</span>
            <span>Papel</span>
            <span>Status</span>
            <span />
          </div>
          <ul aria-label="Membros da equipe" className="divide-y divide-border">
            {users.data.map((user) => (
              <MemberRow
                key={user.id}
                user={user}
                isSelf={user.id === session?.id}
                busy={changeRole.isPending || setActive.isPending || anonymizeUser.isPending}
                onRoleChange={onRoleChange}
                onDeactivate={setDeactivating}
                onReactivate={reactivate}
                onResetLink={generateResetLink}
                onAnonymize={setAnonymizing}
              />
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={demoting !== null}
        title={`Tornar ${demoting?.name ?? ''} Membro?`}
        description={<p>Essa pessoa deixa de acessar a administração.</p>}
        confirmLabel="Tornar Membro"
        pending={changeRole.isPending}
        pendingLabel="Salvando…"
        onConfirm={() => demoting && applyRole(demoting, 'member')}
        onClose={() => setDemoting(null)}
      />

      <ConfirmDialog
        open={deactivating !== null}
        tone="danger"
        title={`Desativar ${deactivating?.name ?? ''}?`}
        description={
          <p>
            A pessoa sai de todos os dispositivos e não consegue mais entrar. Links de redefinição
            pendentes são cancelados. Os cards e comentários dessa conta continuam.
          </p>
        }
        confirmLabel="Desativar"
        pending={setActive.isPending}
        pendingLabel="Desativando…"
        onConfirm={() => deactivating && deactivate(deactivating)}
        onClose={() => setDeactivating(null)}
      />

      <AnonymizeUserDialog
        user={anonymizing}
        pending={anonymizeUser.isPending}
        onConfirm={anonymize}
        onClose={() => setAnonymizing(null)}
      />

      <Dialog
        open={resetLink !== null}
        title={`Link de redefinição para ${resetLink?.name ?? ''}`}
        onClose={() => setResetLink(null)}
        description={
          <p>Copie e envie por um canal privado. O link vale por 24 horas e funciona uma vez só.</p>
        }
        footer={<Button onClick={() => setResetLink(null)}>Concluir</Button>}
      >
        {resetLink && (
          <>
            <CopyField label="Link de redefinição" value={resetLink.url} />
            <p className="text-warning">Este link não aparece de novo. Gerar outro cancela este.</p>
          </>
        )}
      </Dialog>
    </section>
  );
}
