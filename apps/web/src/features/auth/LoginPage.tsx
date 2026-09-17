import { loginRequestSchema, type LoginRequest } from '@kanban/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import type { z } from 'zod';

import { Alert } from '../../components/ui/Alert';
import { FormAlert } from '../../components/ui/FormAlert';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { isApiError } from '../../lib/api-client';
import { formatWait } from '../../lib/format-wait';
import {
  fixFieldsMessage,
  schemaResolver,
  splitErrorDetails,
  type FieldMessages,
} from '../../lib/form-errors';
import { MESSAGES } from '../../lib/query-client';
import { safeNextPath } from '../../lib/safe-next';
import { setupStatusQueryKey, useLogin, useSetupStatus } from './auth-api';
import { AuthLayout } from './AuthLayout';
import { BootError, BootLoading } from './BootScreen';
import type { LoginLocationState } from './RequireAuth';

type LoginFormValues = z.input<typeof loginRequestSchema>;

const FIELDS = ['email', 'password'] as const satisfies ReadonlyArray<keyof LoginFormValues>;

const FIELD_MESSAGES: FieldMessages<keyof LoginFormValues> = {
  email: {
    too_small: 'Informe seu e-mail.',
    invalid_format: 'Digite um e-mail válido, como nome@empresa.com.',
  },
  password: { too_small: 'Informe sua senha.' },
};

export const LOGIN_MESSAGES = {
  invalidCredentials: 'E-mail ou senha incorretos.',
  sessionExpired: 'Sua sessão expirou. Entre de novo para continuar.',
  passwordReset: 'Senha alterada. Entre com a nova senha.',
  tooManyAttempts: (seconds: number | null) =>
    seconds === null
      ? 'Muitas tentativas seguidas. Tente de novo em instantes.'
      : `Muitas tentativas seguidas. Tente de novo em ${formatWait(seconds)}.`,
} as const;

const resolver = schemaResolver(loginRequestSchema, FIELD_MESSAGES);

/** Bloqueio do botão durante o `Retry-After`; ao fim, chama `onExpire`. */
function useSubmitBlock(onExpire: () => void) {
  const [block, setBlock] = useState<{ seconds: number } | null>(null);
  const expire = useEffectEvent(onExpire);

  useEffect(() => {
    if (block === null) return;
    const timer = window.setTimeout(() => {
      setBlock(null);
      expire();
    }, block.seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [block]);

  return [block !== null, (seconds: number) => setBlock({ seconds })] as const;
}

export function LoginPage() {
  const [searchParams] = useSearchParams();
  const next = safeNextPath(searchParams.get('next'));
  const locationState = useLocation().state as LoginLocationState | null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const setupStatus = useSetupStatus();
  const login = useLogin();

  const [formError, setFormError] = useState<string | null>(null);
  const [blocked, blockFor] = useSubmitBlock(() => setFormError(null));

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    setFocus,
    formState: { errors, isSubmitted },
  } = useForm<LoginFormValues, unknown, LoginRequest>({
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { email: '', password: '' },
  });

  if (setupStatus.data?.needsSetup) return <Navigate to="/setup" replace />;
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
      case 'INVALID_CREDENTIALS':
        setFormError(LOGIN_MESSAGES.invalidCredentials);
        setValue('password', '');
        setFocus('password');
        return;
      case 'TOO_MANY_ATTEMPTS':
      case 'RATE_LIMITED':
        setFormError(LOGIN_MESSAGES.tooManyAttempts(error.retryAfterSeconds));
        if (error.retryAfterSeconds !== null) {
          blockFor(error.retryAfterSeconds);
        }
        return;
      case 'SETUP_REQUIRED':
        queryClient.setQueryData(setupStatusQueryKey, { needsSetup: true });
        return;
      case 'VALIDATION_ERROR': {
        const { fieldErrors, other } = splitErrorDetails(error.details, FIELDS);
        fieldErrors.forEach(([field, message], index) =>
          setError(field, { type: 'server', message }, { shouldFocus: index === 0 }),
        );
        setFormError(other.length > 0 ? other.join(' ') : null);
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

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    login.mutate(values, {
      onSuccess: () => void navigate(next, { replace: true }),
      onError,
    });
  });

  return (
    <AuthLayout
      title="Entrar"
      footer={
        <p className="text-muted">
          Esqueceu a senha? Peça um link de redefinição a quem administra a equipe.
        </p>
      }
    >
      <title>Entrar · Ronin</title>
      {locationState?.sessionExpired && !formError && (
        <Alert tone="info">{LOGIN_MESSAGES.sessionExpired}</Alert>
      )}
      {locationState?.passwordReset && !formError && (
        <Alert tone="success">{LOGIN_MESSAGES.passwordReset}</Alert>
      )}
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormAlert
          message={
            formError ??
            (isSubmitted && fieldErrorCount > 0 ? fixFieldsMessage(fieldErrorCount) : null)
          }
        />
        <div className="flex flex-col gap-4">
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
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button
            type="submit"
            loading={login.isPending}
            loadingText="Entrando…"
            disabled={blocked}
            className="w-full"
          >
            Entrar
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
