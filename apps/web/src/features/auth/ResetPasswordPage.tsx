import {
  completePasswordResetRequestSchema,
  type CompletePasswordResetRequest,
} from '@kanban/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { isApiError } from '../../lib/api-client';
import { serverMessage } from '../../lib/api-errors';
import { firstName } from '../../lib/dates';
import { schemaResolver, splitErrorDetails, type FieldMessages } from '../../lib/form-errors';
import { AuthLayout } from './AuthLayout';
import type { LoginLocationState } from './RequireAuth';
import {
  isInvalidTokenError,
  isWellFormedToken,
  tokenRateLimitedMessage,
  useCompletePasswordReset,
  usePasswordResetLookup,
  useTokenFromFragment,
} from './token-api';

type ResetFormValues = z.input<typeof completePasswordResetRequestSchema>;

const FIELD_MESSAGES: FieldMessages<keyof ResetFormValues> = {
  password: {
    too_small: 'A senha precisa ter pelo menos 10 caracteres.',
    too_big: 'A senha pode ter no máximo 256 caracteres.',
  },
};

export const RESET_MESSAGES = {
  invalidTitle: 'Este link não vale mais',
  invalidDescription: 'Peça um novo a quem administra a equipe.',
} as const;

const resolver = schemaResolver(completePasswordResetRequestSchema, FIELD_MESSAGES);

function InvalidResetLink() {
  return (
    <AuthLayout
      title={RESET_MESSAGES.invalidTitle}
      description={RESET_MESSAGES.invalidDescription}
      footer={<Link to="/login">Ir para o login</Link>}
    >
      <title>Link inválido · Ronin</title>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const token = useTokenFromFragment();
  const lookup = usePasswordResetLookup(token);
  const [tokenRejected, setTokenRejected] = useState(false);

  if (!isWellFormedToken(token) || tokenRejected) return <InvalidResetLink />;

  if (lookup.isError) {
    if (isInvalidTokenError(lookup.error)) return <InvalidResetLink />;
    const error = lookup.error;
    return (
      <AuthLayout title="Criar nova senha">
        <title>Criar nova senha · Ronin</title>
        <Alert role="alert">
          {isApiError(error) && error.status === 429
            ? tokenRateLimitedMessage(error.retryAfterSeconds)
            : serverMessage(error)}
        </Alert>
        <Button
          variant="secondary"
          loading={lookup.isFetching}
          loadingText="Verificando…"
          onClick={() => void lookup.refetch()}
        >
          Tentar de novo
        </Button>
      </AuthLayout>
    );
  }

  if (!lookup.data) {
    return (
      <AuthLayout title="Criar nova senha">
        <title>Criar nova senha · Ronin</title>
        <p role="status" className="sr-only">
          Verificando link…
        </p>
        <div aria-hidden className="flex flex-col gap-3">
          <div className="h-5 w-3/4 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-10 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <ResetPasswordForm
      token={token}
      userName={lookup.data.userName}
      onTokenRejected={() => setTokenRejected(true)}
    />
  );
}

interface ResetPasswordFormProps {
  token: string;
  userName: string;
  onTokenRejected: () => void;
}

function ResetPasswordForm({ token, userName, onTokenRejected }: ResetPasswordFormProps) {
  const navigate = useNavigate();
  const complete = useCompletePasswordReset();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetFormValues, unknown, CompletePasswordResetRequest>({
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { token, password: '' },
  });

  const onError = (error: unknown) => {
    if (isInvalidTokenError(error) && isApiError(error)) {
      const fieldDetails = splitErrorDetails(error.details, ['password'] as const);
      if (error.code === 'VALIDATION_ERROR' && fieldDetails.fieldErrors.length > 0) {
        const [[field, message]] = fieldDetails.fieldErrors as [['password', string]];
        setError(field, { type: 'server', message }, { shouldFocus: true });
        return;
      }
      onTokenRejected();
      return;
    }
    if (isApiError(error) && error.status === 429) {
      setFormError(tokenRateLimitedMessage(error.retryAfterSeconds));
      return;
    }
    setFormError(serverMessage(error));
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    complete.mutate(values, {
      onSuccess: () => {
        const state: LoginLocationState = { passwordReset: true };
        void navigate('/login', { replace: true, state });
      },
      onError,
    });
  });

  return (
    <AuthLayout
      title="Criar nova senha"
      description={`Olá, ${firstName(userName)}. Escolha uma nova senha para sua conta.`}
    >
      <title>Criar nova senha · Ronin</title>
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormAlert message={formError} />
        <div className="flex flex-col gap-4">
          <PasswordInput
            label="Nova senha"
            autoComplete="new-password"
            hint={
              errors.password
                ? undefined
                : 'Use pelo menos 10 caracteres. Ao salvar, você sai de todos os dispositivos.'
            }
            maxLength={256}
            error={errors.password?.message}
            {...register('password')}
          />
          <Button
            type="submit"
            loading={complete.isPending}
            loadingText="Salvando…"
            className="w-full"
          >
            Salvar nova senha
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
