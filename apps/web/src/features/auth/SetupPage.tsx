import { DEFAULT_TIMEZONE, setupRequestSchema } from '@kanban/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate } from 'react-router';
import { z } from 'zod';

import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Select } from '../../components/ui/Select';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { formatWait } from '../../lib/format-wait';
import {
  fixFieldsMessage,
  schemaResolver,
  splitErrorDetails,
  type FieldMessages,
} from '../../lib/form-errors';
import { MESSAGES } from '../../lib/query-client';
import { getTimezoneOptions } from '../../lib/timezones';
import { setupStatusQueryKey, useSetup, useSetupStatus } from './auth-api';
import { AuthLayout } from './AuthLayout';
import { BootError, BootLoading } from './BootScreen';

const PASSWORD_MISMATCH = 'As senhas não conferem.';

/** Corpo do setup (schema compartilhado) + confirmação de senha, que só existe na tela. */
export const setupFormSchema = z
  .intersection(
    setupRequestSchema,
    z.object({ passwordConfirmation: z.string().min(1, { error: 'Repita a senha.' }) }),
  )
  .refine((values) => values.password === values.passwordConfirmation, {
    error: PASSWORD_MISMATCH,
    path: ['passwordConfirmation'],
    when: (payload) => {
      const value = payload.value as { passwordConfirmation?: unknown };
      return typeof value.passwordConfirmation === 'string' && value.passwordConfirmation !== '';
    },
  });

type SetupFormValues = z.input<typeof setupFormSchema>;
type SetupFormOutput = z.output<typeof setupFormSchema>;

const FIELDS = [
  'workspaceName',
  'name',
  'email',
  'password',
  'passwordConfirmation',
  'timezone',
] as const satisfies ReadonlyArray<keyof SetupFormValues>;

const FIELD_MESSAGES: FieldMessages<keyof SetupFormValues> = {
  workspaceName: {
    too_small: 'Informe o nome da equipe.',
    too_big: 'O nome da equipe pode ter no máximo 100 caracteres.',
  },
  name: {
    too_small: 'Informe seu nome.',
    too_big: 'O nome pode ter no máximo 80 caracteres.',
  },
  email: {
    too_small: 'Informe seu e-mail.',
    invalid_format: 'Digite um e-mail válido, como nome@empresa.com.',
  },
  password: {
    too_small: 'A senha precisa ter pelo menos 10 caracteres.',
    too_big: 'A senha pode ter no máximo 256 caracteres.',
  },
  timezone: { custom: 'Escolha um fuso horário da lista.' },
};

export const SETUP_MESSAGES = {
  alreadyDone: 'Esta instância já foi configurada. Entre com sua conta.',
  rateLimited: (seconds: number | null) =>
    seconds === null
      ? 'Muitas tentativas seguidas. Tente de novo em instantes.'
      : `Muitas tentativas seguidas. Tente de novo em ${formatWait(seconds)}.`,
} as const;

const resolver = schemaResolver(setupFormSchema, FIELD_MESSAGES);

export function SetupPage() {
  const setupStatus = useSetupStatus();
  const setup = useSetup();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<SetupFormValues, unknown, SetupFormOutput>({
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      workspaceName: '',
      name: '',
      email: '',
      password: '',
      passwordConfirmation: '',
      timezone: DEFAULT_TIMEZONE,
    },
  });

  /**
   * Instância configurada (no boot ou por `SETUP_ALREADY_DONE`): o `RequireAuth` de `/` abre a
   * home ou manda para `/login`. Não trocar `navigate()` + cache: a promessa do `navigate`
   * resolve antes de o React confirmar a nova rota, e esta tela ainda montada redirecionaria.
   */
  if (setupStatus.data?.needsSetup === false) return <Navigate to="/" replace />;
  if (!setupStatus.data) {
    return setupStatus.isError ? (
      <BootError onRetry={() => void setupStatus.refetch()} retrying={setupStatus.isFetching} />
    ) : (
      <BootLoading />
    );
  }

  const fieldErrorCount = Object.keys(errors).length;

  const onError = (error: unknown) => {
    if (!isApiError(error)) {
      setFormError(MESSAGES.generic);
      return;
    }
    switch (error.code) {
      case 'SETUP_ALREADY_DONE':
        toast.info(SETUP_MESSAGES.alreadyDone);
        queryClient.setQueryData(setupStatusQueryKey, { needsSetup: false });
        return;
      case 'RATE_LIMITED':
      case 'TOO_MANY_ATTEMPTS':
        setFormError(SETUP_MESSAGES.rateLimited(error.retryAfterSeconds));
        return;
      case 'VALIDATION_ERROR': {
        const { fieldErrors, other } = splitErrorDetails(error.details, FIELDS);
        fieldErrors.forEach(([field, message], index) =>
          setError(field, { type: 'server', message }, { shouldFocus: index === 0 }),
        );
        if (other.length > 0) setFormError(other.join(' '));
        else if (fieldErrors.length === 0) setFormError(error.message);
        return;
      }
      default:
        setFormError(
          error.fromServer && error.status < 500 && !error.isNetworkError
            ? error.message
            : MESSAGES.generic,
        );
    }
  };

  const onSubmit = handleSubmit(({ passwordConfirmation: _confirmation, ...body }) => {
    setFormError(null);
    setup.mutate(body, { onError });
  });

  return (
    <AuthLayout
      title="Configurar a equipe"
      description="Crie a conta de Admin. Você convida as outras pessoas depois."
    >
      <title>Configurar a equipe · Ronin</title>
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormAlert
          message={
            formError ??
            (isSubmitted && fieldErrorCount > 0 ? fixFieldsMessage(fieldErrorCount) : null)
          }
        />
        <div className="flex flex-col gap-4">
          <Input
            label="Nome da equipe"
            autoComplete="organization"
            maxLength={100}
            error={errors.workspaceName?.message}
            {...register('workspaceName')}
          />
          <Input
            label="Seu nome"
            autoComplete="name"
            maxLength={80}
            error={errors.name?.message}
            {...register('name')}
          />
          <Input
            label="E-mail"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            error={errors.email?.message}
            {...register('email')}
          />
          <PasswordInput
            label="Senha"
            autoComplete="new-password"
            hint={errors.password ? undefined : 'Use pelo menos 10 caracteres.'}
            maxLength={256}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordInput
            label="Confirme a senha"
            autoComplete="new-password"
            maxLength={256}
            error={errors.passwordConfirmation?.message}
            {...register('passwordConfirmation')}
          />
          <Select
            label="Fuso horário"
            hint="Usado nos prazos dos cards. Dá para mudar depois."
            options={getTimezoneOptions()}
            error={errors.timezone?.message}
            {...register('timezone')}
          />
          <Button
            type="submit"
            loading={setup.isPending}
            loadingText="Criando conta…"
            className="w-full"
          >
            Criar conta e começar
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
