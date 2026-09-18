import {
  labelNameSchema,
  nextPaletteColor,
  normalizeSearchText,
  type BoardPayload,
  type Label,
  type PaletteColor,
} from '@raphasparda/ronin-shared';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import { Button } from '../../../../components/ui/Button';
import { ColorSwatchPicker } from '../../../../components/ui/ColorSwatchPicker';
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog';
import { Dialog } from '../../../../components/ui/Dialog';
import { Input } from '../../../../components/ui/Input';
import { LabelPill } from '../../../../components/ui/LabelPill';
import { toast } from '../../../../components/ui/toast-store';
import { useBoardErrorHandler } from './board-errors';
import { isDuplicateLabelName, useCreateLabel, useDeleteLabel, useUpdateLabel } from './labels-api';

export const LABEL_MESSAGES = {
  empty: 'Dê um nome à etiqueta.',
  tooLong: 'O nome da etiqueta pode ter no máximo 50 caracteres.',
  duplicate: 'Já existe uma etiqueta com este nome neste quadro.',
  created: (name: string) => `Etiqueta ${name} criada.`,
  updated: (name: string) => `Etiqueta ${name} atualizada.`,
  deleted: (name: string) => `Etiqueta ${name} excluída.`,
  createFailed: 'Não foi possível criar a etiqueta. Tente de novo.',
  updateFailed: 'Não foi possível salvar a etiqueta. Tente de novo.',
  deleteFailed: 'Não foi possível excluir a etiqueta. Tente de novo.',
  noLabels: 'Este quadro ainda não tem etiquetas.',
} as const;

const cardsCount = (count: number) => (count === 1 ? '1 card' : `${count} cards`);

interface LabelFormProps {
  labels: readonly Label[];
  initial: { name: string; color: PaletteColor };
  exceptId?: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (name: string, color: PaletteColor) => void;
  onCancel: () => void;
}

function LabelForm({
  labels,
  initial,
  exceptId,
  submitLabel,
  pending,
  onSubmit,
  onCancel,
}: LabelFormProps) {
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [error, setError] = useState<string | undefined>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const parsed = labelNameSchema.safeParse(name);
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.code === 'too_big' ? LABEL_MESSAGES.tooLong : LABEL_MESSAGES.empty,
      );
      return;
    }
    if (isDuplicateLabelName(labels, parsed.data, exceptId)) {
      setError(LABEL_MESSAGES.duplicate);
      return;
    }
    onSubmit(parsed.data, color);
  };

  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onCancel();
        }
      }}
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface-sunken p-3"
    >
      <Input
        label="Nome da etiqueta"
        value={name}
        maxLength={50}
        autoComplete="off"
        error={error}
        onChange={(event) => {
          setName(event.target.value);
          setError(undefined);
        }}
      />
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">Cor</legend>
        <ColorSwatchPicker label="Cor da etiqueta" value={color} onChange={setColor} size="sm" />
      </fieldset>
      <p className="flex items-center gap-2 text-muted">
        Prévia:
        <LabelPill label={{ name: name.trim() || 'Etiqueta', color }} />
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" loading={pending} loadingText="Salvando…">
          {submitLabel}
        </Button>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export interface LabelsDialogCard {
  labelIds: readonly string[];
  onToggle: (label: Label, applied: boolean) => void;
}

interface LabelsDialogProps {
  open: boolean;
  payload: BoardPayload;
  readOnly: boolean;
  /** Aberto a partir de um card: cada etiqueta ganha uma caixa para aplicar/remover. */
  card?: LabelsDialogCard;
  onClose: () => void;
}

