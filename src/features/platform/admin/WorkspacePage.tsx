import {
  timezoneSchema,
  workspaceNameSchema,
  type UpdateWorkspaceRequest,
  type Workspace,
} from '@raphasparda/ronin-shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '../../../components/ui/Button';
import { FormAlert } from '../../../components/ui/FormAlert';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { toast } from '../../../components/ui/toast-store';
import { isApiError } from '../../../lib/api-client';
import { isGloballyHandled, serverMessage } from '../../../lib/api-errors';
import { schemaResolver, splitErrorDetails } from '../../../lib/form-errors';
import { getTimezoneOptions } from '../../../lib/timezones';
import { useSession } from '../auth/auth-api';
import { useUpdateWorkspace } from './admin-api';

export const WORKSPACE_MESSAGES = { saved: 'Dados da equipe atualizados.' } as const;

const workspaceFormSchema = z.object({ name: workspaceNameSchema, timezone: timezoneSchema });

type WorkspaceFormValues = z.input<typeof workspaceFormSchema>;

const resolver = schemaResolver(workspaceFormSchema, {
  name: {
    too_small: 'Informe o nome da equipe.',
    too_big: 'O nome da equipe pode ter no máximo 100 caracteres.',
  },
  timezone: { custom: 'Escolha um fuso horário da lista.' },
});

const FIELDS = ['name', 'timezone'] as const;

function WorkspaceForm({ workspace }: { workspace: Workspace }) {
  const update = useUpdateWorkspace();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<WorkspaceFormValues, unknown, Workspace>({ resolver, defaultValues: workspace });

  const onSubmit = handleSubmit((values) => {
    const body: UpdateWorkspaceRequest = {};
    if (values.name !== workspace.name) body.name = values.name;
    if (values.timezone !== workspace.timezone) body.timezone = values.timezone;
    if (body.name === undefined && body.timezone === undefined) {
      reset(values);
      return;
    }
    setFormError(null);
    update.mutate(body, {
      onSuccess: ({ workspace: saved }) => {
        reset(saved);
        toast.success(WORKSPACE_MESSAGES.saved);
      },
      onError: (error) => {
        if (isApiError(error) && error.code === 'VALIDATION_ERROR') {
          const { fieldErrors, other } = splitErrorDetails(error.details, FIELDS);
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

  return (
    <form
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm md:p-6"
    >
      <FormAlert message={formError} />
      <Input
        label="Nome da equipe"
        autoComplete="organization"
        maxLength={100}
        error={errors.name?.message}
        {...register('name')}
      />
      <Select
        label="Fuso horário"
        hint="Prazos e o agrupamento de Meus cards usam este fuso."
        options={getTimezoneOptions()}
        error={errors.timezone?.message}
        {...register('timezone')}
      />
      <Button
        type="submit"
        loading={update.isPending}
        loadingText="Salvando…"
        disabled={!isDirty}
        className="self-end"
      >
        Salvar
      </Button>
    </form>
  );
}

export function WorkspacePage() {
  const workspace = useSession({ enabled: false }).data?.workspace;

  return (
    <section aria-labelledby="equipe-titulo" className="flex flex-col gap-4">
      <title>Equipe · Administração · Ronin</title>
      <h2 id="equipe-titulo" className="text-lg">
        Equipe
      </h2>
      {workspace && <WorkspaceForm workspace={workspace} />}
    </section>
  );
}
