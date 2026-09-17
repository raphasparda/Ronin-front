import {
  changePasswordRequestSchema,
  isPasswordSameAsEmail,
  PASSWORD_SAME_AS_EMAIL_MESSAGE,
  updateMeRequestSchema,
  type ChangePasswordRequest,
  type SessionUser,
  type UpdateMeRequest,
} from '@raphasparda/ronin-shared';
import { LogOut } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { serverMessage } from '../../lib/api-errors';
import { schemaResolver, splitErrorDetails, type FieldMessages } from '../../lib/form-errors';
import { MESSAGES } from '../../lib/query-client';
import { useSessionUser } from '../auth/auth-api';
import { useSignOut } from '../auth/use-sign-out';
import { useChangePassword, useUpdateMe } from './me-api';

export const PROFILE_MESSAGES = {
  nameSaved: 'Nome atualizado.',
  passwordChanged: 'Senha alterada. Você saiu dos outros dispositivos.',
  passwordIncorrect: 'A senha atual está incorreta.',
} as const;

const ROLE_TEXT = { admin: 'Admin', member: 'Membro' } as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`perfil-${title}`}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <h2 id={`perfil-${title}`} className="text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}

function errorFromResponse(error: unknown): string | null {
  if (isApiError(error) && error.status === 429)
    return MESSAGES.rateLimited(error.retryAfterSeconds);
  return serverMessage(error);
}

type NameFormValues = z.input<typeof updateMeRequestSchema>;

const nameResolver = schemaResolver(updateMeRequestSchema, {
  name: { too_small: 'Informe seu nome.', too_big: 'O nome pode ter no máximo 80 caracteres.' },
} satisfies FieldMessages<keyof NameFormValues>);

function NameForm({ user }: { user: SessionUser }) {
  const updateMe = useUpdateMe();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<NameFormValues, unknown, UpdateMeRequest>({
    resolver: nameResolver,
    defaultValues: { name: user.name },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    updateMe.mutate(values, {
      onSuccess: ({ user: updated }) => {
        reset({ name: updated.name });
        toast.success(PROFILE_MESSAGES.nameSaved);
      },
      onError: (error) => {
        if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
          const { fieldErrors, other } = splitErrorDetails(error.details, ['name'] as const);
          fieldErrors.forEach(([field, message]) =>
            setError(field, { type: 'server', message }, { shouldFocus: true }),
          );
          setFormError(other.length > 0 ? other.join(' ') : null);
          return;
        }
        setFormError(errorFromResponse(error));
      },
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <Input
        label="Nome"
        autoComplete="name"
        maxLength={80}
        error={errors.name?.message}
        {...register('name')}
      />
      <Button
        type="submit"
        variant="secondary"
        loading={updateMe.isPending}
        loadingText="Salvando…"
        disabled={!isDirty}
        className="self-start"
      >
        Salvar nome
      </Button>
    </form>
  );
}

function passwordFormSchema(email: string) {
  return changePasswordRequestSchema.refine(
    (values) => !isPasswordSameAsEmail(values.newPassword, email),
    { error: PASSWORD_SAME_AS_EMAIL_MESSAGE, path: ['newPassword'] },
  );
}

type PasswordFormValues = z.input<typeof changePasswordRequestSchema>;

const PASSWORD_FIELDS = ['currentPassword', 'newPassword'] as const;

function PasswordForm({ user }: { user: SessionUser }) {
  const changePassword = useChangePassword();
  const [formError, setFormError] = useState<string | null>(null);
  const resolver = useMemo(
    () =>
      schemaResolver(passwordFormSchema(user.email), {
        currentPassword: { too_small: 'Informe sua senha atual.' },
        newPassword: {
          too_small: 'A senha precisa ter pelo menos 10 caracteres.',
          too_big: 'A senha pode ter no máximo 256 caracteres.',
        },
      } satisfies FieldMessages<keyof PasswordFormValues>),
    [user.email],
  );
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<PasswordFormValues, unknown, ChangePasswordRequest>({
    resolver,
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    changePassword.mutate(values, {
      onSuccess: () => {
        reset();
        toast.success(PROFILE_MESSAGES.passwordChanged);
      },
      onError: (error) => {
        if (isApiError(error) && error.code === 'PASSWORD_INCORRECT') {
          setError(
            'currentPassword',
            { type: 'server', message: PROFILE_MESSAGES.passwordIncorrect },
            { shouldFocus: true },
          );
          return;
        }
        if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
          const { fieldErrors, other } = splitErrorDetails(error.details, PASSWORD_FIELDS);
          fieldErrors.forEach(([field, message], index) =>
            setError(field, { type: 'server', message }, { shouldFocus: index === 0 }),
          );
          setFormError(other.length > 0 ? other.join(' ') : null);
          return;
        }
        setFormError(errorFromResponse(error));
      },
    });
  });

  return (
    <form noValidate onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
      <FormAlert message={formError} />
      <input type="email" autoComplete="username" value={user.email} readOnly hidden />
      <PasswordInput
        label="Senha atual"
        autoComplete="current-password"
        maxLength={256}
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />
      <PasswordInput
        label="Nova senha"
        autoComplete="new-password"
        maxLength={256}
        hint={errors.newPassword ? undefined : 'Use pelo menos 10 caracteres.'}
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />
      <Button
        type="submit"
        variant="secondary"
        loading={changePassword.isPending}
        loadingText="Alterando…"
        className="self-start"
      >
        Alterar senha
      </Button>
    </form>
  );
}

export function ProfilePage() {
  const user = useSessionUser();
  const { signOut, pending } = useSignOut();

  if (!user) return null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <title>Meu perfil · Ronin</title>
      <h1 className="text-xl">Meu perfil</h1>

      <Section title="Dados">
        <div className="flex items-center gap-4">
          <Avatar id={user.id} name={user.name} className="size-16! text-xl!" />
          <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="text-muted">E-mail</dt>
            <dd className="truncate">{user.email}</dd>
            <dt className="text-muted">Papel</dt>
            <dd>{ROLE_TEXT[user.role]}</dd>
          </dl>
        </div>
        <NameForm key={user.name} user={user} />
      </Section>

      <Section title="Senha">
        <PasswordForm user={user} />
      </Section>

      <Button
        variant="secondary"
        icon={<LogOut size={16} />}
        loading={pending}
        loadingText="Saindo…"
        onClick={signOut}
        className="self-start"
      >
        Sair
      </Button>
    </div>
  );
}
