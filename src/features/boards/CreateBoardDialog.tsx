import { createBoardRequestSchema, type CreateBoardRequest } from '@raphasparda/ronin-shared';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import type { z } from 'zod';

import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { FormAlert } from '../../components/ui/FormAlert';
import { Input } from '../../components/ui/Input';
import { isApiError } from '../../lib/api-client';
import { isGloballyHandled, serverMessage } from '../../lib/api-errors';
import { schemaResolver, splitErrorDetails } from '../../lib/form-errors';
import { useCreateBoard } from './boards-api';

type FormValues = z.input<typeof createBoardRequestSchema>;

export const BOARD_NAME_MESSAGES = {
  too_small: 'Dê um nome ao quadro.',
  too_big: 'O nome do quadro pode ter no máximo 100 caracteres.',
} as const;

const resolver = schemaResolver(createBoardRequestSchema, { name: BOARD_NAME_MESSAGES });

export function CreateBoardDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createBoard = useCreateBoard();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const formId = useId();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues, unknown, CreateBoardRequest>({ resolver, defaultValues: { name: '' } });

  const close = () => {
    reset();
    setFormError(null);
    onClose();
  };

  const onSubmit = handleSubmit(({ name }) => {
    setFormError(null);
    createBoard.mutate(name, {
      onSuccess: ({ board }) => {
        reset();
        onClose();
        void navigate(`/b/${board.id}`);
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
        if (!isGloballyHandled(error)) setFormError(serverMessage(error));
      },
    });
  });

  return (
    <Dialog
      open={open}
      title="Novo quadro"
      onClose={close}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={createBoard.isPending}
            loadingText="Criando…"
          >
            Criar quadro
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={(event) => void onSubmit(event)}>
        <FormAlert message={formError} />
        <Input
          label="Nome do quadro"
          maxLength={100}
          autoComplete="off"
          hint="Ele já vem com as listas A fazer, Fazendo e Concluído."
          error={errors.name?.message}
          {...register('name')}
        />
      </form>
    </Dialog>
  );
}
