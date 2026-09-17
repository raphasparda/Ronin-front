import {
  createInviteRequestSchema,
  roleSchema,
  type AdminUser,
  type CreateInviteRequest,
  type Invite,
  type InviteState,
} from '@kanban/shared';
import { Clock, Plus } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../../components/ui/Button';
import { CopyField } from '../../components/ui/CopyField';
import { Dialog } from '../../components/ui/Dialog';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Input';
import { Pill } from '../../components/ui/Pill';
import { ListSkeleton, LoadError } from '../../components/ui/QueryState';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { isGloballyHandled, serverMessage } from '../../lib/api-errors';
import { formatShortDate, formatShortDateTime } from '../../lib/dates';
import { schemaResolver, splitErrorDetails } from '../../lib/form-errors';
import { useSession } from '../auth/auth-api';
import { useAdminInvites, useAdminUsers, useCreateInvite, useRevokeInvite } from './admin-api';

export const INVITE_ADMIN_MESSAGES = {
  emailTaken: 'Já existe uma conta com este e-mail.',
  revoked: 'Convite revogado.',
  noPending: 'Nenhum convite pendente.',
  alone: 'Por enquanto, só você está por aqui. Convide alguém para começar.',
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;

const ROLE_TEXT = { admin: 'Admin', member: 'Membro' } as const;

const HISTORY_TEXT: Record<Exclude<InviteState, 'pending'>, string> = {
  used: 'Usado',
  expired: 'Expirado',
  revoked: 'Revogado',
};

/** E-mail em branco vira `null` (api.md §18.8); o resto segue o schema do servidor. */
const inviteFormSchema = z.object({
  email: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : value))
    .pipe(createInviteRequestSchema.shape.email.unwrap()),
  role: roleSchema,
});

type InviteFormValues = z.input<typeof inviteFormSchema>;

const resolver = schemaResolver(inviteFormSchema, {
  email: { invalid_format: 'Digite um e-mail válido, como nome@empresa.com.' },
});

interface NewInviteDialogProps {
  open: boolean;
  onClose: () => void;
}

function NewInviteDialog({ open, onClose }: NewInviteDialogProps) {
  const createInvite = useCreateInvite();
  const [url, setUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();
  const roleHintId = useId();
  const linkRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (url !== null) linkRef.current?.querySelector<HTMLElement>('button')?.focus();
  }, [url]);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues, unknown, CreateInviteRequest>({
    resolver,
    defaultValues: { email: '', role: 'member' },
  });

  const close = () => {
    reset();
    setUrl(null);
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    createInvite.mutate(values, {
      onSuccess: (response) => setUrl(response.url),
      onError: (error) => {
        if (isApiError(error) && error.code === 'EMAIL_TAKEN') {
          setError(
            'email',
            { type: 'server', message: INVITE_ADMIN_MESSAGES.emailTaken },
            { shouldFocus: true },
          );
          return;
        }
        if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
          const { fieldErrors, other } = splitErrorDetails(error.details, [
            'email',
            'role',
          ] as const);
          fieldErrors.forEach(([field, message], index) =>
            setError(field, { type: 'server', message }, { shouldFocus: index === 0 }),
          );
          setFormError(other.length > 0 ? other.join(' ') : null);
          return;
        }
        if (!isGloballyHandled(error)) setFormError(serverMessage(error));
      },
    });
  });

  if (url !== null) {
    return (
      <Dialog
        open={open}
        title="Convite criado"
        onClose={close}
        description={
          <p>Envie este link para a pessoa. Ele vale por 7 dias e funciona uma vez só.</p>
        }
        footer={<Button onClick={close}>Concluir</Button>}
      >
        <div ref={linkRef} className="flex flex-col gap-4">
          <CopyField label="Link do convite" value={url} />
          <p className="text-warning">Este link não aparece de novo.</p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      title="Novo convite"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={createInvite.isPending}
            loadingText="Criando…"
          >
            Criar convite
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="flex flex-col gap-4"
      >
        <FormAlert message={formError} />
        <Input
          label="E-mail (opcional)"
          type="email"
          autoComplete="off"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          hint="Se preencher, só este e-mail poderá usar o convite."
          error={errors.email?.message}
          {...register('email')}
        />
        <fieldset aria-describedby={roleHintId} className="flex flex-col gap-2">
          <legend className="mb-1.5 font-medium">Papel</legend>
          <label className="flex min-h-10 items-center gap-2 md:min-h-8">
            <input
              type="radio"
              value="member"
              className="size-4 accent-accent"
              {...register('role')}
            />
            Membro
          </label>
          <label className="flex min-h-10 items-center gap-2 md:min-h-8">
            <input
              type="radio"
              value="admin"
              className="size-4 accent-accent"
              {...register('role')}
            />
            Admin
          </label>
          <p id={roleHintId} className="text-muted">
            Admins acessam a administração: convites, papéis e contas.
          </p>
        </fieldset>
      </form>
    </Dialog>
  );
}

function userName(users: readonly AdminUser[] | undefined, id: string | null): string | null {
  if (id === null) return null;
  return users?.find((user) => user.id === id)?.name ?? null;
}

