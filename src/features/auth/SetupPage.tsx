import { DEFAULT_TIMEZONE, setupRequestSchema } from '@raphasparda/ronin-shared';
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
import { setNeedsSetup, setupStatusQueryKey, useSetup, useSetupStatus } from './auth-api';
import { AuthLayout } from './AuthLayout';
import { BootError, BootLoading } from './BootScreen';

const PASSWORD_MISMATCH = 'As senhas não conferem.';

/**
 * Corpo do setup (schema compartilhado) + confirmação de senha, que só existe na tela. O código de
 * configuração é opcional no contrato; a tela o exige quando a instância pede (`requiresSetupToken`).
 */
export function createSetupFormSchema(requiresSetupToken: boolean) {
  return z
    .intersection(
      setupRequestSchema,
      z.object({
        setupToken: z.string().min(requiresSetupToken ? 1 : 0),
        passwordConfirmation: z.string().min(1, { error: 'Repita a senha.' }),
      }),
    )
    .refine((values) => values.password === values.passwordConfirmation, {
      error: PASSWORD_MISMATCH,
      path: ['passwordConfirmation'],
      when: (payload) => {
        const value = payload.value as { passwordConfirmation?: unknown };
        return typeof value.passwordConfirmation === 'string' && value.passwordConfirmation !== '';
      },
    });
}

type SetupFormSchema = ReturnType<typeof createSetupFormSchema>;
type SetupFormValues = z.input<SetupFormSchema>;
type SetupFormOutput = z.output<SetupFormSchema>;

const FIELDS = [
  'setupToken',
  'workspaceName',
  'name',
  'email',
  'password',
  'passwordConfirmation',
  'timezone',
] as const satisfies ReadonlyArray<keyof SetupFormValues>;

const FIELD_MESSAGES: FieldMessages<keyof SetupFormValues> = {
  setupToken: {
    too_small: 'Informe o código de configuração.',
    too_big: 'O código de configuração pode ter no máximo 200 caracteres.',
  },
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
  tokenInvalid: 'Código de configuração inválido.',
  tokenNowRequired:
    'Esta instância pede um código de configuração. Preencha o campo e tente de novo.',
  rateLimited: (seconds: number | null) =>
    seconds === null
      ? 'Muitas tentativas seguidas. Tente de novo em instantes.'
      : `Muitas tentativas seguidas. Tente de novo em ${formatWait(seconds)}.`,
} as const;

const resolverWithToken = schemaResolver(createSetupFormSchema(true), FIELD_MESSAGES);
const resolverWithoutToken = schemaResolver(createSetupFormSchema(false), FIELD_MESSAGES);

export function SetupPage() {
  const setupStatus = useSetupStatus();
  const setup = useSetup();
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const requiresSetupToken = setupStatus.data?.requiresSetupToken === true;

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<SetupFormValues, unknown, SetupFormOutput>({
    resolver: requiresSetupToken ? resolverWithToken : resolverWithoutToken,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: {
      setupToken: '',
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
        setNeedsSetup(queryClient, false);
        return;
      case 'SETUP_TOKEN_INVALID':
        if (requiresSetupToken) {
          setError(
            'setupToken',
            { type: 'server', message: SETUP_MESSAGES.tokenInvalid },
            { shouldFocus: true },
          );
        } else {
          // O servidor passou a exigir o código depois que a tela abriu: recarrega o status.
          setFormError(SETUP_MESSAGES.tokenNowRequired);
          void queryClient.invalidateQueries({ queryKey: setupStatusQueryKey });
        }
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

  const onSubmit = handleSubmit(({ passwordConfirmation: _confirmation, setupToken, ...body }) => {
    setFormError(null);
    setup.mutate(requiresSetupToken ? { ...body, setupToken } : body, { onError });
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
          {requiresSetupToken && (
            <PasswordInput
              label="Código de configuração"
              revealLabel="Mostrar código"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={200}
              hint="Peça o código a quem instalou o Ronin no servidor."
              error={errors.setupToken?.message}
              {...register('setupToken')}
            />
          )}
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