/** "Etiquetas…" (screens §7.7 e §8.7): aplicar ao card, criar, renomear, trocar cor e excluir. */
export function LabelsDialog({ open, payload, readOnly, card, onClose }: LabelsDialogProps) {
  const boardId = payload.board.id;
  const labels = payload.labels;
  const createLabel = useCreateLabel(boardId);
  const updateLabel = useUpdateLabel(boardId);
  const deleteLabel = useDeleteLabel(boardId);
  const handleError = useBoardErrorHandler(boardId);

  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Label | null>(null);

  const usage = (labelId: string) =>
    payload.cards.filter((item) => item.labelIds.includes(labelId)).length;
  const search = normalizeSearchText(query);
  const visible = search
    ? labels.filter((label) => normalizeSearchText(label.name).includes(search))
    : labels;

  const close = () => {
    setEditingId(null);
    setCreating(false);
    setQuery('');
    onClose();
  };

  const create = (name: string, color: PaletteColor) =>
    createLabel.mutate(
      { name, color },
      {
        onSuccess: ({ label }) => {
          setCreating(false);
          toast.success(LABEL_MESSAGES.created(label.name));
          card?.onToggle(label, true);
        },
        onError: (error) => handleError(error, LABEL_MESSAGES.createFailed),
      },
    );

  const update = (label: Label, name: string, color: PaletteColor) => {
    setEditingId(null);
    if (name === label.name && color === label.color) return;
    updateLabel.mutate(
      {
        labelId: label.id,
        changes: {
          ...(name !== label.name && { name }),
          ...(color !== label.color && { color }),
        },
      },
      {
        onSuccess: () => toast.success(LABEL_MESSAGES.updated(name)),
        onError: (error) => handleError(error, LABEL_MESSAGES.updateFailed),
      },
    );
  };

  const remove = (label: Label) => {
    setConfirmDelete(null);
    deleteLabel.mutate(label.id, {
      onSuccess: () => toast.success(LABEL_MESSAGES.deleted(label.name)),
      onError: (error) => handleError(error, LABEL_MESSAGES.deleteFailed),
    });
  };

  const deleting = confirmDelete ? usage(confirmDelete.id) : 0;

  return (
    <>
      <Dialog
        open={open}
        title={card ? 'Etiquetas do card' : 'Etiquetas do quadro'}
        size="md"
        onClose={close}
        footer={<Button onClick={close}>Concluir</Button>}
      >
        {labels.length > 5 && (
          <Input
            label="Buscar etiqueta"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}

        {labels.length === 0 ? (
          <p className="text-muted">{LABEL_MESSAGES.noLabels}</p>
        ) : visible.length === 0 ? (
          <p className="text-muted">Nenhuma etiqueta encontrada.</p>
        ) : (
          <ul aria-label="Etiquetas" className="flex flex-col gap-1">
            {visible.map((label) => {
              const applied = card?.labelIds.includes(label.id) ?? false;
              if (editingId === label.id) {
                return (
                  <li key={label.id}>
                    <LabelForm
                      labels={labels}
                      exceptId={label.id}
                      initial={label}
                      submitLabel="Salvar etiqueta"
                      pending={false}
                      onSubmit={(name, color) => update(label, name, color)}
                      onCancel={() => setEditingId(null)}
                    />
                  </li>
                );
              }
              return (
                <li
                  key={label.id}
                  className="flex min-h-10 items-center gap-2 rounded-md px-1 hover:bg-hover"
                >
                  {card ? (
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={applied}
                        disabled={readOnly}
                        onChange={() => card.onToggle(label, !applied)}
                        className="size-4 shrink-0 accent-(--color-accent)"
                      />
                      <LabelPill label={label} />
                    </label>
                  ) : (
                    <span className="flex min-w-0 flex-1 items-center py-1">
                      <LabelPill label={label} />
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted">{cardsCount(usage(label.id))}</span>
                  {!readOnly && (
                    <>
                      <button
                        type="button"
                        aria-label={`Editar etiqueta ${label.name}`}
                        title="Editar"
                        onClick={() => {
                          setCreating(false);
                          setEditingId(label.id);
                        }}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-text md:size-8"
                      >
                        <Pencil aria-hidden size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir etiqueta ${label.name}`}
                        title="Excluir"
                        onClick={() => setConfirmDelete(label)}
                        className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted hover:bg-surface-sunken hover:text-danger md:size-8"
                      >
                        <Trash2 aria-hidden size={16} />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {!readOnly &&
          (creating ? (
            <LabelForm
              labels={labels}
              initial={{ name: '', color: nextPaletteColor(labels.at(-1)?.color ?? null) }}
              submitLabel="Criar etiqueta"
              pending={createLabel.isPending}
              onSubmit={create}
              onCancel={() => setCreating(false)}
            />
          ) : (
            <Button
              variant="secondary"
              icon={<Plus size={16} />}
              className="self-start"
              onClick={() => {
                setEditingId(null);
                setCreating(true);
              }}
            >
              Criar etiqueta
            </Button>
          ))}
      </Dialog>

      <ConfirmDialog
        open={confirmDelete !== null}
        tone="danger"
        title={`Excluir a etiqueta "${confirmDelete?.name ?? ''}"?`}
        description={
          <p>
            {deleting === 0
              ? 'Nenhum card deste quadro usa esta etiqueta.'
              : `Ela será removida de ${cardsCount(deleting)} deste quadro.`}{' '}
            Não dá para desfazer.
          </p>
        }
        confirmLabel="Excluir etiqueta"
        onConfirm={() => confirmDelete && remove(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </>
  );
}
