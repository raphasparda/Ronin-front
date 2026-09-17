import { acceptInviteRequestSchema, type AcceptInviteRequest } from '@raphasparda/ronin-shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import type { z } from 'zod';

import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Input';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { toast } from '../../components/ui/toast-store';
import { isApiError } from '../../lib/api-client';
import { serverMessage } from '../../lib/api-errors';
import { firstName, formatShortDate } from '../../lib/dates';
import {
  fixFieldsMessage,
  schemaResolver,
  splitErrorDetails,
  type FieldMessages,
} from '../../lib/form-errors';
import { AuthLayout } from './AuthLayout';
import {
  isInvalidTokenError,
  isWellFormedToken,
  tokenRateLimitedMessage,
  useAcceptInvite,
  useInviteLookup,
  useTokenFromFragment,
} from './token-api';

type InviteFormValues = z.input<typeof acceptInviteRequestSchema>;

const FIELDS = ['name', 'email', 'password'] as const satisfies ReadonlyArray<
  keyof InviteFormValues
>;

const FIELD_MESSAGES: FieldMessages<keyof InviteFormValues> = {
  name: { too_small: 'Informe seu nome.', too_big: 'O nome pode ter no máximo 80 caracteres.' },
  email: {
    too_small: 'Informe seu e-mail.',
    invalid_format: 'Digite um e-mail válido, como nome@empresa.com.',
  },
  password: {
    too_small: 'A senha precisa ter pelo menos 10 caracteres.',
    too_big: 'A senha pode ter no máximo 256 caracteres.',
  },
};

export const INVITE_MESSAGES = {
  invalidTitle: 'Este convite não vale mais',
  invalidDescription:
    'Ele pode ter expirado, já ter sido usado ou ter sido cancelado. Peça um novo link a quem convidou você.',
  emailTaken: 'Já existe uma conta com este e-mail. Entre com ela ou use outro e-mail.',
  emailMismatch: 'Este convite é para outro e-mail. Use o e-mail do convite.',
  welcome: (name: string) => `Boas-vindas à equipe, ${firstName(name)}.`,
} as const;

const ROLE_TEXT = { admin: 'Admin', member: 'Membro' } as const;

const resolver = schemaResolver(acceptInviteRequestSchema, FIELD_MESSAGES);

function InvalidInvite() {
  return (
    <AuthLayout
      title={INVITE_MESSAGES.invalidTitle}
      description={INVITE_MESSAGES.invalidDescription}
      footer={
        <p>
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      }
    >
      <title>Convite inválido · Ronin</title>
    </AuthLayout>
  );
}

export function InvitePage() {
  const token = useTokenFromFragment();
  const lookup = useInviteLookup(token);
  const [tokenRejected, setTokenRejected] = useState(false);

  if (!isWellFormedToken(token) || tokenRejected) {
    return <InvalidInvite />;
  }
  if (lookup.isError) {
    if (isInvalidTokenError(lookup.error)) return <InvalidInvite />;
    const rateLimited = isApiError(lookup.error) && lookup.error.status === 429;
    return (
      <AuthLayout title="Aceitar convite">
        <title>Aceitar convite · Ronin</title>
        <Alert role="alert">
          {rateLimited && isApiError(lookup.error)
            ? tokenRateLimitedMessage(lookup.error.retryAfterSeconds)
            : serverMessage(lookup.error)}
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
      <AuthLayout title="Aceitar convite">
        <title>Aceitar convite · Ronin</title>
        <p role="status" className="sr-only">
          Verificando convite…
        </p>
        <div aria-hidden className="flex flex-col gap-3">
          <div className="h-5 w-3/4 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-10 animate-pulse rounded-md bg-surface-sunken" />
          <div className="h-10 animate-pulse rounded-md bg-surface-sunken" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AcceptInviteForm
      token={token}
      invite={lookup.data}
      onTokenRejected={() => setTokenRejected(true)}
    />
  );
}

interface AcceptInviteFormProps {
  token: string;
  invite: { email: string | null; role: 'admin' | 'member'; expiresAt: string };
  onTokenRejected: () => void;
}

function AcceptInviteForm({ token, invite, onTokenRejected }: AcceptInviteFormProps) {
  const navigate = useNavigate();
  const accept = useAcceptInvite();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitted },
  } = useForm<InviteFormValues, unknown, AcceptInviteRequest>({
    resolver,
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { token, name: '', email: invite.email ?? '', password: '' },
  });

  const fieldErrorCount = Object.keys(errors).length;

  const onError = (error: unknown) => {
    if (!isApiError(error)) {
      setFormError(serverMessage(error));
      return;
    }
    switch (error.code) {
      case 'TOKEN_INVALID':
        onTokenRejected();
        return;
      case 'EMAIL_TAKEN':
        setError(
          'email',
          { type: 'server', message: INVITE_MESSAGES.emailTaken },
          { shouldFocus: true },
        );
        return;
      case 'INVITE_EMAIL_MISMATCH':
        setError(
          'email',
          { type: 'server', message: INVITE_MESSAGES.emailMismatch },
          { shouldFocus: true },
        );
        return;
      case 'RATE_LIMITED':
      case 'TOO_MANY_ATTEMPTS':
        setFormError(tokenRateLimitedMessage(error.retryAfterSeconds));
        return;
      case 'VALIDATION_ERROR': {
        if (error.details.some((detail) => detail.path.endsWith('token'))) {
          onTokenRejected();
          return;
        }
        const { fieldErrors, other } = splitErrorDetails(error.details, FIELDS);
        fieldErrors.forEach(([field, message], index) =>
          setError(field, { type: 'server', message }, { shouldFocus: index === 0 }),
        );
        if (other.length > 0) setFormError(other.join(' '));
        else if (fieldErrors.length === 0) setFormError(error.message);
        return;
      }
      default:
        setFormError(serverMessage(error));
    }
  };

  const onSubmit = handleSubmit((values) => {
    setFormError(null);
    accept.mutate(values, {
      onSuccess: (session) => {
        toast.success(INVITE_MESSAGES.welcome(session.user.name));
        void navigate('/', { replace: true });
      },
      onError,
    });
  });

  return (
    <AuthLayout
      title="Aceitar convite"
      description={`Crie sua conta para entrar na equipe como ${ROLE_TEXT[invite.role]}. O convite vale até ${formatShortDate(invite.expiresAt)}.`}
      footer={
        <p className="text-muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      }
    >
      <title>Aceitar convite · Ronin</title>
      <form noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormAlert
          message={
            formError ??
            (isSubmitted && fieldErrorCount > 0 ? fixFieldsMessage(fieldErrorCount) : null)
          }
        />
        <div className="flex flex-col gap-4">
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
            readOnly={invite.email !== null}
            hint={invite.email !== null ? 'Este convite é para este e-mail.' : undefined}
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
          <Button
            type="submit"
            loading={accept.isPending}
            loadingText="Criando conta…"
            className="w-full"
          >
            Criar conta
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