interface InviteRowProps {
  invite: Invite;
  users: readonly AdminUser[] | undefined;
  timeZone: string | undefined;
  now: number;
}

function PendingInviteRow({ invite, users, timeZone, now }: InviteRowProps) {
  const revoke = useRevokeInvite();
  const [confirming, setConfirming] = useState(false);
  const expiresSoon = new Date(invite.expiresAt).getTime() - now <= DAY_MS;
  const expiresText = formatShortDateTime(invite.expiresAt, timeZone);
  const creator = userName(users, invite.createdBy);
  const label = invite.email ?? 'Sem e-mail';

  return (
    <li className="flex flex-col gap-2 p-4 md:flex-row md:items-center md:gap-4 md:py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={`truncate font-semibold ${invite.email ? '' : 'text-muted'}`}>
            {label}
          </span>
          <Pill>{ROLE_TEXT[invite.role]}</Pill>
        </span>
        <span className="flex flex-wrap items-center gap-2 text-muted">
          {creator && <span>Criado por {creator}</span>}
          {expiresSoon ? (
            <Pill status="due-soon" icon={<Clock size={12} />}>
              Expira em {expiresText}
            </Pill>
          ) : (
            <span>Expira em {expiresText}</span>
          )}
        </span>
      </div>
      {confirming ? (
        <div
          role="group"
          aria-label="Confirmar revogação"
          className="flex flex-wrap items-center gap-2"
        >
          <span>Revogar este convite? O link deixa de funcionar.</span>
          <Button
            size="sm"
            variant="danger"
            loading={revoke.isPending}
            loadingText="Revogando…"
            onClick={() =>
              revoke.mutate(invite.id, {
                onSuccess: () => toast.success(INVITE_ADMIN_MESSAGES.revoked),
                onError: (error) => {
                  if (!isGloballyHandled(error)) toast.error(serverMessage(error));
                },
                onSettled: () => setConfirming(false),
              })
            }
          >
            Revogar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          aria-label={`Revogar convite ${label}`}
          onClick={() => setConfirming(true)}
          className="self-start md:self-auto"
        >
          Revogar
        </Button>
      )}
    </li>
  );
}

function HistoryInviteRow({ invite, users, timeZone }: InviteRowProps) {
  const state = invite.state as Exclude<InviteState, 'pending'>;
  const usedBy = userName(users, invite.usedByUserId);

  return (
    <li className="flex flex-col gap-1 p-4 md:flex-row md:items-center md:gap-4 md:py-3">
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className={`truncate font-semibold ${invite.email ? '' : 'text-muted'}`}>
          {invite.email ?? 'Sem e-mail'}
        </span>
        <Pill>{ROLE_TEXT[invite.role]}</Pill>
      </span>
      <span className="flex flex-wrap items-center gap-2 text-muted">
        <Pill color={state === 'used' ? 'green' : 'gray'}>{HISTORY_TEXT[state]}</Pill>
        {state === 'used' && usedBy && <span>por {usedBy}</span>}
        <span>Criado em {formatShortDate(invite.createdAt, timeZone)}</span>
      </span>
    </li>
  );
}

export function InvitesPage() {
  const invites = useAdminInvites();
  const users = useAdminUsers();
  const timeZone = useSession({ enabled: false }).data?.workspace.timezone;
  const [creating, setCreating] = useState(false);
  const [now] = useState(() => Date.now());

  const pending = invites.data?.filter((invite) => invite.state === 'pending') ?? [];
  const history = invites.data?.filter((invite) => invite.state !== 'pending') ?? [];
  const alone = users.data?.length === 1;

  return (
    <section aria-labelledby="convites-titulo" className="flex flex-col gap-4">
      <title>Convites · Administração · Ronin</title>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="convites-titulo" className="text-lg">
          Convites
        </h2>
        <Button icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Novo convite
        </Button>
      </div>

      {invites.isPending ? (
        <ListSkeleton label="Carregando convites…" rows={3} />
      ) : invites.isError ? (
        <LoadError onRetry={() => void invites.refetch()} retrying={invites.isFetching} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <h3 className="font-semibold">Pendentes</h3>
            {pending.length === 0 ? (
              <p className="rounded-lg border border-border bg-surface p-4 text-muted">
                {alone ? INVITE_ADMIN_MESSAGES.alone : INVITE_ADMIN_MESSAGES.noPending}
              </p>
            ) : (
              <ul
                aria-label="Convites pendentes"
                className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm"
              >
                {pending.map((invite) => (
                  <PendingInviteRow
                    key={invite.id}
                    invite={invite}
                    users={users.data}
                    timeZone={timeZone}
                    now={now}
                  />
                ))}
              </ul>
            )}
          </div>

          {history.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="font-semibold">Histórico (30 dias)</h3>
              <ul
                aria-label="Histórico de convites"
                className="divide-y divide-border rounded-lg border border-border bg-surface shadow-sm"
              >
                {history.map((invite) => (
                  <HistoryInviteRow
                    key={invite.id}
                    invite={invite}
                    users={users.data}
                    timeZone={timeZone}
                    now={now}
                  />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <NewInviteDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  );
}
